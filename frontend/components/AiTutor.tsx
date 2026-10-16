"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import { ApiError, askTutor, errorMessage, getAiHistory } from "@/lib/api";
import type { AiMessage, TutorMode } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    <section id="ai-tutor" className="card flex flex-col gap-5 scroll-mt-24" aria-labelledby="ai-tutor-title">
      <div className="space-y-1">
        <p className="kicker">ИИ-наставник</p>
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
            className="chip min-h-11 cursor-pointer hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {quick.label}
          </button>
        ))}
      </div>

      <div
        ref={chatRef}
        className="flex max-h-[460px] min-h-[160px] flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-surface p-3 sm:p-4"
        role="log"
        aria-live="polite"
        aria-label="История диалога с наставником"
      >
        {historyLoading && <Spinner label="Загружаем историю…" />}
        {historyError && <ErrorBox message={historyError} />}
        {!historyLoading && !historyError && items.length === 0 && (
          <p className="m-auto px-2 text-center text-sm text-muted">
            Выберите быстрый запрос или задайте свой вопрос.
          </p>
        )}
        {items.map((item) =>
          item.role === "user" ? (
            <div key={item.id} className="flex justify-end">
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[0.9375rem] leading-relaxed text-white ${
                  item.clamp ? "line-clamp-3" : ""
                }`}
              >
                <span className="sr-only">Вы: </span>
                {item.text}
              </div>
            </div>
          ) : item.failed ? (
            <div key={item.id} className="flex justify-start">
              <div className="flex max-w-[92%] items-start gap-2.5 rounded-2xl rounded-bl-md border border-danger/40 bg-danger/5 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-danger"
                >
                  <path strokeLinecap="round" d="M12 8v5m0 3h.01M10.3 3.9L2.6 17.4A2 2 0 004.3 20.4h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
                <span>{item.text}</span>
              </div>
            </div>
          ) : (
            <div key={item.id} className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-ink">
                <span className="sr-only">Наставник: </span>
                <div className="prose-sp !text-sm [&_h1]:!mt-4 [&_h1]:!text-base [&_h2]:!mt-4 [&_h2]:!text-base [&_h3]:!mt-3 [&_h3]:!text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3">
              <Spinner label="Наставник думает…" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleQuestionSubmit} className="space-y-3">
        <label htmlFor="ai-question" className="block text-sm font-semibold text-ink">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted">
            {question.length}/{MAX_QUESTION_LENGTH} · Ctrl+Enter — отправить
          </span>
          <button type="submit" disabled={!trimmed || busy} className="btn-primary w-full sm:w-auto">
            Спросить
          </button>
        </div>
      </form>

      <p className="text-sm text-muted">
        Ответы наставника сгенерированы ИИ автоматически и могут содержать ошибки. Сверяйте важные факты с
        материалами урока.
      </p>
    </section>
  );
}
