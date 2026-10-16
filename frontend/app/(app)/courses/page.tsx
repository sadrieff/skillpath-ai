"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CourseCard, { LEVEL_LABELS } from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import Skeleton from "@/components/Skeleton";
import { enroll, errorMessage, getCourseCategories, getCourses, unenroll } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CourseCard as CourseCardData, CourseLevel, CourseList } from "@/lib/types";

const PAGE_SIZE = 12;
const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

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

  async function toggleEnroll(course: CourseCardData) {
    setBusyId(course.id);
    setActionError(null);
    try {
      if (course.enrolled) await unenroll(course.id);
      else await enroll(course.id);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((c) =>
                c.id === course.id ? { ...c, enrolled: !course.enrolled } : c,
              ),
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
        <Link href="/" className="btn-secondary w-full !py-2">
          Войдите, чтобы записаться
        </Link>
      );
    }
    const busy = busyId === course.id;
    if (course.enrolled) {
      return (
        <div className="flex gap-2">
          <Link href={`/courses/${course.id}`} className="btn-primary flex-1 !py-2">
            Открыть
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => toggleEnroll(course)}
            className="btn-secondary !py-2"
          >
            {busy ? "Отписываем…" : "Отписаться"}
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => toggleEnroll(course)}
        className="btn-primary w-full !py-2"
      >
        {busy ? "Записываем…" : "Записаться"}
      </button>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Курсы</h1>
        <p className="text-muted">Выберите курс по теме и уровню.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-[1fr_200px_200px]" aria-label="Фильтры">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
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
            className="input pl-10"
            aria-label="Поиск курсов"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
          className="input"
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as CourseLevel | "");
            setPage(0);
          }}
          className="input"
          aria-label="Уровень"
        >
          <option value="">Все уровни</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </select>
      </section>

      {actionError && <ErrorBox message={actionError} />}

      {loading && (
        <div className="space-y-5" aria-busy="true" aria-live="polite">
          <span className="sr-only">Загружаем курсы</span>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        </div>
      )}

      {!loading && error && <ErrorBox message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {!loading && !error && result && result.items.length === 0 && (
        <div className="card py-12 text-center text-sm text-muted">
          Курсов не найдено. Измените запрос или фильтры.
        </div>
      )}

      {!loading && !error && result && result.items.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            Найдено курсов: <span className="tabular-nums">{result.total}</span>
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((course) => (
              <CourseCard key={course.id} course={course} action={renderAction(course)} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-4 pt-2" aria-label="Пагинация">
              <button
                type="button"
                className="btn-secondary !py-2"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Назад
              </button>
              <span className="text-sm text-muted">
                Страница {page + 1} из {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary !py-2"
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
