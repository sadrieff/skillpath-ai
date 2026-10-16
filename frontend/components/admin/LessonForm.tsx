"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import {
  adminCreateLesson,
  adminUpdateLesson,
  errorMessage,
  getLesson,
  uploadFile,
} from "@/lib/api";
import type { LessonInput } from "@/lib/types";
import { focusFirstInvalid, Field, isHttpUrl, parseNonNegativeInt } from "./ui";

/** Matches the backend default MAX_UPLOAD_MB. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILES = ".pdf,.png,.jpg,.jpeg,.txt,.md";

interface LessonFormProps {
  moduleId: number;
  /** Set when editing an existing lesson; its full content is loaded from the API. */
  lessonId?: number;
  /** Used for new lessons, and for edits (the position is kept on the module tree, not on GET /lessons). */
  initialPosition: number;
  onSaved: () => void;
  onCancel: () => void;
}

interface DraftErrors {
  title?: string;
  video?: string;
  material?: string;
  position?: string;
}

export default function LessonForm({
  moduleId,
  lessonId,
  initialPosition,
  onSaved,
  onCancel,
}: LessonFormProps) {
  const editing = lessonId !== undefined;
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [position, setPosition] = useState(String(initialPosition));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lessonId === undefined) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getLesson(lessonId)
      .then((lesson) => {
        if (cancelled) return;
        setTitle(lesson.title);
        setContent(lesson.content);
        setVideoUrl(lesson.video_url ?? "");
        setMaterialUrl(lesson.material_url ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Файл больше 10 МБ. Выберите файл меньшего размера.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFile(file);
      setMaterialUrl(result.url);
      setErrors((prev) => ({ ...prev, material: undefined }));
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function validate(): LessonInput | null {
    const next: DraftErrors = {};
    const trimmedTitle = title.trim();
    const trimmedVideo = videoUrl.trim();
    const trimmedMaterial = materialUrl.trim();
    const parsedPosition = parseNonNegativeInt(position);

    if (!trimmedTitle) next.title = "Укажите название урока.";
    if (trimmedVideo && !isHttpUrl(trimmedVideo)) next.video = "Ссылка на видео должна начинаться с http:// или https://";
    if (trimmedMaterial && !trimmedMaterial.startsWith("/uploads") && !isHttpUrl(trimmedMaterial)) {
      next.material = "Укажите загруженный файл или ссылку http(s).";
    }
    if (parsedPosition === null) next.position = "Порядок должен быть целым числом от 0.";

    setErrors(next);
    if (Object.keys(next).length > 0 || parsedPosition === null) return null;

    return {
      title: trimmedTitle,
      content,
      video_url: trimmedVideo || null,
      material_url: trimmedMaterial || null,
      position: parsedPosition,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const body = validate();
    if (!body) {
      focusFirstInvalid(event.currentTarget);
      return;
    }

    setBusy(true);
    try {
      if (lessonId !== undefined) {
        await adminUpdateLesson(lessonId, body);
      } else {
        await adminCreateLesson(moduleId, body);
      }
      onSaved();
    } catch (err) {
      setServerError(errorMessage(err));
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Загружаем урок…" />;

  if (loadError) {
    return (
      <div className="space-y-3">
        <ErrorBox message={loadError} />
        <button type="button" onClick={onCancel} className="btn-secondary">
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded border border-line bg-ground/60 p-4 sm:p-5" aria-label={editing ? "Редактирование урока" : "Новый урок"}>
      <h4 className="font-semibold text-ink">{editing ? "Редактирование урока" : "Новый урок"}</h4>

      {serverError && <ErrorBox message={serverError} />}

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
        <Field label="Название *" error={errors.title} className="sm:col-span-2">
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

        <Field label="Порядок" error={errors.position} hint="0 — первый урок модуля">
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

      <Field
        label="Содержание (Markdown)"
        hint="Поддерживаются заголовки, списки, код и таблицы. HTML не выполняется."
      >
        {(control) => (
          <textarea
            {...control}
            autoComplete="off"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="input resize-y font-mono text-[13px] leading-relaxed"
          />
        )}
      </Field>

      <Field label="Ссылка на видео (YouTube или другая)" error={errors.video}>
        {(control) => (
          <input
            {...control}
            autoComplete="off"
            type="url"
            inputMode="url"
            spellCheck={false}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="input"
          />
        )}
      </Field>

      <div className="space-y-3 rounded border border-line bg-surface-2 p-4">
        <p className="text-sm font-medium text-ink">Материал к уроку</p>
        <Field label="Файл (PDF, PNG, JPG, TXT, MD, до 10 МБ)" error={uploadError ?? undefined}>
          {(control) => (
            <input
              {...control}
              type="file"
              accept={ACCEPTED_FILES}
              disabled={uploading}
              onChange={handleFile}
              className="block w-full text-sm text-ink file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent-ink hover:file:bg-accent/90 disabled:opacity-60"
            />
          )}
        </Field>
        {uploading && <Spinner label="Загружаем файл…" />}
        <Field
          label="Ссылка на материал"
          error={errors.material}
          hint="Заполняется автоматически после загрузки файла. Можно указать внешнюю ссылку."
        >
          {(control) => (
            <input
              {...control}
              autoComplete="off"
              type="text"
              value={materialUrl}
              onChange={(e) => setMaterialUrl(e.target.value)}
              placeholder="/uploads/… или https://…"
              spellCheck={false}
              className="input"
            />
          )}
        </Field>
        {materialUrl && (
          <button
            type="button"
            onClick={() => setMaterialUrl("")}
            className="inline-flex min-h-11 items-center text-xs font-medium text-danger hover:underline"
          >
            Убрать материал
          </button>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={busy || uploading} className="btn-secondary">
          Отмена
        </button>
        <button type="submit" disabled={busy || uploading} className="btn-primary">
          {busy ? "Сохраняем…" : "Сохранить урок"}
        </button>
      </div>
    </form>
  );
}
