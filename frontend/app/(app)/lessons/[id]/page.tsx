"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AiTutor, { type MistakeRequest } from "@/components/AiTutor";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import ProtectedPage from "@/components/ProtectedPage";
import Quiz from "@/components/Quiz";
import Spinner from "@/components/Spinner";
import { completeLesson, errorMessage, getCourse, getLesson } from "@/lib/api";
import { materialHref, youtubeEmbedUrl, safeHttpUrl } from "@/lib/lesson-media";
import type { CourseDetail, Lesson } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function LessonPage({ params }: { params: { id: string } }) {
  const lessonId = Number(params.id);
  const validId = Number.isInteger(lessonId) && lessonId > 0;

  return (
    <ProtectedPage>
      {validId ? (
        <LessonContent key={lessonId} lessonId={lessonId} />
      ) : (
        <ErrorBox message="Некорректный идентификатор урока." />
      )}
    </ProtectedPage>
  );
}

function LessonContent({ lessonId }: { lessonId: number }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [progressOverride, setProgressOverride] = useState<number | null>(null);
  const [mistakeRequest, setMistakeRequest] = useState<MistakeRequest | null>(null);

  const loadCourse = useCallback((courseId: number) => {
    getCourse(courseId)
      .then(setCourse)
      .catch(() => {
        // Breadcrumb and progress are secondary: the lesson still works without them.
        setCourse(null);
      });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLesson(lessonId)
      .then((data) => {
        setLesson(data);
        loadCourse(data.course_id);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [lessonId, loadCourse]);

  useEffect(() => {
    load();
  }, [load]);

  // After a quiz attempt the backend may have completed the lesson; refresh quietly.
  const refreshQuietly = useCallback(() => {
    getLesson(lessonId)
      .then((data) => {
        setLesson(data);
        loadCourse(data.course_id);
      })
      .catch(() => {
        // keep showing the current state
      });
  }, [lessonId, loadCourse]);

  async function handleComplete() {
    if (!lesson) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await completeLesson(lesson.id);
      setLesson({ ...lesson, completed: result.completed });
      setProgressOverride(result.course_progress_percent);
    } catch (err) {
      setCompleteError(errorMessage(err));
    } finally {
      setCompleting(false);
    }
  }

  if (loading && !lesson) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Загружаем урок…" />
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} onRetry={load} />
        <Link href="/courses" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">
          ← К списку курсов
        </Link>
      </div>
    );
  }

  if (!lesson) return null;

  const courseProgress = progressOverride ?? course?.progress_percent ?? null;
  const youtubeSrc = lesson.video_url ? youtubeEmbedUrl(lesson.video_url) : null;
  const videoLink = lesson.video_url && !youtubeSrc ? safeHttpUrl(lesson.video_url) : null;
  const materialLink = lesson.material_url ? materialHref(lesson.material_url) : null;

  return (
    <div className="space-y-8">
      <nav aria-label="Навигация по разделам">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <li>
            <Link href="/courses" className="hover:text-ink">
              Курсы
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/courses/${lesson.course_id}`} className="hover:text-ink">
              {course?.title ?? "Курс"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-ink" aria-current="page">
            {lesson.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {lesson.completed ? (
                <span className="rounded bg-success/15 px-2.5 py-1 font-medium text-success">
                  Урок пройден
                </span>
              ) : (
                <span className="rounded bg-surface-2 px-2.5 py-1 text-ink">В процессе</span>
              )}
              {lesson.has_quiz && (
                <span className="rounded bg-accent/15 px-2.5 py-1 font-medium text-accent">
                  Есть тест
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{lesson.title}</h1>
          </header>

          {youtubeSrc && (
            <div className="overflow-hidden rounded border border-line bg-black aspect-video">
              <iframe
                src={youtubeSrc}
                title={`Видео: ${lesson.title}`}
                className="h-full w-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}

          {videoLink && (
            <a
              href={videoLink.toString()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full sm:w-auto"
            >
              Смотреть видео
            </a>
          )}

          {lesson.content.trim() ? (
            <article className="prose-sp">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.content}</ReactMarkdown>
            </article>
          ) : (
            <p className="text-sm text-muted">Содержание урока пока не добавлено.</p>
          )}

          {materialLink && (
            <a
              href={materialLink}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="card flex items-center gap-3 transition-colors duration-150 hover:border-accent"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-accent/15 text-accent"
                aria-hidden="true"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
                </svg>
              </span>
              <span className="text-sm">
                <span className="block font-medium text-ink">Материал к уроку</span>
                <span className="text-muted">Скачать файл</span>
              </span>
            </a>
          )}

          <section className="card space-y-4" aria-labelledby="progress-title">
            <h2 id="progress-title" className="sr-only">
              Прогресс
            </h2>
            {courseProgress !== null && <ProgressBar value={courseProgress} label="Прогресс курса" />}
            {completeError && <ErrorBox message={completeError} />}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {lesson.completed ? (
                <p className="text-sm font-medium text-success">Урок отмечен как пройденный.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completing}
                  className="btn-primary w-full sm:w-auto"
                >
                  {completing ? "Сохраняем…" : "Отметить пройденным"}
                </button>
              )}
            </div>
          </section>

          <nav className="flex flex-col gap-3 sm:flex-row sm:justify-between" aria-label="Соседние уроки">
            {lesson.prev_lesson_id !== null ? (
              <Link href={`/lessons/${lesson.prev_lesson_id}`} className="btn-secondary">
                ← Предыдущий урок
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none opacity-40" aria-disabled="true">
                ← Предыдущий урок
              </span>
            )}
            {lesson.next_lesson_id !== null ? (
              <Link href={`/lessons/${lesson.next_lesson_id}`} className="btn-primary">
                Следующий урок →
              </Link>
            ) : (
              <span className="btn-primary pointer-events-none opacity-40" aria-disabled="true">
                Следующий урок →
              </span>
            )}
          </nav>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Тест и ИИ-наставник">
          {lesson.has_quiz && (
            <Quiz
              lessonId={lesson.id}
              onAttemptDone={refreshQuietly}
              onExplainMistake={(attemptId) =>
                setMistakeRequest({ attemptId, nonce: Date.now() })
              }
            />
          )}
          <AiTutor lessonId={lesson.id} mistakeRequest={mistakeRequest} />
        </aside>
      </div>
    </div>
  );
}
