"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-16">
      <p className="text-sm text-muted">Ошибка</p>
      <h1 className="text-2xl font-bold text-ink">Страница не открылась</h1>
      <p className="text-sm text-muted">Что-то пошло не так. Попробуйте ещё раз или обновите страницу.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Попробовать снова
        </button>
        <a href="/" className="btn-secondary">
          На главную
        </a>
      </div>
    </main>
  );
}
