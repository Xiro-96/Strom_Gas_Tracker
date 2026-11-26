import ICAL from 'ical.js';
import type { Deadline } from '@/domain/deadlines';
import { buildIcs, escapeText, foldLine } from '@/domain/ics';

const now = new Date(2026, 10, 26, 10, 30); // 26.11.2026, lokal

const deadline = (overrides: Partial<Deadline> = {}): Deadline => ({
  id: 'cancellation-c1',
  kind: 'cancellation',
  date: '2026-12-30',
  recommendedDate: '2026-12-23',
  title: 'Blitzwerk kündigen',
  detail: 'Kündigung muss spätestens am 30.11.2026 beim Anbieter sein – für Lieferende 31.12.2026.',
  energyType: 'electricity',
  contractId: 'c1',
  done: false,
  ...overrides,
});

/** ical.js liefert `any` – einmal typisieren. */
const parseCalendar = (text: string) => new ICAL.Component(ICAL.parse(text) as unknown[]);

const octets = (line: string) => new TextEncoder().encode(line).length;

describe('ICS – Grundregeln (RFC 5545)', () => {
  it('maskiert Sonderzeichen in Texten', () => {
    expect(escapeText('a,b;c\\d\nneu')).toBe('a\\,b\\;c\\\\d\\nneu');
  });

  it('faltet nach 75 Oktetten, ohne Umlaute zu zerteilen', () => {
    const long = `SUMMARY:${'Schlussrechnung prüfen – Überschreitung ä'.repeat(4)}`;
    const folded = foldLine(long).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const line of folded) expect(octets(line)).toBeLessThanOrEqual(75);
    expect(folded.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    // Entfalten ergibt wieder den Originaltext
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(long);
  });
});

describe('buildIcs', () => {
  const ics = buildIcs({
    deadlines: [
      deadline(),
      deadline({
        id: 'final_bill_due-c1',
        kind: 'final_bill_due',
        date: '2027-02-11',
        recommendedDate: undefined,
        title: 'Schlussrechnung Blitzwerk fällig',
        detail: 'Spätestens 6 Wochen nach Lieferende; Guthaben, Bonus, Verbrauch prüfen.',
      }),
      deadline({ id: 'done-1', done: true, title: 'Erledigt' }),
      deadline({ id: 'past-1', date: '2026-11-01', title: 'Vorbei' }),
      deadline({
        id: 'next_reading-electricity',
        kind: 'next_reading',
        date: '2026-12-01',
        title: 'Strom ablesen',
      }),
    ],
    readingReminder: { start: '2026-12-01', intervalDays: 14 },
    now,
  });
  const lines = ics.split('\r\n');

  it('ist ein gültiger Kalender mit CRLF und gefalteten Zeilen', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of lines) expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it('enthält offene, künftige Fristen als ganztägige Termine mit Erinnerung', () => {
    const cal = parseCalendar(ics);
    const events = cal.getAllSubcomponents('vevent');
    const summaries = events.map((e) => e.getFirstPropertyValue('summary'));
    expect(summaries).toEqual([
      'Blitzwerk kündigen',
      'Schlussrechnung Blitzwerk fällig',
      'Zählerstände ablesen',
    ]);
    const first = events[0];
    expect(first?.getFirstPropertyValue('uid')).toBe('cancellation-c1@strom-gas-tracker');
    expect(String(first?.getFirstPropertyValue('dtstart'))).toBe('2026-12-30');
    expect(String(first?.getFirstPropertyValue('dtend'))).toBe('2026-12-31');
    expect(first?.getFirstPropertyValue('description')).toContain('Lieferende 31.12.2026');
    const alarms = first?.getAllSubcomponents('valarm') ?? [];
    // Empfehlung (7 Tage vorher, 9 Uhr) und Vortag 9 Uhr
    expect(alarms.map((a) => String(a.getFirstPropertyValue('trigger')))).toEqual([
      '-P6DT15H',
      '-PT15H',
    ]);
    expect(alarms.every((a) => a.getFirstPropertyValue('action') === 'DISPLAY')).toBe(true);
  });

  it('erinnert wiederkehrend ans Ablesen (RRULE aus dem Ableseintervall)', () => {
    const cal = parseCalendar(ics);
    const reminder = cal
      .getAllSubcomponents('vevent')
      .find((e) => e.getFirstPropertyValue('uid') === 'ablesen@strom-gas-tracker');
    expect(String(reminder?.getFirstPropertyValue('rrule'))).toBe('FREQ=DAILY;INTERVAL=14');
    expect(String(reminder?.getFirstPropertyValue('dtstart'))).toBe('2026-12-01');
    expect(String(reminder?.getFirstSubcomponent('valarm')?.getFirstPropertyValue('trigger'))).toBe(
      'PT9H',
    );
  });

  it('setzt einen UTC-Zeitstempel (DTSTAMP)', () => {
    expect(lines.find((l) => l.startsWith('DTSTAMP:'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  });

  it('lässt eine schon verstrichene Empfehlung weg (nur Vortag-Erinnerung)', () => {
    const late = buildIcs({
      deadlines: [deadline({ date: '2026-11-30', recommendedDate: '2026-11-23' })],
      now,
    });
    const event = parseCalendar(late).getFirstSubcomponent('vevent');
    expect(
      event?.getAllSubcomponents('valarm').map((a) => String(a.getFirstPropertyValue('trigger'))),
    ).toEqual(['-PT15H']);
  });
});
