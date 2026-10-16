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
import { CAPABILITIES, FAQ, PHOTO_CREDITS } from "./data";
import MiniQuiz from "./MiniQuiz";

const DEV_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1";
const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO === "1";

/** Sets the --i custom property used by the staggered entrances in landing.css. */
function vi(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

function PrimaryAction({ logged }: { logged: boolean }) {
  if (logged) {
    return (
      <Link href="/dashboard" className="lp-btn lp-btn-primary">
        Перейти в кабинет
      </Link>
    );
  }
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
          className="lp-btn lp-btn-quiet"
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
          Демо: данные сбрасываются каждую ночь, ИИ-наставник ограничен по числу запросов в день.
        </p>
      </div>
    </div>
  );
}

/** Wraps the primary action with the demo buttons only when the demo stand flag is set. */
function withDemo(primary: ReactNode) {
  return DEMO_ENABLED ? <ActionGroup primary={primary} /> : primary;
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

export default function Landing() {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const logged = Boolean(user);

  // Hidden states only apply once JS has marked the page; without JS everything is visible.
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
      <div className="lp-page">
        <header className="lp-top">
          <Link href="/" className="lp-wordmark-small">
            SkillPath AI
          </Link>
          <nav className="lp-top-links" aria-label="Основная навигация">
            <Link href="/courses" className="lp-link">
              Курсы
            </Link>
            {logged ? (
              <Link href="/dashboard" className="lp-link">
                Кабинет
              </Link>
            ) : (
              <a href={googleLoginUrl()} className="lp-link">
                Войти
              </a>
            )}
          </nav>
        </header>

        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <h1 id="lp-hero-title" className="lp-statement">
            <span className="lp-line">
              <span className="lp-line-in" style={vi(0)}>
                Ошибка в тесте
              </span>
            </span>
            <span className="lp-line">
              <span className="lp-line-in" style={vi(1)}>
                станет уроком
              </span>
            </span>
          </h1>

          <div className="lp-hero-row">
            <div className="lp-hero-copy" data-rise style={vi(2)}>
              <p className="lp-lead">
                SkillPath AI ведёт курс от урока к тесту. ИИ-наставник разбирает каждый неверный
                ответ простыми словами.
              </p>
              {DEV_LOGIN_ENABLED && <DemoLogin />}
            </div>
            <div className="lp-hero-action" data-rise style={vi(3)}>
              {withDemo(<PrimaryAction logged={logged} />)}
            </div>
          </div>

          <div className="lp-hero-quiz" data-rise style={vi(4)}>
            <MiniQuiz />
          </div>
        </section>

        <section className="lp-band" aria-label="Фото: классная доска, 1923">
          <div className="lp-band-frame">
            <Image
              className="lp-band-img"
              src="/landing/fortepan-blackboard-1923.jpg"
              alt="Классная доска и парты, фото 1923 года"
              width={1920}
              height={1243}
              sizes="100vw"
            />
          </div>
        </section>

        <section className="lp-menu" aria-labelledby="lp-menu-title">
          <div className="lp-menu-main">
            <h2 id="lp-menu-title" className="lp-h2" data-reveal>
              Что внутри
            </h2>
            <ul className="lp-menu-list">
              {CAPABILITIES.map((c, i) => (
                <li key={c.name} className="lp-menu-row" data-reveal style={vi(i)}>
                  <span className="lp-menu-name">{c.name}</span>
                  <span className="lp-menu-value">{c.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure className="lp-menu-fig" data-reveal>
            <Image
              src="/landing/karmsund-classroom-c1910.jpg"
              alt="Школьная комната с партами и доской, около 1910 года"
              width={1920}
              height={1280}
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          </figure>
        </section>

        <section className="lp-exchange" aria-labelledby="lp-exchange-title">
          <figure className="lp-exchange-fig" data-reveal>
            <Image
              src="/landing/classroom-dc-1899.jpg"
              alt="Класс начальной школы, дети у доски на уроке математики, 1899"
              width={1536}
              height={1175}
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          </figure>
          <div className="lp-exchange-main">
            <h2 id="lp-exchange-title" className="lp-h2" data-reveal>
              Разбор ошибки
            </h2>

            <div className="lp-step" data-reveal>
              <p className="lp-step-lead">Сначала вы отвечаете на вопрос теста.</p>
              <p className="lp-call">Ваш ответ: 3</p>
              <p className="lp-response" data-ui>
                Неверно. Правильный ответ: 2.
              </p>
            </div>

            <div className="lp-step" data-reveal>
              <p className="lp-step-lead">Затем наставник смотрит, что вы выбрали.</p>
              <p className="lp-call">Почему 3, а не 2?</p>
              <p className="lp-response" data-ui>
                Срез [1:] пропускает первый элемент. Остаются 2 и 3, то есть два элемента.
              </p>
            </div>

            <div className="lp-step lp-step-wide" data-reveal>
              <p className="lp-step-lead">Потом проходите тест заново.</p>
              <p className="lp-call">Попытка 2: 2 из 2 верно</p>
              <p className="lp-response" data-ui>
                Результат 100%. Урок отмечен пройденным, прогресс курса обновлён.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-showcase" aria-label="Поиск темы в каталоге">
          <p className="lp-lead lp-showcase-lead" data-reveal>
            Напишите тему, и каталог покажет, где её изучить.
          </p>
          <div data-reveal>
            <CatalogTyping />
          </div>
        </section>

        <section className="lp-faq" aria-labelledby="lp-faq-title">
          <div className="lp-faq-head">
            <h2 id="lp-faq-title" className="lp-faq-title" data-reveal>
              Вопросы и ответы
            </h2>
            <figure className="lp-faq-fig" data-reveal>
              <Image
                src="/landing/library-sydney-c1885.jpg"
                alt="Сотрудники публичной библиотеки в читальном зале, около 1885 года"
                width={1920}
                height={1434}
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </figure>
          </div>
          {FAQ.map((item) => (
            <div className="lp-faq-row" key={item.q} data-reveal>
              <h3 className="lp-faq-q">{item.q}</h3>
              <p className="lp-faq-a">{item.a}</p>
            </div>
          ))}
        </section>

        <div className="lp-inverted">
          <section className="lp-cta" aria-labelledby="lp-cta-title">
            <h2 id="lp-cta-title" className="lp-statement lp-statement-inv" data-reveal>
              Первая ошибка
              <br />
              уже урок
            </h2>
            <div className="lp-cta-row">
              <p className="lp-lead" data-reveal>
                Войдите через Google и откройте курс «Python для начинающих».
              </p>
              <div data-reveal>{withDemo(<PrimaryAction logged={logged} />)}</div>
            </div>
          </section>

          <footer className="lp-footer">
            <div className="lp-footer-cols">
              <div>
                <p className="lp-footer-h">Разделы</p>
                <ul>
                  <li>
                    <Link href="/courses" className="lp-link">
                      Курсы
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="lp-link">
                      Кабинет
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="lp-footer-h">Проект</p>
                <p>
                  Учебный проект. Код и вёрстка писались с помощью ИИ-агентов Claude.
                </p>
              </div>
              <div className="lp-footer-credits">
                <p className="lp-footer-h">Фото</p>
                <p>Фото показывают время, а не учеников или команду проекта.</p>
                <ul>
                  {PHOTO_CREDITS.map((c) => (
                    <li key={c.url}>
                      <a href={c.url} className="lp-link">
                        {c.label}
                      </a>
                      . {c.by}, {c.licence}.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="lp-wordmark" aria-hidden="true">
              SkillPath AI
            </p>
            <p className="lp-legal">© 2026 SkillPath AI</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
