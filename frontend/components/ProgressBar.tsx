interface ProgressBarProps {
  value: number;
  label?: string;
}

export default function ProgressBar({ value, label = "Прогресс" }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={label}
        >
          {/* Scale instead of width: the bar animates on transform only. */}
          <div
            className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${percent / 100})` }}
          />
        </div>
        <span className="w-12 text-right text-sm font-semibold tabular-nums text-ink">{percent}%</span>
      </div>
    </div>
  );
}
