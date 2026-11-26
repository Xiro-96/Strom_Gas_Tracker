import type { Deadline } from '@/domain/deadlines';
import { buildIcs } from '@/domain/ics';
import type { ISODate } from '@/domain/types';

export const CALENDAR_FILE_NAME = 'strom-gas-fristen.ics';

/** Kalenderdatei mit allen offenen Fristen und der wiederkehrenden Ablese-Erinnerung. */
export function calendarText(
  deadlines: readonly Deadline[],
  readingIntervalDays: number,
  today: ISODate,
  now: Date = new Date(),
): string {
  const next = deadlines
    .filter((d) => d.kind === 'next_reading')
    .map((d) => d.date)
    .sort()[0];
  const start = !next || next < today ? today : next;
  return buildIcs({
    deadlines,
    readingReminder: { start, intervalDays: readingIntervalDays },
    now,
  });
}

/** Startet den Download (iOS/Android öffnen die .ics im Kalender-Import). */
export function downloadCalendar(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = CALENDAR_FILE_NAME;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
