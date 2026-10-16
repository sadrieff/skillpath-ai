"""Authentication: Google OAuth2 (authlib + OpenID discovery), dev login and the current user."""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

from authlib.integrations.base_client import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.deps import CurrentUser, DbSession
from app.models import Profile
from app.schemas import DevLoginIn, TokenOut, UserOut
from app.security import create_access_token

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
GOOGLE_SCOPE = "openid email profile"

router = APIRouter(prefix="/auth", tags=["auth"])

# One authlib client per (client id, secret) pair: the discovery document is fetched once.
_google_clients: dict[tuple[str, str], Any] = {}


def _require_google_configured(settings: Settings) -> None:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured",
        )


def _google_client(settings: Settings) -> Any:
    key = (settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET)
    client = _google_clients.get(key)
    if client is None:
        oauth = OAuth()
        oauth.register(
            name="google",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            server_metadata_url=GOOGLE_DISCOVERY_URL,
            client_kwargs={"scope": GOOGLE_SCOPE},
        )
        client = oauth.create_client("google")
        _google_clients[key] = client
    return client


def _redirect_uri(settings: Settings) -> str:
    return f"{settings.BACKEND_URL.rstrip('/')}/api/auth/google/callback"


def _apply_admin_role(profile: Profile, email: str, settings: Settings) -> None:
    """ADMIN_EMAILS grants admin on login. Nothing ever downgrades an existing role here."""
    if email in settings.admin_emails_set:
        profile.role = "admin"


def upsert_google_profile(
    db: Session,
    *,
    sub: str,
    email: str,
    name: str | None,
    picture: str | None,
    settings: Settings,
) -> Profile:
    """Create or update the profile for a verified Google account (matched by google_sub, then email)."""
    email = email.strip().lower()
    profile = db.scalar(select(Profile).where(Profile.google_sub == sub))
    if profile is None:
        profile = db.scalar(select(Profile).where(Profile.email == email))
    if profile is None:
        profile = Profile(
            email=email,
            full_name=name or email.split("@", 1)[0],
            avatar_url=picture,
            google_sub=sub,
            role="student",
        )
        db.add(profile)
    else:
        profile.google_sub = sub
        if name and not profile.full_name:
            profile.full_name = name
        profile.avatar_url = picture or profile.avatar_url
        if profile.email != email:
            taken = db.scalar(select(Profile.id).where(Profile.email == email))
            if taken is None:
                profile.email = email
    _apply_admin_role(profile, email, settings)
    db.commit()
    db.refresh(profile)
    return profile


def _token_response(profile: Profile) -> TokenOut:
    return TokenOut(access_token=create_access_token(profile.id), user=UserOut.model_validate(profile))


def _require_dev_login() -> None:
    """Dependency (runs before body validation) so the endpoint is a plain 404 when disabled."""
    if not get_settings().ENABLE_DEV_LOGIN:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.get("/google/login")
async def google_login(request: Request) -> RedirectResponse:
    settings = get_settings()
    _require_google_configured(settings)
    client = _google_client(settings)
    # authlib answers with 307; the contract says 302. Its state cookie stays on the response.
    response = await client.authorize_redirect(request, _redirect_uri(settings))
    response.status_code = status.HTTP_302_FOUND
    return response


@router.get("/google/callback")
async def google_callback(request: Request, db: DbSession) -> RedirectResponse:
    settings = get_settings()
    _require_google_configured(settings)
    client = _google_client(settings)
    try:
        token = await client.authorize_access_token(request)
    except OAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google sign-in failed") from exc

    userinfo = token.get("userinfo") or await client.userinfo(token=token)
    sub = userinfo.get("sub")
    email = userinfo.get("email")
    if not sub or not email or userinfo.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google account has no verified email",
        )

    profile = upsert_google_profile(
        db,
        sub=str(sub),
        email=str(email),
        name=userinfo.get("name"),
        picture=userinfo.get("picture"),
        settings=settings,
    )
    jwt_token = create_access_token(profile.id)
    target = f"{settings.FRONTEND_URL.rstrip('/')}/auth/callback?token={quote(jwt_token)}"
    return RedirectResponse(url=target, status_code=status.HTTP_302_FOUND)


@router.post("/dev-login", response_model=TokenOut, dependencies=[Depends(_require_dev_login)])
def dev_login(body: DevLoginIn, db: DbSession) -> TokenOut:
    """Demo/test login by email. The request body can never choose the role."""
    settings = get_settings()
    profile = db.scalar(select(Profile).where(Profile.email == body.email))
    if profile is None:
        profile = Profile(
            email=body.email,
            full_name=body.full_name or body.email.split("@", 1)[0],
            role="student",
        )
        db.add(profile)
    elif body.full_name:
        profile.full_name = body.full_name
    _apply_admin_role(profile, body.email, settings)
    db.commit()
    db.refresh(profile)
    return _token_response(profile)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
