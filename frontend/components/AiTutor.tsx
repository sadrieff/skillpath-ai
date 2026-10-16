"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import { ApiError, askTutor, errorMessage, getAiHistory } from "@/lib/api";
import type { AiMessage, TutorMode } from "@/lib/types";

/** A request from the quiz to explain the mistakes of one attempt. `nonce` makes repeated clicks distinct. */
export interface MistakeRequest {
  attemptId: number;
  nonce: number;
}

interface AiTutorProps {
  lessonId: number;
  mistakeRequest: MistakeRequest | null;
}

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
  /** Set for user messages loaded from history: the question text is shown clamped. */
  clamp?: boolean;
}

const MODE_LABELS: Record<TutorMode, string> = {
  explain_simple: "Объясни проще",
  example: "Приведи пример",
  review_plan: "План повторения",
  explain_mistake: "Разбор ошибок в тесте",
  question: "Вопрос",
};

const QUICK_MODES: { mode: TutorMode; label: string }[] = [
  { mode: "explain_simple", label: "Объясни проще" },
  { mode: "example", label: "Приведи пример" },
  { mode: "review_plan", label: "План повторения" },
];

const MAX_QUESTION_LENGTH = 1000;

let itemSeq = 0;
function nextItemId(prefix: string): string {
  itemSeq += 1;
  return `${prefix}-${itemSeq}`;
}

/** Maps backend failures to messages the student can act on. */
function tutorErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return "ИИ-наставник не настроен. Обратитесь к администратору курса.";
    if (err.status === 502) return "Сервис ИИ временно недоступен. Попробуйте позже.";
  }
  return errorMessage(err);
}

function historyToItems(history: AiMessage[]): ChatItem[] {
  return history.flatMap((msg) => [
    {
      id: nextItemId(`h${msg.id}-u`),
      role: "user" as const,
      text: msg.mode === "question" ? msg.prompt : MODE_LABELS[msg.mode],
      clamp: msg.mode === "question",
    },
    { id: nextItemId(`h${msg.id}-a`), role: "assistant" as const, text: msg.answer },
  ]);
}

export default function AiTutor({ lessonId, mistakeRequest }: AiTutorProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [question, setQuestion] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const handledNonce = useRef<number | null>(null);

  // Load previous exchanges for this lesson (API returns oldest first).
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    getAiHistory(lessonId)
      .then((history) => {
        if (!cancelled) setItems((prev) => [...historyToItems(history), ...prev]);
      })
      .catch((err: unknown) => {
        if (!cancelled) setHistoryError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const ask = useCallback(
    async (mode: TutorMode, message?: string, attemptId?: number) => {
      const userItem: ChatItem = {
        id: nextItemId("u"),
        role: "user",
        text: mode === "question" && message ? message : MODE_LABELS[mode],
      };
      setItems((prev) => [...prev, userItem]);
      setPending((count) => count + 1);
      try {
        const response = await askTutor({
          lesson_id: lessonId,
          mode,
          message,
          attempt_id: attemptId,
        });
        setItems((prev) => [...prev, { id: nextItemId("a"), role: "assistant", text: response.answer }]);
      } catch (err) {
        setItems((prev) => [
          ...prev,
          { id: nextItemId("e"), role: "assistant", text: tutorErrorText(err), failed: true },
        ]);
      } finally {
        setPending((count) => count - 1);
      }
    },
    [lessonId],
  );

  // Triggered by "Разобрать ошибки с ИИ" in the quiz. Each nonce is handled once (guards StrictMode double effects).
  useEffect(() => {
    if (!mistakeRequest || handledNonce.current === mistakeRequest.nonce) return;
    handledNonce.current = mistakeRequest.nonce;
    void ask("explain_mistake", undefined, mistakeRequest.attemptId);
  }, [mistakeRequest, ask]);

  // Keep the newest message visible inside the chat box (does not scroll the page).
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, pending]);

  const trimmed = question.trim();
  const busy = pending > 0;

  function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed || busy) return;
    setQuestion("");
    void ask("question", trimmed);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section id="ai-tutor" className="card flex flex-col gap-4 scroll-mt-24" aria-labelledby="ai-tutor-title">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted">ИИ-наставник</p>
        <h2 id="ai-tutor-title" className="text-lg font-semibold text-ink">
          Вопрос по теме урока
        </h2>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Быстрые запросы">
        {QUICK_MODES.map((quick) => (
          <button
            key={quick.mode}
            type="button"
            onClick={() => void ask(quick.mode)}
            disabled={busy}
            className="btn-secondary !px-3.5 !py-2 text-xs"
          >
            {quick.label}
          </button>
        ))}
      </div>

      <div
        ref={chatRef}
        className="flex max-h-[420px] min-h-[120px] flex-col gap-3 overflow-y-auto rounded border border-line bg-ground/60 p-3"
        role="log"
        aria-live="polite"
        aria-label="История диалога с наставником"
      >
        {historyLoading && <Spinner label="Загружаем историю…" />}
        {historyError && <ErrorBox message={historyError} />}
        {!historyLoading && !historyError && items.length === 0 && (
          <p className="m-auto text-center text-sm text-muted">
            Выберите быстрый запрос или задайте свой вопрос.
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] whitespace-pre-wrap rounded px-3.5 py-2.5 text-sm leading-relaxed ${
                item.role === "user"
                  ? "bg-accent/25 text-ink"
                  : item.failed
                    ? "border border-danger/40 bg-danger/10 text-danger"
                    : "bg-surface-2 text-ink"
              } ${item.clamp ? "line-clamp-3" : ""}`}
            >
              <span className="sr-only">{item.role === "user" ? "Вы: " : "Наставник: "}</span>
              {item.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded bg-surface-2 px-3.5 py-2.5">
              <Spinner label="Наставник думает…" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleQuestionSubmit} className="space-y-2">
        <label htmlFor="ai-question" className="block text-sm font-medium text-ink">
          Ваш вопрос
        </label>
        <textarea
          id="ai-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleQuestionKeyDown}
          maxLength={MAX_QUESTION_LENGTH}
          rows={3}
          placeholder="Например, почему это работает именно так…"
          className="input resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {question.length}/{MAX_QUESTION_LENGTH} · Ctrl+Enter — отправить
          </span>
          <button type="submit" disabled={!trimmed || busy} className="btn-primary !py-2">
            Спросить
          </button>
        </div>
      </form>

      <p className="text-xs leading-relaxed text-muted">
        Ответы наставника сгенерированы ИИ автоматически и могут содержать ошибки. Сверяйте важные факты с
        материалами урока.
      </p>
    </section>
  );
}
