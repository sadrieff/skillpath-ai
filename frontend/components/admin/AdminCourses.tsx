"use client";

import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABELS } from "@/components/CourseCard";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import {
  adminCreateCourse,
  adminDeleteCourse,
  adminListCourses,
  adminStats,
  adminUpdateCourse,
  errorMessage,
} from "@/lib/api";
import { courseTheme } from "@/lib/courseTheme";
import type { AdminCourse, AdminStats, CourseInput } from "@/lib/types";
import CourseForm from "./CourseForm";
import { dangerButton, SectionTitle } from "./ui";

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

  const statItems = stats
    ? [
        { label: "Пользователи", value: stats.users },
        { label: "Курсы", value: stats.courses },
        { label: "Уроки", value: stats.lessons },
        { label: "Записи на курсы", value: stats.enrollments },
        { label: "Попытки тестов", value: stats.attempts },
      ]
    : [];

  return (
    <div className="space-y-10">
      {error && <ErrorBox message={error} onRetry={load} />}

      {stats && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-5">
          {statItems.map((item) => (
            <div key={item.label}>
              <p className="text-[2rem] font-extrabold leading-none text-ink">{item.value}</p>
              <p className="mt-2 text-sm text-muted">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-6">
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
          <div className="card text-base text-muted">Курсов пока нет. Создайте первый курс.</div>
        )}

        {courses.length > 0 && (
          <table className="w-full text-left">
            <caption className="sr-only">Список курсов</caption>
            <thead className="sr-only md:not-sr-only">
              <tr className="border-b border-line text-sm text-muted">
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Курс
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Категория
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Уровень
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Часы
                </th>
                <th scope="col" className="py-3 font-semibold">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody className="flex flex-col gap-3 md:table-row-group md:gap-0">
              {courses.map((course) => {
                const theme = courseTheme(course.category, course.id);
                const deleting = deletingId === course.id;
                return (
                  <tr
                    key={course.id}
                    className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
                  >
                    <th scope="row" className="text-left font-normal md:border-b md:border-line md:py-4 md:pr-4">
                      <span className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full"
                          style={{ background: theme.bg, boxShadow: `inset 0 0 0 2px ${theme.fg}` }}
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold leading-snug text-ink">{course.title}</span>
                          {course.description && (
                            <span className="mt-1 line-clamp-2 block text-sm text-muted">
                              {course.description}
                            </span>
                          )}
                        </span>
                      </span>
                    </th>
                    <td className="text-sm text-ink md:border-b md:border-line md:py-4 md:pr-4">
                      <span className="text-muted md:hidden">Категория: </span>
                      {course.category}
                    </td>
                    <td className="text-sm text-ink md:border-b md:border-line md:py-4 md:pr-4">
                      <span className="text-muted md:hidden">Уровень: </span>
                      {LEVEL_LABELS[course.level] ?? course.level}
                    </td>
                    <td className="text-sm text-ink md:border-b md:border-line md:py-4 md:pr-4">
                      <span className="text-muted md:hidden">Часы: </span>
                      {course.duration_hours} ч
                    </td>
                    <td className="md:whitespace-nowrap md:border-b md:border-line md:py-4 md:text-right">
                      <div className="flex flex-wrap gap-2 md:flex-nowrap md:justify-end">
                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "edit", course })}
                          className="btn-secondary"
                          aria-label={`Редактировать курс «${course.title}»`}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCourse(course)}
                          disabled={deleting}
                          className={dangerButton}
                          aria-label={`Удалить курс «${course.title}»`}
                        >
                          {deleting ? "Удаляем…" : "Удалить"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
