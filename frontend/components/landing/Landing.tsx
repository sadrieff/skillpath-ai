"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { demoLogin, devLogin, errorMessage } from "@/lib/api";
import { googleLoginUrl, useAuth } from "@/lib/auth";
import CatalogTyping from "./CatalogTyping";
import { FAQ } from "./data";
import MiniQuiz from "./MiniQuiz";
import { useGoogleEnabled } from "./useGoogleEnabled";

const DEV_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1";
const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO === "1";

/** Sets the --i custom property used by the staggered entrances in landing.css. */
function vi(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

function PrimaryAction({ logged }: { logged: boolean }) {
  const googleEnabled = useGoogleEnabled();
  if (logged) {
    return (
      <Link href="/dashboard" className="lp-btn lp-btn-primary">
        Перейти в кабинет
      </Link>
    );
  }
  if (!googleEnabled) return null;
  return (
    <a href={googleLoginUrl()} className="lp-btn lp-btn-primary">
      Войти через Google
    </a>
  );
}

/**
 * Google button plus the two demo buttons (demo stand only).
 * Each instance keeps its own busy state and error text.
 */
function ActionGroup({ primary }: { primary: ReactNode }) {
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<"student" | "admin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const googleEnabled = useGoogleEnabled();

  async function onDemo(role: "student" | "admin") {
    setBusy(role);
    setError(null);
    try {
      const res = await demoLogin(role);
      await loginWithToken(res.access_token);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <div className="lp-action-group">
      <div className="lp-action-row">
        {primary}
        <button
          type="button"
          className={googleEnabled ? "lp-btn lp-btn-quiet" : "lp-btn lp-btn-primary"}
          disabled={busy !== null}
          onClick={() => void onDemo("student")}
        >
          {busy === "student" ? "Входим…" : "Войти как студент"}
        </button>
        <button
          type="button"
          className="lp-btn lp-btn-quiet"
          disabled={busy !== null}
          onClick={() => void onDemo("admin")}
        >
          {busy === "admin" ? "Входим…" : "Войти как админ"}
        </button>
      </div>
      <div className="lp-action-foot">
        {error && <p className="lp-error">{error}</p>}
        <p className="lp-action-note">
          Демо: данные сбрасываются каждую ночь. На каждого посетителя доступно 2 запроса к ИИ-наставнику.
        </p>
      </div>
    </div>
  );
}

/** Wraps the primary action with the demo buttons only when the demo stand flag is set. */
function withDemo(primary: ReactNode, logged: boolean) {
  return DEMO_ENABLED && !logged ? <ActionGroup primary={primary} /> : primary;
}

function DemoLogin() {
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await devLogin(email.trim(), fullName.trim() || undefined);
      await loginWithToken(res.access_token);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="lp-demo">
      <p className="lp-demo-title">Демо-вход</p>
      <label className="lp-sr" htmlFor="lp-demo-email">
        Email для демо-входа
      </label>
      <input
        id="lp-demo-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        className="lp-input"
      />
      <label className="lp-sr" htmlFor="lp-demo-name">
        Имя для демо-входа
      </label>
      <input
        id="lp-demo-name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Имя (необязательно)"
        className="lp-input"
      />
      {error && <p className="lp-error">{error}</p>}
      <button type="submit" disabled={busy} className="lp-btn lp-btn-quiet">
        {busy ? "Входим..." : "Войти как демо-пользователь"}
      </button>
    </form>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PROGRESS_MOCK = [
  { title: "Python для начинающих", pct: 75, color: "#f7efd2" },
  { title: "Основы SQL", pct: 40, color: "#e1ecf7" },
  { title: "Git и GitHub", pct: 10, color: "#f9e8dd" },
];

export default function Landing() {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const logged = Boolean(user);
  const googleEnabled = useGoogleEnabled();

  // Скрытые состояния включаются только когда JS отметил страницу: без JS всё видно.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add("is-js");
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="lp-root">
      <div className="lp-wrap">
        <header className="lp-nav">
          <Link href="/" className="lp-logo">
            SkillPath
          </Link>
          <nav className="lp-nav-links" aria-label="Основная навигация">
            <Link href="/courses" className="lp-link">
              Курсы
            </Link>
            {logged ? (
              <Link href="/dashboard" className="lp-link lp-nav-cta">
                Кабинет
              </Link>
            ) : (
              <a href={googleEnabled ? googleLoginUrl() : "#lp-hero-title"} className="lp-link lp-nav-cta">
                Войти
              </a>
            )}
          </nav>
        </header>

        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div>
            <h1 id="lp-hero-title" className="lp-h1" data-rise style={vi(0)}>
              Ошибка в тесте станет уроком
            </h1>
            <p className="lp-lead" data-rise style={vi(1)}>
              Курсы по Python, SQL и Git с тестом после каждого урока. ИИ-наставник видит, какой ответ вы
              выбрали, и объясняет, где ошибка.
            </p>
            <div className="lp-hero-actions" data-rise style={vi(2)}>
              {withDemo(<PrimaryAction logged={logged} />, logged)}
              {DEV_LOGIN_ENABLED && <DemoLogin />}
            </div>
          </div>
          <div className="lp-panel lp-panel-peach" data-rise style={vi(3)}>
            <MiniQuiz />
          </div>
        </section>

        <section className="lp-facts" aria-label="Коротко о платформе">
          <div className="lp-fact" data-reveal>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 5h11a3 3 0 013 3v11H7a3 3 0 01-3-3V5z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 9h6M8 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <p className="lp-fact-main">12 уроков</p>
            <p className="lp-fact-sub">в трёх курсах: Python, SQL, Git</p>
          </div>
          <div className="lp-fact" data-reveal style={vi(1)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8.5 12.5l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <p className="lp-fact-main">Тест после урока</p>
            <p className="lp-fact-sub">проходной балл 70%</p>
          </div>
          <div className="lp-fact" data-reveal style={vi(2)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 6h14v9H9l-4 3V6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <p className="lp-fact-main">Разбор ошибок</p>
            <p className="lp-fact-sub">от ИИ-наставника по теме урока</p>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-how-title">
          <h2 id="lp-how-title" className="lp-h2 lp-center" data-reveal>
            Как устроено обучение
          </h2>
          <p className="lp-sec-lead lp-center" data-reveal>
            Урок, проверка и помощь наставника на одной странице, без переключения между вкладками.
          </p>

          <div className="lp-row" data-reveal>
            <div className="lp-row-text">
              <h3>Читаете урок и сразу проверяете себя</h3>
              <p>
                Текст урока слева, тест справа. После отправки видно, какие ответы верные, и почему.
                Набрали 70% и больше, урок засчитан.
              </p>
            </div>
            <div className="lp-panel lp-panel-sky">
              <Image
                className="lp-shot"
                src="/landing/app-lesson.jpg"
                alt="Страница урока: текст про SELECT слева и тест из трёх вопросов справа"
                width={1280}
                height={900}
                sizes="(max-width: 900px) 100vw, 600px"
                unoptimized
              />
            </div>
          </div>

          <div className="lp-row lp-row-flip" data-reveal>
            <div className="lp-row-text">
              <h3>Наставник разбирает именно вашу ошибку</h3>
              <p>Он получает вопрос, ваш вариант и верный ответ, поэтому объясняет конкретную разницу.</p>
              <ul className="lp-row-list">
                <li>
                  <Check />
                  <span>Объяснит тему проще или приведёт пример</span>
                </li>
                <li>
                  <Check />
                  <span>Составит план повторения</span>
                </li>
                <li>
                  <Check />
                  <span>Отвечает только по материалу урока</span>
                </li>
              </ul>
            </div>
            <div className="lp-panel lp-panel-sage">
              <Image
                className="lp-shot lp-shot-narrow"
                src="/landing/app-tutor.jpg"
                alt="Панель ИИ-наставника с разбором ошибки в тесте по SQL"
                width={384}
                height={900}
                sizes="300px"
                unoptimized
              />
            </div>
          </div>

          <div className="lp-row" data-reveal>
            <div className="lp-row-text">
              <h3>Прогресс виден по каждому курсу</h3>
              <p>
                В кабинете курсы, на которых вы остановились, процент пройденного и результаты тестов. Одна
                кнопка возвращает к следующему уроку.
              </p>
            </div>
            <div className="lp-panel lp-panel-lavender" data-ui>
              <div className="lp-mock">
                {PROGRESS_MOCK.map((row) => (
                  <div className="lp-mock-row" key={row.title}>
                    <span className="lp-mock-dot" style={{ background: row.color }} />
                    <div>
                      <p className="lp-mock-title">{row.title}</p>
                      <div className="lp-mock-bar">
                        <span style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                    <span className="lp-mock-pct">{row.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-find-title">
          <h2 id="lp-find-title" className="lp-h2 lp-center" data-reveal>
            Найдите курс по теме
          </h2>
          <p className="lp-sec-lead lp-center" data-reveal>
            Напишите, что хотите изучить, и каталог покажет подходящие уроки.
          </p>
          <div className="lp-find" data-reveal>
            <CatalogTyping />
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-faq-title">
          <h2 id="lp-faq-title" className="lp-h2 lp-center" data-reveal>
            Вопросы и ответы
          </h2>
          <div className="lp-faq">
            {FAQ.map((item, i) => (
              <div key={item.q} className="lp-faq-item" data-reveal style={vi(i % 2)}>
                <h3 className="lp-faq-q">{item.q}</h3>
                <p className="lp-faq-a">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <div className="lp-panel lp-panel-butter" data-reveal>
            <h2 id="lp-cta-title" className="lp-h2">
              Начните с одного урока
            </h2>
            <p>Курс «Python для начинающих»: четыре урока, тест после каждого.</p>
            <div className="lp-cta-actions">{withDemo(<PrimaryAction logged={logged} />, logged)}</div>
          </div>
        </section>

        <footer className="lp-footer">
          <p>SkillPath AI. Проектная работа.</p>
          <nav className="lp-footer-links" aria-label="Ссылки внизу страницы">
            <Link href="/courses" className="lp-link">
              Курсы
            </Link>
            <a href="https://github.com/sadrieff/skillpath-ai" className="lp-link">
              Код на GitHub
            </a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
