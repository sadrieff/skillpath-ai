"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABELS } from "@/components/CourseCard";
import CourseCover from "@/components/CourseCover";
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
        <Link href="/courses" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
          ← Все курсы
        </Link>
      </div>
    );
  }

  if (!course) return null;

  const lessons = course.modules.flatMap((m) => m.lessons);
  const completedCount = lessons.filter((l) => l.completed).length;
  const firstOpenLesson = lessons.find((l) => !l.completed);

  return (
    <div className="space-y-10">
      <Link href="/courses" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
        ← Все курсы
      </Link>

      <header className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <p className="kicker">{course.category}</p>
          <h1 className="font-serif text-4xl text-ink sm:text-5xl">{course.title}</h1>
          <p className="whitespace-pre-line text-lg leading-relaxed text-muted">{course.description}</p>

          <div className="flex flex-wrap gap-2">
            <span className="chip text-sm">{LEVEL_LABELS[course.level] ?? course.level}</span>
            <span className="chip text-sm">{course.duration_hours} ч</span>
            <span className="chip text-sm">{course.lessons_count} уроков</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!user && (
              <Link href="/" className="btn-primary">
                Войдите, чтобы записаться
              </Link>
            )}
            {user && !course.enrolled && (
              <button type="button" onClick={handleToggle} disabled={actionBusy} className="btn-primary">
                {actionBusy ? "Записываем…" : "Записаться"}
              </button>
            )}
            {user && course.enrolled && firstOpenLesson && (
              <Link href={`/lessons/${firstOpenLesson.id}`} className="btn-accent">
                Продолжить
              </Link>
            )}
            {user && course.enrolled && (
              <button
                type="button"
                onClick={handleToggle}
                disabled={actionBusy}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-[0.9375rem] font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
              >
                {actionBusy ? "Отписываем…" : "Отписаться"}
              </button>
            )}
          </div>
        </div>

        <CourseCover
          category={course.category}
          id={course.id}
          title={course.title}
          className="h-56 rounded-2xl"
        />
      </header>

      {actionError && <ErrorBox message={actionError} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside
          aria-label="Ваш прогресс"
          className="card space-y-5 self-start lg:sticky lg:top-24 lg:order-2"
        >
          <p className="kicker">Ваш прогресс</p>

          {course.enrolled ? (
            <>
              <ProgressBar value={course.progress_percent} />
              <p className="text-sm text-muted">
                Пройдено {completedCount} из {lessons.length}
              </p>
            </>
          ) : (
            <p className="text-[0.9375rem] text-muted">
              Запишитесь на курс, чтобы отслеживать прогресс.
            </p>
          )}

          {user && course.enrolled && firstOpenLesson && (
            <p className="text-sm text-muted">
              Следующий урок:{" "}
              <Link
                href={`/lessons/${firstOpenLesson.id}`}
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                {firstOpenLesson.title}
              </Link>
            </p>
          )}

          {user && course.enrolled && lessons.length > 0 && !firstOpenLesson && (
            <p className="text-[0.9375rem] font-medium text-accent">Все уроки пройдены.</p>
          )}
        </aside>

        <section className="space-y-5">
          <h2 className="text-[1.75rem] sm:text-3xl">Программа курса</h2>

          {course.modules.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-[0.9375rem] text-muted">
              Программа курса пока не заполнена.
            </div>
          )}

          {course.modules.length > 0 && (
            <div className="card divide-y divide-line overflow-hidden p-0">
              {course.modules.map((module, moduleIndex) => (
                <div key={module.id}>
                  <div className="flex items-center justify-between gap-4 bg-surface-2/60 px-6 py-4">
                    <h3 className="min-w-0 text-base font-semibold leading-snug text-ink">
                      Модуль {moduleIndex + 1} · {module.title}
                    </h3>
                    <span className="shrink-0 text-sm text-muted tabular-nums">
                      {module.lessons.filter((l) => l.completed).length} из {module.lessons.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {module.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          href={`/lessons/${lesson.id}`}
                          className="flex min-h-[52px] items-center gap-4 px-6 py-3 transition-colors duration-150 hover:bg-surface-2"
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              lesson.completed ? "bg-accent text-accent-ink" : "border-2 border-line bg-surface"
                            }`}
                          >
                            {lesson.completed && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
