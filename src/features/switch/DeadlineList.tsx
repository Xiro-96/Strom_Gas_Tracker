import { Badge } from '@/components/ui/badge';
import { daysBetween } from '@/domain/dates';
import { deadlineState, type Deadline, type DeadlineState } from '@/domain/deadlines';
import type { ISODate } from '@/domain/types';
import { formatCountdown, formatDate } from '@/lib/format';

const STATE: Record<
  DeadlineState,
  { label: string; variant: 'danger' | 'warning' | 'outline' | 'savings' | 'secondary' }
> = {
  overdue: { label: 'überfällig', variant: 'danger' },
  soon: { label: 'bald', variant: 'warning' },
  later: { label: 'geplant', variant: 'outline' },
  done: { label: 'erledigt', variant: 'savings' },
  expired: { label: 'verstrichen', variant: 'secondary' },
};

/** Fristenliste mit Zustand, Datum, Countdown und Erklärung. Verstrichene Fristen werden ausgeblendet. */
export function DeadlineList({
  deadlines,
  today,
  label,
}: {
  deadlines: readonly Deadline[];
  today: ISODate;
  label: string;
}) {
  const visible = deadlines
    .map((d) => ({ d, state: deadlineState(d, today) }))
    .filter((x) => x.state !== 'expired');
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine offenen Fristen.</p>;
  }
  return (
    <ul aria-label={label} className="flex flex-col divide-y">
      {visible.map(({ d, state }) => (
        <li key={d.id} className="flex flex-col gap-1 py-2.5 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium">{d.title}</span>
            <Badge variant={STATE[state].variant}>{STATE[state].label}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDate(d.date)}
            {state === 'done' ? '' : ` · ${formatCountdown(daysBetween(today, d.date))}`}
            {d.recommendedDate && state !== 'done' && d.recommendedDate >= today
              ? ` · empfohlen bis ${formatDate(d.recommendedDate)}`
              : ''}
          </span>
          <span className="text-xs text-muted-foreground">{d.detail}</span>
        </li>
      ))}
    </ul>
  );
}
