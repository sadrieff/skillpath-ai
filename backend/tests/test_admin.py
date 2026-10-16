"""Admin API: access control, CRUD, quizzes, uploads and stats."""

import re

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Course, Enrollment, Lesson, Module, Question, Quiz, QuizAttempt

API_KEY = "sk-test-routerai-SECRET-admin-4412"
UPLOAD_NAME_RE = re.compile(
    r"^/uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png)$"
)


@pytest.fixture
def admin(make_user):
    return make_user("admin", email="boss@example.com")


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    target = tmp_path / "uploads"  # does not exist yet: the endpoint must create it
    monkeypatch.setattr(get_settings(), "UPLOAD_DIR", str(target))
    return target


def _course_payload(**overrides):
    payload = {
        "title": "Git и GitHub",
        "description": "Основы контроля версий",
        "category": "Tools",
        "level": "beginner",
        "duration_hours": 6,
    }
    payload.update(overrides)
    return payload


def _quiz_payload(**overrides):
    payload = {
        "title": "Тест",
        "questions": [
            {
                "text": "Что делает git init?",
                "options": ["Создает репозиторий", "Удаляет файлы", "Отправляет код"],
                "correct_index": 0,
                "explanation": "git init создает пустой репозиторий.",
            }
        ],
    }
    payload.update(overrides)
    return payload


# --- Access control --------------------------------------------------------------

@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/admin/courses"),
        ("post", "/api/admin/courses"),
        ("get", "/api/admin/stats"),
        ("get", "/api/admin/lessons/1/quiz"),
        ("post", "/api/admin/upload"),
    ],
)
def test_student_gets_403(client, make_user, method, path):
    _, headers = make_user("student")
    response = getattr(client, method)(path, headers=headers)
    assert response.status_code == 403


@pytest.mark.parametrize("path", ["/api/admin/courses", "/api/admin/stats"])
def test_anonymous_gets_401(client, path):
    assert client.get(path).status_code == 401


# --- Courses / modules / lessons CRUD ---------------------------------------------

