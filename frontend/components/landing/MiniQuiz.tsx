"use client";

import { useId, useState } from "react";
import { QUIZ, type QuizQuestion } from "./data";

function QuestionBlock({
  question,
  index,
  isLast,
  onNext,
}: {
  question: QuizQuestion;
  index: number;
  isLast: boolean;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const groupId = useId();

  const isRight = checked && picked === question.correct;
  let feedback = "";
  if (checked && picked !== null) {
    feedback =
      picked === question.correct ? question.correctFeedback : question.options[picked].feedback;
  }

  return (
    <fieldset className="lp-quiz-q">
      <legend className="lp-quiz-prompt">{question.prompt}</legend>
      <div className="lp-quiz-options">
        {question.options.map((opt, i) => {
          const id = `${groupId}-${i}`;
          return (
            <label key={id} htmlFor={id} className="lp-quiz-option">
              <input
                id={id}
                type="radio"
                name={`${question.id}-${index}`}
                value={i}
                checked={picked === i}
                onChange={() => {
                  setPicked(i);
                  setChecked(false);
                }}
              />
              <span>{opt.text}</span>
            </label>
          );
        })}
      </div>
      <div className="lp-quiz-actions">
        <button
          type="button"
          className="lp-btn lp-btn-quiet"
          disabled={picked === null}
          onClick={() => setChecked(true)}
        >
          Проверить
        </button>
        {checked && (
          <button type="button" className="lp-btn lp-btn-primary" onClick={onNext}>
            {isLast ? "Пройти заново" : "Следующий вопрос"}
          </button>
        )}
      </div>
      {/* Reserved height keeps the layout still when feedback appears. */}
      <div className="lp-quiz-feedback" aria-live="polite">
        {checked && picked !== null && (
          <div className={isRight ? "lp-fb lp-fb-ok" : "lp-fb lp-fb-bad"}>
            <p className="lp-fb-verdict">{isRight ? "Верно" : "Неверно"}</p>
            {!isRight && (
              <div className="lp-tutor">
                <p className="lp-tutor-label">Так наставник разбирает ошибку</p>
                <p>{feedback}</p>
                <p className="lp-tutor-note">Пример разбора, запроса к ИИ здесь нет.</p>
              </div>
            )}
            {isRight && <p>{question.correctFeedback}</p>}
          </div>
        )}
      </div>
    </fieldset>
  );
}

export default function MiniQuiz() {
  const [index, setIndex] = useState(0);
  const question = QUIZ[index];

  return (
    <div className="lp-quiz" data-ui>
      <p className="lp-quiz-title">
        Вопрос {index + 1} из {QUIZ.length}. Выберите неверный ответ, чтобы увидеть разбор.
      </p>
      <QuestionBlock
        key={question.id}
        question={question}
        index={index}
        isLast={index === QUIZ.length - 1}
        onNext={() => setIndex((index + 1) % QUIZ.length)}
      />
    </div>
  );
}
