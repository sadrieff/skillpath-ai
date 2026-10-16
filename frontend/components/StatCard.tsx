import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div>
      <p className="text-[2.5rem] font-extrabold leading-none tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-sm text-muted">{label}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}
