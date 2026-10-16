import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
  AdminQuiz,
  AdminStats,
  AiMessage,
  CourseDetail,
  CourseInput,
  CourseLevel,
  CourseList,
  Dashboard,
  DevLoginResponse,
  Lesson,
  LessonCompleteResult,
  LessonInput,
  ModuleInput,
  Quiz,
  QuizAnswer,
  QuizAttemptResult,
  QuizUpsertInput,
  TutorAnswer,
  TutorRequest,
  UploadResult,
  User,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

export const TOKEN_KEY = "sp_token";
/** Dispatched on window when the stored token is cleared (e.g. after a 401). */
export const AUTH_EVENT = "sp-auth-change";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable (private mode): the token simply won't persist
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  if (err instanceof Error) return err.message;
  return "Произошла неизвестная ошибка";
}

function extractDetail(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .join("; ");
    }
  }
  return `Ошибка сервера (${status})`;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  form?: FormData;
  /** Send Bearer token from localStorage (default true). */
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, form, auth = true } = opts;
  const headers: Record<string, string> = {};

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (form) {
    payload = form; // browser sets multipart boundary itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: payload,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте подключение.");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) clearToken();
    throw new ApiError(res.status, extractDetail(data, res.status));
  }
  return data as T;
}

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------- Auth ----------

export function googleLoginUrl(): string {
  return `${API_URL}/api/auth/google/login`;
}

export const getMe = () => request<User>("/api/auth/me");

export const devLogin = (email: string, full_name?: string) =>
  request<DevLoginResponse>("/api/auth/dev-login", {
    method: "POST",
    body: { email, full_name },
    auth: false,
  });

// ---------- Catalog ----------

export interface CourseListParams {
  q?: string;
  category?: string;
  level?: CourseLevel | "";
  limit?: number;
  offset?: number;
}

export const getCourses = (params: CourseListParams = {}) =>
  request<CourseList>(`/api/courses${qs({ ...params })}`);

export const getCourseCategories = () => request<string[]>("/api/courses/categories");

export const getCourse = (id: number) => request<CourseDetail>(`/api/courses/${id}`);

export const enroll = (id: number) =>
  request<{ enrolled: boolean }>(`/api/courses/${id}/enroll`, { method: "POST" });

export const unenroll = (id: number) =>
  request<void>(`/api/courses/${id}/enroll`, { method: "DELETE" });

// ---------- Lessons & progress ----------

export const getLesson = (id: number) => request<Lesson>(`/api/lessons/${id}`);

export const completeLesson = (id: number) =>
  request<LessonCompleteResult>(`/api/lessons/${id}/complete`, { method: "POST" });

// ---------- Quizzes ----------

export const getQuiz = (lessonId: number) => request<Quiz>(`/api/lessons/${lessonId}/quiz`);

export const submitAttempt = (quizId: number, answers: QuizAnswer[]) =>
  request<QuizAttemptResult>(`/api/quizzes/${quizId}/attempts`, {
    method: "POST",
    body: { answers },
  });

// ---------- Dashboard ----------

export const getDashboard = () => request<Dashboard>("/api/me/dashboard");

// ---------- AI tutor ----------

export const askTutor = (body: TutorRequest) =>
  request<TutorAnswer>("/api/ai/tutor", { method: "POST", body });

export const getAiHistory = (lessonId: number) =>
  request<AiMessage[]>(`/api/ai/history${qs({ lesson_id: lessonId })}`);

// ---------- Admin ----------

export const adminStats = () => request<AdminStats>("/api/admin/stats");

export const adminListCourses = () => request<AdminCourse[]>("/api/admin/courses");

export const adminCreateCourse = (body: CourseInput) =>
  request<AdminCourse>("/api/admin/courses", { method: "POST", body });

export const adminUpdateCourse = (id: number, body: Partial<CourseInput>) =>
  request<AdminCourse>(`/api/admin/courses/${id}`, { method: "PUT", body });

export const adminDeleteCourse = (id: number) =>
  request<void>(`/api/admin/courses/${id}`, { method: "DELETE" });

export const adminCreateModule = (courseId: number, body: ModuleInput) =>
  request<AdminModule>(`/api/admin/courses/${courseId}/modules`, { method: "POST", body });

export const adminUpdateModule = (id: number, body: Partial<ModuleInput>) =>
  request<AdminModule>(`/api/admin/modules/${id}`, { method: "PUT", body });

export const adminDeleteModule = (id: number) =>
  request<void>(`/api/admin/modules/${id}`, { method: "DELETE" });

export const adminCreateLesson = (moduleId: number, body: LessonInput) =>
  request<AdminLesson>(`/api/admin/modules/${moduleId}/lessons`, { method: "POST", body });

export const adminUpdateLesson = (id: number, body: Partial<LessonInput>) =>
  request<AdminLesson>(`/api/admin/lessons/${id}`, { method: "PUT", body });

export const adminDeleteLesson = (id: number) =>
  request<void>(`/api/admin/lessons/${id}`, { method: "DELETE" });

export const adminGetQuiz = (lessonId: number) =>
  request<AdminQuiz>(`/api/admin/lessons/${lessonId}/quiz`);

export const adminUpsertQuiz = (lessonId: number, body: QuizUpsertInput) =>
  request<AdminQuiz>(`/api/admin/lessons/${lessonId}/quiz`, { method: "PUT", body });

export const adminDeleteQuiz = (lessonId: number) =>
  request<void>(`/api/admin/lessons/${lessonId}/quiz`, { method: "DELETE" });

export function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>("/api/admin/upload", { method: "POST", form });
}