def test_full_crud_flow(client, admin, db: Session):
    admin_user, headers = admin

    created = client.post("/api/admin/courses", json=_course_payload(), headers=headers)
    assert created.status_code == 201
    course = created.json()
    assert course["author_id"] == admin_user.id
    assert course["title"] == "Git и GitHub"

    listed = client.get("/api/admin/courses", headers=headers)
    assert listed.status_code == 200
    assert [c["id"] for c in listed.json()] == [course["id"]]

    partial = client.put(
        f"/api/admin/courses/{course['id']}", json={"level": "intermediate"}, headers=headers
    )
    assert partial.status_code == 200
    assert partial.json()["level"] == "intermediate"
    assert partial.json()["title"] == "Git и GitHub"  # untouched fields are kept

    module = client.post(
        f"/api/admin/courses/{course['id']}/modules", json={"title": "Основы", "position": 1}, headers=headers
    )
    assert module.status_code == 201
    module_id = module.json()["id"]
    assert module.json()["course_id"] == course["id"]

    renamed = client.put(f"/api/admin/modules/{module_id}", json={"position": 3}, headers=headers)
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Основы"
    assert renamed.json()["position"] == 3

    lesson = client.post(
        f"/api/admin/modules/{module_id}/lessons",
        json={"title": "Коммиты", "content": "# Коммиты", "position": 1},
        headers=headers,
    )
    assert lesson.status_code == 201
    lesson_id = lesson.json()["id"]
    assert lesson.json()["module_id"] == module_id

    lesson_update = client.put(
        f"/api/admin/lessons/{lesson_id}",
        json={"video_url": "https://video.example/1", "content": "Новый текст"},
        headers=headers,
    )
    assert lesson_update.status_code == 200
    assert lesson_update.json()["video_url"] == "https://video.example/1"
    assert lesson_update.json()["title"] == "Коммиты"

    cleared = client.put(f"/api/admin/lessons/{lesson_id}", json={"video_url": None}, headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["video_url"] is None

    assert client.delete(f"/api/admin/lessons/{lesson_id}", headers=headers).status_code == 204
    assert db.get(Lesson, lesson_id) is None

    assert client.delete(f"/api/admin/modules/{module_id}", headers=headers).status_code == 204
    assert db.get(Module, module_id) is None

    assert client.delete(f"/api/admin/courses/{course['id']}", headers=headers).status_code == 204
    assert db.get(Course, course["id"]) is None
    assert client.get("/api/admin/courses", headers=headers).json() == []


def test_course_delete_removes_enrollments_and_modules(client, admin, make_user, db: Session):
    _, headers = admin
    course_id = client.post("/api/admin/courses", json=_course_payload(), headers=headers).json()["id"]
    module_id = client.post(
        f"/api/admin/courses/{course_id}/modules", json={"title": "M"}, headers=headers
    ).json()["id"]
    client.post(f"/api/admin/modules/{module_id}/lessons", json={"title": "L"}, headers=headers)
    student, _ = make_user("student")
    db.add(Enrollment(user_id=student.id, course_id=course_id))
    db.commit()

    assert client.delete(f"/api/admin/courses/{course_id}", headers=headers).status_code == 204
    assert db.scalar(select(func.count(Enrollment.id)).where(Enrollment.course_id == course_id)) == 0
    assert db.scalar(select(func.count(Module.id)).where(Module.course_id == course_id)) == 0
    assert db.scalar(select(func.count(Lesson.id))) == 0


def test_missing_ids_return_404(client, admin):
    _, headers = admin
    assert client.put("/api/admin/courses/999999", json={"title": "x"}, headers=headers).status_code == 404
    assert client.delete("/api/admin/courses/999999", headers=headers).status_code == 404
    assert (
        client.post("/api/admin/courses/999999/modules", json={"title": "x"}, headers=headers).status_code
        == 404
    )
    assert client.put("/api/admin/modules/999999", json={"title": "x"}, headers=headers).status_code == 404
    assert client.delete("/api/admin/modules/999999", headers=headers).status_code == 404
    assert (
        client.post("/api/admin/modules/999999/lessons", json={"title": "x"}, headers=headers).status_code
        == 404
    )
    assert client.put("/api/admin/lessons/999999", json={"title": "x"}, headers=headers).status_code == 404
    assert client.delete("/api/admin/lessons/999999", headers=headers).status_code == 404


def test_create_course_validates_input(client, admin):
    _, headers = admin
    bad_level = client.post("/api/admin/courses", json=_course_payload(level="expert"), headers=headers)
    empty_title = client.post("/api/admin/courses", json=_course_payload(title=""), headers=headers)
    assert bad_level.status_code == 422
    assert empty_title.status_code == 422


def test_update_rejects_explicit_null_for_required_field(client, admin):
    _, headers = admin
    course_id = client.post("/api/admin/courses", json=_course_payload(), headers=headers).json()["id"]
    response = client.put(f"/api/admin/courses/{course_id}", json={"title": None}, headers=headers)
    assert response.status_code == 422


# --- Quizzes ----------------------------------------------------------------------

@pytest.fixture
def lesson_id(client, admin) -> int:
    _, headers = admin
    course_id = client.post("/api/admin/courses", json=_course_payload(), headers=headers).json()["id"]
    module_id = client.post(
        f"/api/admin/courses/{course_id}/modules", json={"title": "M"}, headers=headers
    ).json()["id"]
    lesson = client.post(f"/api/admin/modules/{module_id}/lessons", json={"title": "L"}, headers=headers)
    return lesson.json()["id"]


def test_quiz_upsert_get_and_replace(client, admin, lesson_id, db: Session):
    _, headers = admin
    created = client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=_quiz_payload(), headers=headers)
    assert created.status_code == 200
    assert created.json()["questions"][0]["correct_index"] == 0

    fetched = client.get(f"/api/admin/lessons/{lesson_id}/quiz", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["questions"][0]["correct_index"] == 0  # admin view includes the answer

    replacement = _quiz_payload(
        title="Новый тест",
        questions=[
            {"text": "Q1", "options": ["a", "b"], "correct_index": 1, "explanation": ""},
            {"text": "Q2", "options": ["a", "b", "c"], "correct_index": 2, "explanation": "E2"},
        ],
    )
    replaced = client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=replacement, headers=headers)
    assert replaced.status_code == 200
    body = replaced.json()
    assert body["title"] == "Новый тест"
    assert [q["text"] for q in body["questions"]] == ["Q1", "Q2"]

    quiz_id = body["id"]
    assert db.scalar(select(func.count(Question.id)).where(Question.quiz_id == quiz_id)) == 2
    assert db.scalar(select(func.count(Quiz.id)).where(Quiz.lesson_id == lesson_id)) == 1


