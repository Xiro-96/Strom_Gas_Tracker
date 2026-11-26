import { AlarmClock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Deadline } from '@/domain/deadlines';
import type { ISODate } from '@/domain/types';
import { openDeadlines } from '@/features/switch/urgency';
import { formatCountdown, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Spec 7.2 – Fristen-Leiste: die dringendste offene Frist mit Countdown, Link ins Cockpit. */
export function DeadlineBar({ deadlines, today }: { deadlines: Deadline[]; today: ISODate }) {
  const open = openDeadlines(deadlines, today);
  const first = open[0];
  if (!first) return null;
  const { deadline, state, days } = first;
  const recommended =
    deadline.recommendedDate && deadline.recommendedDate >= today
      ? ` · empfohlen bis ${formatDate(deadline.recommendedDate)}`
      : '';
  return (
    <Link
      to="/wechsel"
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors hover:bg-accent/40',
        state === 'overdue' && 'border-danger/40 bg-danger/10',
        state === 'soon' && 'border-warning/40 bg-warning/10',
        state === 'later' && 'bg-card',
      )}
    >
      <AlarmClock
        aria-hidden="true"
        className={cn(
          'size-5 shrink-0',
          state === 'overdue'
            ? 'text-danger'
            : state === 'soon'
              ? 'text-warning'
              : 'text-muted-foreground',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {deadline.title} · {formatCountdown(days)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          bis {formatDate(deadline.date)}
          {recommended}
          {open.length > 1 ? ` · ${String(open.length - 1)} weitere` : ''}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
