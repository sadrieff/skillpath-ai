/** Цвет обложки курса. Задан по категории, для остальных выбирается по номеру курса. */
export interface CourseTheme {
  /** Фон обложки. */
  bg: string;
  /** Тёмный оттенок того же цвета: текст и значки на обложке. */
  fg: string;
}

const BY_CATEGORY: Record<string, CourseTheme> = {
  python: { bg: "#ffe38a", fg: "#6b4f00" },
  databases: { bg: "#bfd8ff", fg: "#1b4590" },
  tools: { bg: "#ffc9b8", fg: "#8e2f10" },
};

const FALLBACK: CourseTheme[] = [
  { bg: "#c6ebcb", fg: "#1b5f2f" },
  { bg: "#f6cbe5", fg: "#7d255d" },
  { bg: "#d9d2f7", fg: "#43328f" },
  { bg: "#ffd9a8", fg: "#7a4300" },
];

export function courseTheme(category: string, id: number): CourseTheme {
  return BY_CATEGORY[category.trim().toLowerCase()] ?? FALLBACK[Math.abs(id) % FALLBACK.length];
}
