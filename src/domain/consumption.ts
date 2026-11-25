import { subYears } from 'date-fns';
import {
  addDays,
  dayOfYear,
  daysBetween,
  daysInMonth,
  fromISODate,
  monthKey,
  toISODate,
  yearOf,
} from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import type { ISODate } from '@/domain/types';

export interface MonthTotal {
  month: string;
  kwh: number;
  coveredDays: number;
  daysInMonth: number;
}

export function monthlyTotals(daily: readonly DailyPoint[]): MonthTotal[] {
  const map = new Map<string, MonthTotal>();
  for (const { date, kwh } of daily) {
    const key = monthKey(date);
    const entry = map.get(key) ?? {
      month: key,
      kwh: 0,
      coveredDays: 0,
      daysInMonth: daysInMonth(date),
    };
    entry.kwh += kwh;
    entry.coveredDays += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function windowStats(daily: readonly DailyPoint[], from: ISODate, to: ISODate) {
  let kwh = 0;
  let covered = 0;
  for (const point of daily) {
    if (point.date >= from && point.date < to) {
      kwh += point.kwh;
      covered += 1;
    }
  }
  return { kwh, covered, days: daysBetween(from, to) };
}

/** Ø kWh/Tag über die abgedeckten Tage in [from, to); null ohne Daten. */
export function averagePerDay(
  daily: readonly DailyPoint[],
  from: ISODate,
  to: ISODate,
): number | null {
  const { kwh, covered } = windowStats(daily, from, to);
  return covered > 0 ? kwh / covered : null;
}

/** Ø der letzten `days` Tage bis zum letzten abgedeckten Tag (Übersicht: 30 Tage). */
export function lastWindowAverage(
  daily: readonly DailyPoint[],
  days: number,
): { from: ISODate; to: ISODate; perDay: number } | null {
  const last = daily.at(-1);
  if (!last) return null;
  const to = addDays(last.date, 1);
  const from = addDays(to, -days);
  const perDay = averagePerDay(daily, from, to);
  return perDay === null ? null : { from, to, perDay };
}

const MIN_COVERAGE = 0.8;

/** Relative Änderung gegenüber demselben Zeitraum im Vorjahr (−0,06 = −6 %); null ohne Vergleich. */
export function trendVsPreviousYear(
  daily: readonly DailyPoint[],
  from: ISODate,
  to: ISODate,
): number | null {
  const prevFrom = toISODate(subYears(fromISODate(from), 1));
  const prevTo = toISODate(subYears(fromISODate(to), 1));
  const now = windowStats(daily, from, to);
  const prev = windowStats(daily, prevFrom, prevTo);
  if (now.covered < now.days * MIN_COVERAGE || prev.covered < prev.days * MIN_COVERAGE) return null;
  const prevAvg = prev.kwh / prev.covered;
  if (prevAvg === 0) return null;
  return now.kwh / now.covered / prevAvg - 1;
}

export interface YearCurve {
  year: number;
  points: { day: number; date: ISODate; kwh: number }[];
}

/** Kumulierter Verbrauch je Jahr (x = Tag im Jahr). */
export function cumulativeByYear(daily: readonly DailyPoint[]): YearCurve[] {
  const curves = new Map<number, YearCurve>();
  for (const { date, kwh } of daily) {
    const year = yearOf(date);
    const curve = curves.get(year) ?? { year, points: [] };
    const prev = curve.points.at(-1)?.kwh ?? 0;
    curve.points.push({ day: dayOfYear(date), date, kwh: prev + kwh });
    curves.set(year, curve);
  }
  return [...curves.values()].sort((a, b) => a.year - b.year);
}

export type ReadingState = 'none' | 'ok' | 'due' | 'overdue';

/** Ablesestatus: fällig ab Intervall, überfällig ab dem 1,5-fachen (Default 14 → 21 Tage). */
export function readingStatus(
  lastDate: ISODate | undefined,
  today: ISODate,
  intervalDays: number,
): { state: ReadingState; daysSince: number | null } {
  if (!lastDate) return { state: 'none', daysSince: null };
  const daysSince = daysBetween(lastDate, today);
  if (daysSince >= Math.round(intervalDays * 1.5)) return { state: 'overdue', daysSince };
  if (daysSince >= intervalDays) return { state: 'due', daysSince };
  return { state: 'ok', daysSince };
}
