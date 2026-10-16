"""Ночной сброс демо-стенда: стирает всё и заливает сид, но только при DEMO_MODE."""

from sqlalchemy import func, select

from app import demo_reset
from app.config import get_settings
from app.models import Course, Enrollment, Profile
from app.seed import seed


def _count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_reset_removes_visitor_data_and_restores_seed(db, tmp_path):
    seed(db)
    courses_before = _count(db, Course)
    visitor = Profile(email="demo-abc@demo.local", full_name="Демо-студент", role="student")
    db.add(visitor)
    db.flush()
    db.add(Enrollment(user_id=visitor.id, course_id=db.scalar(select(Course.id).limit(1))))
    db.commit()

    demo_reset.reset_demo(db, tmp_path)

    assert db.scalar(select(Profile).where(Profile.email == "demo-abc@demo.local")) is None
    assert _count(db, Enrollment) == 0
    assert _count(db, Course) == courses_before


def test_reset_deletes_only_files_inside_the_upload_dir(db, tmp_path):
    (tmp_path / "a.pdf").write_bytes(b"x")
    nested = tmp_path / "keep"
    nested.mkdir()
    (nested / "b.txt").write_bytes(b"y")
    outside = tmp_path.parent / f"{tmp_path.name}-outside.txt"
    outside.write_bytes(b"z")

    removed = demo_reset.wipe_uploads(tmp_path)

    assert removed == 1
    assert not (tmp_path / "a.pdf").exists()
    assert (nested / "b.txt").exists()
    assert outside.exists()


def test_main_refuses_without_demo_mode(db, monkeypatch, capsys):
    seed(db)
    monkeypatch.setattr(get_settings(), "DEMO_MODE", False)

    code = demo_reset.main()

    assert code == demo_reset.EXIT_NOT_DEMO
    assert "DEMO_MODE" in capsys.readouterr().err
    assert _count(db, Course) > 0
