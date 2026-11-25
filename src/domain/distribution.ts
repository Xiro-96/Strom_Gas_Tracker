import { daysInMonth, daysInYear, eachDay, yearOf } from '@/domain/dates';
import type { Interval } from '@/domain/intervals';
import type { EnergyType, ISODate } from '@/domain/types';

/**
 * Gradtagzahlen-Promille je Monat (Spec 6.2, Fallback ohne Wetterdaten). Juni–August zusammen
 * 40 ‰, gleichmäßig auf 92 Tage verteilt. Σ = 1000.
 */
export const HEATING_PERMILLE: Readonly<Record<number, number>> = {
  1: 170,
  2: 150,
  3: 130,
  4: 80,
  5: 40,
  9: 30,
  10: 80,
  11: 120,
  12: 160,
};
const SUMMER_PERMILLE = 40;
const SUMMER_DAYS = 92;

export function heatingShare(date: ISODate): number {
  const month = Number(date.slice(5, 7));
  if (month >= 6 && month <= 8) return SUMMER_PERMILLE / (1000 * SUMMER_DAYS);
  return (HEATING_PERMILLE[month] ?? 0) / (1000 * daysInMonth(date));
}

/** anteil(d): Strom 1; Gas b ÷ Tage_im_Jahr + (1 − b) × Heizanteil(d). */
export function dayWeight(date: ISODate, energyType: EnergyType, baseLoadShare: number): number {
  if (energyType === 'electricity') return 1;
  return baseLoadShare / daysInYear(yearOf(date)) + (1 - baseLoadShare) * heatingShare(date);
}

/** Σ anteil(d) über [from, to). */
export function sumWeights(
  from: ISODate,
  to: ISODate,
  energyType: EnergyType,
  baseLoadShare: number,
): number {
  return eachDay(from, to).reduce((sum, d) => sum + dayWeight(d, energyType, baseLoadShare), 0);
}

export interface DailyPoint {
  date: ISODate;
  kwh: number;
}

export interface DistributionOptions {
  energyType: EnergyType;
  baseLoadShare: number;
  /** Optional eigene Gewichtung (z. B. Wetterdaten in Phase 4). */
  weight?: (date: ISODate) => number;
}

/**
 * kWh(d) = Δ_kWh × anteil(d) ÷ Σ anteil(Intervall). Tage ohne Intervall bleiben Lücken
 * (sie fehlen im Ergebnis) – nie stillschweigend 0.
 */
export function distribute(
  intervals: readonly Interval[],
  options: DistributionOptions,
): DailyPoint[] {
  const weightOf =
    options.weight ?? ((d: ISODate) => dayWeight(d, options.energyType, options.baseLoadShare));
  const byDay = new Map<ISODate, number>();
  for (const interval of intervals) {
    const days = eachDay(interval.from, interval.to);
    const weights = days.map(weightOf);
    const total = weights.reduce((a, b) => a + b, 0);
    days.forEach((day, i) => {
      const share = total > 0 ? (weights[i] ?? 0) / total : 1 / days.length;
      byDay.set(day, (byDay.get(day) ?? 0) + interval.kwh * share);
    });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kwh]) => ({ date, kwh }));
}
