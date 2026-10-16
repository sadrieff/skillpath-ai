"""Public test stand: POST /api/auth/demo-login, the per-IP limit and the global daily AI cap."""

import re
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import demo
from app.config import Settings, get_settings
from app.models import AiMessage, Course, Enrollment, Lesson, Module, Profile
from app.services import ai_client

DEMO_LOGIN_URL = "/api/auth/demo-login"
TUTOR_URL = "/api/ai/tutor"
STUDENT_EMAIL_RE = re.compile(r"^demo-[0-9a-f]{8}@demo\.local$")


@pytest.fixture
def settings():
    return get_settings()


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    demo.reset_demo_rate_limit()
    yield
    demo.reset_demo_rate_limit()


@pytest.fixture
def demo_on(settings, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "DEMO_RATE_PER_HOUR", 20)
    monkeypatch.setattr(settings, "AI_DAILY_LIMIT", 0)
    monkeypatch.setattr(settings, "DEMO_AI_PER_USER", 0)
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")
    return settings


@pytest.fixture
def two_courses(db: Session) -> list[int]:
    ids = []
    for title in ("Курс А", "Курс Б"):
        course = Course(title=title, description="", category="Python", level="beginner", duration_hours=1)
        db.add(course)
        db.flush()
        ids.append(course.id)
    db.commit()
    return ids


@pytest.fixture
def tutor_ctx(db: Session, make_user, monkeypatch) -> dict:
    course = Course(title="Python", description="", category="Python", level="beginner", duration_hours=1)
    db.add(course)
    db.flush()
    module = Module(course_id=course.id, title="Модуль", position=1)
    db.add(module)
    db.flush()
    lesson = Lesson(module_id=module.id, title="Урок", content="# Урок", position=1)
    db.add(lesson)
    db.commit()
    _, admin_headers = make_user("admin")

    calls: list = []

    async def _fake(messages, **_kwargs):
        calls.append(messages)
        return "Ответ наставника"

    monkeypatch.setattr(ai_client, "chat", _fake)
    return {"lesson_id": lesson.id, "admin_headers": admin_headers, "calls": calls}


def _login(client, role: str, ip: str | None = None):
    headers = {"X-Forwarded-For": ip} if ip else {}
    return client.post(DEMO_LOGIN_URL, json={"role": role}, headers=headers)


# --- switch -------------------------------------------------------------------


def test_demo_login_is_off_by_default():
    assert Settings(_env_file=None).DEMO_MODE is False
    assert Settings(_env_file=None).AI_DAILY_LIMIT == 0
    assert Settings(_env_file=None).DEMO_RATE_PER_HOUR == 20


