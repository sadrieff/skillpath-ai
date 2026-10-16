"""Student dashboard: stats, active courses, recent quiz attempts and recommendations."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession
from app.models import Course, Enrollment, LessonProgress, Quiz, QuizAttempt
from app.schemas import (
    CourseCard,
    DashboardCourse,
    DashboardOut,
    DashboardStats,
    RecentAttemptOut,
)
from app.services.courses import (
    build_course_cards,
    completed_lesson_ids,
    lesson_ids_by_course,
    percent_floor,
)

router = APIRouter(tags=["dashboard"])

RECENT_ATTEMPTS_LIMIT = 10
RECOMMENDATIONS_LIMIT = 3


def _stats(db: Session, user_id: int, courses_active: int) -> DashboardStats:
    lessons_completed = (
        db.scalar(
            select(func.count(LessonProgress.id)).where(
                LessonProgress.user_id == user_id, LessonProgress.completed.is_(True)
            )
        )
        or 0
    )
    attempts = db.scalar(select(func.count(QuizAttempt.id)).where(QuizAttempt.user_id == user_id)) or 0
    avg = db.scalar(
        select(func.avg(QuizAttempt.score * 100.0 / QuizAttempt.total)).where(
            QuizAttempt.user_id == user_id
        )
    )
    return DashboardStats(
        courses_active=courses_active,
        lessons_completed=lessons_completed,
        avg_quiz_percent=round(float(avg), 1) if avg is not None else 0.0,
        quiz_attempts=attempts,
    )


def _recent_attempts(db: Session, user_id: int) -> list[RecentAttemptOut]:
    rows = db.execute(
        select(
            QuizAttempt.id,
            QuizAttempt.score,
            QuizAttempt.total,
            QuizAttempt.created_at,
            Quiz.title,
            Quiz.lesson_id,
        )
        .select_from(QuizAttempt)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.created_at.desc(), QuizAttempt.id.desc())
        .limit(RECENT_ATTEMPTS_LIMIT)
    ).all()
    return [
        RecentAttemptOut(
            attempt_id=attempt_id,
            quiz_title=title,
            lesson_id=lesson_id,
            percent=percent_floor(score, total),
            created_at=created_at,
        )
        for attempt_id, score, total, created_at, title, lesson_id in rows
    ]


def _recommendations(db: Session, enrolled_ids: list[int]) -> list[CourseCard]:
    """Newest non-enrolled courses from the categories the user studies; topped up with newest overall."""
    newest_first = (Course.created_at.desc(), Course.id.desc())
    picked: list[Course] = []

    if enrolled_ids:
        categories = list(
            db.scalars(select(Course.category).where(Course.id.in_(enrolled_ids)).distinct())
        )
        if categories:
            conditions = [Course.category.in_(categories)]
            if enrolled_ids:
                conditions.append(Course.id.not_in(enrolled_ids))
            picked = list(
                db.scalars(
                    select(Course).where(*conditions).order_by(*newest_first).limit(RECOMMENDATIONS_LIMIT)
                )
            )

    if len(picked) < RECOMMENDATIONS_LIMIT:
        excluded = list(enrolled_ids) + [course.id for course in picked]
        conditions = [Course.id.not_in(excluded)] if excluded else []
        filler = list(
            db.scalars(
                select(Course)
                .where(*conditions)
                .order_by(*newest_first)
                .limit(RECOMMENDATIONS_LIMIT - len(picked))
            )
        )
        picked.extend(filler)
    return build_course_cards(db, picked, None)


@router.get("/me/dashboard", response_model=DashboardOut)
def get_dashboard(db: DbSession, user: CurrentUser) -> DashboardOut:
    enrolled_ids = list(
        db.scalars(
            select(Enrollment.course_id)
            .where(Enrollment.user_id == user.id)
            .order_by(Enrollment.enrolled_at.desc(), Enrollment.course_id.desc())
        )
    )

    ordered: list[Course] = []
    if enrolled_ids:
        courses_by_id = {c.id: c for c in db.scalars(select(Course).where(Course.id.in_(enrolled_ids)))}
        ordered = [courses_by_id[cid] for cid in enrolled_ids if cid in courses_by_id]
    cards = build_course_cards(db, ordered, user)

    order_by_course = lesson_ids_by_course(db, enrolled_ids)
    all_lesson_ids = [lesson_id for ids in order_by_course.values() for lesson_id in ids]
    done = completed_lesson_ids(db, user.id, all_lesson_ids)

    active: list[DashboardCourse] = []
    for card in cards:
        lessons = order_by_course.get(card.id, [])
        next_id = next((lesson_id for lesson_id in lessons if lesson_id not in done), None)
        if next_id is None and lessons:
            next_id = lessons[-1]
        active.append(DashboardCourse(**card.model_dump(), next_lesson_id=next_id))

    return DashboardOut(
        stats=_stats(db, user.id, len(enrolled_ids)),
        courses=active,
        recent_attempts=_recent_attempts(db, user.id),
        recommendations=_recommendations(db, enrolled_ids),
    )
