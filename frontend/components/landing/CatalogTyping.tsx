"use client";

import { useState } from "react";
import { matchCatalog } from "./data";

const EXAMPLES = ["циклы в Python", "JOIN в SQL", "ветки в Git"];

export default function CatalogTyping() {
  const [query, setQuery] = useState(EXAMPLES[0]);
  const matches = matchCatalog(query);

  return (
    <div className="lp-typing">
      <label className="lp-sr" htmlFor="lp-topic">
        Тема, которую хотите изучить
      </label>
      <input
        id="lp-topic"
        className="lp-typing-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        data-ui
      />

      <div className="lp-typing-answer" aria-live="polite" data-ui>
        {query.trim() === "" && <p className="lp-muted">Введите тему, например «циклы в Python».</p>}
        {query.trim() !== "" && matches.length === 0 && (
          <p className="lp-muted">
            В демо-каталоге такой темы нет. Попробуйте «python», «sql» или «git». Поиск идёт по словам,
            без ИИ.
          </p>
        )}
        {matches.map((m) => (
          <div className="lp-typing-row" key={m.course.title}>
            <p className="lp-typing-course">{m.course.title}</p>
            <p className="lp-muted">{m.course.level}</p>
            <ul className="lp-typing-lessons">
              {m.lessons.map((l) => (
                <li key={l.title}>
                  <span>{l.title}</span>
                  <span className="lp-muted"> · {l.module}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="lp-typing-examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="lp-textbtn" onClick={() => setQuery(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
