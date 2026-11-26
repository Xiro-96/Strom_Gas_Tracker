import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: 'danger' | 'warning' | 'savings' | 'muted';
  children: ReactNode;
}) {
  const styles = {
    danger: 'border-danger/30 bg-danger/10 text-danger',
    warning: 'border-warning/30 bg-warning/10',
    savings: 'border-savings/30 bg-savings/10',
    muted: 'border-border bg-muted/40 text-muted-foreground',
  } as const;
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn('flex flex-col gap-1 rounded-xl border px-3 py-2 text-sm', styles[tone])}
    >
      {children}
    </div>
  );
}
