"""Catalog endpoints: list/search/filter/pagination, categories, detail, enrollment."""
from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.models import Enrollment, LessonProgress
from tests.catalog_factories import (
    course_lesson_ids,
    enroll,
    make_course,
    mark_done,
)

COURSES = "/api/courses"


def _titles(payload: dict) -> list[str]:
    return [item["title"] for item in payload["items"]]


@pytest.fixture
def catalog(db: Session):
    """Known catalog for filter/search tests (independent of seed data)."""
    return {
        "python": make_course(db, "Python: первые шаги", category="Python", level="beginner"),
        "sql": make_course(db, "Основы SQL", category="Databases", level="beginner"),
        "ml": make_course(db, "Machine Learning", category="Python", level="advanced"),
        "git": make_course(db, "Git and GitHub", category="Tools", level="intermediate"),
        "pct": make_course(db, "Скидки 100% и цены_2", category="Tools", level="beginner"),
    }


# --- list / search ------------------------------------------------------------


def test_list_is_public_and_reports_total(client, seeded):
    response = client.get(COURSES)
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert len(payload["items"]) == 3
    card = payload["items"][0]
    assert set(card) == {
        "id",
        "title",
        "description",
        "category",
        "level",
        "duration_hours",
        "lessons_count",
        "enrolled",
        "progress_percent",
    }
    assert card["enrolled"] is False
    assert card["progress_percent"] == 0
    assert card["lessons_count"] > 0


def test_search_is_case_insensitive_ascii(client, catalog):
    assert _titles(client.get(COURSES, params={"q": "sql"}).json()) == ["Основы SQL"]
    assert _titles(client.get(COURSES, params={"q": "SQL"}).json()) == ["Основы SQL"]
    assert _titles(client.get(COURSES, params={"q": "git and"}).json()) == ["Git and GitHub"]


def test_search_is_case_insensitive_cyrillic(client, catalog):
    # SQLite lower() is ASCII-only; the Cyrillic match must still work.
    assert _titles(client.get(COURSES, params={"q": "ОСНОВЫ"}).json()) == ["Основы SQL"]
    assert _titles(client.get(COURSES, params={"q": "скидки"}).json()) == ["Скидки 100% и цены_2"]


def test_search_treats_wildcards_literally(client, catalog):
    assert _titles(client.get(COURSES, params={"q": "%"}).json()) == ["Скидки 100% и цены_2"]
    assert _titles(client.get(COURSES, params={"q": "_"}).json()) == ["Скидки 100% и цены_2"]
    assert client.get(COURSES, params={"q": "%%%"}).json()["total"] == 0


def test_search_matches_substring_and_ignores_blank_query(client, catalog):
    assert _titles(client.get(COURSES, params={"q": "learn"}).json()) == ["Machine Learning"]
    assert client.get(COURSES, params={"q": "   "}).json()["total"] == 5
    assert client.get(COURSES, params={"q": "no-such-thing"}).json()["total"] == 0


def test_filter_by_category_and_level(client, catalog):
    by_category = client.get(COURSES, params={"category": "Python"}).json()
    assert by_category["total"] == 2
    assert {item["category"] for item in by_category["items"]} == {"Python"}

    by_level = client.get(COURSES, params={"level": "advanced"}).json()
    assert _titles(by_level) == ["Machine Learning"]

    combined = client.get(COURSES, params={"category": "Tools", "level": "beginner"}).json()
    assert _titles(combined) == ["Скидки 100% и цены_2"]


def test_filters_combine_with_search(client, catalog):
    payload = client.get(COURSES, params={"q": "learning", "category": "Databases"}).json()
    assert payload == {"items": [], "total": 0}


def test_invalid_level_is_rejected(client, catalog):
    assert client.get(COURSES, params={"level": "expert"}).status_code == 422


