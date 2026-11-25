import { daysBetween } from '@/domain/dates';
import { gasFactorsAt } from '@/domain/gas';
import type { EnergyType, GasFactorEntry, ISODate, ReadingKind } from '@/domain/types';

export interface IntervalReading {
  id?: string;
  meterId: string;
  date: ISODate;
  value: number;
  kind: ReadingKind;
}

export interface IntervalMeter {
  id: string;
  energyType: EnergyType;
  rolloverModulus?: number;
  predecessorId?: string;
  gasFactors?: GasFactorEntry[];
}

/** Verbrauch zwischen zwei Ablesungen desselben Zählers, Tage [from, to). */
export interface Interval {
  meterId: string;
  from: ISODate;
  to: ISODate;
  days: number;
  startValue: number;
  endValue: number;
  /** Differenz in der Zählereinheit (kWh bzw. m³). */
  delta: number;
  /** Energie in kWh (Gas umgerechnet). */
  kwh: number;
  /** kWh je Tag. */
  perDay: number;
  rollover: boolean;
  fromReadingId?: string;
  toReadingId?: string;
}

export interface IntervalError {
  meterId: string;
  from: ISODate;
  to: ISODate;
  startValue: number;
  endValue: number;
  reason: 'negative';
}

/** Am selben Tag: Ausbau des alten vor Einbau des neuen Zählers. */
const KIND_ORDER: Record<ReadingKind, number> = {
  meter_removal: 0,
  regular: 1,
  switch: 1,
  from_bill: 1,
  estimated: 1,
  meter_install: 2,
};

export function sortReadings<T extends IntervalReading>(readings: readonly T[]): T[] {
  return [...readings].sort(
    (a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}

/** Δ zwischen zwei Ständen; Überlauf nur, wenn der Zähler einen Modulus hat und das Ergebnis plausibel ist. */
export function readingDelta(
  start: number,
  end: number,
  rolloverModulus?: number,
): { delta: number; rollover: boolean } | null {
  const delta = end - start;
  if (delta >= 0) return { delta, rollover: false };
  if (rolloverModulus && end + rolloverModulus - start < rolloverModulus / 2) {
    return { delta: end + rolloverModulus - start, rollover: true };
  }
  return null;
}

/**
 * Spec 6.2: Ablesungen je Zählerkette sortieren; aufeinanderfolgende Ablesungen desselben
 * Zählers bilden Intervalle. Beim Zählerwechsel endet das alte Intervall mit `meter_removal`,
 * das neue beginnt mit `meter_install` – die Auswertung läuft ohne Sprung weiter.
 */
export function buildIntervals(
  readings: readonly IntervalReading[],
  meters: readonly IntervalMeter[],
): { intervals: Interval[]; errors: IntervalError[] } {
  const meterById = new Map(meters.map((m) => [m.id, m]));
  const lastByMeter = new Map<string, IntervalReading>();
  const intervals: Interval[] = [];
  const errors: IntervalError[] = [];

  for (const reading of sortReadings(readings)) {
    const meter = meterById.get(reading.meterId);
    if (!meter) continue;
    const prev = lastByMeter.get(reading.meterId);
    lastByMeter.set(reading.meterId, reading);
    if (!prev) continue;
    const days = daysBetween(prev.date, reading.date);
    if (days <= 0) continue;

    const result = readingDelta(prev.value, reading.value, meter.rolloverModulus);
    if (!result) {
      errors.push({
        meterId: meter.id,
        from: prev.date,
        to: reading.date,
        startValue: prev.value,
        endValue: reading.value,
        reason: 'negative',
      });
      lastByMeter.set(reading.meterId, prev);
      continue;
    }

    let kwh = result.delta;
    if (meter.energyType === 'gas') {
      const { zFactor, calorificValue } = gasFactorsAt(meter, prev.date);
      kwh = result.delta * zFactor * calorificValue;
    }
    intervals.push({
      meterId: meter.id,
      from: prev.date,
      to: reading.date,
      days,
      startValue: prev.value,
      endValue: reading.value,
      delta: result.delta,
      kwh,
      perDay: kwh / days,
      rollover: result.rollover,
      fromReadingId: prev.id,
      toReadingId: reading.id,
    });
  }
  return { intervals, errors };
}
