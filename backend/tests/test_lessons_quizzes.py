"""Lessons (access, navigation, completion), public quiz view and quiz attempts (scoring, validation)."""
from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import LessonProgress, Quiz, QuizAttempt
from app.services.courses import percent_floor, percent_rounded
from tests.catalog_factories import (
    course_lesson_ids,
    enroll,
    make_course,
    make_quiz,
    mark_done,
)

LESSONS = "/api/lessons"
QUIZZES = "/api/quizzes"

OPTIONS = ["A", "B", "C", "D"]


@pytest.fixture
def course_ctx(db: Session, make_user):
    """Course with modules of 2, 1 and 2 lessons, a student enrolled in it, and a 3-question quiz."""
    course = make_course(db, "Тестовый курс", lessons=(2, 1, 2))
    lesson_ids = course_lesson_ids(db, course)
    student, headers = make_user(role="student")
    enroll(db, student.id, course.id)
    quiz = make_quiz(db, lesson_ids[0], [(OPTIONS, 1), (OPTIONS, 2), (OPTIONS, 0)])
    return {
        "course": course,
        "lessons": lesson_ids,
        "student": student,
        "headers": headers,
        "quiz": quiz,
        "question_ids": [q.id for q in quiz.questions],
    }


def _answers(question_ids: list[int], choices: list[int]) -> dict:
    return {
        "answers": [
            {"question_id": qid, "choice_index": choice}
            for qid, choice in zip(question_ids, choices, strict=True)
        ]
    }


def _lesson_completed(db: Session, user_id: int, lesson_id: int) -> bool:
    return (
        db.scalar(
            select(LessonProgress.completed).where(
                LessonProgress.user_id == user_id, LessonProgress.lesson_id == lesson_id
            )
        )
        is True
    )


# --- percent helpers ----------------------------------------------------------


@pytest.mark.parametrize(
    ("part", "total", "expected"),
    [(0, 3, 0), (1, 3, 33), (2, 3, 67), (3, 3, 100), (1, 8, 13), (1, 2, 50), (0, 0, 0)],
)
def test_percent_rounded_half_up(part, total, expected):
    assert percent_rounded(part, total) == expected


@pytest.mark.parametrize(("part", "total", "expected"), [(2, 3, 66), (7, 10, 70), (6, 10, 60), (0, 0, 0)])
def test_percent_floor(part, total, expected):
    assert percent_floor(part, total) == expected


# --- GET /lessons/{id} --------------------------------------------------------


def test_lesson_requires_token(client, course_ctx):
    assert client.get(f"{LESSONS}/{course_ctx['lessons'][0]}").status_code == 401


def test_lesson_403_when_not_enrolled(client, make_user, course_ctx):
    _, headers = make_user()
    response = client.get(f"{LESSONS}/{course_ctx['lessons'][0]}", headers=headers)
    assert response.status_code == 403


def test_lesson_404_for_unknown_id(client, course_ctx):
    response = client.get(f"{LESSONS}/999999", headers=course_ctx["headers"])
    assert response.status_code == 404


def test_lesson_detail_fields_and_navigation_across_modules(client, course_ctx):
    ids = course_ctx["lessons"]
    headers = course_ctx["headers"]

    first = client.get(f"{LESSONS}/{ids[0]}", headers=headers).json()
    middle = client.get(f"{LESSONS}/{ids[1]}", headers=headers).json()
    across_module = client.get(f"{LESSONS}/{ids[2]}", headers=headers).json()
    last = client.get(f"{LESSONS}/{ids[4]}", headers=headers).json()

    assert set(first) == {
        "id",
        "title",
        "content",
        "video_url",
        "material_url",
        "module_id",
        "course_id",
        "completed",
        "has_quiz",
        "prev_lesson_id",
        "next_lesson_id",
    }
    assert first["course_id"] == course_ctx["course"].id
    assert first["prev_lesson_id"] is None
    assert first["next_lesson_id"] == ids[1]
    assert first["has_quiz"] is True
    assert middle["prev_lesson_id"] == ids[0] and middle["next_lesson_id"] == ids[2]
    assert across_module["prev_lesson_id"] == ids[1] and across_module["next_lesson_id"] == ids[3]
    assert across_module["has_quiz"] is False
    assert last["prev_lesson_id"] == ids[3] and last["next_lesson_id"] is None


