"""Shared test fixtures.

Environment variables are set BEFORE any `app` module is imported, because settings,
the DB engine and the FastAPI app are built at import time.
"""
import os
import tempfile
import uuid

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-do-not-use-in-prod-0123456789abcdef"
os.environ["ENABLE_DEV_LOGIN"] = "true"
os.environ["ADMIN_EMAILS"] = ""
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="skillpath-test-uploads-")

from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.models import Base, Profile
from app.security import create_access_token

get_settings.cache_clear()


@pytest.fixture
def engine() -> Iterator[Engine]:
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    from app.db import get_db
    from app.main import app

    def _override_get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def make_user(db: Session) -> Callable[..., tuple[Profile, dict[str, str]]]:
    """Create a profile with the given role; returns (user, auth_headers)."""

    def _make(role: str = "student", email: str | None = None, full_name: str = "Test User"):
        user = Profile(
            email=email or f"user-{uuid.uuid4().hex[:10]}@example.com",
            full_name=full_name,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
        return user, headers

    return _make


@pytest.fixture
def seeded(db: Session) -> dict[str, int]:
    from app.seed import seed

    return seed(db)
