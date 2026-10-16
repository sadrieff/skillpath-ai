"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErrorBox from "@/components/ErrorBox";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth";

/** Target of the backend Google OAuth redirect: /auth/callback?token=<jwt> */
export default function AuthCallbackPage() {
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("Токен не получен. Попробуйте войти снова.");
      return;
    }

    let cancelled = false;
    loginWithToken(token).then((user) => {
      if (cancelled) return;
      if (user) router.replace("/dashboard");
      else setError("Не удалось загрузить профиль. Попробуйте войти снова.");
    });

    return () => {
      cancelled = true;
    };
  }, [loginWithToken, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-24 text-center">
      <h1 className="sr-only">Вход в SkillPath AI</h1>
      {error ? (
        <>
          <ErrorBox message={error} />
          <Link href="/" className="btn-secondary">
            На главную
          </Link>
        </>
      ) : (
        <Spinner label="Завершаем вход…" />
      )}
    </div>
  );
}
