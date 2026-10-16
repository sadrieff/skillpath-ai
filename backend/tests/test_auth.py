"""Auth: dev login gating, role rules, /auth/me and the Google OAuth flow (client faked, no network)."""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from authlib.integrations.base_client import OAuthError
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Profile
from app.routers import auth as auth_router
from app.security import decode_access_token

DEV_LOGIN = "/api/auth/dev-login"
ME = "/api/auth/me"
GOOGLE_LOGIN = "/api/auth/google/login"
GOOGLE_CALLBACK = "/api/auth/google/callback"


@pytest.fixture
def settings():
    return get_settings()


# --- dev login ----------------------------------------------------------------


def test_dev_login_disabled_returns_404(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", False)
    response = client.post(DEV_LOGIN, json={"email": "anna@example.com"})
    assert response.status_code == 404


def test_dev_login_disabled_hides_body_validation(client, settings, monkeypatch):
    # The 404 must win over body validation, so a disabled endpoint reveals nothing.
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", False)
    assert client.post(DEV_LOGIN, json={"email": "not-an-email"}).status_code == 404
    assert client.post(DEV_LOGIN, json={}).status_code == 404


def test_dev_login_creates_student_and_token_works(client, db, settings, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")

    response = client.post(DEV_LOGIN, json={"email": "Anna@Example.com", "full_name": "Анна"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "anna@example.com"
    assert body["user"]["full_name"] == "Анна"
    assert body["user"]["role"] == "student"
    assert decode_access_token(body["access_token"]) == body["user"]["id"]

    me = client.get(ME, headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "anna@example.com"


def test_dev_login_upserts_same_profile(client, db, settings, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")

    first = client.post(DEV_LOGIN, json={"email": "repeat@example.com"}).json()
    second = client.post(DEV_LOGIN, json={"email": "repeat@example.com", "full_name": "Имя"}).json()

    assert first["user"]["id"] == second["user"]["id"]
    assert second["user"]["full_name"] == "Имя"
    count = db.scalar(select(func.count(Profile.id)).where(Profile.email == "repeat@example.com"))
    assert count == 1


def test_dev_login_body_cannot_choose_role(client, db, settings, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")

    response = client.post(
        DEV_LOGIN, json={"email": "sneaky@example.com", "role": "admin", "is_admin": True}
    )

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "student"
    stored = db.scalar(select(Profile).where(Profile.email == "sneaky@example.com"))
    assert stored.role == "student"


def test_dev_login_admin_email_gets_admin_role(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "boss@example.com, Other@Example.com")

    boss = client.post(DEV_LOGIN, json={"email": "BOSS@example.com"}).json()
    other = client.post(DEV_LOGIN, json={"email": "other@example.com"}).json()
    plain = client.post(DEV_LOGIN, json={"email": "plain@example.com"}).json()

    assert boss["user"]["role"] == "admin"
    assert other["user"]["role"] == "admin"
    assert plain["user"]["role"] == "student"


def test_dev_login_never_downgrades_existing_admin(client, db, make_user, settings, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")
    make_user(role="admin", email="seeded-admin@example.com")

    response = client.post(DEV_LOGIN, json={"email": "seeded-admin@example.com"})

    assert response.json()["user"]["role"] == "admin"


@pytest.mark.parametrize("email", ["", "no-at-sign", "a@nodot", "@example.com", "x@"])
def test_dev_login_rejects_invalid_email(client, settings, monkeypatch, email):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)
    response = client.post(DEV_LOGIN, json={"email": email})
    assert response.status_code == 422


# --- /auth/me -----------------------------------------------------------------


def test_me_requires_token(client):
    response = client.get(ME)
    assert response.status_code == 401
    assert response.headers.get("www-authenticate") == "Bearer"


def test_me_rejects_garbage_token(client):
    response = client.get(ME, headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_me_returns_user_shape(client, make_user):
    user, headers = make_user(role="student", email="shape@example.com", full_name="Пётр")

    response = client.get(ME, headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "email": "shape@example.com",
        "full_name": "Пётр",
        "avatar_url": None,
        "role": "student",
    }


# --- Google OAuth -------------------------------------------------------------


class FakeGoogleClient:
    """Stands in for the authlib Google client so the flow runs without network access."""

    def __init__(self, userinfo=None, error=False):
        self.userinfo_payload = userinfo
        self.error = error
        self.redirect_args = None

    async def authorize_redirect(self, request, redirect_uri):
        self.redirect_args = redirect_uri
        return RedirectResponse(url="https://accounts.google.com/o/oauth2/v2/auth?client_id=fake")

    async def authorize_access_token(self, request):
        if self.error:
            raise OAuthError(error="access_denied")
        return {"userinfo": self.userinfo_payload}

    async def userinfo(self, token):  # pragma: no cover - only used when id_token has no userinfo
        return self.userinfo_payload


@pytest.fixture
def google_configured(settings, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setattr(settings, "BACKEND_URL", "http://api.test")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://web.test/")
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")


def _use_fake_google(monkeypatch, fake: FakeGoogleClient) -> None:
    monkeypatch.setattr(auth_router, "_google_client", lambda settings: fake)


def test_google_login_503_when_not_configured(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    response = client.get(GOOGLE_LOGIN, follow_redirects=False)
    assert response.status_code == 503


def test_google_callback_503_when_not_configured(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    response = client.get(GOOGLE_CALLBACK, follow_redirects=False)
    assert response.status_code == 503


def test_google_login_redirects_with_backend_callback_uri(client, google_configured, monkeypatch):
    fake = FakeGoogleClient()
    _use_fake_google(monkeypatch, fake)

    response = client.get(GOOGLE_LOGIN, follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"].startswith("https://accounts.google.com/")
    assert fake.redirect_args == "http://api.test/api/auth/google/callback"


def test_google_callback_creates_student_and_redirects_with_token(
    client, db, google_configured, monkeypatch
):
    _use_fake_google(
        monkeypatch,
        FakeGoogleClient(
            {
                "sub": "google-sub-1",
                "email": "New.Person@Gmail.com",
                "email_verified": True,
                "name": "New Person",
                "picture": "http://img.test/a.png",
            }
        ),
    )

    response = client.get(GOOGLE_CALLBACK, follow_redirects=False)

    assert response.status_code == 302
    location = urlparse(response.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == "http://web.test/auth/callback"
    token = parse_qs(location.query)["token"][0]
    user_id = decode_access_token(token)
    profile = db.get(Profile, user_id)
    assert profile.email == "new.person@gmail.com"
    assert profile.google_sub == "google-sub-1"
    assert profile.role == "student"
    assert profile.avatar_url == "http://img.test/a.png"


def test_google_callback_links_existing_email_without_duplicate(
    client, db, make_user, google_configured, monkeypatch
):
    existing, _ = make_user(role="student", email="linked@example.com")
    _use_fake_google(
        monkeypatch,
        FakeGoogleClient({"sub": "sub-linked", "email": "linked@example.com", "email_verified": True}),
    )

    response = client.get(GOOGLE_CALLBACK, follow_redirects=False)

    assert response.status_code == 302
    db.expire_all()
    assert db.scalar(select(func.count(Profile.id)).where(Profile.email == "linked@example.com")) == 1
    assert db.get(Profile, existing.id).google_sub == "sub-linked"


def test_google_callback_admin_email_gets_admin_role(client, db, google_configured, monkeypatch, settings):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "root@example.com")
    _use_fake_google(
        monkeypatch,
        FakeGoogleClient({"sub": "sub-root", "email": "root@example.com", "email_verified": True}),
    )

    response = client.get(GOOGLE_CALLBACK, follow_redirects=False)

    token = parse_qs(urlparse(response.headers["location"]).query)["token"][0]
    assert db.get(Profile, decode_access_token(token)).role == "admin"


def test_google_callback_rejects_unverified_email(client, db, google_configured, monkeypatch):
    _use_fake_google(
        monkeypatch,
        FakeGoogleClient({"sub": "sub-x", "email": "unverified@example.com", "email_verified": False}),
    )

    response = client.get(GOOGLE_CALLBACK, follow_redirects=False)

    assert response.status_code == 403
    assert db.scalar(select(func.count(Profile.id)).where(Profile.email == "unverified@example.com")) == 0


def test_google_callback_maps_oauth_error_to_400(client, google_configured, monkeypatch):
    _use_fake_google(monkeypatch, FakeGoogleClient(error=True))
    response = client.get(GOOGLE_CALLBACK, follow_redirects=False)
    assert response.status_code == 400


def test_upsert_google_profile_keeps_existing_admin_role(db, make_user, settings, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")
    make_user(role="admin", email="kept@example.com")

    profile = auth_router.upsert_google_profile(
        db,
        sub="sub-kept",
        email="kept@example.com",
        name=None,
        picture=None,
        settings=settings,
    )

    assert profile.role == "admin"
    assert profile.google_sub == "sub-kept"


def test_upsert_google_profile_creates_new_profile(db: Session, settings, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")
    profile = auth_router.upsert_google_profile(
        db, sub="sub-new", email="fresh@example.com", name="Fresh", picture=None, settings=settings
    )
    assert profile.id is not None
    assert profile.full_name == "Fresh"


def test_providers_reflect_configuration(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    assert client.get("/api/auth/providers").json() == {"google": False, "demo": True}

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    assert client.get("/api/auth/providers").json() == {"google": True, "demo": False}
