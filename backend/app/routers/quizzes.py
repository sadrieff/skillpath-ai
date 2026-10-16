"""Quiz attempts: server-side scoring, answer validation and auto-completion of passed lessons."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import Question, Quiz, QuizAttempt
from app.schemas import AttemptIn, AttemptOut, ResultItem
from app.services.courses import (
    PASS_PERCENT,
    mark_lesson_completed,
    percent_floor,
    require_lesson_access,
)

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


@router.post("/{quiz_id}/attempts", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
def create_attempt(quiz_id: int, body: AttemptIn, db: DbSession, user: CurrentUser) -> AttemptOut:
    quiz = db.get(Quiz, quiz_id)
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    lesson = quiz.lesson
    require_lesson_access(db, user, lesson)

    questions = list(
        db.scalars(
            select(Question).where(Question.quiz_id == quiz.id).order_by(Question.position, Question.id)
        )
    )
    if not questions:
        raise _unprocessable("Quiz has no questions")
    by_id = {question.id: question for question in questions}

    answered: dict[int, int] = {}
    for answer in body.answers:
        question = by_id.get(answer.question_id)
        if question is None:
            raise _unprocessable(f"Unknown question id {answer.question_id}")
        if answer.question_id in answered:
            raise _unprocessable(f"Duplicate answer for question {answer.question_id}")
        if answer.choice_index >= len(question.options):
            raise _unprocessable(f"choice_index out of range for question {answer.question_id}")
        answered[answer.question_id] = answer.choice_index

    if len(answered) != len(questions):
        raise _unprocessable("All questions must be answered")

    results: list[ResultItem] = []
    stored_answers: list[dict] = []
    score = 0
    for question in questions:
        choice = answered[question.id]
        correct = choice == question.correct_index
        score += int(correct)
        results.append(
            ResultItem(
                question_id=question.id,
                choice_index=choice,
                correct=correct,
                correct_index=question.correct_index,
                explanation=question.explanation or "",
            )
        )
        stored_answers.append({"question_id": question.id, "choice_index": choice, "correct": correct})

    total = len(questions)
    percent = percent_floor(score, total)
    attempt = QuizAttempt(
        user_id=user.id,
        quiz_id=quiz.id,
        score=score,
        total=total,
        answers=stored_answers,
    )
    db.add(attempt)
    # Pass check uses the floored percent, so 'passed' and the displayed percent always agree.
    if percent >= PASS_PERCENT:
        mark_lesson_completed(db, user.id, lesson.id)
    db.commit()
    db.refresh(attempt)

    return AttemptOut(
        attempt_id=attempt.id,
        score=score,
        total=total,
        percent=percent,
        results=results,
    )
