"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import CourseCard from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import ProtectedPage from "@/components/ProtectedPage";
import Skeleton from "@/components/Skeleton";
import StatCard from "@/components/StatCard";
import { errorMessage, getDashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Dashboard } from "@/lib/types";

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

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Привет, {greeting}</h1>
        <p className="text-sm text-muted">Прогресс по курсам и результаты тестов.</p>
      </header>

      {loading && (
        <div className="space-y-10" aria-busy="true" aria-live="polite">
          <span className="sr-only">Загружаем дашборд</span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
          </div>
          <Skeleton className="h-40" />
        </div>
      )}

      {!loading && error && <ErrorBox message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Сводка">
            <StatCard label="Активных курсов" value={data.stats.courses_active} />
            <StatCard label="Пройдено уроков" value={data.stats.lessons_completed} />
            <StatCard label="Средний балл тестов" value={`${Math.round(data.stats.avg_quiz_percent)}%`} />
            <StatCard label="Попыток тестов" value={data.stats.quiz_attempts} />
          </section>

          <section className="space-y-4" aria-labelledby="my-courses-title">
            <div className="flex items-end justify-between gap-4">
              <h2 id="my-courses-title" className="text-xl font-semibold text-ink">
                Мои курсы
              </h2>
              <Link href="/courses" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">
                Все курсы
              </Link>
            </div>
            {data.courses.length === 0 ? (
              <div className="card text-sm text-muted">
                Вы не записаны ни на один курс.{" "}
                <Link href="/courses" className="text-accent hover:underline">
                  Открыть каталог
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {data.courses.map((course) => (
                  <li key={course.id} className="card flex flex-col gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-accent">{course.category}</span>
                      <h3 className="font-semibold text-ink">
                        <Link href={`/courses/${course.id}`} className="hover:text-accent">
                          {course.title}
                        </Link>
                      </h3>
                    </div>
                    <ProgressBar value={course.progress_percent} />
                    <div className="mt-auto">
                      <Link
                        href={course.next_lesson_id ? `/lessons/${course.next_lesson_id}` : `/courses/${course.id}`}
                        className="btn-primary !py-2"
                      >
                        Продолжить
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4" aria-labelledby="attempts-title">
            <h2 id="attempts-title" className="text-xl font-semibold text-ink">
              Последние результаты тестов
            </h2>
            {data.recent_attempts.length === 0 ? (
              <div className="card text-sm text-muted">Тестов пока не было. Пройдите тест в любом уроке.</div>
            ) : (
              <ul className="card divide-y divide-line !p-0">
                {data.recent_attempts.map((attempt) => {
                  const passed = attempt.percent >= PASS_PERCENT;
                  return (
                    <li key={attempt.attempt_id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <Link
                          href={`/lessons/${attempt.lesson_id}`}
                          className="block truncate font-medium text-ink hover:text-accent"
                        >
                          {attempt.quiz_title}
                        </Link>
                        <p className="text-xs text-muted">{formatDate(attempt.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-muted">{passed ? "Зачтено" : "Не зачтено"}</span>
                        <span
                          className={`rounded px-3 py-1 text-sm font-semibold tabular-nums ${
                            passed ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                          }`}
                        >
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
              <h2 id="recommendations-title" className="text-xl font-semibold text-ink">
                Рекомендации
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {data.recommendations.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
