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
import { CAPABILITIES, FAQ } from "./data";
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
              <a href={googleEnabled ? googleLoginUrl() : "#lp-hero-title"} className="lp-link">
                Войти
              </a>
            )}
          </nav>
        </header>

        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div>
            <h1 id="lp-hero-title" className="lp-statement" data-rise style={vi(0)}>
              Ошибка в тесте станет уроком
            </h1>
            <p className="lp-lead" data-rise style={vi(1)}>
              SkillPath AI ведёт курс от урока к тесту. ИИ-наставник разбирает каждый неверный ответ
              простыми словами.
            </p>
            <div className="lp-hero-actions" data-rise style={vi(2)}>
              {withDemo(<PrimaryAction logged={logged} />, logged)}
              {DEV_LOGIN_ENABLED && <DemoLogin />}
            </div>
          </div>
          <div data-rise style={vi(3)}>
            <MiniQuiz />
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-shots-title">
          <h2 id="lp-shots-title" className="lp-h2" data-reveal>
            Так это выглядит в приложении
          </h2>
          <p className="lp-sec-lead" data-reveal>
            Скриншоты сделаны на демо-стенде. Урок, тест и наставник открываются на одной странице.
          </p>
          <div className="lp-grid-2">
            <figure className="lp-shot" data-reveal>
              <div className="lp-shot-frame">
                <Image
                  src="/landing/app-lesson.jpg"
                  alt="Страница урока: текст про SELECT слева и тест из трёх вопросов справа"
                  width={1280}
                  height={1000}
                  sizes="(max-width: 700px) 100vw, 540px"
                />
              </div>
              <figcaption>Текст урока и тест рядом.</figcaption>
            </figure>
            <figure className="lp-shot" data-reveal style={vi(1)}>
              <div className="lp-shot-frame">
                <Image
                  src="/landing/app-tutor.jpg"
                  alt="Панель ИИ-наставника с разбором ошибки в тесте по SQL"
                  width={1280}
                  height={1000}
                  sizes="(max-width: 700px) 100vw, 540px"
                />
              </div>
              <figcaption>Наставник объясняет ошибку и отвечает на вопросы по уроку.</figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-steps-title">
          <h2 id="lp-steps-title" className="lp-h2" data-reveal>
            Как наставник разбирает ошибку
          </h2>
          <p className="lp-sec-lead" data-reveal>
            Он видит, какой вариант вы выбрали и какой был верным, и объясняет разницу.
          </p>
          <div className="lp-grid-3">
            <div className="lp-card lp-step" data-reveal>
              <h3 className="lp-step-title">Вы отвечаете на вопрос</h3>
              <p className="lp-call">Ваш ответ: int</p>
              <p className="lp-response" data-ui>
                Неверно. Правильный ответ: float.
              </p>
            </div>
            <div className="lp-card lp-step" data-reveal style={vi(1)}>
              <h3 className="lp-step-title">Наставник объясняет</h3>
              <p className="lp-call">Почему не int?</p>
              <p className="lp-response" data-ui>
                int хранит только целые числа. У 3.14 есть дробная часть, поэтому это float.
              </p>
            </div>
            <div className="lp-card lp-step" data-reveal style={vi(2)}>
              <h3 className="lp-step-title">Вы проходите тест заново</h3>
              <p className="lp-call">Попытка 2: 2 из 2 верно</p>
              <p className="lp-response" data-ui>
                Результат 100%. Урок отмечен пройденным, прогресс курса обновлён.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-menu-title">
          <h2 id="lp-menu-title" className="lp-h2" data-reveal>
            Что внутри
          </h2>
          <p className="lp-sec-lead" data-reveal>
            Всё, что нужно для прохождения курса, в одном приложении.
          </p>
          <div className="lp-grid-3">
            {CAPABILITIES.map((c, i) => (
              <div key={c.name} className="lp-card lp-feature" data-reveal style={vi(i % 3)}>
                <p className="lp-feature-name">{c.name}</p>
                <p className="lp-feature-value">{c.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-find-title">
          <h2 id="lp-find-title" className="lp-h2" data-reveal>
            Найдите курс по теме
          </h2>
          <p className="lp-sec-lead" data-reveal>
            Напишите тему, и каталог покажет, где её изучить.
          </p>
          <div className="lp-card" data-reveal>
            <CatalogTyping />
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-faq-title">
          <h2 id="lp-faq-title" className="lp-h2" data-reveal>
            Вопросы и ответы
          </h2>
          <div className="lp-grid-2" style={{ marginTop: 24 }}>
            {FAQ.map((item, i) => (
              <div key={item.q} className="lp-card" data-reveal style={vi(i % 2)}>
                <h3 className="lp-faq-q">{item.q}</h3>
                <p className="lp-faq-a">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-cta-title">
          <div className="lp-cta" data-reveal>
            <div>
              <h2 id="lp-cta-title" className="lp-h2">
                Откройте первый курс
              </h2>
              <p>Пройдите урок из курса «Python для начинающих» и сдайте первый тест.</p>
            </div>
            <div>{withDemo(<PrimaryAction logged={logged} />, logged)}</div>
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
