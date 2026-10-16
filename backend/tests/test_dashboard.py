"""GET /api/me/dashboard: stats, active courses with next lesson, recent attempts, recommendations."""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from tests.catalog_factories import (
    add_attempt,
    course_lesson_ids,
    enroll,
    make_course,
    make_quiz,
    mark_done,
)

DASHBOARD = "/api/me/dashboard"
OPTIONS = ["A", "B"]
BASE_TIME = datetime(2026, 3, 1, 9, 0, 0)


def _ids(items: list[dict]) -> list[int]:
    return [item["id"] for item in items]


def _answers(question_ids: list[int], choices: list[int]) -> dict:
    return {
        "answers": [
            {"question_id": qid, "choice_index": choice}
            for qid, choice in zip(question_ids, choices, strict=True)
        ]
    }


def test_dashboard_requires_token(client):
    assert client.get(DASHBOARD).status_code == 401


def test_new_user_gets_empty_dashboard_with_newest_recommendations(client, db, make_user):
    _, headers = make_user()
    old = make_course(db, "Старый", category="A", created_at=BASE_TIME)
    mid = make_course(db, "Средний", category="B", created_at=BASE_TIME + timedelta(days=1))
    new = make_course(db, "Новый", category="C", created_at=BASE_TIME + timedelta(days=2))

    body = client.get(DASHBOARD, headers=headers).json()

    assert body["stats"] == {
        "courses_active": 0,
        "lessons_completed": 0,
        "avg_quiz_percent": 0.0,
        "quiz_attempts": 0,
    }
    assert body["courses"] == []
    assert body["recent_attempts"] == []
    assert _ids(body["recommendations"]) == [new.id, mid.id, old.id]
    assert all(card["enrolled"] is False for card in body["recommendations"])


