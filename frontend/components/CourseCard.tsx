import Link from "next/link";
import type { ReactNode } from "react";
import { courseTheme } from "@/lib/courseTheme";
import type { CourseCard as CourseCardData, CourseLevel } from "@/lib/types";
import ProgressBar from "./ProgressBar";

export const LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

interface CourseCardProps {
  course: CourseCardData;
  /** Optional footer slot, e.g. an enroll button. */
  action?: ReactNode;
}

export default function CourseCard({ course, action }: CourseCardProps) {
  const theme = courseTheme(course.category, course.id);
  const letter = course.title.trim().charAt(0).toUpperCase();

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[transform,box-shadow] duration-200 hover:shadow-lift motion-safe:hover:-translate-y-0.5">
      <div
        className="flex h-36 flex-col justify-between p-4"
        style={{ background: theme.bg, color: theme.fg }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-surface/80 px-3 py-1 text-sm font-semibold text-ink">
            {course.category}
          </span>
          <span className="pt-1 text-sm font-semibold">
            {LEVEL_LABELS[course.level] ?? course.level}
          </span>
        </div>
        <span aria-hidden="true" className="text-6xl font-bold leading-none">
          {letter}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <h3 className="text-xl font-bold leading-snug text-ink">
            <Link href={`/courses/${course.id}`} className="rounded hover:text-accent">
              {course.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-[0.9375rem] leading-relaxed text-muted">
            {course.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{course.duration_hours} ч</span>
          <span>{course.lessons_count} уроков</span>
        </div>

        {course.enrolled && <ProgressBar value={course.progress_percent} />}

        {action && <div className="mt-auto pt-1">{action}</div>}
      </div>
    </article>
  );
}