def test_lesson_completed_flag_reflects_progress(client, db, course_ctx):
    lesson_id = course_ctx["lessons"][1]
    mark_done(db, course_ctx["student"].id, lesson_id)
    body = client.get(f"{LESSONS}/{lesson_id}", headers=course_ctx["headers"]).json()
    assert body["completed"] is True


def test_admin_can_open_lessons_without_enrollment(client, make_user, course_ctx):
    _, admin_headers = make_user(role="admin")
    response = client.get(f"{LESSONS}/{course_ctx['lessons'][3]}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["course_id"] == course_ctx["course"].id


def test_unenrolled_student_loses_lesson_access(client, db, course_ctx):
    from app.models import Enrollment

    db.query(Enrollment).filter(Enrollment.user_id == course_ctx["student"].id).delete()
    db.commit()
    response = client.get(f"{LESSONS}/{course_ctx['lessons'][0]}", headers=course_ctx["headers"])
    assert response.status_code == 403


# --- POST /lessons/{id}/complete ----------------------------------------------


def test_complete_requires_token(client, course_ctx):
    assert client.post(f"{LESSONS}/{course_ctx['lessons'][0]}/complete").status_code == 401


def test_complete_403_when_not_enrolled(client, make_user, course_ctx):
    _, headers = make_user()
    response = client.post(f"{LESSONS}/{course_ctx['lessons'][0]}/complete", headers=headers)
    assert response.status_code == 403


def test_complete_returns_course_progress_percent(client, db, course_ctx):
    headers = course_ctx["headers"]
    lessons = course_ctx["lessons"]
    student_id = course_ctx["student"].id

    one = client.post(f"{LESSONS}/{lessons[0]}/complete", headers=headers)
    two = client.post(f"{LESSONS}/{lessons[1]}/complete", headers=headers)
    three = client.post(f"{LESSONS}/{lessons[2]}/complete", headers=headers)
    five = [client.post(f"{LESSONS}/{lid}/complete", headers=headers) for lid in lessons[3:]]

    assert one.json() == {"completed": True, "course_progress_percent": 20}
    assert two.json()["course_progress_percent"] == 40
    assert three.json()["course_progress_percent"] == 60
    assert five[-1].json() == {"completed": True, "course_progress_percent": 100}
    assert _lesson_completed(db, student_id, lessons[0])


def test_complete_is_idempotent(client, db, course_ctx):
    headers = course_ctx["headers"]
    lesson_id = course_ctx["lessons"][0]

    first = client.post(f"{LESSONS}/{lesson_id}/complete", headers=headers)
    stamp = db.scalar(
        select(LessonProgress.completed_at).where(LessonProgress.lesson_id == lesson_id)
    )
    second = client.post(f"{LESSONS}/{lesson_id}/complete", headers=headers)

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    rows = db.scalar(select(func.count(LessonProgress.id)).where(LessonProgress.lesson_id == lesson_id))
    assert rows == 1
    assert db.scalar(
        select(LessonProgress.completed_at).where(LessonProgress.lesson_id == lesson_id)
    ) == stamp


def test_complete_404_for_unknown_lesson(client, course_ctx):
    assert client.post(f"{LESSONS}/999999/complete", headers=course_ctx["headers"]).status_code == 404


# --- GET /lessons/{id}/quiz ---------------------------------------------------


def test_quiz_requires_token(client, course_ctx):
    assert client.get(f"{LESSONS}/{course_ctx['lessons'][0]}/quiz").status_code == 401


def test_quiz_403_when_not_enrolled(client, make_user, course_ctx):
    _, headers = make_user()
    response = client.get(f"{LESSONS}/{course_ctx['lessons'][0]}/quiz", headers=headers)
    assert response.status_code == 403


def test_quiz_404_when_lesson_has_no_quiz(client, course_ctx):
    response = client.get(f"{LESSONS}/{course_ctx['lessons'][1]}/quiz", headers=course_ctx["headers"])
    assert response.status_code == 404


def test_quiz_never_leaks_correct_index_or_explanation(client, course_ctx):
    response = client.get(f"{LESSONS}/{course_ctx['lessons'][0]}/quiz", headers=course_ctx["headers"])
    assert response.status_code == 200
    raw = response.text
    assert "correct_index" not in raw
    assert "explanation" not in raw
    assert "Объяснение" not in raw

    body = response.json()
    assert body["id"] == course_ctx["quiz"].id
    assert body["title"] == course_ctx["quiz"].title
    assert [q["id"] for q in body["questions"]] == course_ctx["question_ids"]
    for question in body["questions"]:
        assert set(question) == {"id", "text", "options"}
        assert question["options"] == OPTIONS


def test_quiz_questions_keep_position_order(client, db, make_user):
    course = make_course(db, "Порядок вопросов", lessons=(1,))
    lesson_id = course_lesson_ids(db, course)[0]
    student, headers = make_user()
    enroll(db, student.id, course.id)
    quiz = make_quiz(db, lesson_id, [(OPTIONS, 0), (OPTIONS, 1), (OPTIONS, 2), (OPTIONS, 3)])
    body = client.get(f"{LESSONS}/{lesson_id}/quiz", headers=headers).json()
    assert [q["id"] for q in body["questions"]] == [q.id for q in quiz.questions]


# --- POST /quizzes/{id}/attempts ----------------------------------------------


def test_attempt_requires_token(client, course_ctx):
    response = client.post(
        f"{QUIZZES}/{course_ctx['quiz'].id}/attempts",
        json=_answers(course_ctx["question_ids"], [0, 0, 0]),
    )
    assert response.status_code == 401


def test_attempt_403_when_not_enrolled(client, make_user, course_ctx):
    _, headers = make_user()
    response = client.post(
        f"{QUIZZES}/{course_ctx['quiz'].id}/attempts",
        json=_answers(course_ctx["question_ids"], [1, 2, 0]),
        headers=headers,
    )
    assert response.status_code == 403


def test_attempt_404_for_unknown_quiz(client, course_ctx):
    response = client.post(
        f"{QUIZZES}/999999/attempts",
        json=_answers(course_ctx["question_ids"], [1, 2, 0]),
        headers=course_ctx["headers"],
    )
    assert response.status_code == 404


def test_perfect_attempt_scores_stores_and_completes_lesson(client, db, course_ctx):
    quiz_id = course_ctx["quiz"].id
    qids = course_ctx["question_ids"]

    response = client.post(
        f"{QUIZZES}/{quiz_id}/attempts",
        json=_answers(qids, [1, 2, 0]),
        headers=course_ctx["headers"],
    )

    assert response.status_code == 201
    body = response.json()
    assert body["score"] == 3 and body["total"] == 3 and body["percent"] == 100
    assert [r["question_id"] for r in body["results"]] == qids
    assert all(r["correct"] is True for r in body["results"])
    assert [r["correct_index"] for r in body["results"]] == [1, 2, 0]
    assert all(r["explanation"].startswith("Объяснение") for r in body["results"])

    attempt = db.get(QuizAttempt, body["attempt_id"])
    assert attempt.score == 3 and attempt.total == 3
    assert attempt.answers == [
        {"question_id": qids[0], "choice_index": 1, "correct": True},
        {"question_id": qids[1], "choice_index": 2, "correct": True},
        {"question_id": qids[2], "choice_index": 0, "correct": True},
    ]
    assert _lesson_completed(db, course_ctx["student"].id, course_ctx["lessons"][0])


def test_scoring_is_server_side_and_partial_correctness(client, db, course_ctx):
    qids = course_ctx["question_ids"]
    body = client.post(
        f"{QUIZZES}/{course_ctx['quiz'].id}/attempts",
        json=_answers(qids, [1, 0, 0]),
        headers=course_ctx["headers"],
    ).json()

    assert body["score"] == 2
    assert body["percent"] == 66
    assert [r["correct"] for r in body["results"]] == [True, False, True]
    assert body["results"][1]["choice_index"] == 0
    assert body["results"][1]["correct_index"] == 2
    # 2/3 is below the pass mark, so the lesson must stay incomplete.
    assert not _lesson_completed(db, course_ctx["student"].id, course_ctx["lessons"][0])


def test_answers_may_be_submitted_in_any_order(client, course_ctx):
    qids = course_ctx["question_ids"]
    shuffled = {
        "answers": [
            {"question_id": qids[2], "choice_index": 0},
            {"question_id": qids[0], "choice_index": 1},
            {"question_id": qids[1], "choice_index": 2},
        ]
    }
    body = client.post(
        f"{QUIZZES}/{course_ctx['quiz'].id}/attempts", json=shuffled, headers=course_ctx["headers"]
    ).json()
    assert body["score"] == 3
    assert [r["question_id"] for r in body["results"]] == qids


@pytest.fixture
def ten_question_ctx(db: Session, make_user):
    course = make_course(db, "Десять вопросов", lessons=(1,))
    lesson_id = course_lesson_ids(db, course)[0]
    student, headers = make_user()
    enroll(db, student.id, course.id)
    quiz = make_quiz(db, lesson_id, [(OPTIONS, 0)] * 10)
    return {
        "lesson_id": lesson_id,
        "student": student,
        "headers": headers,
        "quiz_id": quiz.id,
        "question_ids": [q.id for q in quiz.questions],
    }


def test_pass_threshold_exactly_70_percent_completes_lesson(client, db, ten_question_ctx):
    choices = [0] * 7 + [1] * 3
    body = client.post(
        f"{QUIZZES}/{ten_question_ctx['quiz_id']}/attempts",
        json=_answers(ten_question_ctx["question_ids"], choices),
        headers=ten_question_ctx["headers"],
    ).json()

    assert body["score"] == 7 and body["percent"] == 70
    assert _lesson_completed(db, ten_question_ctx["student"].id, ten_question_ctx["lesson_id"])


def test_just_below_threshold_does_not_complete_lesson(client, db, ten_question_ctx):
    choices = [0] * 6 + [1] * 4
    body = client.post(
        f"{QUIZZES}/{ten_question_ctx['quiz_id']}/attempts",
        json=_answers(ten_question_ctx["question_ids"], choices),
        headers=ten_question_ctx["headers"],
    ).json()

    assert body["percent"] == 60
    assert not _lesson_completed(db, ten_question_ctx["student"].id, ten_question_ctx["lesson_id"])


def test_failed_attempt_keeps_earlier_completion(client, db, ten_question_ctx):
    mark_done(db, ten_question_ctx["student"].id, ten_question_ctx["lesson_id"])
    client.post(
        f"{QUIZZES}/{ten_question_ctx['quiz_id']}/attempts",
        json=_answers(ten_question_ctx["question_ids"], [1] * 10),
        headers=ten_question_ctx["headers"],
    )
    assert _lesson_completed(db, ten_question_ctx["student"].id, ten_question_ctx["lesson_id"])


@pytest.mark.parametrize(
    "payload_builder",
    [
        pytest.param(lambda qids: {"answers": []}, id="no-answers"),
        pytest.param(lambda qids: _answers(qids[:2], [0, 0]), id="partial"),
        pytest.param(
            lambda qids: {
                "answers": [
                    {"question_id": qids[0], "choice_index": 0},
                    {"question_id": qids[0], "choice_index": 1},
                    {"question_id": qids[1], "choice_index": 0},
                    {"question_id": qids[2], "choice_index": 0},
                ]
            },
            id="duplicate",
        ),
        pytest.param(
            lambda qids: {
                "answers": [
                    {"question_id": qids[0], "choice_index": 0},
                    {"question_id": qids[1], "choice_index": 0},
                    {"question_id": 999999, "choice_index": 0},
                ]
            },
            id="unknown-question",
        ),
        pytest.param(lambda qids: _answers(qids, [4, 0, 0]), id="choice-out-of-range"),
        pytest.param(lambda qids: _answers(qids, [-1, 0, 0]), id="negative-choice"),
        pytest.param(lambda qids: {}, id="missing-body-field"),
    ],
)
def test_invalid_attempts_are_422_and_not_stored(client, db, course_ctx, payload_builder):
    response = client.post(
        f"{QUIZZES}/{course_ctx['quiz'].id}/attempts",
        json=payload_builder(course_ctx["question_ids"]),
        headers=course_ctx["headers"],
    )
    assert response.status_code == 422
    assert db.scalar(select(func.count(QuizAttempt.id))) == 0


def test_quiz_without_questions_rejects_attempts(client, db, make_user):
    course = make_course(db, "Пустой тест", lessons=(1,))
    lesson_id = course_lesson_ids(db, course)[0]
    student, headers = make_user()
    enroll(db, student.id, course.id)
    empty = Quiz(lesson_id=lesson_id, title="Пусто")
    db.add(empty)
    db.commit()

    response = client.post(f"{QUIZZES}/{empty.id}/attempts", json={"answers": []}, headers=headers)
    assert response.status_code == 422
