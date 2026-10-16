"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, getCourse } from "@/lib/api";
import type { CourseDetail } from "@/lib/types";

/** Loads a course with its modules and lessons (public endpoint). Pass null to load nothing. */
export function useCourseTree(courseId: number | null) {
  const [tree, setTree] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (courseId === null) {
      setTree(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCourse(courseId)
      .then((data) => {
        if (!cancelled) setTree(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTree(null);
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { tree, loading, error, reload };
}
