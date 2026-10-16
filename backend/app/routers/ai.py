"""AI tutor endpoints: POST /ai/tutor and GET /ai/history (see ARCHITECTURE.md)."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession
from app.models import AiMessage, Enrollment, Lesson, Profile, Quiz, QuizAttempt, utcnow
from app.schemas import AiHistoryItem, TutorIn, TutorOut
from app.services import ai_client, ai_guard
from app.services.ai_client import AiNotConfigured, AiUpstreamError

router = APIRouter(tags=["ai"])

RATE_LIMIT_CALLS = 20
RATE_LIMIT_WINDOW = timedelta(minutes=10)
HISTORY_LIMIT = 20


def _load_lesson_or_404(db: Session, lesson_id: int) -> Lesson:
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return lesson


def _ensure_lesson_access(db: Session, user: Profile, lesson: Lesson) -> None:
    if user.role == "admin":
        return
    course_id = lesson.module.course_id
    enrolled = db.scalar(
        select(Enrollment.id).where(Enrollment.user_id == user.id, Enrollment.course_id == course_id)
    )
    if enrolled is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this course")


def _mistakes_for_attempt(
    db: Session, user: Profile, lesson: Lesson, attempt_id: int
) -> list[dict[str, str]]:
    """Return the wrong answers of the user's own attempt on this lesson's quiz (else 422)."""
    attempt = db.get(QuizAttempt, attempt_id)
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(status_code=422, detail="Attempt not found for this user")
    quiz = db.get(Quiz, attempt.quiz_id)
    if quiz is None or quiz.lesson_id != lesson.id:
        raise HTTPException(status_code=422, detail="Attempt does not belong to this lesson")

    questions = {question.id: question for question in quiz.questions}
    mistakes: list[dict[str, str]] = []
    for answer in attempt.answers or []:
        question = questions.get(answer.get("question_id"))
        choice_index = answer.get("choice_index")
        if question is None or not isinstance(choice_index, int):
            continue
        if not 0 <= choice_index < len(question.options):
            continue
        if choice_index == question.correct_index:
            continue
        mistakes.append(
            {
                "question": question.text,
                "chosen": question.options[choice_index],
                "correct": question.options[question.correct_index],
                "explanation": question.explanation or "",
            }
        )
    return mistakes


def _enforce_rate_limit(db: Session, user: Profile) -> None:
    since = utcnow() - RATE_LIMIT_WINDOW
    recent = db.scalar(
        select(func.count(AiMessage.id)).where(AiMessage.user_id == user.id, AiMessage.created_at >= since)
    )
    if (recent or 0) >= RATE_LIMIT_CALLS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many AI tutor requests, try again later",
        )


@router.post("/ai/tutor", response_model=TutorOut)
async def tutor(payload: TutorIn, user: CurrentUser, db: DbSession) -> TutorOut:
    # DB reads and validation happen before the upstream await; the write happens after it.
    lesson = _load_lesson_or_404(db, payload.lesson_id)
    _ensure_lesson_access(db, user, lesson)

    message = (payload.message or "").strip() or None
    if payload.mode == "question" and message is None:
        raise HTTPException(status_code=422, detail="question mode requires a message")

    if payload.mode == "question" and ai_guard.is_blocked(message):
        # Hard stop: nothing is sent to the AI and nothing is saved.
        raise HTTPException(status_code=422, detail=ai_guard.REFUSAL)

    mistakes: list[dict[str, str]] | None = None
    if payload.mode == "explain_mistake":
        if payload.attempt_id is None:
            raise HTTPException(status_code=422, detail="explain_mistake requires attempt_id")
        mistakes = _mistakes_for_attempt(db, user, lesson, payload.attempt_id)

    _enforce_rate_limit(db, user)

    lesson_title = lesson.title
    lesson_content = lesson.content or ""
    messages = ai_client.build_messages(
        payload.mode,
        lesson_title,
        lesson_content,
        message=message,
        mistakes=mistakes,
    )

    try:
        answer = await ai_client.chat(messages)
    except AiNotConfigured:
        raise HTTPException(status_code=503, detail="AI tutor is not configured") from None
    except AiUpstreamError:
        raise HTTPException(status_code=502, detail="AI tutor is temporarily unavailable") from None

    if ai_guard.is_off_topic_answer(answer) or ai_guard.is_blocked(answer):
        # The model refused or the answer drifted into a blocked topic: never show it to the student.
        raise HTTPException(status_code=422, detail=ai_guard.REFUSAL)

    row = AiMessage(
        user_id=user.id,
        lesson_id=lesson.id,
        mode=payload.mode,
        prompt=message or payload.mode,
        answer=answer,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return TutorOut(answer=answer, message_id=row.id)


@router.get("/ai/history", response_model=list[AiHistoryItem])
def history(lesson_id: int, user: CurrentUser, db: DbSession) -> list[AiMessage]:
    _load_lesson_or_404(db, lesson_id)
    rows = db.scalars(
        select(AiMessage)
        .where(AiMessage.user_id == user.id, AiMessage.lesson_id == lesson_id)
        .order_by(AiMessage.created_at.desc(), AiMessage.id.desc())
        .limit(HISTORY_LIMIT)
    ).all()
    return list(reversed(rows))
