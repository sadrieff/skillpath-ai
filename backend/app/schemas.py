"""Pydantic v2 request/response models for the REST API (see ARCHITECTURE.md)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CourseLevel = Literal["beginner", "intermediate", "advanced"]
TutorMode = Literal["explain_simple", "example", "explain_mistake", "review_plan", "question"]


# --- Auth -------------------------------------------------------------------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str = ""
    avatar_url: str | None = None
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class DevLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("email")
    @classmethod
    def _looks_like_email(cls, value: str) -> str:
        value = value.strip().lower()
        local, sep, domain = value.partition("@")
        if not sep or not local or "." not in domain:
            raise ValueError("invalid email")
        return value


# --- Catalog / courses -------------------------------------------------------

class CourseCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str = ""
    category: str
    level: str
    duration_hours: int = 0
    lessons_count: int = 0
    enrolled: bool = False
    progress_percent: int = 0


class CourseListOut(BaseModel):
    items: list[CourseCard]
    total: int


class LessonBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    position: int = 0
    completed: bool = False


class ModuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    position: int = 0
    lessons: list[LessonBrief] = []


class CourseDetail(CourseCard):
    modules: list[ModuleOut] = []


class EnrollOut(BaseModel):
    enrolled: bool = True


# --- Lessons -----------------------------------------------------------------

class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str = ""
    video_url: str | None = None
    material_url: str | None = None
    module_id: int
    course_id: int
    completed: bool = False
    has_quiz: bool = False
    prev_lesson_id: int | None = None
    next_lesson_id: int | None = None


class CompleteOut(BaseModel):
    completed: bool = True
    course_progress_percent: int = 0


# --- Quizzes -----------------------------------------------------------------

class QuestionPublic(BaseModel):
    """Question as shown to students: never includes correct_index."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    options: list[str]


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    questions: list[QuestionPublic]


class AnswerIn(BaseModel):
    question_id: int
    choice_index: int = Field(ge=0)


class AttemptIn(BaseModel):
    answers: list[AnswerIn]


class ResultItem(BaseModel):
    question_id: int
    choice_index: int
    correct: bool
    correct_index: int
    explanation: str = ""


class AttemptOut(BaseModel):
    attempt_id: int
    score: int
    total: int
    percent: int
    results: list[ResultItem]


# --- Dashboard ---------------------------------------------------------------

class DashboardStats(BaseModel):
    courses_active: int = 0
    lessons_completed: int = 0
    avg_quiz_percent: float = 0.0
    quiz_attempts: int = 0


class DashboardCourse(CourseCard):
    next_lesson_id: int | None = None


class RecentAttemptOut(BaseModel):
    attempt_id: int
    quiz_title: str
    lesson_id: int
    percent: int
    created_at: datetime


class DashboardOut(BaseModel):
    stats: DashboardStats
    courses: list[DashboardCourse] = []
    recent_attempts: list[RecentAttemptOut] = []
    recommendations: list[CourseCard] = []


# --- AI tutor ----------------------------------------------------------------

class TutorIn(BaseModel):
    lesson_id: int
    mode: TutorMode
    message: str | None = Field(default=None, max_length=2000)
    attempt_id: int | None = None


class TutorOut(BaseModel):
    answer: str
    message_id: int


class AiHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson_id: int
    mode: str
    prompt: str
    answer: str
    created_at: datetime


# --- Admin: courses / modules / lessons ---------------------------------------

class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    category: str = Field(min_length=1, max_length=100)
    level: CourseLevel = "beginner"
    duration_hours: int = Field(default=1, ge=0)


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    level: CourseLevel | None = None
    duration_hours: int | None = Field(default=None, ge=0)


class CourseAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str = ""
    category: str
    level: str
    duration_hours: int = 0
    author_id: int | None = None
    created_at: datetime


class ModuleIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    position: int = Field(default=0, ge=0)


class ModuleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    position: int | None = Field(default=None, ge=0)


class ModuleAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    position: int = 0


class LessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = ""
    video_url: str | None = Field(default=None, max_length=500)
    material_url: str | None = Field(default=None, max_length=500)
    position: int = Field(default=0, ge=0)


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    video_url: str | None = Field(default=None, max_length=500)
    material_url: str | None = Field(default=None, max_length=500)
    position: int | None = Field(default=None, ge=0)


class LessonAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    module_id: int
    title: str
    content: str = ""
    video_url: str | None = None
    material_url: str | None = None
    position: int = 0


# --- Admin: quizzes ----------------------------------------------------------

class QuestionAdminIn(BaseModel):
    text: str = Field(min_length=1)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)
    explanation: str = ""

    @model_validator(mode="after")
    def _correct_index_in_range(self) -> "QuestionAdminIn":
        if self.correct_index >= len(self.options):
            raise ValueError("correct_index is out of range for options")
        return self


class QuizAdminIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    questions: list[QuestionAdminIn] = Field(min_length=1)


class QuestionAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    options: list[str]
    correct_index: int
    explanation: str = ""


class QuizAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson_id: int
    title: str
    questions: list[QuestionAdminOut] = []


# --- Admin: misc -------------------------------------------------------------

class UploadOut(BaseModel):
    url: str


class StatsOut(BaseModel):
    users: int
    courses: int
    lessons: int
    enrollments: int
    attempts: int
