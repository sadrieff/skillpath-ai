"""Lesson content, completion and the public quiz view (enrolled students or admins only)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import Question
from app.schemas import CompleteOut, LessonOut, QuestionPublic, QuizOut
from app.services.courses import (
    completed_lesson_ids,
    course_progress_percent,
    get_lesson_or_404,
    lesson_ids_by_course,
    mark_lesson_completed,
    quiz_for_lesson,
    require_lesson_access,
)

router = APIRouter(prefix="/lessons", tags=["lessons"])


@router.get("/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: int, db: DbSession, user: CurrentUser) -> LessonOut:
    lesson = get_lesson_or_404(db, lesson_id)
    course_id = require_lesson_access(db, user, lesson)

    order = lesson_ids_by_course(db, [course_id])[course_id]
    index = order.index(lesson.id)
    prev_id = order[index - 1] if index > 0 else None
    next_id = order[index + 1] if index + 1 < len(order) else None

    return LessonOut(
        id=lesson.id,
        title=lesson.title,
        content=lesson.content or "",
        video_url=lesson.video_url,
        material_url=lesson.material_url,
        module_id=lesson.module_id,
        course_id=course_id,
        completed=lesson.id in completed_lesson_ids(db, user.id, [lesson.id]),
        has_quiz=quiz_for_lesson(db, lesson.id) is not None,
        prev_lesson_id=prev_id,
        next_lesson_id=next_id,
    )


@router.post("/{lesson_id}/complete", response_model=CompleteOut)
def complete_lesson(lesson_id: int, db: DbSession, user: CurrentUser) -> CompleteOut:
    lesson = get_lesson_or_404(db, lesson_id)
    course_id = require_lesson_access(db, user, lesson)
    mark_lesson_completed(db, user.id, lesson.id)
    db.commit()
    return CompleteOut(
        completed=True,
        course_progress_percent=course_progress_percent(db, user.id, course_id),
    )


@router.get("/{lesson_id}/quiz", response_model=QuizOut)
def get_lesson_quiz(lesson_id: int, db: DbSession, user: CurrentUser) -> QuizOut:
    lesson = get_lesson_or_404(db, lesson_id)
    require_lesson_access(db, user, lesson)
    quiz = quiz_for_lesson(db, lesson.id)
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    questions = db.scalars(
        select(Question).where(Question.quiz_id == quiz.id).order_by(Question.position, Question.id)
    )
    # QuestionPublic has no correct_index / explanation fields, so answers never leak here.
    return QuizOut(
        id=quiz.id,
        title=quiz.title,
        questions=[
            QuestionPublic(id=q.id, text=q.text, options=list(q.options)) for q in questions
        ],
    )
