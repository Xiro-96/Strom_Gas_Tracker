import { daysBetween } from '@/domain/dates';
import { deadlineState, type Deadline, type DeadlineState } from '@/domain/deadlines';
import type { ISODate } from '@/domain/types';

export interface OpenDeadline {
  deadline: Deadline;
  state: Extract<DeadlineState, 'overdue' | 'soon' | 'later'>;
  /** Tage bis zur Frist (negativ = überfällig) */
  days: number;
}

/**
 * Offene Fristen für Leiste und Hinweise: ohne Erledigte/Verfallene und ohne „nächste Ablesung“
 * (die zeigen die Energiekarten). Überfällige zuerst, dann nach Datum.
 */
export function openDeadlines(deadlines: readonly Deadline[], today: ISODate): OpenDeadline[] {
  const result: OpenDeadline[] = [];
  for (const deadline of deadlines) {
    if (deadline.kind === 'next_reading') continue;
    const state = deadlineState(deadline, today);
    if (state === 'done' || state === 'expired') continue;
    result.push({ deadline, state, days: daysBetween(today, deadline.date) });
  }
  return result.sort(
    (a, b) =>
      Number(b.state === 'overdue') - Number(a.state === 'overdue') ||
      a.deadline.date.localeCompare(b.deadline.date),
  );
}

/** Für Hinweise beim App-Start: überfällig oder in höchstens 7 Tagen. */
export const isUrgent = (o: OpenDeadline) => o.state === 'overdue' || o.days <= 7;
