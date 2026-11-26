import { addDays, daysBetween, todayISO } from '@/domain/dates';
import type { Deadline } from '@/domain/deadlines';
import type { ISODate } from '@/domain/types';

const CRLF = '\r\n';
const MAX_OCTETS = 75;
const UID_DOMAIN = 'strom-gas-tracker';
const encoder = new TextEncoder();

/** RFC 5545 3.3.11 – Backslash, Semikolon, Komma und Zeilenumbruch maskieren. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 3.1 – Zeilen > 75 Oktette falten (Fortsetzung beginnt mit Leerzeichen), UTF-8-sicher. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const charSize = encoder.encode(char).length;
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (size + charSize > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.map((p, i) => (i === 0 ? p : ` ${p}`)).join(CRLF);
}

const icsDate = (iso: ISODate) => iso.replace(/-/g, '');
const pad = (n: number) => String(n).padStart(2, '0');
const utcStamp = (d: Date) =>
  `${String(d.getUTCFullYear())}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Erinnerung um 9 Uhr, `daysBefore` Tage vor einem ganztägigen Termin (Start 0 Uhr). */
const triggerBefore = (daysBefore: number) =>
  daysBefore <= 0 ? 'PT9H' : daysBefore === 1 ? '-PT15H' : `-P${String(daysBefore - 1)}DT15H`;

function alarm(trigger: string, text: string): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(text)}`,
    `TRIGGER:${trigger}`,
    'END:VALARM',
  ];
}

function allDayEvent(input: {
  uid: string;
  date: ISODate;
  summary: string;
  description: string;
  stamp: string;
  alarms: string[][];
  rrule?: string;
}): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${input.uid}@${UID_DOMAIN}`,
    `DTSTAMP:${input.stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(input.date)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(input.date, 1))}`,
    ...(input.rrule ? [`RRULE:${input.rrule}`] : []),
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    'TRANSP:TRANSPARENT',
    ...input.alarms.flat(),
    'END:VEVENT',
  ];
}

/**
 * Kalender-Export (Spec Phase 3): offene, künftige Fristen als ganztägige Termine mit Erinnerung
 * (Vortag 9 Uhr, bei Kündigungen zusätzlich am empfohlenen Tag) und eine wiederkehrende
 * Ablese-Erinnerung (RRULE im Ableseintervall). Einzelne „nächste Ablesung“-Fristen ersetzt die
 * Wiederholung.
 */
export function buildIcs(input: {
  deadlines: readonly Deadline[];
  readingReminder?: { start: ISODate; intervalDays: number };
  now: Date;
}): string {
  const today = todayISO(input.now);
  const stamp = utcStamp(input.now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Strom & Gas Tracker//Fristen//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText('Strom & Gas – Fristen')}`,
  ];
  for (const d of input.deadlines) {
    if (d.done || d.date < today) continue;
    if (input.readingReminder && d.kind === 'next_reading') continue;
    const alarms: string[][] = [];
    if (d.recommendedDate && d.recommendedDate >= today && d.recommendedDate < d.date) {
      alarms.push(
        alarm(triggerBefore(daysBetween(d.recommendedDate, d.date)), `Empfohlen: ${d.title}`),
      );
    }
    alarms.push(alarm(triggerBefore(1), d.title));
    lines.push(
      ...allDayEvent({
        uid: d.id,
        date: d.date,
        summary: d.title,
        description: d.detail,
        stamp,
        alarms,
      }),
    );
  }
  if (input.readingReminder) {
    lines.push(
      ...allDayEvent({
        uid: 'ablesen',
        date: input.readingReminder.start,
        summary: 'Zählerstände ablesen',
        description: 'Strom und Gas ablesen und in der App erfassen – mit Foto.',
        stamp,
        rrule: `FREQ=DAILY;INTERVAL=${String(input.readingReminder.intervalDays)}`,
        alarms: [alarm(triggerBefore(0), 'Zählerstände ablesen')],
      }),
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