def test_pagination_limit_offset_and_total(client, db):
    for index in range(7):
        make_course(db, f"Курс {index:02d}", category="Pagination")

    first = client.get(COURSES, params={"category": "Pagination", "limit": 3}).json()
    second = client.get(COURSES, params={"category": "Pagination", "limit": 3, "offset": 3}).json()
    last = client.get(COURSES, params={"category": "Pagination", "limit": 3, "offset": 6}).json()
    beyond = client.get(COURSES, params={"category": "Pagination", "limit": 3, "offset": 50}).json()

    assert first["total"] == second["total"] == last["total"] == 7
    assert len(first["items"]) == 3 and len(second["items"]) == 3 and len(last["items"]) == 1
    assert _titles(first) + _titles(second) + _titles(last) == [f"Курс {i:02d}" for i in range(7)]
    assert beyond["items"] == [] and beyond["total"] == 7


def test_pagination_works_for_cyrillic_search(client, db):
    for index in range(5):
        make_course(db, f"Тема {index}", category="Search")
    page = client.get(COURSES, params={"q": "ТЕМА", "limit": 2, "offset": 2}).json()
    assert page["total"] == 5
    assert _titles(page) == ["Тема 2", "Тема 3"]


@pytest.mark.parametrize(
    "params",
    [{"limit": 0}, {"limit": 101}, {"offset": -1}, {"q": "x" * 101}],
)
def test_list_parameter_bounds(client, params):
    assert client.get(COURSES, params=params).status_code == 422


def test_list_card_reports_lessons_and_enrollment_for_token(client, db, make_user, catalog):
    user, headers = make_user()
    course = catalog["python"]
    lesson_ids = course_lesson_ids(db, course)
    enroll(db, user.id, course.id)
    mark_done(db, user.id, lesson_ids[0])

    anonymous = {item["id"]: item for item in client.get(COURSES).json()["items"]}
    authed = {item["id"]: item for item in client.get(COURSES, headers=headers).json()["items"]}

    assert anonymous[course.id]["lessons_count"] == 2
    assert anonymous[course.id]["enrolled"] is False
    assert authed[course.id]["enrolled"] is True
    assert authed[course.id]["progress_percent"] == 50
    assert authed[catalog["sql"].id]["enrolled"] is False
    assert authed[catalog["sql"].id]["progress_percent"] == 0


def test_list_with_invalid_token_is_treated_as_anonymous(client, catalog):
    response = client.get(COURSES, headers={"Authorization": "Bearer junk"})
    assert response.status_code == 200
    assert all(item["enrolled"] is False for item in response.json()["items"])


