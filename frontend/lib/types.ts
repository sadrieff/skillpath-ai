// Response/request shapes from ARCHITECTURE.md (REST API section).

export type Role = "student" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: Role;
}

export interface DevLoginResponse {
  access_token: string;
  user: User;
}

export type CourseLevel = "beginner" | "intermediate" | "advanced";

export interface CourseCard {
  id: number;
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  duration_hours: number;
  lessons_count: number;
  enrolled: boolean;
  progress_percent: number;
}

export interface CourseList {
  items: CourseCard[];
  total: number;
}

export interface LessonBrief {
  id: number;
  title: string;
  position: number;
  completed: boolean;
}

export interface ModuleTree {
  id: number;
  title: string;
  position: number;
  lessons: LessonBrief[];
}

export interface CourseDetail extends CourseCard {
  modules: ModuleTree[];
}

export interface Lesson {
  id: number;
  title: string;
  content: string;
  video_url: string | null;
  material_url: string | null;
  module_id: number;
  course_id: number;
  completed: boolean;
  has_quiz: boolean;
  prev_lesson_id: number | null;
  next_lesson_id: number | null;
}

export interface LessonCompleteResult {
  completed: boolean;
  course_progress_percent: number;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
}

/** GET /api/lessons/{id}/quiz (never contains correct_index) */
export interface Quiz {
  id: number;
  title: string;
  questions: QuizQuestion[];
}

export interface QuizAnswer {
  question_id: number;
  choice_index: number;
}

export interface QuizAttemptRequest {
  answers: QuizAnswer[];
}

export interface QuizAttemptResultItem {
  question_id: number;
  choice_index: number;
  correct: boolean;
  correct_index: number;
  explanation: string;
}

export interface QuizAttemptResult {
  attempt_id: number;
  score: number;
  total: number;
  percent: number;
  results: QuizAttemptResultItem[];
}

export interface DashboardStats {
  courses_active: number;
  lessons_completed: number;
  avg_quiz_percent: number;
  quiz_attempts: number;
}

export interface DashboardCourse extends CourseCard {
  next_lesson_id: number | null;
}

export interface RecentAttempt {
  attempt_id: number;
  quiz_title: string;
  lesson_id: number;
  percent: number;
  created_at: string;
}

export interface Dashboard {
  stats: DashboardStats;
  courses: DashboardCourse[];
  recent_attempts: RecentAttempt[];
  recommendations: CourseCard[];
}

export type TutorMode =
  | "explain_simple"
  | "example"
  | "explain_mistake"
  | "review_plan"
  | "question";

export interface TutorRequest {
  lesson_id: number;
  mode: TutorMode;
  message?: string;
  attempt_id?: number;
}

export interface TutorAnswer {
  answer: string;
  message_id: number;
}

/** One row of GET /api/ai/history (shape is not fixed by the contract; mirrors ai_messages). */
export interface AiMessage {
  id: number;
  lesson_id: number;
  mode: TutorMode;
  prompt: string;
  answer: string;
  created_at: string;
}

// ---------- Admin ----------

export interface AdminStats {
  users: number;
  courses: number;
  lessons: number;
  enrollments: number;
  attempts: number;
}

export interface CourseInput {
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  duration_hours: number;
}

export interface AdminCourse extends CourseInput {
  id: number;
}

export interface ModuleInput {
  title: string;
  position: number;
}

export interface AdminModule extends ModuleInput {
  id: number;
  course_id: number;
}

export interface LessonInput {
  title: string;
  content: string;
  video_url: string | null;
  material_url: string | null;
  position: number;
}

export interface AdminLesson extends LessonInput {
  id: number;
  module_id: number;
}

export interface AdminQuestion {
  id: number;
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

/** GET /api/admin/lessons/{id}/quiz (includes correct_index) */
export interface AdminQuiz {
  id: number;
  title: string;
  questions: AdminQuestion[];
}

export interface QuizQuestionInput {
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

/** PUT /api/admin/lessons/{id}/quiz body */
export interface QuizUpsertInput {
  title: string;
  questions: QuizQuestionInput[];
}

export interface UploadResult {
  url: string;
}
