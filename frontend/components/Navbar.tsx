"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
}

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    ...(user ? [{ href: "/dashboard", label: "Дашборд" }] : []),
    { href: "/courses", label: "Курсы" },
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Админ" }] : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    `inline-flex min-h-11 items-center rounded px-3 text-sm font-medium transition-colors duration-150 ${
      isActive(href) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-accent text-sm font-bold text-accent-ink">
            SP
          </span>
          <span>SkillPath AI</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {/* Reserve the slot while auth loads, so the bar does not jump. */}
          <div className="ml-2 flex min-h-11 min-w-[104px] items-center justify-end">
            {!loading && user && (
              <button type="button" onClick={logout} className="btn-secondary !py-2">
                Выйти
              </button>
            )}
            {!loading && !user && (
              <Link href="/" className="btn-primary !py-2">
                Войти
              </Link>
            )}
          </div>
        </nav>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded border border-line text-ink md:hidden"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" className="border-t border-line px-4 py-3 md:hidden" aria-label="Мобильное меню">
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={linkClass(item.href)}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            {!loading && user && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="inline-flex min-h-11 items-center rounded px-3 text-left text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink"
              >
                Выйти
              </button>
            )}
            {!loading && !user && (
              <Link href="/" onClick={() => setOpen(false)} className={linkClass("/")}>
                Войти
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
