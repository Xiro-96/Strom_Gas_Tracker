import { addDays, daysBetween, daysInYear, eachDay, yearOf } from '@/domain/dates';
import { dayWeight, type DailyPoint } from '@/domain/distribution';
import type { Interval } from '@/domain/intervals';
import type { EnergyType, ISODate } from '@/domain/types';

export interface AnnualForecast {
  /** Prognose-Jahresverbrauch in kWh. */
  kwh: number;
  /** last365: Verbrauch der letzten 365 Tage · avg90: Ø 90 Tage × 365 · normalYear: Gas, gradtagbereinigt */
  method: 'last365' | 'avg90' | 'normalYear';
  /** Datenbasis (abgedeckte Tage im Fenster). */
  basis: { from: ISODate; to: ISODate; days: number };
  uncertain: boolean;
  /** Spanne bei unsicherer Prognose. */
  range?: [number, number];
}

interface ForecastOptions {
  energyType: EnergyType;
  baseLoadShare: number;
  weight?: (date: ISODate) => number;
}

const YEAR = 365;
const MIN_INTERVALS = 3;
const UNCERTAINTY = 0.2;

/**
 * Spec 6.4 – Jahresprognose.
 * Strom: mit ≥ 365 Tagen Daten der Verbrauch der letzten 365 Tage, sonst Ø der letzten 90 Tage × 365
 * (unsicher). Gas: Normaljahr = beobachteter Verbrauch ÷ Σ anteil(beobachtete Tage), Basis höchstens
 * die letzten 365 Tage. Weniger als 3 Intervalle → unsicher, mit Spanne.
 */
export function forecastAnnual(
  daily: readonly DailyPoint[],
  intervals: readonly Interval[],
  options: ForecastOptions,
): AnnualForecast | null {
  const last = daily.at(-1);
  const first = daily[0];
  if (!last || !first) return null;
  const to = addDays(last.date, 1);
  const windowFrom = addDays(to, -YEAR);
  const basisPoints = daily.filter((p) => p.date >= windowFrom);
  const basisFrom = basisPoints[0]?.date ?? windowFrom;
  const observed = basisPoints.reduce((sum, p) => sum + p.kwh, 0);
  const intervalCount = intervals.filter((i) => i.to > windowFrom).length;

  let kwh: number;
  let method: AnnualForecast['method'];
  let uncertain = intervalCount < MIN_INTERVALS;
  let basis = { from: basisFrom, to, days: basisPoints.length };

  if (options.energyType === 'gas') {
    const weightOf = options.weight ?? ((d: ISODate) => dayWeight(d, 'gas', options.baseLoadShare));
    const share = basisPoints.reduce((sum, p) => sum + weightOf(p.date), 0);
    if (share <= 0) return null;
    kwh = observed / share;
    method = 'normalYear';
  } else if (daysBetween(first.date, to) >= YEAR && basisPoints.length >= YEAR * 0.9) {
    kwh = (observed / basisPoints.length) * YEAR;
    method = 'last365';
  } else {
    const from90 = addDays(to, -90);
    const recent = daily.filter((p) => p.date >= from90);
    kwh = (recent.reduce((sum, p) => sum + p.kwh, 0) / recent.length) * YEAR;
    method = 'avg90';
    uncertain = true;
    basis = { from: recent[0]?.date ?? from90, to, days: recent.length };
  }

  return {
    kwh,
    method,
    basis,
    uncertain,
    ...(uncertain
      ? { range: [kwh * (1 - UNCERTAINTY), kwh * (1 + UNCERTAINTY)] as [number, number] }
      : {}),
  };
}

/**
 * Prognostizierte Tageswerte für einen Zeitraum ohne Ablesungen (Restjahr, Spec 6.4):
 * Gas: Jahresverbrauch × anteil(d) · Strom: Jahresverbrauch ÷ Tage im Jahr.
 */
export function projectedDaily(
  annualKwh: number,
  from: ISODate,
  to: ISODate,
  options: ForecastOptions,
): DailyPoint[] {
  return eachDay(from, to).map((date) => ({
    date,
    kwh:
      options.energyType === 'gas'
        ? annualKwh *
          (options.weight ?? ((d: ISODate) => dayWeight(d, 'gas', options.baseLoadShare)))(date)
        : annualKwh / daysInYear(yearOf(date)),
  }));
}
