"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABELS } from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import Spinner from "@/components/Spinner";
import { enroll, errorMessage, getCourse, unenroll } from "@/lib/api";
import { useAuth } from "@/lib/auth";
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

  const firstOpenLesson = course.modules
    .flatMap((m) => m.lessons)
    .find((lesson) => !lesson.completed);

  return (
    <div className="space-y-10">
      <Link href="/courses" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
        ← Все курсы
      </Link>

      <header className="card space-y-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-accent/15 px-2.5 py-1 font-medium text-accent">
            {course.category}
          </span>
          <span className="rounded bg-surface-2 px-2.5 py-1 text-ink">
            {LEVEL_LABELS[course.level] ?? course.level}
          </span>
          <span className="rounded bg-surface-2 px-2.5 py-1 text-ink">
            {course.duration_hours} ч
          </span>
          <span className="rounded bg-surface-2 px-2.5 py-1 text-ink">
            {course.lessons_count} уроков
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{course.title}</h1>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted sm:text-base">
            {course.description}
          </p>
        </div>

        {actionError && <ErrorBox message={actionError} />}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-sm">
            {course.enrolled ? (
              <ProgressBar value={course.progress_percent} label="Ваш прогресс" />
            ) : (
              <p className="text-sm text-muted">Запишитесь на курс, чтобы отслеживать прогресс.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {!user && (
              <Link href="/" className="btn-primary">
                Войдите, чтобы записаться
              </Link>
            )}
            {user && course.enrolled && firstOpenLesson && (
              <Link href={`/lessons/${firstOpenLesson.id}`} className="btn-primary">
                Продолжить
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
        </div>
      </header>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-ink">Программа курса</h2>

        {course.modules.length === 0 && (
          <div className="card text-sm text-muted">Программа курса пока не заполнена.</div>
        )}

        {course.modules.map((module, moduleIndex) => (
          <div key={module.id} className="card !p-0">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h3 className="font-semibold text-ink">
                <span className="mr-2 text-accent">Модуль {moduleIndex + 1}.</span>
                {module.title}
              </h3>
              <span className="shrink-0 text-xs text-muted">
                {module.lessons.filter((l) => l.completed).length}/{module.lessons.length}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {module.lessons.map((lesson, lessonIndex) => (
                <li key={lesson.id}>
                  <Link
                    href={`/lessons/${lesson.id}`}
                    className="flex min-h-11 items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-line"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                        lesson.completed
                          ? "bg-success/15 text-success"
                          : "bg-surface-2 text-muted"
                      }`}
                      aria-hidden="true"
                    >
                      {lesson.completed ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4 10-10" />
                        </svg>
                      ) : (
                        lessonIndex + 1
                      )}
                    </span>
                    <span className={`text-sm ${lesson.completed ? "text-muted" : "text-ink"}`}>
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
  );
}
