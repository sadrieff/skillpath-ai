"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABELS } from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import Spinner from "@/components/Spinner";
import { enroll, errorMessage, getCourse, unenroll } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { courseTheme } from "@/lib/courseTheme";
import type { CourseDetail } from "@/lib/types";

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!validId) return;
    setLoading(true);
    setError(null);
    getCourse(courseId)
      .then(setCourse)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [courseId, validId]);

  // Reload once auth has settled and whenever the signed-in user changes,
  // so `enrolled` and `progress_percent` reflect the current user.
  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, userId, load]);

  async function handleToggle() {
    if (!course) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (course.enrolled) await unenroll(course.id);
      else await enroll(course.id);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }

  if (!validId) {
    return <ErrorBox message="Некорректный идентификатор курса." />;
  }

  if (loading && !course) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Загружаем курс…" />
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} onRetry={load} />
        <Link href="/courses" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">
          ← К списку курсов
        </Link>
      </div>
    );
  }

  if (!course) return null;

  const theme = courseTheme(course.category, course.id);
  const lessons = course.modules.flatMap((m) => m.lessons);
  const completedCount = lessons.filter((l) => l.completed).length;
  const firstOpenLesson = lessons.find((l) => !l.completed);

  return (
    <div className="space-y-10">
      <Link href="/courses" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
        ← Все курсы
      </Link>

      <header
        className="space-y-6 overflow-hidden rounded-2xl p-6 sm:p-10"
        style={{ background: theme.bg, color: theme.fg }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-surface/80 text-sm">{course.category}</span>
          <span className="chip bg-surface/80 text-sm">
            {LEVEL_LABELS[course.level] ?? course.level}
          </span>
          <span className="chip bg-surface/80 text-sm">{course.duration_hours} ч</span>
          <span className="chip bg-surface/80 text-sm">{course.lessons_count} уроков</span>
        </div>

        <div className="max-w-3xl space-y-4">
          <h1 className="text-[2.5rem] font-bold leading-tight sm:text-[3rem]">{course.title}</h1>
          <p className="whitespace-pre-line text-[1.0625rem] leading-relaxed">{course.description}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {!user && (
            <Link href="/" className="btn-primary">
              Войдите, чтобы записаться
            </Link>
          )}
          {user && (
            <button
              type="button"
              onClick={handleToggle}
              disabled={actionBusy}
              className={course.enrolled ? "btn-secondary" : "btn-primary"}
            >
              {actionBusy
                ? "Сохраняем…"
                : course.enrolled
                  ? "Отписаться"
                  : "Записаться на курс"}
            </button>
          )}
        </div>
      </header>

      {actionError && <ErrorBox message={actionError} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside
          aria-label="Ваш прогресс"
          className="space-y-5 self-start rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6 lg:sticky lg:top-24 lg:order-2"
        >
          <h2 className="text-xl font-bold text-ink">Ваш прогресс</h2>

          {course.enrolled ? (
            <>
              <ProgressBar value={course.progress_percent} />
              <p className="text-[0.9375rem] text-muted">
                Пройдено уроков:{" "}
                <span className="font-semibold text-ink tabular-nums">
                  {completedCount} из {lessons.length}
                </span>
              </p>
            </>
          ) : (
            <p className="text-[0.9375rem] text-muted">
              Запишитесь на курс, чтобы отслеживать прогресс.
            </p>
          )}

          {user && course.enrolled && firstOpenLesson && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Следующий урок: <span className="text-ink">{firstOpenLesson.title}</span>
              </p>
              <Link href={`/lessons/${firstOpenLesson.id}`} className="btn-primary w-full">
                Продолжить
              </Link>
            </div>
          )}

          {user && course.enrolled && lessons.length > 0 && !firstOpenLesson && (
            <p className="text-[0.9375rem] font-semibold text-success">Все уроки пройдены.</p>
          )}
        </aside>

        <section className="space-y-5">
          <h2 className="text-[1.75rem] font-bold text-ink">Программа курса</h2>

          {course.modules.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center text-[0.9375rem] text-muted">
              Программа курса пока не заполнена.
            </div>
          )}

          {course.modules.map((module, moduleIndex) => (
            <div
              key={module.id}
              className="overflow-hidden rounded-xl border border-line bg-surface shadow-card"
            >
              <div className="flex items-center gap-4 border-b border-line px-5 py-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-bold"
                  style={{ background: theme.bg, color: theme.fg }}
                >
                  {moduleIndex + 1}
                </span>
                <h3 className="min-w-0 flex-1 text-lg font-bold leading-snug text-ink">
                  <span className="sr-only">Модуль {moduleIndex + 1}. </span>
                  {module.title}
                </h3>
                <span className="shrink-0 text-sm text-muted tabular-nums">
                  {module.lessons.filter((l) => l.completed).length}/{module.lessons.length}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/lessons/${lesson.id}`}
                      className="flex min-h-12 items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-surface-2"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                          lesson.completed ? "border-success bg-success text-accent-ink" : "border-line bg-surface"
                        }`}
                      >
                        {lesson.completed && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4 10-10" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-base ${lesson.completed ? "text-muted" : "text-ink"}`}>
                        {lesson.title}
                      </span>
                      {lesson.completed && <span className="sr-only">(пройден)</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
