"""Shared catalog helpers: access checks, progress math, course cards and lesson ordering."""
from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Course, Enrollment, Lesson, LessonProgress, Module, Profile, Quiz, utcnow
from app.schemas import CourseCard

PASS_PERCENT = 70


def escape_like(value: str) -> str:
    """Escape LIKE wildcards so user input is matched literally (escape char is backslash)."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def is_sqlite(db: Session) -> bool:
    return db.get_bind().dialect.name == "sqlite"


def percent_rounded(part: int, total: int) -> int:
    """Half-up integer percent, 0 when there is nothing to count."""
    if total <= 0:
        return 0
    return (part * 100 + total // 2) // total


def percent_floor(part: int, total: int) -> int:
    """Floor integer percent, used for quiz scores so that `percent >= 70` means pass."""
    if total <= 0:
        return 0
    return part * 100 // total


# --- lookups / access ---------------------------------------------------------


def get_course_or_404(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


def get_lesson_or_404(db: Session, lesson_id: int) -> Lesson:
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return lesson


def lesson_course_id(db: Session, lesson: Lesson) -> int:
    return db.scalar(select(Module.course_id).where(Module.id == lesson.module_id))


def is_enrolled(db: Session, user_id: int, course_id: int) -> bool:
    return (
        db.scalar(
            select(Enrollment.id).where(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        )
        is not None
    )


def require_course_access(db: Session, user: Profile, course_id: int) -> None:
    """Admins always have access; students need an enrollment. Otherwise 403."""
    if user.role == "admin":
        return
    if not is_enrolled(db, user.id, course_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enroll in the course to access its lessons",
        )


def require_lesson_access(db: Session, user: Profile, lesson: Lesson) -> int:
    """Check access to the lesson's course and return that course id."""
    course_id = lesson_course_id(db, lesson)
    require_course_access(db, user, course_id)
    return course_id


# --- ordering / structure -----------------------------------------------------


def lesson_ids_by_course(db: Session, course_ids: Iterable[int]) -> dict[int, list[int]]:
    """Lesson ids per course in learning order: module position, then lesson position."""
    ids = list(course_ids)
    result: dict[int, list[int]] = {course_id: [] for course_id in ids}
    if not ids:
        return result
    rows = db.execute(
        select(Module.course_id, Lesson.id)
        .select_from(Lesson)
        .join(Module, Module.id == Lesson.module_id)
        .where(Module.course_id.in_(ids))
        .order_by(Module.position, Module.id, Lesson.position, Lesson.id)
    ).all()
    for course_id, lesson_id in rows:
        result[course_id].append(lesson_id)
    return result


def course_structure(db: Session, course_id: int) -> list[tuple[Module, list[Lesson]]]:
    """Modules of a course in order, each with its lessons in order."""
    modules = list(
        db.scalars(
            select(Module).where(Module.course_id == course_id).order_by(Module.position, Module.id)
        )
    )
    lessons = db.scalars(
        select(Lesson)
        .join(Module, Module.id == Lesson.module_id)
        .where(Module.course_id == course_id)
        .order_by(Module.position, Module.id, Lesson.position, Lesson.id)
    )
    by_module: dict[int, list[Lesson]] = defaultdict(list)
    for lesson in lessons:
        by_module[lesson.module_id].append(lesson)
    return [(module, by_module.get(module.id, [])) for module in modules]


# --- progress -----------------------------------------------------------------


def completed_lesson_ids(db: Session, user_id: int, lesson_ids: Iterable[int]) -> set[int]:
    ids = list(lesson_ids)
    if not ids:
        return set()
    return set(
        db.scalars(
            select(LessonProgress.lesson_id).where(
                LessonProgress.user_id == user_id,
                LessonProgress.completed.is_(True),
                LessonProgress.lesson_id.in_(ids),
            )
        )
    )


def mark_lesson_completed(db: Session, user_id: int, lesson_id: int) -> None:
    """Idempotent upsert of a completed lesson. Flushes but does not commit."""
    row = db.scalar(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id, LessonProgress.lesson_id == lesson_id
        )
    )
    if row is None:
        db.add(
            LessonProgress(user_id=user_id, lesson_id=lesson_id, completed=True, completed_at=utcnow())
        )
    elif not row.completed:
        row.completed = True
        row.completed_at = utcnow()
    # The session runs with autoflush=False, so flush before anything re-counts progress.
    db.flush()


def course_progress_percent(db: Session, user_id: int, course_id: int) -> int:
    total = (
        db.scalar(
            select(func.count(Lesson.id))
            .select_from(Lesson)
            .join(Module, Module.id == Lesson.module_id)
            .where(Module.course_id == course_id)
        )
        or 0
    )
    done = (
        db.scalar(
            select(func.count(LessonProgress.id))
            .select_from(LessonProgress)
            .join(Lesson, Lesson.id == LessonProgress.lesson_id)
            .join(Module, Module.id == Lesson.module_id)
            .where(
                LessonProgress.user_id == user_id,
                LessonProgress.completed.is_(True),
                Module.course_id == course_id,
            )
        )
        or 0
    )
    return percent_rounded(done, total)


# --- course cards -------------------------------------------------------------


def build_course_cards(db: Session, courses: Sequence[Course], user: Profile | None) -> list[CourseCard]:
    """Build CourseCards with a fixed number of grouped queries (no per-course N+1)."""
    if not courses:
        return []
    ids = [course.id for course in courses]

    lesson_totals: dict[int, int] = dict(
        db.execute(
            select(Module.course_id, func.count(Lesson.id))
            .select_from(Lesson)
            .join(Module, Module.id == Lesson.module_id)
            .where(Module.course_id.in_(ids))
            .group_by(Module.course_id)
        ).all()
    )

    enrolled_ids: set[int] = set()
    done_counts: dict[int, int] = {}
    if user is not None:
        enrolled_ids = set(
            db.scalars(
                select(Enrollment.course_id).where(
                    Enrollment.user_id == user.id, Enrollment.course_id.in_(ids)
                )
            )
        )
        if enrolled_ids:
            done_counts = dict(
                db.execute(
                    select(Module.course_id, func.count(LessonProgress.id))
                    .select_from(LessonProgress)
                    .join(Lesson, Lesson.id == LessonProgress.lesson_id)
                    .join(Module, Module.id == Lesson.module_id)
                    .where(
                        LessonProgress.user_id == user.id,
                        LessonProgress.completed.is_(True),
                        Module.course_id.in_(enrolled_ids),
                    )
                    .group_by(Module.course_id)
                ).all()
            )

    cards: list[CourseCard] = []
    for course in courses:
        enrolled = course.id in enrolled_ids
        total = lesson_totals.get(course.id, 0)
        progress = percent_rounded(done_counts.get(course.id, 0), total) if enrolled else 0
        cards.append(
            CourseCard(
                id=course.id,
                title=course.title,
                description=course.description or "",
                category=course.category,
                level=course.level,
                duration_hours=course.duration_hours or 0,
                lessons_count=total,
                enrolled=enrolled,
                progress_percent=progress,
            )
        )
    return cards


def build_course_card(db: Session, course: Course, user: Profile | None = None) -> CourseCard:
    return build_course_cards(db, [course], user)[0]


def quiz_for_lesson(db: Session, lesson_id: int) -> Quiz | None:
    return db.scalar(select(Quiz).where(Quiz.lesson_id == lesson_id))
