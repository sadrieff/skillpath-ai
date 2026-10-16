"""Public catalog and enrollment endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession, get_optional_user
from app.models import Course, Enrollment, Profile
from app.schemas import (
    CourseCard,
    CourseDetail,
    CourseLevel,
    CourseListOut,
    EnrollOut,
    LessonBrief,
    ModuleOut,
)
from app.services.courses import (
    build_course_card,
    build_course_cards,
    completed_lesson_ids,
    course_structure,
    escape_like,
    get_course_or_404,
    is_enrolled,
    is_sqlite,
)

router = APIRouter(prefix="/courses", tags=["courses"])

OptionalUser = Annotated[Profile | None, Depends(get_optional_user)]


def _list_courses(
    db: Session,
    *,
    q: str | None,
    category: str | None,
    level: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Course], int]:
    conditions = []
    if category:
        conditions.append(Course.category == category)
    if level:
        conditions.append(Course.level == level)

    needle = q.strip() if q else ""
    if needle and is_sqlite(db):
        # SQLite's lower()/LIKE only fold ASCII, so Cyrillic titles need Unicode-aware matching in Python.
        # The catalog is small, so filtering the (id, title) pairs here is cheap.
        folded = needle.casefold()
        rows = db.execute(
            select(Course.id, Course.title).where(*conditions).order_by(Course.id)
        ).all()
        matched = [course_id for course_id, title in rows if folded in title.casefold()]
        page_ids = matched[offset : offset + limit]
        by_id = {c.id: c for c in db.scalars(select(Course).where(Course.id.in_(page_ids)))}
        return [by_id[course_id] for course_id in page_ids], len(matched)

    if needle:
        pattern = f"%{escape_like(needle.lower())}%"
        conditions.append(func.lower(Course.title).like(pattern, escape="\\"))

    total = db.scalar(select(func.count(Course.id)).where(*conditions)) or 0
    items = list(
        db.scalars(
            select(Course).where(*conditions).order_by(Course.id).offset(offset).limit(limit)
        )
    )
    return items, total


@router.get("", response_model=CourseListOut)
def list_courses(
    db: DbSession,
    user: OptionalUser,
    q: Annotated[str | None, Query(max_length=100)] = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    level: CourseLevel | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CourseListOut:
    courses, total = _list_courses(
        db, q=q, category=category, level=level, limit=limit, offset=offset
    )
    return CourseListOut(items=build_course_cards(db, courses, user), total=total)


@router.get("/categories", response_model=list[str])
def list_categories(db: DbSession) -> list[str]:
    return list(db.scalars(select(Course.category).distinct().order_by(Course.category)))


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(course_id: int, db: DbSession, user: OptionalUser) -> CourseDetail:
    course = get_course_or_404(db, course_id)
    card: CourseCard = build_course_card(db, course, user)
    structure = course_structure(db, course.id)
    lesson_ids = [lesson.id for _, lessons in structure for lesson in lessons]
    done = completed_lesson_ids(db, user.id, lesson_ids) if user is not None else set()
    modules = [
        ModuleOut(
            id=module.id,
            title=module.title,
            position=module.position,
            lessons=[
                LessonBrief(
                    id=lesson.id,
                    title=lesson.title,
                    position=lesson.position,
                    completed=lesson.id in done,
                )
                for lesson in lessons
            ],
        )
        for module, lessons in structure
    ]
    return CourseDetail(**card.model_dump(), modules=modules)


@router.post("/{course_id}/enroll", response_model=EnrollOut, status_code=status.HTTP_200_OK)
def enroll(course_id: int, response: Response, db: DbSession, user: CurrentUser) -> EnrollOut:
    """201 on first enrollment, 200 when the user is already enrolled."""
    get_course_or_404(db, course_id)
    if is_enrolled(db, user.id, course_id):
        return EnrollOut(enrolled=True)
    db.add(Enrollment(user_id=user.id, course_id=course_id))
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request enrolled first: the unique constraint makes this idempotent.
        db.rollback()
        return EnrollOut(enrolled=True)
    response.status_code = status.HTTP_201_CREATED
    return EnrollOut(enrolled=True)


@router.delete("/{course_id}/enroll", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def unenroll(course_id: int, db: DbSession, user: CurrentUser) -> Response:
    """Remove the enrollment. Lesson progress is kept, so re-enrolling restores it."""
    get_course_or_404(db, course_id)
    db.execute(
        delete(Enrollment).where(Enrollment.user_id == user.id, Enrollment.course_id == course_id)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
