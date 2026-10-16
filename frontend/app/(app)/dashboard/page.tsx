"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import CourseCard from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import ProtectedPage from "@/components/ProtectedPage";
import Skeleton from "@/components/Skeleton";
import StatCard from "@/components/StatCard";
import { errorMessage, getDashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { courseTheme } from "@/lib/courseTheme";
import type { Dashboard, DashboardCourse } from "@/lib/types";

/** Score at which a quiz counts as passed (same rule as the backend and the quiz). */
const PASS_PERCENT = 70;

/** Text links on the beige page background: ink with an accent underline, so the contrast stays above 4.5:1. */
const linkClass = "font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <DashboardContent />
    </ProtectedPage>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resumeHref(course: DashboardCourse): string {
  return course.next_lesson_id ? `/lessons/${course.next_lesson_id}` : `/courses/${course.id}`;
}

function DashboardContent() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboard()
      .then(setData)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const greeting = user?.full_name || user?.email || "студент";
  // The course to continue: the first one not finished yet, otherwise the first one.
  const current =
    data?.courses.find((c) => c.progress_percent > 0 && c.progress_percent < 100) ??
    data?.courses.find((c) => c.progress_percent < 100) ??
    data?.courses[0];
  const currentTheme = current ? courseTheme(current.category, current.id) : null;

  return (
    <div className="space-y-10 md:space-y-14">
      <header className="space-y-2">
        <h1 className="text-[2.5rem] font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          Привет, {greeting}
        </h1>
        <p className="text-[1.0625rem] text-muted">Прогресс по курсам и результаты тестов.</p>
      </header>

      {loading && (
        <div className="space-y-10" aria-busy="true" aria-live="polite">
          <span className="sr-only">Загружаем дашборд</span>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <Skeleton className="h-[104px]" />
            <Skeleton className="h-[104px]" />
            <Skeleton className="h-[104px]" />
            <Skeleton className="h-[104px]" />
          </div>
          <Skeleton className="h-56 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      )}

      {!loading && error && <ErrorBox message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          {current && currentTheme && (
            <section className="space-y-4" aria-labelledby="continue-title">
              <h2 id="continue-title" className="text-3xl font-bold tracking-tight text-ink">
                Продолжить
              </h2>
              <div
                className="flex flex-col gap-6 rounded-2xl p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8"
                style={{ background: currentTheme.bg, color: currentTheme.fg }}
              >
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{current.category}</p>
                  <p className="text-2xl font-extrabold leading-snug sm:text-3xl">{current.title}</p>
                  <p className="text-[0.9375rem] font-semibold">Пройдено {Math.round(current.progress_percent)}%</p>
                </div>
                <Link href={resumeHref(current)} className="btn-primary shrink-0 !px-6 !py-3 text-base">
                  {current.next_lesson_id ? "Следующий урок" : "Открыть курс"}
                </Link>
              </div>
            </section>
          )}

          <section aria-label="Сводка" className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            <StatCard label="Активных курсов" value={data.stats.courses_active} />
            <StatCard label="Пройдено уроков" value={data.stats.lessons_completed} />
            <StatCard label="Средний балл тестов" value={`${Math.round(data.stats.avg_quiz_percent)}%`} />
            <StatCard label="Попыток тестов" value={data.stats.quiz_attempts} />
          </section>

          <section className="space-y-4" aria-labelledby="my-courses-title">
            <div className="flex items-end justify-between gap-4">
              <h2 id="my-courses-title" className="text-3xl font-bold tracking-tight text-ink">
                Мои курсы
              </h2>
              <Link href="/courses" className={`inline-flex min-h-11 items-center ${linkClass}`}>
                Все курсы
              </Link>
            </div>
            {data.courses.length === 0 ? (
              <div className="card text-[0.9375rem] text-muted">
                Вы не записаны ни на один курс.{" "}
                <Link href="/courses" className={linkClass}>
                  Открыть каталог
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.courses.map((course) => (
                  <li key={course.id}>
                    <CourseCard
                      course={course}
                      action={
                        <Link href={resumeHref(course)} className="btn-primary w-full !py-2">
                          {course.next_lesson_id ? "Продолжить" : "Открыть курс"}
                        </Link>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4" aria-labelledby="attempts-title">
            <h2 id="attempts-title" className="text-3xl font-bold tracking-tight text-ink">
              Последние результаты тестов
            </h2>
            {data.recent_attempts.length === 0 ? (
              <div className="card text-[0.9375rem] text-muted">Тестов пока не было. Пройдите тест в любом уроке.</div>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-card">
                {data.recent_attempts.map((attempt) => {
                  const passed = attempt.percent >= PASS_PERCENT;
                  return (
                    <li key={attempt.attempt_id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <Link
                          href={`/lessons/${attempt.lesson_id}`}
                          className="block truncate font-semibold text-ink hover:text-accent"
                        >
                          {attempt.quiz_title}
                        </Link>
                        <p className="text-sm text-muted">{formatDate(attempt.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <span
                          className={`flex items-center gap-1.5 text-sm font-semibold ${passed ? "text-success" : "text-danger"}`}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            {passed ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
                          </svg>
                          {passed ? "Зачтено" : "Не зачтено"}
                        </span>
                        <span className="min-w-[4.5rem] whitespace-nowrap text-right text-xl font-extrabold tabular-nums text-ink">
                          {Math.round(attempt.percent)}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {data.recommendations.length > 0 && (
            <section className="space-y-4" aria-labelledby="recommendations-title">
              <h2 id="recommendations-title" className="text-3xl font-bold tracking-tight text-ink">
                Рекомендации
              </h2>
              <ul className="grid gap-4 md:grid-cols-3">
                {data.recommendations.map((course) => (
                  <li key={course.id}>
                    <CourseCard course={course} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
