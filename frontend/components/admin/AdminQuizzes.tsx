"use client";

import { useEffect, useState } from "react";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import { ApiError, adminDeleteQuiz, adminGetQuiz, adminListCourses, errorMessage } from "@/lib/api";
import type { AdminCourse, AdminQuiz } from "@/lib/types";
import { Field, SectionTitle } from "./ui";
import QuizForm from "./QuizForm";
import { useCourseTree } from "./useCourseTree";

interface LessonOption {
  id: number;
  label: string;
}

interface LoadedQuiz {
  lessonId: number;
  quiz: AdminQuiz | null;
}

export default function AdminQuizzes() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const { tree, loading: treeLoading, error: treeError } = useCourseTree(courseId);

  const [loaded, setLoaded] = useState<LoadedQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Load the quiz (or its absence) whenever a lesson is picked.
  useEffect(() => {
    if (lessonId === null) {
      setLoaded(null);
      setQuizError(null);
      return;
    }
    let cancelled = false;
    setQuizLoading(true);
    setQuizError(null);
    setDeleteError(null);
    adminGetQuiz(lessonId)
      .then((quiz) => {
        if (!cancelled) setLoaded({ lessonId, quiz });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoaded({ lessonId, quiz: null });
        } else {
          setLoaded(null);
          setQuizError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setQuizLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const lessons: LessonOption[] = tree
    ? [...tree.modules]
        .sort((a, b) => a.position - b.position)
        .flatMap((module) =>
          [...module.lessons]
            .sort((a, b) => a.position - b.position)
            .map((lesson) => ({ id: lesson.id, label: `${module.title} · ${lesson.title}` })),
        )
    : [];

  const currentQuiz = loaded && loaded.lessonId === lessonId ? loaded.quiz : null;
  const hasQuiz = currentQuiz !== null;
  const showEditor = lessonId !== null && loaded !== null && loaded.lessonId === lessonId;

  function selectCourse(value: string) {
    setCourseId(value ? Number(value) : null);
    setLessonId(null);
  }

  function selectLesson(value: string) {
    setLessonId(value ? Number(value) : null);
  }

  async function removeQuiz() {
    if (lessonId === null) return;
    const confirmed = window.confirm("Удалить тест этого урока? Вопросы и варианты будут удалены.");
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await adminDeleteQuiz(lessonId);
      setLoaded({ lessonId, quiz: null });
      setFormVersion((v) => v + 1);
    } catch (err) {
      // 404 means there is nothing left to delete.
      if (err instanceof ApiError && err.status === 404) {
        setLoaded({ lessonId, quiz: null });
        setFormVersion((v) => v + 1);
      } else {
        setDeleteError(errorMessage(err));
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card grid gap-5 sm:grid-cols-2">
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
        <Field label="Урок" hint={courseId !== null && tree && lessons.length === 0 ? "В курсе пока нет уроков." : undefined}>
          {(control) => (
            <select
              {...control}
              autoComplete="off"
              value={lessonId ?? ""}
              onChange={(e) => selectLesson(e.target.value)}
              disabled={courseId === null || treeLoading || lessons.length === 0}
              className="input"
            >
              <option value="">{treeLoading ? "Загружаем уроки…" : "Выберите урок"}</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </section>

      {coursesError && <ErrorBox message={coursesError} />}
      {treeError && <ErrorBox message={treeError} />}
      {!coursesLoading && !coursesError && courses.length === 0 && (
        <p className="text-sm text-muted">Сначала создайте курс и уроки.</p>
      )}

      {lessonId === null && courseId !== null && !treeLoading && !treeError && (
        <p className="text-sm text-muted">Выберите урок, чтобы создать или отредактировать его тест.</p>
      )}

      {lessonId !== null && quizLoading && <Spinner label="Загружаем тест…" />}
      {quizError && <ErrorBox message={quizError} />}

      {showEditor && (
        <section className="card space-y-6 sm:p-6">
          <SectionTitle
            actions={
              hasQuiz ? (
                <button
                  type="button"
                  onClick={removeQuiz}
                  disabled={deleting}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-60"
                >
                  {deleting ? "Удаляем…" : "Удалить тест"}
                </button>
              ) : null
            }
          >
            {hasQuiz ? "Редактирование теста" : "Новый тест"}
          </SectionTitle>
          {!hasQuiz && (
            <p className="text-sm text-muted">У этого урока пока нет теста. Заполните форму и сохраните.</p>
          )}
          {deleteError && <ErrorBox message={deleteError} />}
          <QuizForm
            key={`${lessonId}-${formVersion}`}
            lessonId={lessonId}
            initial={currentQuiz}
            onSaved={(quiz) => {
              setLoaded({ lessonId, quiz });
            }}
          />
        </section>
      )}
    </div>
  );
}
