import {
  addDays,
  daysBetween,
  daysInMonth,
  daysInYear,
  eachDay,
  isISODate,
  toISODate,
} from '@/domain/dates';

describe('dates', () => {
  it('zählt Kalendertage, auch über die Sommerzeit-Umstellung', () => {
    expect(daysBetween('2026-01-01', '2026-01-22')).toBe(21);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // Umstellung 29.03.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2); // Umstellung 25.10.
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9);
  });

  it('addiert Tage als ISO-Datum', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('liefert alle Tage im halboffenen Intervall [A, B)', () => {
    expect(eachDay('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(eachDay('2026-01-01', '2026-01-01')).toEqual([]);
  });

  it('kennt Schaltjahre und Monatslängen', () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
    expect(daysInMonth('2028-02-10')).toBe(29);
    expect(daysInMonth('2026-11-25')).toBe(30);
  });

  it('formatiert lokale Daten ohne Zeitzonenverschiebung', () => {
    expect(toISODate(new Date(2026, 10, 25, 23, 59))).toBe('2026-11-25');
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('prüft das ISO-Format streng', () => {
    expect(isISODate('2026-11-25')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('25.11.2026')).toBe(false);
  });
});
