import { addYears } from 'date-fns';
import { cumulativeByYear, monthlyTotals, type YearCurve } from '@/domain/consumption';
import { addDays, fromISODate, maxDate, minDate, toISODate } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import type { Interval } from '@/domain/intervals';
import type { ISODate } from '@/domain/types';

export type ChartRange = '3m' | '12m' | 'year' | 'contract' | 'all';
export interface Bounds {
  from: ISODate;
  to: ISODate;
}

const shiftYears = (date: ISODate, years: number) => toISODate(addYears(fromISODate(date), years));

/**
 * Zeitraum [from, to) relativ zum letzten Datentag. „Vertrag“ = Abrechnungszeitraum des laufenden
 * Vertrags (letzter Tag inklusive); ohne Vertrag wie „12 Monate“.
 */
export function rangeBounds(
  range: ChartRange,
  lastDay: ISODate,
  contractPeriod?: { from: ISODate; to: ISODate },
): Bounds {
  const to = addDays(lastDay, 1);
  switch (range) {
    case 'contract':
      return contractPeriod
        ? { from: contractPeriod.from, to: addDays(contractPeriod.to, 1) }
        : rangeBounds('12m', lastDay);
    case '3m':
      return { from: addMonthsISO(to, -3), to };
    case '12m':
      return { from: shiftYears(to, -1), to };
    case 'year':
      return {
        from: `${lastDay.slice(0, 4)}-01-01`,
        to: `${Number(lastDay.slice(0, 4)) + 1}-01-01`,
      };
    case 'all':
      return { from: '0000-01-01', to };
  }
}

function addMonthsISO(date: ISODate, months: number): ISODate {
  const d = fromISODate(date);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

export interface StepPoint {
  date: ISODate;
  /** kWh/Tag; null unterbricht die Linie (Lücke ohne Ablesung). */
  perDay: number | null;
}

/**
 * Diagramm 1: Ø kWh/Tag je Ableseintervall als Stufen (stepAfter) auf echter Zeitachse.
 * `shiftYears = 1` legt das Vorjahr deckungsgleich darüber.
 */
export function stepSeries(
  intervals: readonly Interval[],
  bounds: Bounds,
  yearsShift = 0,
): StepPoint[] {
  const points: StepPoint[] = [];
  let lastTo: ISODate | null = null;
  for (const interval of intervals) {
    const from = yearsShift ? shiftYears(interval.from, yearsShift) : interval.from;
    const to = yearsShift ? shiftYears(interval.to, yearsShift) : interval.to;
    if (to <= bounds.from || from >= bounds.to) continue;
    const start = maxDate(from, bounds.from);
    const end = minDate(to, bounds.to);
    if (lastTo !== null && start !== lastTo) points.push({ date: lastTo, perDay: null }); // Lücke
    if (lastTo !== null && start === lastTo) points.pop(); // nahtlos: neuer Start ersetzt den Schlusspunkt
    points.push({ date: start, perDay: interval.perDay }, { date: end, perDay: interval.perDay });
    lastTo = end;
  }
  return points;
}

export interface MonthComparison {
  month: string;
  kwh: number;
  complete: boolean;
  coveredDays: number;
  previousKwh: number | null;
  previousComplete: boolean;
}

/** Diagramm 2: Monatsverbrauch mit Vorjahresmonat als „Geister-Balken“. */
export function monthlyComparison(daily: readonly DailyPoint[], bounds: Bounds): MonthComparison[] {
  const months = monthlyTotals(daily);
  const byMonth = new Map(months.map((m) => [m.month, m]));
  return months
    .filter((m) => m.month >= bounds.from.slice(0, 7) && `${m.month}-01` < bounds.to)
    .map((m) => {
      const prevKey = `${Number(m.month.slice(0, 4)) - 1}${m.month.slice(4)}`;
      const prev = byMonth.get(prevKey);
      return {
        month: m.month,
        kwh: m.kwh,
        complete: m.coveredDays === m.daysInMonth,
        coveredDays: m.coveredDays,
        previousKwh: prev ? prev.kwh : null,
        previousComplete: prev ? prev.coveredDays === prev.daysInMonth : false,
      };
    });
}

/** Diagramm 3: kumulierter Verbrauch je Jahr (x = Tag im Jahr), die letzten `maxYears` Jahre. */
export function cumulativeYears(daily: readonly DailyPoint[], maxYears = 3): YearCurve[] {
  return cumulativeByYear(daily).slice(-maxYears);
}
