"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import Spinner from "./Spinner";

/** Renders children only for an authenticated user; otherwise redirects to the landing page. */
export default function ProtectedPage({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Проверяем вход…" />
      </div>
    );
  }

  return <>{children}</>;
}