def test_quiz_delete_and_404s(client, admin, lesson_id):
    _, headers = admin
    assert client.get(f"/api/admin/lessons/{lesson_id}/quiz", headers=headers).status_code == 404
    assert client.delete(f"/api/admin/lessons/{lesson_id}/quiz", headers=headers).status_code == 404

    client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=_quiz_payload(), headers=headers)
    assert client.delete(f"/api/admin/lessons/{lesson_id}/quiz", headers=headers).status_code == 204
    assert client.get(f"/api/admin/lessons/{lesson_id}/quiz", headers=headers).status_code == 404


def test_quiz_put_for_missing_lesson_returns_404(client, admin):
    _, headers = admin
    response = client.put("/api/admin/lessons/999999/quiz", json=_quiz_payload(), headers=headers)
    assert response.status_code == 404


@pytest.mark.parametrize(
    "bad_payload",
    [
        _quiz_payload(questions=[{"text": "Q", "options": ["only one"], "correct_index": 0}]),
        _quiz_payload(
            questions=[{"text": "Q", "options": [f"o{i}" for i in range(7)], "correct_index": 0}]
        ),
        _quiz_payload(questions=[{"text": "Q", "options": ["a", "b"], "correct_index": 2}]),
        _quiz_payload(questions=[{"text": "Q", "options": ["a", "b"], "correct_index": -1}]),
        _quiz_payload(questions=[]),
        _quiz_payload(title=""),
    ],
    ids=["one-option", "seven-options", "index-too-big", "negative-index", "no-questions", "empty-title"],
)
def test_quiz_validation_returns_422(client, admin, lesson_id, bad_payload):
    _, headers = admin
    response = client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=bad_payload, headers=headers)
    assert response.status_code == 422


def test_invalid_quiz_replacement_keeps_previous_quiz(client, admin, lesson_id, db: Session):
    _, headers = admin
    client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=_quiz_payload(), headers=headers)
    bad = _quiz_payload(questions=[{"text": "Q", "options": ["a", "b"], "correct_index": 5}])
    assert client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=bad, headers=headers).status_code == 422

    fetched = client.get(f"/api/admin/lessons/{lesson_id}/quiz", headers=headers).json()
    assert [q["text"] for q in fetched["questions"]] == ["Что делает git init?"]


def test_deleting_quiz_removes_its_attempts(client, admin, lesson_id, db: Session, make_user):
    _, headers = admin
    created = client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=_quiz_payload(), headers=headers).json()
    student, _ = make_user("student")
    db.add(QuizAttempt(user_id=student.id, quiz_id=created["id"], score=1, total=1, answers=[]))
    db.commit()

    client.delete(f"/api/admin/lessons/{lesson_id}/quiz", headers=headers)
    assert db.scalar(select(func.count(QuizAttempt.id))) == 0


# --- Uploads ----------------------------------------------------------------------

