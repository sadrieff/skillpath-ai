"use client";

import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABELS } from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import StatCard from "@/components/StatCard";
import {
  adminCreateCourse,
  adminDeleteCourse,
  adminListCourses,
  adminStats,
  adminUpdateCourse,
  errorMessage,
} from "@/lib/api";
import type { AdminCourse, AdminStats, CourseInput } from "@/lib/types";
import CourseForm from "./CourseForm";
import { SectionTitle } from "./ui";

type Editor = { mode: "create" } | { mode: "edit"; course: AdminCourse } | null;

export default function AdminCourses() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([adminStats(), adminListCourses()])
      .then(([statsData, coursesData]) => {
        setStats(statsData);
        setCourses(coursesData);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCourse(input: CourseInput) {
    if (editor?.mode === "edit") {
      await adminUpdateCourse(editor.course.id, input);
    } else {
      await adminCreateCourse(input);
    }
    setEditor(null);
    load();
  }

  async function removeCourse(course: AdminCourse) {
    const confirmed = window.confirm(
      `Удалить курс «${course.title}»? Модули, уроки и тесты курса будут удалены. Действие необратимо.`,
    );
    if (!confirmed) return;
    setDeletingId(course.id);
    setActionError(null);
    try {
      await adminDeleteCourse(course.id);
      if (editor?.mode === "edit" && editor.course.id === course.id) setEditor(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && <ErrorBox message={error} onRetry={load} />}

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Пользователи" value={stats.users} />
          <StatCard label="Курсы" value={stats.courses} />
          <StatCard label="Уроки" value={stats.lessons} />
          <StatCard label="Записи на курсы" value={stats.enrollments} />
          <StatCard label="Попытки тестов" value={stats.attempts} />
        </div>
      )}

      <section className="space-y-5">
        <SectionTitle
          actions={
            editor?.mode === "create" ? null : (
              <button type="button" onClick={() => setEditor({ mode: "create" })} className="btn-primary">
                Новый курс
              </button>
            )
          }
        >
          Курсы
        </SectionTitle>

        {editor && (
          <CourseForm
            key={editor.mode === "edit" ? `edit-${editor.course.id}` : "create"}
            initial={editor.mode === "edit" ? editor.course : undefined}
            onSubmit={saveCourse}
            onCancel={() => setEditor(null)}
          />
        )}

        {actionError && <ErrorBox message={actionError} />}

        {loading && !stats && <Spinner label="Загружаем курсы…" />}

        {!loading && courses.length === 0 && !error && (
          <div className="card text-sm text-muted">Курсов пока нет. Создайте первый курс.</div>
        )}

        {courses.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id} className="card flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-accent/15 px-2.5 py-1 font-medium text-accent">
                      {course.category}
                    </span>
                    <span className="text-muted">{LEVEL_LABELS[course.level] ?? course.level}</span>
                    <span className="text-muted">· {course.duration_hours} ч</span>
                  </div>
                  <h3 className="font-semibold leading-snug text-ink">{course.title}</h3>
                  {course.description && (
                    <p className="line-clamp-2 text-sm text-muted">{course.description}</p>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditor({ mode: "edit", course })}
                    className="btn-secondary !py-2"
                    aria-label={`Редактировать курс «${course.title}»`}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCourse(course)}
                    disabled={deletingId === course.id}
                    className="inline-flex min-h-11 items-center justify-center rounded border border-danger/40 bg-danger/10 px-5 py-2 text-sm font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-60"
                    aria-label={`Удалить курс «${course.title}»`}
                  >
                    {deletingId === course.id ? "Удаляем…" : "Удалить"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
