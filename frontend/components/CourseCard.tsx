import Link from "next/link";
import type { ReactNode } from "react";
import CourseCover from "@/components/CourseCover";
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
    <article className="card flex flex-col overflow-hidden p-0 transition hover:border-ink/20 hover:shadow-lift motion-safe:hover:-translate-y-0.5">
      <CourseCover category={course.category} id={course.id} title={course.title} className="h-40" />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-sm text-muted">
          {course.category} · {LEVEL_LABELS[course.level] ?? course.level}
        </p>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold leading-snug text-ink">
            <Link href={`/courses/${course.id}`} className="rounded hover:text-accent">
              {course.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-[0.9375rem] leading-relaxed text-muted">{course.description}</p>
        </div>

        <p className="text-sm text-muted">
          {course.duration_hours} ч · {course.lessons_count} уроков
        </p>

        {course.enrolled && <ProgressBar value={course.progress_percent} />}

        {action && <div className="mt-auto pt-1">{action}</div>}
      </div>
    </article>
  );
}
