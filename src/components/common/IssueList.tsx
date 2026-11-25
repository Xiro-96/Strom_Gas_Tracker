import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { Issue } from '@/domain/plausibility';
import { cn } from '@/lib/utils';

const STYLE = {
  error: { icon: CircleAlert, className: 'border-danger/30 bg-danger/10 text-danger' },
  confirm: { icon: TriangleAlert, className: 'border-warning/30 bg-warning/10 text-warning' },
  warning: { icon: TriangleAlert, className: 'border-warning/30 bg-warning/10 text-warning' },
  info: { icon: Info, className: 'border-border bg-muted text-muted-foreground' },
} as const;

/** Ergebnisse der Plausibilitätsprüfung – Fehler, Rückfragen, Warnungen, Hinweise. */
export function IssueList({ issues }: { issues: readonly Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {issues.map((issue) => {
        const { icon: Icon, className } = STYLE[issue.level];
        return (
          <li
            key={issue.code}
            className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-sm', className)}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{issue.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
