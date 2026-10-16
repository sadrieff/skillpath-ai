"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CourseCard, { LEVEL_LABELS } from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import Skeleton from "@/components/Skeleton";
import { enroll, errorMessage, getCourseCategories, getCourses } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CourseCard as CourseCardData, CourseLevel, CourseList } from "@/lib/types";

const PAGE_SIZE = 12;
const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];
const LEVEL_OPTIONS: (CourseLevel | "")[] = ["", ...LEVELS];

const CHIP = "chip min-h-11 px-4 text-[0.9375rem] transition-colors duration-150";
const CHIP_ON = "border-ink bg-ink text-white hover:bg-ink/85";
const CHIP_OFF = "hover:bg-surface-2";

export default function CoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<CourseLevel | "">("");
  const [page, setPage] = useState(0);

  const [categories, setCategories] = useState<string[]>([]);
  const [result, setResult] = useState<CourseList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce the search input.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    getCourseCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Wait for auth to settle so `enrolled` / `progress_percent` are correct for the user.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCourses({ q, category, level, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, q, category, level, page, reloadKey]);

  async function enrollCourse(course: CourseCardData) {
    setBusyId(course.id);
    setActionError(null);
    try {
      await enroll(course.id);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((c) => (c.id === course.id ? { ...c, enrolled: true } : c)),
            }
          : prev,
      );
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function renderAction(course: CourseCardData) {
    if (!user) {
      return (
        <Link href="/" className="btn-secondary w-full">
          Войдите, чтобы записаться
        </Link>
      );
    }
    if (course.enrolled) {
      return (
        <Link href={`/courses/${course.id}`} className="btn-secondary w-full">
          Открыть курс
        </Link>
      );
    }
    const busy = busyId === course.id;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => enrollCourse(course)}
        className="btn-primary w-full"
      >
        {busy ? "Записываем…" : "Записаться"}
      </button>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl text-ink sm:text-5xl">Курсы</h1>
        <p className="text-lg text-muted">Выберите курс по теме и уровню.</p>
      </header>

      <section className="space-y-5" aria-label="Фильтры">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название курса…"
            name="q"
            autoComplete="off"
            className="input pl-11"
            aria-label="Поиск курсов"
          />
        </div>

        <div role="group" aria-label="Категория" className="flex flex-wrap gap-2">
          {["", ...categories].map((c) => {
            const active = category === c;
            return (
              <button
                key={c || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setCategory(c);
                  setPage(0);
                }}
                className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
              >
                {c || "Все"}
              </button>
            );
          })}
        </div>

        <div role="group" aria-label="Уровень" className="flex flex-wrap gap-2">
          {LEVEL_OPTIONS.map((l) => {
            const active = level === l;
            return (
              <button
                key={l || "any"}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setLevel(l);
                  setPage(0);
                }}
                className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
              >
                {l === "" ? "Любой" : LEVEL_LABELS[l]}
              </button>
            );
          })}
        </div>
      </section>

      {actionError && <ErrorBox message={actionError} />}

      <p className="text-sm text-muted" aria-live="polite">
        {!loading && !error && result && (
          <>
            Найдено курсов: <span className="font-semibold text-ink tabular-nums">{result.total}</span>
          </>
        )}
      </p>

      {loading && (
        <div aria-busy="true">
          <span className="sr-only">Загружаем курсы</span>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      )}

      {!loading && error && <ErrorBox message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {!loading && !error && result && result.items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-[0.9375rem] text-muted">
          Курсов не найдено. Измените запрос или фильтры.
        </div>
      )}

      {!loading && !error && result && result.items.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {result.items.map((course) => (
              <CourseCard key={course.id} course={course} action={renderAction(course)} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-4" aria-label="Пагинация">
              <button
                type="button"
                className="btn-secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Назад
              </button>
              <span className="text-[0.9375rem] text-muted">
                Страница {page + 1} из {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперёд
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
