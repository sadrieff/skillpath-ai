"use client";

import { useState, type FormEvent } from "react";
import ErrorBox from "@/components/ErrorBox";
import { adminUpsertQuiz, errorMessage } from "@/lib/api";
import type { AdminQuiz, QuizUpsertInput } from "@/lib/types";
import { Field, focusFirstInvalid } from "./ui";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

interface DraftQuestion {
  key: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuestionErrors {
  text?: string;
  options?: string;
}

interface DraftErrors {
  title?: string;
  list?: string;
  questions: Record<string, QuestionErrors>;
}

let keySeq = 0;
const newKey = (): string => {
  keySeq += 1;
  return `q${keySeq}`;
};

const emptyQuestion = (): DraftQuestion => ({
  key: newKey(),
  text: "",
  options: ["", ""],
  correctIndex: 0,
  explanation: "",
});

function toDrafts(quiz: AdminQuiz | null): DraftQuestion[] {
  if (!quiz) return [emptyQuestion()];
  return quiz.questions.map((q) => ({
    key: newKey(),
    text: q.text,
    options: [...q.options],
    correctIndex: q.correct_index,
    explanation: q.explanation,
  }));
}

interface QuizFormProps {
  lessonId: number;
  /** Existing quiz, or null to create a new one. */
  initial: AdminQuiz | null;
  onSaved: (quiz: AdminQuiz) => void;
}

export default function QuizForm({ lessonId, initial, onSaved }: QuizFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => toDrafts(initial));
  const [errors, setErrors] = useState<DraftErrors>({ questions: {} });
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  function addOption(key: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key && q.options.length < MAX_OPTIONS ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  }

  function removeOption(key: string, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.key !== key || q.options.length <= MIN_OPTIONS) return q;
        const options = q.options.filter((_, i) => i !== optionIndex);
        let correctIndex = q.correctIndex;
        if (optionIndex === q.correctIndex) correctIndex = 0;
        else if (optionIndex < q.correctIndex) correctIndex -= 1;
        return { ...q, options, correctIndex };
      }),
    );
  }

  function setOptionText(key: string, optionIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? { ...q, options: q.options.map((o, i) => (i === optionIndex ? value : o)) }
          : q,
      ),
    );
  }

  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  }

  function validate(): QuizUpsertInput | null {
    const next: DraftErrors = { questions: {} };
    const trimmedTitle = title.trim();
    if (!trimmedTitle) next.title = "Укажите название теста.";
    if (questions.length === 0) next.list = "Добавьте хотя бы один вопрос.";

    for (const q of questions) {
      const qErrors: QuestionErrors = {};
      if (!q.text.trim()) qErrors.text = "Введите текст вопроса.";
      if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) {
        qErrors.options = `Нужно от ${MIN_OPTIONS} до ${MAX_OPTIONS} вариантов ответа.`;
      } else if (q.options.some((o) => !o.trim())) {
        qErrors.options = "Заполните все варианты ответа или удалите лишние.";
      } else if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        qErrors.options = "Отметьте верный вариант ответа.";
      }
      if (qErrors.text || qErrors.options) next.questions[q.key] = qErrors;
    }

    setErrors(next);
    const hasErrors =
      Boolean(next.title) || Boolean(next.list) || Object.keys(next.questions).length > 0;
    if (hasErrors) return null;

    return {
      title: trimmedTitle,
      questions: questions.map((q) => ({
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()),
        correct_index: q.correctIndex,
        explanation: q.explanation.trim(),
      })),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setSaved(false);
    const body = validate();
    if (!body) {
      focusFirstInvalid(event.currentTarget);
      return;
    }

    setBusy(true);
    try {
      const quiz = await adminUpsertQuiz(lessonId, body);
      setSaved(true);
      onSaved(quiz);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-label="Редактор теста">
      {serverError && <ErrorBox message={serverError} />}
      {saved && !serverError && (
        <p role="status" className="rounded border border-success/40 bg-success/10 p-3 text-sm text-success">
          Тест сохранён.
        </p>
      )}

      <Field label="Название теста *" error={errors.title}>
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

      {errors.list && <p className="text-sm text-danger">{errors.list}</p>}

      <ol className="space-y-5">
        {questions.map((q, qIndex) => {
          const qErrors = errors.questions[q.key] ?? {};
          return (
            <li key={q.key} className="space-y-4 rounded border border-line bg-ground/60 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-ink">Вопрос {qIndex + 1}</h4>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.key)}
                  className="inline-flex min-h-11 items-center text-xs font-medium text-danger hover:underline"
                  aria-label={`Удалить вопрос ${qIndex + 1}`}
                >
                  Удалить вопрос
                </button>
              </div>

              <Field label="Текст вопроса *" error={qErrors.text}>
                {(control) => (
                  <textarea
                    {...control}
                    autoComplete="off"
                    value={q.text}
                    onChange={(e) => updateQuestion(q.key, { text: e.target.value })}
                    rows={2}
                    className="input resize-y"
                  />
                )}
              </Field>

              <fieldset className="space-y-2" aria-describedby={qErrors.options ? `opt-err-${q.key}` : undefined}>
                <legend className="mb-2 text-sm font-medium text-ink">
                  Варианты ответа (отметьте верный) *
                </legend>
                {q.options.map((option, oIndex) => {
                  const inputId = `${q.key}-opt-${oIndex}`;
                  return (
                    <div key={inputId} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.key}`}
                        checked={q.correctIndex === oIndex}
                        onChange={() => updateQuestion(q.key, { correctIndex: oIndex })}
                        aria-label={`Вариант ${oIndex + 1} верный`}
                        className="h-4 w-4 shrink-0 accent-accent"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => setOptionText(q.key, oIndex, e.target.value)}
                        aria-label={`Вариант ${oIndex + 1}`}
                        aria-invalid={Boolean(qErrors.options) && !option.trim()}
                        maxLength={500}
                        className="input !py-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(q.key, oIndex)}
                        disabled={q.options.length <= MIN_OPTIONS}
                        aria-label={`Удалить вариант ${oIndex + 1}`}
                        className="btn-secondary !px-3 !py-2 shrink-0"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => addOption(q.key)}
                    disabled={q.options.length >= MAX_OPTIONS}
                    className="btn-secondary !py-1.5 text-xs"
                  >
                    + Вариант
                  </button>
                  <span className="text-xs text-muted">
                    {q.options.length} из {MAX_OPTIONS}
                  </span>
                </div>
                {qErrors.options && (
                  <p id={`opt-err-${q.key}`} className="text-xs text-danger">
                    {qErrors.options}
                  </p>
                )}
              </fieldset>

              <Field label="Пояснение (необязательно)" hint="Показывается ученику после ответа.">
                {(control) => (
                  <textarea
                    {...control}
                    autoComplete="off"
                    value={q.explanation}
                    onChange={(e) => updateQuestion(q.key, { explanation: e.target.value })}
                    rows={2}
                    className="input resize-y"
                  />
                )}
              </Field>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
          className="btn-secondary"
        >
          + Добавить вопрос
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Сохраняем…" : "Сохранить тест"}
        </button>
      </div>
      <p className="text-xs text-muted">Сохранение заменяет весь тест урока целиком.</p>
    </form>
  );
}
