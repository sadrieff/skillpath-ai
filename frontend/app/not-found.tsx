import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-16">
      <p className="text-sm text-muted">Ошибка 404</p>
      <h1 className="text-2xl font-bold text-ink">Страница не найдена</h1>
      <p className="text-sm text-muted">Такой страницы нет или её перенесли.</p>
      <Link href="/" className="btn-primary self-start">
        На главную
      </Link>
    </main>
  );
}
