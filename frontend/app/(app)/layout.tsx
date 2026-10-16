import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";

/** Shell for the signed-in part of the product: top navigation and the page column. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Перейти к содержанию
      </a>
      {process.env.NEXT_PUBLIC_DEMO === "1" && (
        <div className="bg-surface-2 px-4 py-2 text-center text-sm text-muted sm:px-6">
          Демо-стенд. Данные можно менять, ночью они сбрасываются.
        </div>
      )}
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </>
  );
}
