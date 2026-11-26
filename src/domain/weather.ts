import { addYears } from 'date-fns';
import { daysInYear, eachDay, fromISODate, toISODate, yearOf } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import type { Interval } from '@/domain/intervals';
import type { ISODate } from '@/domain/types';

/** Tagesmitteltemperaturen (°C) je Datum. */
export type TempSeries = ReadonlyMap<ISODate, number>;

/** Spec 6.2 – Gradtagzahl G20/15: Tagesmittel < 15 °C → 20 − Tagesmittel, sonst 0. */
export function degreeDay(meanTemp: number): number {
  return meanTemp < 15 ? 20 - meanTemp : 0;
}

/** Normaljahr: mittlere Gradtagzahl je Kalendertag („MM-TT“) über die Referenzjahre. */
export function normalDegreeDays(temps: TempSeries, years: readonly number[]): Map<string, number> {
  const wanted = new Set(years);
  const sums = new Map<string, { sum: number; n: number }>();
  for (const [date, t] of temps) {
    if (!wanted.has(yearOf(date))) continue;
    const key = date.slice(5);
    const entry = sums.get(key) ?? { sum: 0, n: 0 };
    entry.sum += degreeDay(t);
    entry.n += 1;
    sums.set(key, entry);
  }
  const normal = new Map<string, number>();
  for (const [key, { sum, n }] of sums) normal.set(key, sum / n);
  return normal;
}

/** Σ Gradtage eines Normaljahres (365 Tage, ohne 29.02.). */
export function normalYearTotal(normal: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const [key, g] of normal) if (key !== '02-29') total += g;
  return total;
}

const normalAt = (normal: ReadonlyMap<string, number>, date: ISODate) =>
  normal.get(date.slice(5)) ?? normal.get('02-28') ?? 0;

/**
 * Spec 6.2 mit Wetter: anteil(d) = b ÷ Tage_im_Jahr + (1 − b) × G(d) ÷ G_Normaljahr.
 * G(d) gemessen, wo vorhanden, sonst aus dem Normaljahr (Zukunft, Lücken). `null`, wenn das
 * Normaljahr keine Heizgradtage hat (dann gilt die Promille-Methode).
 */
export function weatherWeight(input: {
  temps: TempSeries;
  normal: ReadonlyMap<string, number>;
  baseLoadShare: number;
}): ((date: ISODate) => number) | null {
  const total = normalYearTotal(input.normal);
  if (!(total > 0)) return null;
  const b = input.baseLoadShare;
  return (date) => {
    const t = input.temps.get(date);
    const g = t === undefined ? normalAt(input.normal, date) : degreeDay(t);
    return b / daysInYear(yearOf(date)) + ((1 - b) * g) / total;
  };
}

const shiftYear = (d: ISODate, years: number) => toISODate(addYears(fromISODate(d), years));

/**
 * „Hast du mehr geheizt oder war es nur kälter?“ – Verbrauch [from, to) gegen das Vorjahr,
 * roh und witterungsbereinigt (je Gewichtseinheit). `null` ohne vollständige Daten.
 */
export function adjustedTrend(
  daily: readonly DailyPoint[],
  from: ISODate,
  to: ISODate,
  weight: (date: ISODate) => number,
): { raw: number; adjusted: number } | null {
  const byDay = new Map(daily.map((p) => [p.date, p.kwh]));
  const window = eachDay(from, to);
  const sumOver = (days: ISODate[]) => {
    let kwh = 0;
    let w = 0;
    for (const d of days) {
      const v = byDay.get(d);
      if (v === undefined) return null;
      kwh += v;
      w += weight(d);
    }
    return { kwh, w };
  };
  const now = sumOver(window);
  const prev = sumOver(eachDay(shiftYear(from, -1), shiftYear(to, -1)));
  if (!now || !prev || prev.kwh <= 0 || now.w <= 0 || prev.w <= 0) return null;
  return { raw: now.kwh / prev.kwh - 1, adjusted: now.kwh / now.w / (prev.kwh / prev.w) - 1 };
}

export interface ScatterPoint {
  from: ISODate;
  to: ISODate;
  meanTemp: number;
  perDay: number;
}

/** Diagramm 8: kWh/Tag gegen Ø-Außentemperatur je Intervall (≥ 80 % Tage mit Temperatur) + Gerade. */
export function temperatureScatter(
  intervals: readonly Interval[],
  temps: TempSeries,
): {
  points: ScatterPoint[];
  regression: { slope: number; intercept: number; r2: number } | null;
} {
  const points: ScatterPoint[] = [];
  for (const iv of intervals) {
    const days = eachDay(iv.from, iv.to);
    const values = days.map((d) => temps.get(d)).filter((t): t is number => t !== undefined);
    if (days.length === 0 || values.length < 0.8 * days.length) continue;
    points.push({
      from: iv.from,
      to: iv.to,
      meanTemp: values.reduce((a, b) => a + b, 0) / values.length,
      perDay: iv.perDay,
    });
  }
  if (points.length < 3) return { points, regression: null };
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.meanTemp, 0) / n;
  const my = points.reduce((s, p) => s + p.perDay, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.meanTemp - mx) ** 2;
    sxy += (p.meanTemp - mx) * (p.perDay - my);
    syy += (p.perDay - my) ** 2;
  }
  if (sxx === 0) return { points, regression: null };
  const slope = sxy / sxx;
  return {
    points,
    regression: {
      slope,
      intercept: my - slope * mx,
      r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy),
    },
  };
}
