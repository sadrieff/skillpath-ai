"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import AdminCourses from "@/components/admin/AdminCourses";
import AdminQuizzes from "@/components/admin/AdminQuizzes";
import AdminStructure from "@/components/admin/AdminStructure";
import { useAuth } from "@/lib/auth";

type TabId = "courses" | "structure" | "quizzes";

const TABS: { id: TabId; label: string }[] = [
  { id: "courses", label: "Курсы" },
  { id: "structure", label: "Структура" },
  { id: "quizzes", label: "Тесты" },
];

export default function AdminPage() {
  return (
    <ProtectedPage>
      <AdminContent />
    </ProtectedPage>
  );
}

function AdminContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("courses");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!loading && user && user.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  if (!isAdmin) {
    return (
      <div className="card max-w-lg space-y-2">
        <h1 className="text-[1.75rem] sm:text-[2.5rem] font-extrabold leading-tight text-ink">Нет доступа</h1>
        <p className="text-base text-muted">Раздел доступен только администраторам. Открываем дашборд.</p>
      </div>
    );
  }

  // Arrow keys move between tabs (roving tabindex), Home and End jump to the ends.
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((item) => item.id === tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[next].id;
    setTab(target);
    tabRefs.current[target]?.focus();
  }

  return (
    <div className="space-y-10">
      <h1 className="text-[1.75rem] sm:text-[2.5rem] font-extrabold leading-tight text-ink">Администрирование</h1>

      <div
        role="tablist"
        aria-label="Разделы администрирования"
        className="flex gap-6 overflow-x-auto border-b border-line"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[item.id] = el;
              }}
              id={`admin-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="admin-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={handleTabKeyDown}
              className={`min-h-11 shrink-0 border-b-4 px-1 pb-2 pt-2.5 text-[1.0625rem] transition-colors duration-150 ${
                selected
                  ? "border-accent font-bold text-ink"
                  : "border-transparent font-medium text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} tabIndex={0}>
        {tab === "courses" && <AdminCourses />}
        {tab === "structure" && <AdminStructure />}
        {tab === "quizzes" && <AdminQuizzes />}
      </div>
    </div>
  );
}
