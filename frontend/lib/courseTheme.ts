/** Оформление курса: пастельная подложка обложки и короткий фрагмент кода по теме. */
export interface CourseTheme {
  /** Фон обложки. */
  bg: string;
  /** Тёмный оттенок того же цвета: подписи на обложке. */
  fg: string;
  /** Строка кода, которая показывается на обложке. */
  snippet: string;
}

const BY_CATEGORY: Record<string, CourseTheme> = {
  python: { bg: "#f7efd2", fg: "#6b5410", snippet: 'print("Привет, мир")' },
  databases: { bg: "#e1ecf7", fg: "#1f4a7a", snippet: "SELECT name FROM users;" },
  tools: { bg: "#f9e8dd", fg: "#86411c", snippet: 'git commit -m "init"' },
};

const FALLBACK: Omit<CourseTheme, "snippet">[] = [
  { bg: "#e4ede2", fg: "#2f5a2b" },
  { bg: "#e9e6f5", fg: "#463a86" },
  { bg: "#f5e3ea", fg: "#7d2f4c" },
];

export function courseTheme(category: string, id: number, title = ""): CourseTheme {
  const known = BY_CATEGORY[category.trim().toLowerCase()];
  if (known) return known;
  const base = FALLBACK[Math.abs(id) % FALLBACK.length];
  return { ...base, snippet: title };
}
