"use client";

import { useState, type FormEvent } from "react";
import ErrorBox from "@/components/ErrorBox";
import { errorMessage } from "@/lib/api";
import { LEVEL_LABELS } from "@/components/CourseCard";
import type { CourseInput, CourseLevel } from "@/lib/types";
import { focusFirstInvalid, Field, parseNonNegativeNumber } from "./ui";

interface CourseFormProps {
  initial?: CourseInput;
  /** Throws on server error; the form shows the message. */
  onSubmit: (input: CourseInput) => Promise<void>;
  onCancel: () => void;
}

interface DraftErrors {
  title?: string;
  category?: string;
  duration?: string;
}

const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

export default function CourseForm({ initial, onSubmit, onCancel }: CourseFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [level, setLevel] = useState<CourseLevel>(initial?.level ?? "beginner");
  const [duration, setDuration] = useState(initial ? String(initial.duration_hours) : "");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): CourseInput | null {
    const next: DraftErrors = {};
    const trimmedTitle = title.trim();
    const trimmedCategory = category.trim();
    const hours = parseNonNegativeNumber(duration);

    if (!trimmedTitle) next.title = "Укажите название курса.";
    if (!trimmedCategory) next.category = "Укажите категорию.";
    if (hours === null) next.duration = "Укажите длительность в часах (неотрицательное число).";

    setErrors(next);
    if (Object.keys(next).length > 0 || hours === null) return null;

    return {
      title: trimmedTitle,
      description: description.trim(),
      category: trimmedCategory,
      level,
      duration_hours: hours,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const input = validate();
    if (!input) {
      focusFirstInvalid(event.currentTarget);
      return;
    }

    setBusy(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setServerError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card space-y-5 sm:p-6" aria-labelledby="course-form-title">
      <h3 id="course-form-title" className="text-lg font-semibold text-ink">
        {initial ? "Редактирование курса" : "Новый курс"}
      </h3>

      {serverError && <ErrorBox message={serverError} />}

      <div className="grid gap-5 sm:grid-cols-2">
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

        <Field label="Категория *" error={errors.category}>
          {(control) => (
            <input
              {...control}
              autoComplete="off"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={100}
              placeholder="Python, Data, Web…"
              className="input"
            />
          )}
        </Field>

        <Field label="Уровень *">
          {(control) => (
            <select
              {...control}
              autoComplete="off"
              value={level}
              onChange={(e) => setLevel(e.target.value as CourseLevel)}
              className="input"
            >
              {LEVELS.map((value) => (
                <option key={value} value={value}>
                  {LEVEL_LABELS[value]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Длительность, часов *" error={errors.duration}>
          {(control) => (
            <input
              {...control}
              autoComplete="off"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="input"
            />
          )}
        </Field>

        <Field label="Описание" className="sm:col-span-2" hint="Необязательно. Отображается на странице курса.">
          {(control) => (
            <textarea
              {...control}
              autoComplete="off"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="input resize-y"
            />
          )}
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
          Отмена
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
