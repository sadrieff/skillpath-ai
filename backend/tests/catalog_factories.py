"""Small data factories for the catalog / progress / dashboard tests.

`seed()` returns row counts rather than ids, so tests build the rows they need with these helpers
instead of depending on the demo data.
"""
from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import (
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    Question,
    Quiz,
    QuizAttempt,
)
from app.services.courses import lesson_ids_by_course


def make_course(
    db: Session,
    title: str,
    *,
    category: str = "Python",
    level: str = "beginner",
    lessons: Sequence[int] = (2,),
    created_at: datetime | None = None,
    description: str = "Описание курса",
) -> Course:
    """Create a course. `lessons` lists the lesson count of each module, in order."""
    course = Course(
        title=title,
        description=description,
        category=category,
        level=level,
        duration_hours=3,
    )
    if created_at is not None:
        course.created_at = created_at
    for module_position, lesson_count in enumerate(lessons, start=1):
        module = Module(title=f"{title} модуль {module_position}", position=module_position)
        for lesson_position in range(1, lesson_count + 1):
            module.lessons.append(
                Lesson(
                    title=f"{title} урок {module_position}.{lesson_position}",
                    content="# Урок\n\nТекст урока.",
                    position=lesson_position,
                )
            )
        course.modules.append(module)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def course_lesson_ids(db: Session, course: Course) -> list[int]:
    """Lesson ids in learning order (module position, then lesson position)."""
    return lesson_ids_by_course(db, [course.id])[course.id]


def make_quiz(
    db: Session,
    lesson_id: int,
    specs: Iterable[tuple[list[str], int]],
    *,
    title: str = "Проверка",
) -> Quiz:
    """Create a quiz; `specs` is a list of (options, correct_index) per question."""
    quiz = Quiz(lesson_id=lesson_id, title=title)
    for position, (options, correct_index) in enumerate(specs, start=1):
        quiz.questions.append(
            Question(
                text=f"Вопрос {position}",
                options=list(options),
                correct_index=correct_index,
                explanation=f"Объяснение {position}",
                position=position,
            )
        )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


def enroll(db: Session, user_id: int, course_id: int) -> None:
    db.add(Enrollment(user_id=user_id, course_id=course_id))
    db.commit()


def mark_done(db: Session, user_id: int, lesson_id: int) -> None:
    db.add(LessonProgress(user_id=user_id, lesson_id=lesson_id, completed=True))
    db.commit()


def add_attempt(
    db: Session,
    user_id: int,
    quiz_id: int,
    score: int,
    total: int,
    created_at: datetime,
) -> QuizAttempt:
    attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        score=score,
        total=total,
        answers=[],
        created_at=created_at,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt
