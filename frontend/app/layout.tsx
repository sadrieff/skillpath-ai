import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { onest, serif } from "./fonts";

export const metadata: Metadata = {
  title: "SkillPath AI",
  description: "Платформа обучения с AI-наставником: курсы, тесты и разбор ошибок.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${onest.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-ground font-sans text-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