def test_demo_login_disabled_returns_404(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    assert _login(client, "student").status_code == 404


def test_demo_login_disabled_hides_body_validation(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    response = client.post(DEMO_LOGIN_URL, json={"role": "root"})
    assert response.status_code == 404


# --- accounts -----------------------------------------------------------------


def test_student_gets_a_fresh_account_each_time(client, db, demo_on, two_courses):
    first = _login(client, "student")
    second = _login(client, "student")
    assert first.status_code == 200 and second.status_code == 200

    user_a = first.json()["user"]
    user_b = second.json()["user"]
    assert user_a["id"] != user_b["id"]
    assert user_a["email"] != user_b["email"]
    assert STUDENT_EMAIL_RE.match(user_a["email"])
    assert user_a["role"] == "student"
    assert user_a["full_name"] == "Демо-студент"

    token_headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=token_headers).json()["id"] == user_a["id"]


def test_student_is_enrolled_in_all_existing_courses(client, db, demo_on, two_courses):
    user_id = _login(client, "student").json()["user"]["id"]
    enrolled = set(db.scalars(select(Enrollment.course_id).where(Enrollment.user_id == user_id)).all())
    assert enrolled == set(two_courses)


def test_admin_is_one_shared_profile(client, db, demo_on):
    first = _login(client, "admin").json()
    second = _login(client, "admin").json()

    assert first["user"]["id"] == second["user"]["id"]
    assert first["user"]["email"] == "demo-admin@demo.local"
    assert first["user"]["role"] == "admin"
    assert first["user"]["full_name"] == "Демо-админ"
    assert db.scalar(select(func.count(Profile.id)).where(Profile.email == "demo-admin@demo.local")) == 1


def test_demo_admin_can_open_admin_stats(client, demo_on):
    token = _login(client, "admin").json()["access_token"]
    response = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_demo_student_cannot_open_admin_stats(client, demo_on):
    token = _login(client, "student").json()["access_token"]
    response = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_role_outside_enum_is_rejected(client, demo_on):
    assert client.post(DEMO_LOGIN_URL, json={"role": "root"}).status_code == 422
    assert client.post(DEMO_LOGIN_URL, json={}).status_code == 422


def test_admin_emails_do_not_grant_anything(client, demo_on, monkeypatch):
    monkeypatch.setattr(demo_on, "ADMIN_EMAILS", "boss@example.com")
    assert _login(client, "student").json()["user"]["role"] == "student"


# --- per-IP limit -------------------------------------------------------------


def test_per_ip_limit_returns_429_after_threshold(client, demo_on, monkeypatch):
    monkeypatch.setattr(demo_on, "DEMO_RATE_PER_HOUR", 3)
    for _ in range(3):
        assert _login(client, "student", ip="203.0.113.1").status_code == 200

    blocked = _login(client, "student", ip="203.0.113.1")
    assert blocked.status_code == 429
    assert "Слишком много" in blocked.json()["detail"]


def test_per_ip_limit_counts_each_forwarded_ip_separately(client, demo_on, monkeypatch):
    monkeypatch.setattr(demo_on, "DEMO_RATE_PER_HOUR", 2)
    for _ in range(2):
        assert _login(client, "admin", ip="203.0.113.1").status_code == 200
    assert _login(client, "admin", ip="203.0.113.1").status_code == 429

    assert _login(client, "admin", ip="198.51.100.7").status_code == 200


def test_first_forwarded_entry_is_the_client(client, demo_on, monkeypatch):
    monkeypatch.setattr(demo_on, "DEMO_RATE_PER_HOUR", 1)
    chained = {"X-Forwarded-For": "203.0.113.9, 10.0.0.2"}
    assert client.post(DEMO_LOGIN_URL, json={"role": "student"}, headers=chained).status_code == 200
    # Same client behind a different proxy hop: still the same first entry, so still limited.
    other_hop = {"X-Forwarded-For": "203.0.113.9, 10.0.0.7"}
    assert client.post(DEMO_LOGIN_URL, json={"role": "student"}, headers=other_hop).status_code == 429


# --- daily AI cap -------------------------------------------------------------


def _add_tutor_rows(db: Session, lesson_id: int, count: int, created_at: datetime | None = None) -> None:
    # Отдельный пользователь: иначе сработает лимит на человека, а не общий дневной.
    filler = Profile(email=f"filler-{count}-{lesson_id}@test.local", full_name="Filler", role="student")
    db.add(filler)
    db.flush()
    for _ in range(count):
        row = AiMessage(user_id=filler.id, lesson_id=lesson_id, mode="example", prompt="p", answer="a")
        if created_at is not None:
            row.created_at = created_at
        db.add(row)
    db.commit()


def _tutor(client, ctx: dict):
    payload = {"lesson_id": ctx["lesson_id"], "mode": "example"}
    return client.post(TUTOR_URL, json=payload, headers=ctx["admin_headers"])


def test_daily_cap_blocks_tutor_before_upstream(client, db, tutor_ctx, demo_on, monkeypatch):
    monkeypatch.setattr(demo_on, "AI_DAILY_LIMIT", 2)
    _add_tutor_rows(db, tutor_ctx["lesson_id"], 2)

    response = _tutor(client, tutor_ctx)
    assert response.status_code == 429
    assert response.json()["detail"] == (
        "Дневной лимит ИИ-наставника на демо-стенде исчерпан, попробуйте завтра"
    )
    assert tutor_ctx["calls"] == []


def test_daily_cap_ignores_rows_from_before_utc_midnight(client, db, tutor_ctx, demo_on, monkeypatch):
    monkeypatch.setattr(demo_on, "AI_DAILY_LIMIT", 1)
    midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    _add_tutor_rows(db, tutor_ctx["lesson_id"], 5, created_at=midnight - timedelta(minutes=1))

    assert _tutor(client, tutor_ctx).status_code == 200
    assert len(tutor_ctx["calls"]) == 1


def test_daily_cap_zero_means_off(client, db, tutor_ctx, demo_on):
    _add_tutor_rows(db, tutor_ctx["lesson_id"], 25)
    assert demo_on.AI_DAILY_LIMIT == 0

    assert _tutor(client, tutor_ctx).status_code == 200
    assert len(tutor_ctx["calls"]) == 1


def test_daily_cap_counts_all_users(client, db, tutor_ctx, demo_on, monkeypatch, make_user):
    monkeypatch.setattr(demo_on, "AI_DAILY_LIMIT", 2)
    other, other_headers = make_user("student")
    row = AiMessage(user_id=other.id, lesson_id=tutor_ctx["lesson_id"], mode="x", prompt="p", answer="a")
    db.add(row)
    db.commit()

    assert _tutor(client, tutor_ctx).status_code == 200
    assert _tutor(client, tutor_ctx).status_code == 429
    assert len(tutor_ctx["calls"]) == 1
    assert db.scalar(select(func.count(AiMessage.id))) == 2


def test_user_gets_only_two_ai_requests_in_demo(client, db, tutor_ctx, demo_on, monkeypatch):
    monkeypatch.setattr(demo_on, "DEMO_AI_PER_USER", 2)

    assert _tutor(client, tutor_ctx).status_code == 200
    assert _tutor(client, tutor_ctx).status_code == 200
    third = _tutor(client, tutor_ctx)

    assert third.status_code == 429
    assert "2 запроса" in third.json()["detail"]
    assert len(tutor_ctx["calls"]) == 2


def test_user_cap_is_per_account(client, db, tutor_ctx, demo_on, monkeypatch, make_user):
    monkeypatch.setattr(demo_on, "DEMO_AI_PER_USER", 1)
    _, other_headers = make_user("admin")

    assert _tutor(client, tutor_ctx).status_code == 200
    assert _tutor(client, tutor_ctx).status_code == 429
    other = client.post(
        TUTOR_URL, json={"lesson_id": tutor_ctx["lesson_id"], "mode": "example"}, headers=other_headers
    )
    assert other.status_code == 200


def test_user_cap_does_not_apply_outside_demo_mode(client, db, tutor_ctx, settings, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    monkeypatch.setattr(settings, "DEMO_AI_PER_USER", 1)

    assert _tutor(client, tutor_ctx).status_code == 200
    assert _tutor(client, tutor_ctx).status_code == 200
