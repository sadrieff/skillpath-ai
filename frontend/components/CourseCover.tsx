import { courseTheme } from "@/lib/courseTheme";

interface CourseCoverProps {
  category: string;
  id: number;
  title: string;
  /** Высота обложки в Tailwind-классе, по умолчанию h-40. */
  className?: string;
}

/** Пастельная подложка с маленькой карточкой кода, как фрагмент урока. Декоративная, для скринридеров скрыта. */
export default function CourseCover({ category, id, title, className = "h-40" }: CourseCoverProps) {
  const theme = courseTheme(category, id, title);
  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: theme.bg }}
    >
      <div className="w-[78%] max-w-[260px] rounded-xl border border-black/5 bg-white/90 px-4 py-3 shadow-card">
        <div className="mb-2 flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
        </div>
        <p className="truncate font-mono text-[0.8125rem] leading-6" style={{ color: theme.fg }}>
          {theme.snippet}
        </p>
      </div>
    </div>
  );
}
