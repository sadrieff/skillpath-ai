import Link from "next/link";
import type { ReactNode } from "react";
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
  return (
    <article className="card flex flex-col gap-4 transition hover:border-accent">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
          {course.category}
        </span>
        <span className="text-xs text-muted">{LEVEL_LABELS[course.level] ?? course.level}</span>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold leading-snug text-ink">
          <Link href={`/courses/${course.id}`} className="hover:text-accent">
            {course.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted">{course.description}</p>
      </div>

      <div className="flex gap-4 text-xs text-muted">
        <span>{course.duration_hours} ч</span>
        <span>{course.lessons_count} уроков</span>
      </div>

      {course.enrolled && <ProgressBar value={course.progress_percent} />}

      {action && <div className="mt-auto pt-1">{action}</div>}
    </article>
  );
}
