"""Admin endpoints: course/module/lesson CRUD, quizzes, uploads and stats (see ARCHITECTURE.md).

Every route requires an admin profile via `require_admin`.
"""

import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.deps import DbSession, require_admin
from app.models import (
    AiMessage,
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    Profile,
    Question,
    Quiz,
    QuizAttempt,
)
from app.schemas import (
    CourseAdminOut,
    CourseIn,
    CourseUpdate,
    LessonAdminOut,
    LessonIn,
    LessonUpdate,
    ModuleAdminOut,
    ModuleIn,
    ModuleUpdate,
    QuizAdminIn,
    QuizAdminOut,
    StatsOut,
    UploadOut,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

ALLOWED_UPLOAD_EXTENSIONS = frozenset({".pdf", ".png", ".jpg", ".jpeg", ".txt", ".md"})
UPLOAD_CHUNK_BYTES = 1024 * 1024

COURSE_NON_NULLABLE = frozenset({"title", "description", "category", "level", "duration_hours"})
MODULE_NON_NULLABLE = frozenset({"title", "position"})
LESSON_NON_NULLABLE = frozenset({"title", "content", "position"})


def _get_or_404(db: Session, model: type, obj_id: int, label: str) -> Any:
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return obj


def _apply_updates(obj: Any, data: dict[str, Any], non_nullable: frozenset[str]) -> None:
    for field, value in data.items():
        if value is None and field in non_nullable:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        setattr(obj, field, value)


def _purge_lesson_dependents(db: Session, lesson_ids: list[int]) -> None:
    """Remove rows that reference lessons but have no ORM relationship back to them."""
    if not lesson_ids:
        return
    quiz_ids = list(db.scalars(select(Quiz.id).where(Quiz.lesson_id.in_(lesson_ids))))
    if quiz_ids:
        db.execute(delete(QuizAttempt).where(QuizAttempt.quiz_id.in_(quiz_ids)))
    db.execute(delete(LessonProgress).where(LessonProgress.lesson_id.in_(lesson_ids)))
    db.execute(delete(AiMessage).where(AiMessage.lesson_id.in_(lesson_ids)))


def _lesson_ids_for_module(db: Session, module_id: int) -> list[int]:
    return list(db.scalars(select(Lesson.id).where(Lesson.module_id == module_id)))


# --- Courses -----------------------------------------------------------------

@router.get("/courses", response_model=list[CourseAdminOut])
def list_courses(db: DbSession) -> list[Course]:
    return list(db.scalars(select(Course).order_by(Course.id)))


@router.post("/courses", response_model=CourseAdminOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseIn, admin: Annotated[Profile, Depends(require_admin)], db: DbSession
) -> Course:
    course = Course(**payload.model_dump(), author_id=admin.id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.put("/courses/{course_id}", response_model=CourseAdminOut)
def update_course(course_id: int, payload: CourseUpdate, db: DbSession) -> Course:
    course = _get_or_404(db, Course, course_id, "Course")
    _apply_updates(course, payload.model_dump(exclude_unset=True), COURSE_NON_NULLABLE)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: DbSession) -> Response:
    course = _get_or_404(db, Course, course_id, "Course")
    lesson_ids = list(
        db.scalars(
            select(Lesson.id).join(Module, Lesson.module_id == Module.id).where(Module.course_id == course.id)
        )
    )
    _purge_lesson_dependents(db, lesson_ids)
    db.execute(delete(Enrollment).where(Enrollment.course_id == course.id))
    db.delete(course)  # modules -> lessons -> quizzes -> questions cascade via the ORM
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/courses/{course_id}/modules", response_model=ModuleAdminOut, status_code=status.HTTP_201_CREATED
)
def create_module(course_id: int, payload: ModuleIn, db: DbSession) -> Module:
    _get_or_404(db, Course, course_id, "Course")
    module = Module(course_id=course_id, **payload.model_dump())
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


# --- Modules -----------------------------------------------------------------

