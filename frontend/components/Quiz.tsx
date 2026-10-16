"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import { ApiError, errorMessage, getQuiz, submitAttempt } from "@/lib/api";
import type { Quiz as QuizData, QuizAttemptResult } from "@/lib/types";
import InlineCode from "@/components/InlineCode";

/** Score at which the lesson counts as passed (matches the backend rule). */
const PASS_PERCENT = 70;

interface QuizProps {
  lessonId: number;
  /** Called with the attempt id when the student asks the AI tutor to explain their mistakes. */
  onExplainMistake: (attemptId: number) => void;
  /** Called after a finished attempt, so the lesson page can refresh completion state. */
  onAttemptDone?: () => void;
}

type LoadState = "loading" | "ready" | "missing" | "error";

export default function Quiz({ lessonId, onExplainMistake, onAttemptDone }: QuizProps) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadState("loading");
    setLoadError(null);
    getQuiz(lessonId)
      .then((data) => {
        setQuiz(data);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setLoadState("missing");
          return;
        }
        setLoadError(errorMessage(err));
        setLoadState("error");
      });
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadState === "missing") return null;

  if (loadState === "loading") {
    return (
      <section className="card">
        <Spinner label="Загружаем тест…" />
      </section>
    );
  }

  if (loadState === "error" || !quiz) {
    return (
      <section className="card">
        <ErrorBox message={loadError ?? "Не удалось загрузить тест."} onRetry={load} />
      </section>
    );
  }

  const answeredCount = quiz.questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answeredCount === quiz.questions.length && quiz.questions.length > 0;

  function selectOption(questionId: number, choiceIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceIndex }));
  }

  function resetAttempt() {
    setAnswers({});
    setResult(null);
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quiz || !allAnswered) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitAttempt(
        quiz.id,
        quiz.questions.map((q) => ({ question_id: q.id, choice_index: answers[q.id] })),
      );
      setResult(response);
      onAttemptDone?.();
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const wrongCount = result ? result.results.filter((r) => !r.correct).length : 0;

  return (
    <section className="card space-y-5" aria-labelledby="quiz-title">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted">Проверка знаний</p>
        <h2 id="quiz-title" className="text-lg font-semibold text-ink">
          {quiz.title}
        </h2>
      </div>

      {submitError && <ErrorBox message={submitError} />}

      {!result && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {quiz.questions.map((question, index) => (
            <fieldset key={question.id} className="space-y-3">
              <legend className="mb-3 text-sm font-medium leading-relaxed text-ink">
                <span className="mr-1.5 text-accent">{index + 1}.</span>
                <InlineCode text={question.text} />
              </legend>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const inputId = `q${question.id}-o${optionIndex}`;
                  const checked = answers[question.id] === optionIndex;
                  return (
                    <label
                      key={inputId}
                      htmlFor={inputId}
                      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded border px-3.5 py-2.5 text-sm transition-colors duration-150 ${
                        checked
                          ? "border-accent bg-accent/15 text-ink"
                          : "border-line bg-surface-2 text-ink hover:bg-line"
                      }`}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={`question-${question.id}`}
                        value={optionIndex}
                        checked={checked}
                        onChange={() => selectOption(question.id, optionIndex)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                      />
                      <span><InlineCode text={option} /></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted" aria-live="polite">
              Отвечено: {answeredCount} из {quiz.questions.length}
            </p>
            <button type="submit" disabled={!allAnswered || submitting} className="btn-primary w-full sm:w-auto">
              {submitting ? "Проверяем…" : "Отправить ответы"}
            </button>
          </div>
        </form>
      )}

      {result && (
        <div className="space-y-5">
          <div
            className={`rounded border p-4 ${
              result.percent >= PASS_PERCENT
                ? "border-success/40 bg-success/10"
                : "border-danger/40 bg-danger/10"
            }`}
            role="status"
          >
            <p className="text-2xl font-bold tabular-nums text-ink">
              {result.score} из {result.total}{" "}
              <span className="text-base font-medium text-ink">({result.percent}%)</span>
            </p>
            <p className="mt-1 text-sm text-ink">
              {result.percent >= PASS_PERCENT
                ? "Тест пройден, урок засчитан."
                : `Для зачёта нужно не менее ${PASS_PERCENT}%. Разберите ошибки и попробуйте снова.`}
            </p>
          </div>

          <ol className="space-y-4">
            {result.results.map((item, index) => {
              const question = quiz.questions.find((q) => q.id === item.question_id);
              const chosen = question?.options[item.choice_index];
              const correct = question?.options[item.correct_index];
              return (
                <li key={item.question_id} className="space-y-2 rounded border border-line bg-surface-2 p-4">
                  <p className="text-sm font-medium text-ink">
                    <span className={`inline-flex items-center gap-1.5 ${item.correct ? "text-success" : "text-danger"}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        {item.correct ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4 10-10" />
                        ) : (
                          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                        )}
                      </svg>
                      {item.correct ? "Верно" : "Неверно"}.
                    </span>{" "}
                    <span className="sr-only">Вопрос </span>
                    {index + 1}. {question?.text}
                  </p>
                  <p className="text-xs text-muted">Ваш ответ: {chosen ?? "—"}</p>
                  {!item.correct && <p className="text-xs text-ink">Правильный ответ: {correct ?? "—"}</p>}
                  {item.explanation && <p className="text-sm text-muted"><InlineCode text={item.explanation} /></p>}
                </li>
              );
            })}
          </ol>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={resetAttempt} className="btn-secondary">
              Пройти снова
            </button>
            {wrongCount > 0 && (
              <button
                type="button"
                onClick={() => onExplainMistake(result.attempt_id)}
                className="btn-primary"
              >
                Разобрать ошибки с ИИ
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
