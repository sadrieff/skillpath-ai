interface ProgressBarProps {
  value: number;
  label?: string;
}

export default function ProgressBar({ value, label = "Прогресс" }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-medium tabular-nums text-ink">{percent}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        {/* Scale instead of width: the bar animates on transform only. */}
        <div
          className="h-full origin-left rounded bg-accent transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
    </div>
  );
}
