"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
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
    `inline-flex min-h-11 items-center rounded px-3 text-[0.9375rem] font-medium transition-colors duration-150 ${
      isActive(href) ? "font-semibold text-ink" : "text-muted hover:text-ink"
    }`;

  const label = (item: NavItem) =>
    isActive(item.href) ? (
      <span className="underline decoration-accent decoration-[3px] underline-offset-[10px]">{item.label}</span>
    ) : (
      item.label
    );

  const userName = user ? user.full_name || user.email : "";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
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
              {label(item)}
            </Link>
          ))}
          {/* Reserve the slot while auth loads, so the bar does not jump. */}
          <div className="ml-3 flex min-h-11 min-w-[120px] items-center justify-end gap-2 border-l border-line pl-4">
            {!loading && user && (
              <>
                <span
                  role="img"
                  aria-label={`Вы вошли как ${userName}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink"
                >
                  {initials(userName)}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex min-h-11 items-center rounded px-3 text-[0.9375rem] font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  Выйти
                </button>
              </>
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
          className="flex h-11 w-11 items-center justify-center rounded border border-line bg-surface text-ink md:hidden"
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
        <nav id="mobile-menu" className="border-t border-line bg-surface px-4 py-3 md:hidden" aria-label="Мобильное меню">
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={linkClass(item.href)}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {label(item)}
              </Link>
            ))}
            {!loading && user && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="inline-flex min-h-11 items-center rounded px-3 text-left text-[0.9375rem] font-medium text-muted transition-colors duration-150 hover:text-ink"
              >
                Выйти
              </button>
            )}
            {!loading && !user && (
              <Link href="/" onClick={() => setOpen(false)} className="btn-primary mt-1">
                Войти
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
