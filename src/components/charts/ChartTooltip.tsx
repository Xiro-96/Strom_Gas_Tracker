import type { ReactNode } from 'react';

/** Deutsch beschrifteter Tooltip-Kasten für alle Diagramme. */
export function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-40 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-card">
      <p className="mb-1 font-medium">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({
  color,
  label,
  value,
  dashed,
}: {
  color: string;
  label: string;
  value: string;
  dashed?: boolean;
}) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <svg width="12" height="6" aria-hidden="true">
          <line
            x1="0"
            y1="3"
            x2="12"
            y2="3"
            stroke={color}
            strokeWidth={2}
            strokeDasharray={dashed ? '3 2' : undefined}
          />
        </svg>
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </p>
  );
}
