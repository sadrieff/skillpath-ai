"""Core sanity tests: health, JWT, seed idempotency, migrations vs models."""
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
from alembic.config import Config
from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.orm import Session

from alembic import command
from app.models import Base, Course, Lesson, Module, Profile, Question, Quiz
from app.security import ALGORITHM, create_access_token, decode_access_token

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_token_roundtrip():
    token = create_access_token(42)
    assert isinstance(token, str)
    assert decode_access_token(token) == 42


def test_decode_rejects_garbage_and_wrong_secret():
    assert decode_access_token("not-a-jwt") is None
    forged = jwt.encode(
        {"sub": "1", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "some-other-secret",
        algorithm=ALGORITHM,
    )
    assert decode_access_token(forged) is None


def test_decode_rejects_expired_token():
    from app.config import get_settings

    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        get_settings().JWT_SECRET,
        algorithm=ALGORITHM,
    )
    assert decode_access_token(expired) is None


def test_seed_is_idempotent(db: Session):
    from app.seed import seed

    first = seed(db)
    second = seed(db)

    assert first["courses"] == 3
    assert second == {"profiles": 0, "courses": 0}

    assert db.scalar(select(func.count(Profile.id)).where(Profile.role == "admin")) == 1
    assert db.scalar(select(func.count(Course.id))) == 3
    assert db.scalar(select(func.count(Module.id))) == 6
    assert db.scalar(select(func.count(Lesson.id))) == 12
    assert db.scalar(select(func.count(Quiz.id))) >= 4
    assert db.scalar(select(func.count(Question.id))) == 3 * db.scalar(select(func.count(Quiz.id)))


def test_seed_content_is_russian_and_substantial(db: Session):
    from app.seed import seed

    seed(db)
    for lesson in db.scalars(select(Lesson)):
        assert len(lesson.content.split()) >= 100, lesson.title
        assert any("а" <= ch.lower() <= "я" for ch in lesson.content)


def test_seeded_quiz_questions_are_valid(db: Session):
    from app.seed import seed

    seed(db)
    for question in db.scalars(select(Question)):
        assert len(question.options) == 4
        assert 0 <= question.correct_index < len(question.options)
        assert question.explanation


def test_migrations_match_models(tmp_path: Path):
    db_file = tmp_path / "migration_check.db"
    url = f"sqlite:///{db_file.as_posix()}"
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", url)

    command.upgrade(config, "head")

    engine = create_engine(url)
    try:
        migrated = set(inspect(engine).get_table_names()) - {"alembic_version"}
    finally:
        engine.dispose()

    assert migrated == set(Base.metadata.tables.keys())
    assert len(migrated) == 10


def test_migration_downgrade_and_upgrade(tmp_path: Path):
    db_file = tmp_path / "migration_roundtrip.db"
    url = f"sqlite:///{db_file.as_posix()}"
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", url)

    command.upgrade(config, "head")
    command.downgrade(config, "base")

    engine = create_engine(url)
    try:
        remaining = set(inspect(engine).get_table_names()) - {"alembic_version"}
    finally:
        engine.dispose()
    assert remaining == set()

    command.upgrade(config, "head")