def test_active_courses_progress_and_next_lesson(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Прогресс", lessons=(2, 2))
    ids = course_lesson_ids(db, course)
    enroll(db, user.id, course.id)

    fresh = client.get(DASHBOARD, headers=headers).json()
    assert fresh["courses"][0]["next_lesson_id"] == ids[0]
    assert fresh["courses"][0]["progress_percent"] == 0
    assert fresh["courses"][0]["lessons_count"] == 4
    assert fresh["courses"][0]["enrolled"] is True

    mark_done(db, user.id, ids[0])
    mark_done(db, user.id, ids[1])
    partial = client.get(DASHBOARD, headers=headers).json()
    assert partial["courses"][0]["progress_percent"] == 50
    assert partial["courses"][0]["next_lesson_id"] == ids[2]

    for lesson_id in ids[2:]:
        mark_done(db, user.id, lesson_id)
    done = client.get(DASHBOARD, headers=headers).json()
    assert done["courses"][0]["progress_percent"] == 100
    assert done["courses"][0]["next_lesson_id"] == ids[-1]


def test_next_lesson_skips_gaps_in_completion(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Пропуски", lessons=(3,))
    ids = course_lesson_ids(db, course)
    enroll(db, user.id, course.id)
    mark_done(db, user.id, ids[1])

    body = client.get(DASHBOARD, headers=headers).json()
    assert body["courses"][0]["next_lesson_id"] == ids[0]


def test_stats_count_completions_attempts_and_average(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Статистика", lessons=(2,))
    lesson_id, second_lesson = course_lesson_ids(db, course)
    enroll(db, user.id, course.id)
    quiz = make_quiz(db, lesson_id, [(OPTIONS, 0), (OPTIONS, 1)])
    qids = [q.id for q in quiz.questions]

    perfect = client.post(
        f"/api/quizzes/{quiz.id}/attempts",
        json=_answers(qids, [0, 1]),
        headers=headers,
    )
    half = client.post(
        f"/api/quizzes/{quiz.id}/attempts",
        json=_answers(qids, [0, 0]),
        headers=headers,
    )
    assert perfect.status_code == 201 and half.status_code == 201
    mark_done(db, user.id, second_lesson)

    stats = client.get(DASHBOARD, headers=headers).json()["stats"]

    assert stats["courses_active"] == 1
    assert stats["quiz_attempts"] == 2
    assert stats["avg_quiz_percent"] == 75.0
    assert stats["lessons_completed"] == 2  # the passing attempt completed lesson 1, plus the manual one


def test_stats_ignore_other_users_and_unenrolled_courses(client, db, make_user):
    user, headers = make_user()
    other, _ = make_user()
    enrolled_course = make_course(db, "Активный", lessons=(1,))
    dropped = make_course(db, "Брошенный", lessons=(1,))
    enroll(db, user.id, enrolled_course.id)
    enroll(db, other.id, dropped.id)
    lesson_of_other = course_lesson_ids(db, dropped)[0]
    mark_done(db, other.id, lesson_of_other)
    quiz = make_quiz(db, course_lesson_ids(db, dropped)[0], [(OPTIONS, 0)])
    add_attempt(db, other.id, quiz.id, score=1, total=1, created_at=BASE_TIME)

    body = client.get(DASHBOARD, headers=headers).json()

    assert body["stats"]["courses_active"] == 1
    assert body["stats"]["lessons_completed"] == 0
    assert body["stats"]["quiz_attempts"] == 0
    assert body["stats"]["avg_quiz_percent"] == 0.0
    assert _ids(body["courses"]) == [enrolled_course.id]
    assert body["recent_attempts"] == []


def test_recent_attempts_are_newest_first_and_capped_at_ten(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Попытки", lessons=(1,))
    lesson_id = course_lesson_ids(db, course)[0]
    enroll(db, user.id, course.id)
    quiz = make_quiz(db, lesson_id, [(OPTIONS, 0), (OPTIONS, 0)], title="Тест на попытки")
    attempt_ids = []
    for index in range(12):
        attempt = add_attempt(
            db,
            user.id,
            quiz.id,
            score=index % 3,
            total=2,
            created_at=BASE_TIME + timedelta(minutes=index),
        )
        attempt_ids.append(attempt.id)

    body = client.get(DASHBOARD, headers=headers).json()
    recent = body["recent_attempts"]

    assert len(recent) == 10
    assert [item["attempt_id"] for item in recent] == list(reversed(attempt_ids))[:10]
    first = recent[0]
    assert first["quiz_title"] == "Тест на попытки"
    assert first["lesson_id"] == lesson_id
    assert first["percent"] == percent_for(11 % 3, 2)
    assert body["stats"]["quiz_attempts"] == 12


def percent_for(score: int, total: int) -> int:
    return score * 100 // total


def test_recommendations_exclude_enrolled_and_prefer_same_category(client, db, make_user):
    user, headers = make_user()
    python_a = make_course(db, "Python A", category="Python", created_at=BASE_TIME)
    python_b = make_course(db, "Python B", category="Python", created_at=BASE_TIME + timedelta(days=1))
    python_c = make_course(db, "Python C", category="Python", created_at=BASE_TIME + timedelta(days=2))
    other = make_course(db, "Other", category="Tools", created_at=BASE_TIME + timedelta(days=5))
    enroll(db, user.id, python_c.id)

    body = client.get(DASHBOARD, headers=headers).json()

    recommended = _ids(body["recommendations"])
    assert python_c.id not in recommended
    assert len(recommended) == 3
    assert recommended[0] == python_b.id
    assert recommended[1] == python_a.id
    assert recommended[2] == other.id


def test_recommendations_capped_at_three_when_many_match(client, db, make_user):
    user, headers = make_user()
    enrolled = make_course(db, "Основа", category="Data", created_at=BASE_TIME)
    enroll(db, user.id, enrolled.id)
    for index in range(6):
        make_course(db, f"Дата {index}", category="Data", created_at=BASE_TIME + timedelta(hours=index + 1))

    recommended = client.get(DASHBOARD, headers=headers).json()["recommendations"]

    assert len(recommended) == 3
    assert [item["title"] for item in recommended] == ["Дата 5", "Дата 4", "Дата 3"]


def test_recommendations_fall_back_to_newest_other_courses(client, db, make_user):
    user, headers = make_user()
    enrolled = make_course(db, "Единственный", category="Solo", created_at=BASE_TIME)
    enroll(db, user.id, enrolled.id)
    newest = make_course(db, "Свежий", category="Other1", created_at=BASE_TIME + timedelta(days=3))
    second = make_course(db, "Второй", category="Other2", created_at=BASE_TIME + timedelta(days=2))

    recommended = _ids(client.get(DASHBOARD, headers=headers).json()["recommendations"])

    assert recommended == [newest.id, second.id]


def test_recommendations_with_seed_data_exclude_enrolled(client, db: Session, make_user, seeded):
    from app.models import Course

    user, headers = make_user()
    python_course = db.query(Course).filter(Course.category == "Python").one()
    enroll(db, user.id, python_course.id)

    body = client.get(DASHBOARD, headers=headers).json()

    assert python_course.id not in _ids(body["recommendations"])
    assert len(body["recommendations"]) == 2
    assert body["courses"][0]["id"] == python_course.id


def test_courses_listed_by_most_recent_enrollment(client, db, make_user):
    user, headers = make_user()
    first = make_course(db, "Первый")
    second = make_course(db, "Второй")
    enroll(db, user.id, first.id)
    enroll(db, user.id, second.id)

    body = client.get(DASHBOARD, headers=headers).json()

    assert _ids(body["courses"]) == [second.id, first.id]