def test_list_query_count_does_not_grow_with_courses(client, engine, db, make_user):
    """Grouped queries: the number of SQL statements must not depend on the number of courses."""
    user, headers = make_user()

    def count_statements(path: str) -> int:
        statements: list[str] = []

        def record(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        event.listen(engine, "before_cursor_execute", record)
        try:
            response = client.get(path, headers=headers)
            assert response.status_code == 200
        finally:
            event.remove(engine, "before_cursor_execute", record)
        return len(statements)

    first = make_course(db, "Мало 0", category="Count", lessons=(2, 2))
    for index in range(1, 3):
        make_course(db, f"Мало {index}", category="Count", lessons=(2, 2))
    enroll(db, user.id, first.id)
    few = count_statements(f"{COURSES}?category=Count")

    for index in range(12):
        course = make_course(db, f"Много {index}", category="Count", lessons=(3, 1))
        if index % 2 == 0:
            enroll(db, user.id, course.id)
    many = count_statements(f"{COURSES}?category=Count&limit=100")

    assert few == many


# --- categories ---------------------------------------------------------------


def test_categories_are_distinct_and_sorted(client, catalog):
    assert client.get(f"{COURSES}/categories").json() == ["Databases", "Python", "Tools"]


def test_categories_route_is_not_shadowed_by_course_id(client, seeded):
    response = client.get(f"{COURSES}/categories")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# --- detail -------------------------------------------------------------------


def test_detail_returns_modules_lessons_in_order(client, db, make_user):
    course = make_course(db, "Порядок", lessons=(2, 1, 2))
    response = client.get(f"{COURSES}/{course.id}")
    assert response.status_code == 200
    body = response.json()
    assert [m["position"] for m in body["modules"]] == [1, 2, 3]
    assert [len(m["lessons"]) for m in body["modules"]] == [2, 1, 2]
    flat = [lesson["id"] for module in body["modules"] for lesson in module["lessons"]]
    assert flat == course_lesson_ids(db, course)
    assert body["lessons_count"] == 5
    assert all(lesson["completed"] is False for m in body["modules"] for lesson in m["lessons"])


def test_detail_shows_completed_flags_for_user(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Флаги", lessons=(2, 1))
    lesson_ids = course_lesson_ids(db, course)
    enroll(db, user.id, course.id)
    mark_done(db, user.id, lesson_ids[1])

    body = client.get(f"{COURSES}/{course.id}", headers=headers).json()

    flags = [lesson["completed"] for m in body["modules"] for lesson in m["lessons"]]
    assert flags == [False, True, False]
    assert body["enrolled"] is True
    assert body["progress_percent"] == 33


def test_detail_404_for_unknown_course(client):
    assert client.get(f"{COURSES}/999999").status_code == 404


# --- enrollment ---------------------------------------------------------------


def test_enroll_requires_token(client, db):
    course = make_course(db, "Закрыт")
    assert client.post(f"{COURSES}/{course.id}/enroll").status_code == 401


def test_enroll_is_201_then_200_and_idempotent(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Запись")

    first = client.post(f"{COURSES}/{course.id}/enroll", headers=headers)
    second = client.post(f"{COURSES}/{course.id}/enroll", headers=headers)

    assert first.status_code == 201
    assert first.json() == {"enrolled": True}
    assert second.status_code == 200
    assert second.json() == {"enrolled": True}
    count = db.scalar(
        select(func.count(Enrollment.id)).where(
            Enrollment.user_id == user.id, Enrollment.course_id == course.id
        )
    )
    assert count == 1


def test_enroll_unknown_course_404(client, make_user):
    _, headers = make_user()
    assert client.post(f"{COURSES}/424242/enroll", headers=headers).status_code == 404


def test_unenroll_is_204_keeps_progress_and_is_repeatable(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Выход", lessons=(2,))
    lesson_ids = course_lesson_ids(db, course)
    client.post(f"{COURSES}/{course.id}/enroll", headers=headers)
    mark_done(db, user.id, lesson_ids[0])

    first = client.delete(f"{COURSES}/{course.id}/enroll", headers=headers)
    second = client.delete(f"{COURSES}/{course.id}/enroll", headers=headers)

    assert first.status_code == 204
    assert second.status_code == 204
    assert first.content == b""
    assert db.scalar(select(func.count(Enrollment.id)).where(Enrollment.user_id == user.id)) == 0
    progress = db.scalar(select(func.count(LessonProgress.id)).where(LessonProgress.user_id == user.id))
    assert progress == 1


def test_unenroll_requires_token(client, db):
    course = make_course(db, "Без токена")
    assert client.delete(f"{COURSES}/{course.id}/enroll").status_code == 401


def test_reenroll_restores_progress_percent(client, db, make_user):
    user, headers = make_user()
    course = make_course(db, "Возврат", lessons=(2,))
    lesson_ids = course_lesson_ids(db, course)
    client.post(f"{COURSES}/{course.id}/enroll", headers=headers)
    mark_done(db, user.id, lesson_ids[0])
    client.delete(f"{COURSES}/{course.id}/enroll", headers=headers)
    client.post(f"{COURSES}/{course.id}/enroll", headers=headers)

    body = client.get(f"{COURSES}/{course.id}", headers=headers).json()
    assert body["progress_percent"] == 50


def test_course_with_explicit_created_at_is_listed(client, db):
    make_course(db, "С датой", created_at=datetime(2026, 1, 2, 3, 4, 5))
    assert client.get(COURSES, params={"q": "с дат"}).json()["total"] == 1
