"""Demo accounts for the public test stand (DEMO_MODE=true): demo-login, per-IP limit, daily AI cap."""
from __future__ import annotations

import threading
import time
import uuid
from collections import deque
from datetime import UTC, datetime

from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AiMessage, Course, Enrollment, Profile

DEMO_DOMAIN = "demo.local"
DEMO_ADMIN_EMAIL = f"demo-admin@{DEMO_DOMAIN}"
DEMO_WINDOW_SECONDS = 3600

# Sliding window per client IP. The state lives in this process only: with several
# workers each one keeps its own counts, so the real limit is DEMO_RATE_PER_HOUR * workers.
_demo_hits: dict[str, deque[float]] = {}
_demo_lock = threading.Lock()


def client_ip(request: Request) -> str:
    # The app runs behind a reverse proxy that sets X-Forwarded-For. The first entry is the client.
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",", 1)[0].strip()
    if first:
        return first
    return request.client.host if request.client else "unknown"


def enforce_demo_rate_limit(ip: str, limit: int) -> None:
    now = time.monotonic()
    with _demo_lock:
        hits = _demo_hits.setdefault(ip, deque())
        while hits and now - hits[0] >= DEMO_WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много демо-входов с этого адреса, попробуйте позже",
            )
        hits.append(now)


def reset_demo_rate_limit() -> None:
    with _demo_lock:
        _demo_hits.clear()


def create_demo_student(db: Session) -> Profile:
    """A fresh student on every call, enrolled in every existing course."""
    profile = Profile(
        email=f"demo-{uuid.uuid4().hex[:8]}@{DEMO_DOMAIN}",
        full_name="Демо-студент",
        role="student",
    )
    db.add(profile)
    db.flush()
    for course_id in db.scalars(select(Course.id)).all():
        db.add(Enrollment(user_id=profile.id, course_id=course_id))
    db.commit()
    db.refresh(profile)
    return profile


def get_or_create_demo_admin(db: Session) -> Profile:
    profile = db.scalar(select(Profile).where(Profile.email == DEMO_ADMIN_EMAIL))
    if profile is None:
        profile = Profile(email=DEMO_ADMIN_EMAIL, full_name="Демо-админ", role="admin")
        db.add(profile)
    else:
        profile.role = "admin"
    db.commit()
    db.refresh(profile)
    return profile


def enforce_daily_ai_cap(db: Session) -> None:
    """Global cap on tutor calls per UTC day. Counts saved AiMessage rows, so it is checked, not reserved."""
    limit = get_settings().AI_DAILY_LIMIT
    if limit <= 0:
        return
    midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    today = db.scalar(select(func.count(AiMessage.id)).where(AiMessage.created_at >= midnight))
    if (today or 0) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Дневной лимит ИИ-наставника на демо-стенде исчерпан, попробуйте завтра",
        )