@router.put("/modules/{module_id}", response_model=ModuleAdminOut)
def update_module(module_id: int, payload: ModuleUpdate, db: DbSession) -> Module:
    module = _get_or_404(db, Module, module_id, "Module")
    _apply_updates(module, payload.model_dump(exclude_unset=True), MODULE_NON_NULLABLE)
    db.commit()
    db.refresh(module)
    return module


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(module_id: int, db: DbSession) -> Response:
    module = _get_or_404(db, Module, module_id, "Module")
    _purge_lesson_dependents(db, _lesson_ids_for_module(db, module.id))
    db.delete(module)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/modules/{module_id}/lessons", response_model=LessonAdminOut, status_code=status.HTTP_201_CREATED
)
def create_lesson(module_id: int, payload: LessonIn, db: DbSession) -> Lesson:
    _get_or_404(db, Module, module_id, "Module")
    lesson = Lesson(module_id=module_id, **payload.model_dump())
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


# --- Lessons -----------------------------------------------------------------

@router.put("/lessons/{lesson_id}", response_model=LessonAdminOut)
def update_lesson(lesson_id: int, payload: LessonUpdate, db: DbSession) -> Lesson:
    lesson = _get_or_404(db, Lesson, lesson_id, "Lesson")
    _apply_updates(lesson, payload.model_dump(exclude_unset=True), LESSON_NON_NULLABLE)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(lesson_id: int, db: DbSession) -> Response:
    lesson = _get_or_404(db, Lesson, lesson_id, "Lesson")
    _purge_lesson_dependents(db, [lesson.id])
    db.delete(lesson)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Quizzes -----------------------------------------------------------------

def _quiz_for_lesson_or_404(db: Session, lesson_id: int) -> Quiz:
    _get_or_404(db, Lesson, lesson_id, "Lesson")
    quiz = db.scalar(select(Quiz).where(Quiz.lesson_id == lesson_id))
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return quiz


@router.get("/lessons/{lesson_id}/quiz", response_model=QuizAdminOut)
def get_quiz(lesson_id: int, db: DbSession) -> Quiz:
    return _quiz_for_lesson_or_404(db, lesson_id)


@router.put("/lessons/{lesson_id}/quiz", response_model=QuizAdminOut)
def upsert_quiz(lesson_id: int, payload: QuizAdminIn, db: DbSession) -> Quiz:
    lesson = _get_or_404(db, Lesson, lesson_id, "Lesson")
    quiz = db.scalar(select(Quiz).where(Quiz.lesson_id == lesson.id))
    # Everything is staged in one session and committed once, so the question replacement
    # is atomic: either the whole new quiz is stored or the previous one stays untouched.
    try:
        if quiz is None:
            quiz = Quiz(lesson_id=lesson.id, title=payload.title)
            db.add(quiz)
        else:
            quiz.title = payload.title
            quiz.questions.clear()  # delete-orphan removes the old questions on flush
        for position, item in enumerate(payload.questions):
            quiz.questions.append(
                Question(
                    text=item.text,
                    options=list(item.options),
                    correct_index=item.correct_index,
                    explanation=item.explanation,
                    position=position,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(quiz)
    return quiz


@router.delete("/lessons/{lesson_id}/quiz", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(lesson_id: int, db: DbSession) -> Response:
    quiz = _quiz_for_lesson_or_404(db, lesson_id)
    db.execute(delete(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id))
    db.delete(quiz)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Uploads -----------------------------------------------------------------

@router.post("/upload", response_model=UploadOut)
def upload_file(file: Annotated[UploadFile, File()]) -> UploadOut:
    # The client filename is used only for its extension; the stored name is server-generated.
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Unsupported file type")

    settings = get_settings()
    limit_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4()}{suffix}"
    target = upload_dir / stored_name
    written = 0
    try:
        with target.open("wb") as out:
            while True:
                chunk = file.file.read(UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                written += len(chunk)
                if written > limit_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File is larger than {settings.MAX_UPLOAD_MB} MB",
                    )
                out.write(chunk)
        if written == 0:
            raise HTTPException(status_code=422, detail="Empty file")
    except BaseException:
        target.unlink(missing_ok=True)
        raise

    return UploadOut(url=f"/uploads/{stored_name}")


# --- Stats -------------------------------------------------------------------

@router.get("/stats", response_model=StatsOut)
def stats(db: DbSession) -> StatsOut:
    def count(model: type) -> int:
        return int(db.scalar(select(func.count()).select_from(model)) or 0)

    return StatsOut(
        users=count(Profile),
        courses=count(Course),
        lessons=count(Lesson),
        enrollments=count(Enrollment),
        attempts=count(QuizAttempt),
    )
