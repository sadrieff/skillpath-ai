"use client";

import { useEffect, useState, type FormEvent } from "react";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import {
  adminCreateModule,
  adminDeleteLesson,
  adminDeleteModule,
  adminListCourses,
  adminUpdateModule,
  errorMessage,
} from "@/lib/api";
import type { AdminCourse, LessonBrief, ModuleInput, ModuleTree } from "@/lib/types";
import LessonForm from "./LessonForm";
import { dangerButton, focusFirstInvalid, Field, SectionTitle, parseNonNegativeInt } from "./ui";
import { useCourseTree } from "./useCourseTree";

type Editor =
  | { kind: "module"; module?: ModuleTree }
  | { kind: "lesson"; moduleId: number; lesson?: LessonBrief }
  | null;

const byPosition = <T extends { position: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.position - b.position);

const nextPosition = (items: { position: number }[]): number =>
  items.reduce((max, item) => Math.max(max, item.position + 1), 0);

export default function AdminStructure() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseId, setCourseId] = useState<number | null>(null);
  const { tree, loading, error, reload } = useCourseTree(courseId);
  const [editor, setEditor] = useState<Editor>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminListCourses()
      .then((data) => {
        if (!cancelled) setCourses(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCoursesError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectCourse(value: string) {
    setEditor(null);
    setActionError(null);
    setCourseId(value ? Number(value) : null);
  }

  async function saveModule(values: ModuleInput, moduleId?: number) {
    if (moduleId !== undefined) {
      await adminUpdateModule(moduleId, values);
    } else if (courseId !== null) {
      await adminCreateModule(courseId, values);
    }
    setEditor(null);
    reload();
  }

  async function removeModule(module: ModuleTree) {
    const confirmed = window.confirm(
      `Удалить модуль «${module.title}» вместе с его уроками и тестами?`,
    );
    if (!confirmed) return;
    await runAction(`module-${module.id}`, () => adminDeleteModule(module.id));
  }

  async function removeLesson(lesson: LessonBrief) {
    const confirmed = window.confirm(`Удалить урок «${lesson.title}» и его тест?`);
    if (!confirmed) return;
    await runAction(`lesson-${lesson.id}`, () => adminDeleteLesson(lesson.id));
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
      setEditor(null);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  const modules = tree ? byPosition(tree.modules) : [];

  return (
    <div className="space-y-10">
      <section className="card space-y-5 sm:p-6">
        <div className="max-w-md">
          <Field label="Курс">
            {(control) => (
              <select
                {...control}
                autoComplete="off"
                value={courseId ?? ""}
                onChange={(e) => selectCourse(e.target.value)}
                disabled={coursesLoading || courses.length === 0}
                className="input"
              >
                <option value="">{coursesLoading ? "Загружаем курсы…" : "Выберите курс"}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {coursesError && <ErrorBox message={coursesError} />}
        {!coursesLoading && !coursesError && courses.length === 0 && (
          <p className="text-sm text-muted">Сначала создайте курс на вкладке «Курсы».</p>
        )}
      </section>

      {courseId !== null && loading && !tree && <Spinner label="Загружаем структуру курса…" />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {actionError && <ErrorBox message={actionError} />}

      {tree && (
        <section className="space-y-5">
          <SectionTitle
            actions={
              editor?.kind === "module" && !editor.module ? null : (
                <button
                  type="button"
                  onClick={() => setEditor({ kind: "module" })}
                  className="btn-primary"
                >
                  Добавить модуль
                </button>
              )
            }
          >
            Модули и уроки
          </SectionTitle>

          {editor?.kind === "module" && !editor.module && (
            <div className="card sm:p-6">
              <ModuleForm
                initialPosition={nextPosition(modules)}
                onSubmit={(values) => saveModule(values)}
                onCancel={() => setEditor(null)}
              />
            </div>
          )}

          {modules.length === 0 && (
            <div className="card text-base text-muted">В курсе пока нет модулей.</div>
          )}

          {modules.map((module, moduleIndex) => {
            const lessons = byPosition(module.lessons);
            const editingThis = editor?.kind === "module" && editor.module?.id === module.id;
            const addingLesson = editor?.kind === "lesson" && editor.moduleId === module.id && !editor.lesson;
            return (
              <div key={module.id} className="card overflow-hidden p-0">
                <div className="space-y-4 border-b border-line px-5 py-4">
                  {editingThis ? (
                    <ModuleForm
                      initialTitle={module.title}
                      initialPosition={module.position}
                      onSubmit={(values) => saveModule(values, module.id)}
                      onCancel={() => setEditor(null)}
                    />
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-muted">
                          Модуль {moduleIndex + 1} · порядок {module.position}
                        </p>
                        <h3 className="text-lg font-semibold text-ink">{module.title}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditor({ kind: "module", module })}
                          className="btn-secondary"
                          aria-label={`Изменить модуль «${module.title}»`}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => removeModule(module)}
                          disabled={busyKey === `module-${module.id}`}
                          className={dangerButton}
                          aria-label={`Удалить модуль «${module.title}»`}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <ul className="divide-y divide-line">
                  {lessons.length === 0 && (
                    <li className="px-5 py-3 text-sm text-muted">В модуле пока нет уроков.</li>
                  )}
                  {lessons.map((lesson) => {
                    const editingLesson =
                      editor?.kind === "lesson" && editor.lesson?.id === lesson.id;
                    return (
                      <li key={lesson.id} className="px-5 py-3">
                        {editingLesson ? (
                          <LessonForm
                            moduleId={module.id}
                            lessonId={lesson.id}
                            initialPosition={lesson.position}
                            onSaved={() => {
                              setEditor(null);
                              reload();
                            }}
                            onCancel={() => setEditor(null)}
                          />
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="w-10 shrink-0 text-sm text-muted">#{lesson.position}</span>
                              <span className="truncate text-base text-ink">{lesson.title}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setEditor({ kind: "lesson", moduleId: module.id, lesson })}
                                className="btn-secondary"
                                aria-label={`Изменить урок «${lesson.title}»`}
                              >
                                Изменить
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLesson(lesson)}
                                disabled={busyKey === `lesson-${lesson.id}`}
                                className={dangerButton}
                                aria-label={`Удалить урок «${lesson.title}»`}
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="space-y-4 border-t border-line px-5 py-4">
                  {addingLesson ? (
                    <LessonForm
                      moduleId={module.id}
                      initialPosition={nextPosition(lessons)}
                      onSaved={() => {
                        setEditor(null);
                        reload();
                      }}
                      onCancel={() => setEditor(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditor({ kind: "lesson", moduleId: module.id })}
                      className="btn-secondary"
                    >
                      + Добавить урок
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

interface ModuleFormProps {
  initialTitle?: string;
  initialPosition: number;
  onSubmit: (values: ModuleInput) => Promise<void>;
  onCancel: () => void;
}

function ModuleForm({ initialTitle = "", initialPosition, onSubmit, onCancel }: ModuleFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [position, setPosition] = useState(String(initialPosition));
  const [titleError, setTitleError] = useState<string | undefined>();
  const [positionError, setPositionError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const trimmed = title.trim();
    const parsed = parseNonNegativeInt(position);
    setTitleError(trimmed ? undefined : "Укажите название модуля.");
    setPositionError(parsed === null ? "Порядок должен быть целым числом от 0." : undefined);
    if (!trimmed || parsed === null) {
      focusFirstInvalid(event.currentTarget);
      return;
    }

    setBusy(true);
    try {
      await onSubmit({ title: trimmed, position: parsed });
    } catch (err) {
      setServerError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-label="Форма модуля">
      {serverError && <ErrorBox message={serverError} />}
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_140px]">
        <Field label="Название модуля *" error={titleError}>
          {(control) => (
            <input
              {...control}
              autoComplete="off"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="input"
            />
          )}
        </Field>
        <Field label="Порядок" error={positionError}>
          {(control) => (
            <input
              {...control}
              autoComplete="off"
              type="number"
              min={0}
              step={1}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="input"
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
          Отмена
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Сохраняем…" : "Сохранить модуль"}
        </button>
      </div>
    </form>
  );
}