def test_upload_happy_path_stores_file_with_generated_name(client, admin, upload_dir):
    _, headers = admin
    content = b"%PDF-1.4 fake pdf body"
    response = client.post(
        "/api/admin/upload",
        files={"file": ("Лекция 1.PDF", content, "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 200
    url = response.json()["url"]
    assert UPLOAD_NAME_RE.match(url), url

    stored = upload_dir / url.removeprefix("/uploads/")
    assert stored.read_bytes() == content
    assert [p.name for p in upload_dir.iterdir()] == [stored.name]


def test_upload_disallowed_extension_rejected(client, admin, upload_dir):
    _, headers = admin
    for name in ("evil.exe", "page.html", "script.js", "noextension"):
        response = client.post(
            "/api/admin/upload", files={"file": (name, b"data", "application/octet-stream")}, headers=headers
        )
        assert response.status_code == 422, name
    assert not upload_dir.exists() or list(upload_dir.iterdir()) == []


def test_upload_oversize_rejected_and_partial_file_removed(client, admin, upload_dir, monkeypatch):
    _, headers = admin
    monkeypatch.setattr(get_settings(), "MAX_UPLOAD_MB", 1)
    too_big = b"a" * (1024 * 1024 + 1)
    response = client.post(
        "/api/admin/upload", files={"file": ("big.txt", too_big, "text/plain")}, headers=headers
    )
    assert response.status_code == 413
    assert list(upload_dir.iterdir()) == []


def test_upload_at_limit_is_accepted(client, admin, upload_dir, monkeypatch):
    _, headers = admin
    monkeypatch.setattr(get_settings(), "MAX_UPLOAD_MB", 1)
    response = client.post(
        "/api/admin/upload",
        files={"file": ("ok.md", b"a" * (1024 * 1024), "text/markdown")},
        headers=headers,
    )
    assert response.status_code == 200


def test_upload_path_traversal_filename_is_ignored(client, admin, upload_dir):
    _, headers = admin
    response = client.post(
        "/api/admin/upload",
        files={"file": ("../../../escape.png", b"\x89PNG fake", "image/png")},
        headers=headers,
    )
    assert response.status_code == 200
    url = response.json()["url"]
    assert UPLOAD_NAME_RE.match(url), url
    assert "escape" not in url
    assert [p.name for p in upload_dir.iterdir()] == [url.removeprefix("/uploads/")]
    assert not (upload_dir.parent / "escape.png").exists()
    assert not (upload_dir.parent.parent / "escape.png").exists()


def test_empty_upload_rejected(client, admin, upload_dir):
    _, headers = admin
    response = client.post(
        "/api/admin/upload", files={"file": ("empty.txt", b"", "text/plain")}, headers=headers
    )
    assert response.status_code == 422
    assert list(upload_dir.iterdir()) == []


# --- Stats ------------------------------------------------------------------------

def test_stats_counts_rows(client, admin, make_user, db: Session):
    _, headers = admin
    student, _ = make_user("student")
    course_id = client.post("/api/admin/courses", json=_course_payload(), headers=headers).json()["id"]
    module_id = client.post(
        f"/api/admin/courses/{course_id}/modules", json={"title": "M"}, headers=headers
    ).json()["id"]
    lesson_id = client.post(
        f"/api/admin/modules/{module_id}/lessons", json={"title": "L"}, headers=headers
    ).json()["id"]
    quiz = client.put(f"/api/admin/lessons/{lesson_id}/quiz", json=_quiz_payload(), headers=headers).json()
    db.add(Enrollment(user_id=student.id, course_id=course_id))
    db.add(QuizAttempt(user_id=student.id, quiz_id=quiz["id"], score=1, total=1, answers=[]))
    db.commit()

    response = client.get("/api/admin/stats", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"users": 2, "courses": 1, "lessons": 1, "enrollments": 1, "attempts": 1}


# --- Secrets never leak -------------------------------------------------------------

def test_api_key_never_appears_in_admin_responses(client, admin, monkeypatch):
    _, headers = admin
    monkeypatch.setattr(get_settings(), "ROUTERAI_API_KEY", API_KEY)
    responses = [
        client.get("/api/admin/courses", headers=headers),
        client.get("/api/admin/stats", headers=headers),
        client.post("/api/admin/courses", json=_course_payload(level="bad"), headers=headers),
        client.get("/api/admin/lessons/999999/quiz", headers=headers),
    ]
    for response in responses:
        assert API_KEY not in response.text
