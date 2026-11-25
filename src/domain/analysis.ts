import { distribute, type DailyPoint } from '@/domain/distribution';
import {
  buildIntervals,
  sortReadings,
  type Interval,
  type IntervalError,
} from '@/domain/intervals';
import type { EnergyType, Meter, Reading } from '@/domain/types';

export interface EnergyAnalysis {
  energyType: EnergyType;
  meters: Meter[];
  /** Zähler, an dem heute abgelesen wird. */
  currentMeter?: Meter;
  readings: Reading[];
  lastReading?: Reading;
  intervals: Interval[];
  errors: IntervalError[];
  daily: DailyPoint[];
}

/** Bündelt Intervalle und Tagesverteilung einer Energieart über alle Zähler der Kette. */
export function analyzeEnergy(
  allMeters: readonly Meter[],
  allReadings: readonly Reading[],
  energyType: EnergyType,
  baseLoadShare: number,
): EnergyAnalysis {
  const meters = allMeters
    .filter((m) => m.energyType === energyType)
    .sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
  const ids = new Set(meters.map((m) => m.id));
  const readings = sortReadings(allReadings.filter((r) => ids.has(r.meterId)));
  const currentMeter = meters.filter((m) => !m.activeTo).at(-1) ?? meters.at(-1);
  const lastReading =
    readings.filter((r) => r.meterId === currentMeter?.id).at(-1) ?? readings.at(-1);
  const { intervals, errors } = buildIntervals(readings, meters);
  const daily = distribute(intervals, { energyType, baseLoadShare });
  return { energyType, meters, currentMeter, readings, lastReading, intervals, errors, daily };
}
