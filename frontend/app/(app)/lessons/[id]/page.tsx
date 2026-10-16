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

/** Текст урока часто начинается с того же заголовка, что уже стоит в h1 страницы. */
function withoutTitle(content: string, title: string): string {
  const [first, ...rest] = content.trimStart().split("\n");
  return first.replace(/^#+\s*/, "").trim() === title.trim() ? rest.join("\n") : content;
}

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
  // Lesson number counts across the whole course, module by module.
  const lessonIndex = course?.modules.flatMap((m) => m.lessons).findIndex((item) => item.id === lesson.id) ?? -1;

  return (
    <div className="space-y-8">
      <nav aria-label="Навигация по разделам">
        <ol className="flex flex-wrap items-center text-sm text-muted">
          <li>
            <Link href="/courses" className="inline-flex min-h-11 items-center hover:text-ink">
              Курсы
            </Link>
          </li>
          <li aria-hidden="true" className="px-1">
            /
          </li>
          <li>
            <Link href={`/courses/${lesson.course_id}`} className="inline-flex min-h-11 items-center hover:text-ink">
              {course?.title ?? "Курс"}
            </Link>
          </li>
          <li aria-hidden="true" className="px-1">
            /
          </li>
          <li className="inline-flex min-h-11 max-w-full items-center truncate text-ink" aria-current="page">
            {lesson.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,680px)_360px] lg:justify-between lg:gap-12">
        <div className="min-w-0 space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="kicker">
                {lessonIndex >= 0 ? `Урок ${lessonIndex + 1}` : "Урок"}
                {course ? ` · ${course.title}` : ""}
              </p>
              {lesson.completed ? (
                <span className="chip gap-1.5 border-accent/40 text-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4 10-10" />
                  </svg>
                  Пройден
                </span>
              ) : (
                <span className="chip">В процессе</span>
              )}
              {lesson.has_quiz && <span className="chip">Есть тест</span>}
            </div>
            <h1 className="font-serif text-4xl font-medium leading-[1.15] text-ink sm:text-[2.75rem]">{lesson.title}</h1>
          </header>

          {youtubeSrc && (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="aspect-video bg-ink">
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
              <p className="px-5 py-3 text-sm font-semibold text-ink">Видео к уроку</p>
            </div>
          )}

          {videoLink && (
            <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">Видео к уроку</p>
                <p className="text-sm text-muted">Откроется на другом сайте</p>
              </div>
              <a
                href={videoLink.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full sm:w-auto"
              >
                Смотреть видео
              </a>
            </div>
          )}

          {lesson.content.trim() ? (
            <article className="prose-sp">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{withoutTitle(lesson.content, lesson.title)}</ReactMarkdown>
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
              className="card flex items-center gap-4 transition-colors duration-150 hover:border-ink"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">Материал к уроку</span>
                <span className="block text-sm text-muted">Скачать файл</span>
              </span>
            </a>
          )}

          <section className="space-y-6 border-t border-line pt-8" aria-labelledby="progress-title">
            <h2 id="progress-title" className="sr-only">
              Прогресс
            </h2>
            {courseProgress !== null && <ProgressBar value={courseProgress} label="Прогресс курса" />}
            {completeError && <ErrorBox message={completeError} />}
            {lesson.completed ? (
              <p className="flex items-center gap-2 text-base font-semibold text-accent">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4 10-10" />
                </svg>
                Урок пройден
              </p>
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

            <nav className="grid gap-3 sm:grid-cols-2" aria-label="Соседние уроки">
              {lesson.prev_lesson_id !== null ? (
                <Link href={`/lessons/${lesson.prev_lesson_id}`} className="btn-secondary w-full">
                  <span aria-hidden="true">←</span> Предыдущий
                </Link>
              ) : (
                <span className="btn-secondary pointer-events-none w-full opacity-40" aria-disabled="true">
                  <span aria-hidden="true">←</span> Предыдущий
                </span>
              )}
              {lesson.next_lesson_id !== null ? (
                <Link href={`/lessons/${lesson.next_lesson_id}`} className="btn-secondary w-full">
                  Следующий <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="btn-secondary pointer-events-none w-full opacity-40" aria-disabled="true">
                  Следующий <span aria-hidden="true">→</span>
                </span>
              )}
            </nav>
          </section>
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Тест и ИИ-наставник">
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
