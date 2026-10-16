"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import CourseCard from "@/components/CourseCard";
import CourseCover from "@/components/CourseCover";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import ProtectedPage from "@/components/ProtectedPage";
import Skeleton from "@/components/Skeleton";
import StatCard from "@/components/StatCard";
import { errorMessage, getDashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Dashboard, DashboardCourse } from "@/lib/types";

/** Score at which a quiz counts as passed (same rule as the backend and the quiz). */
const PASS_PERCENT = 70;

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

  return (
    <div className="space-y-12 md:space-y-14">
      <header className="space-y-2">
        <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">Добрый день, {greeting}</h1>
        <p className="text-[1.0625rem] text-muted">Прогресс по курсам и результаты тестов.</p>
      </header>

      {loading && (
        <div className="space-y-12" aria-busy="true" aria-live="polite">
          <span className="sr-only">Загружаем дашборд</span>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      )}

      {!loading && error && <ErrorBox message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          {current && (
            <section aria-labelledby="continue-title" className="card overflow-hidden p-0">
              <div className="grid md:grid-cols-2">
                <div className="flex flex-col justify-center gap-5 p-8">
                  <p className="kicker">Продолжить обучение</p>
                  <h2 id="continue-title" className="font-serif text-3xl text-ink">
                    {current.title}
                  </h2>
                  <div className="max-w-sm">
                    <ProgressBar value={current.progress_percent} label="Пройдено" />
                  </div>
                  <div>
                    <Link href={resumeHref(current)} className="btn-accent">
                      {current.next_lesson_id ? "Продолжить" : "Открыть курс"}
                    </Link>
                  </div>
                </div>
                <CourseCover category={current.category} id={current.id} title={current.title} className="h-full min-h-[220px]" />
              </div>
            </section>
          )}

          <section aria-label="Сводка" className="card grid grid-cols-2 gap-px overflow-hidden bg-line p-0 md:grid-cols-4">
            <div className="bg-surface p-6">
              <StatCard label="Активных курсов" value={data.stats.courses_active} />
            </div>
            <div className="bg-surface p-6">
              <StatCard label="Пройдено уроков" value={data.stats.lessons_completed} />
            </div>
            <div className="bg-surface p-6">
              <StatCard label="Средний балл тестов" value={`${Math.round(data.stats.avg_quiz_percent)}%`} />
            </div>
            <div className="bg-surface p-6">
              <StatCard label="Попыток тестов" value={data.stats.quiz_attempts} />
            </div>
          </section>

          <section className="space-y-5" aria-labelledby="my-courses-title">
            <div className="flex items-end justify-between gap-4">
              <h2 id="my-courses-title" className="font-serif text-[1.75rem] text-ink sm:text-3xl">
                Мои курсы
              </h2>
              <Link
                href="/courses"
                className="inline-flex min-h-11 items-center font-medium text-accent transition-colors duration-150 hover:text-ink"
              >
                Все курсы →
              </Link>
            </div>
            {data.courses.length === 0 ? (
              <div className="card text-[0.9375rem] text-muted">
                Вы не записаны ни на один курс.{" "}
                <Link href="/courses" className="font-medium text-accent hover:text-ink">
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
                        <Link href={resumeHref(course)} className="btn-secondary w-full !py-2">
                          {course.next_lesson_id ? "Продолжить" : "Открыть курс"}
                        </Link>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-5" aria-labelledby="attempts-title">
            <h2 id="attempts-title" className="font-serif text-[1.75rem] text-ink sm:text-3xl">
              Последние результаты тестов
            </h2>
            {data.recent_attempts.length === 0 ? (
              <div className="card text-[0.9375rem] text-muted">Тестов пока не было. Пройдите тест в любом уроке.</div>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden p-0">
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
                          className={`flex items-center gap-1.5 text-sm font-medium ${passed ? "text-accent" : "text-danger"}`}
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
                        <span className="min-w-[4.5rem] whitespace-nowrap text-right font-semibold tabular-nums text-ink">
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
            <section className="space-y-5" aria-labelledby="recommendations-title">
              <h2 id="recommendations-title" className="font-serif text-[1.75rem] text-ink sm:text-3xl">
                Рекомендации
              </h2>
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
