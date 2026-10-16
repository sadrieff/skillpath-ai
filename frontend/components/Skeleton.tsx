interface SkeletonProps {
  /** Give it the height of the content it stands in for, so the page does not move when data arrives. */
  className?: string;
}

/** Placeholder block shown while data loads. Decorative, so it is hidden from screen readers. */
export default function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-surface-2 ${className}`} />;
}
