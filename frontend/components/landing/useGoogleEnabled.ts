"use client";

import { useEffect, useState } from "react";
import { getAuthProviders } from "@/lib/api";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// Один запрос на все кнопки лендинга.
let providers: Promise<boolean> | null = null;

function loadGoogleEnabled(): Promise<boolean> {
  providers ??= getAuthProviders().then((p) => p.google);
  return providers;
}

/** Показывать ли вход через Google. На демо-стенде пока не знаем ответ, кнопку не рисуем. */
export function useGoogleEnabled(): boolean {
  const [enabled, setEnabled] = useState(!DEMO);

  useEffect(() => {
    let cancelled = false;
    loadGoogleEnabled()
      .then((value) => {
        if (!cancelled) setEnabled(value);
      })
      .catch(() => {
        providers = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
