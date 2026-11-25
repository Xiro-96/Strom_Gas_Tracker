import type { GasFactorEntry, ISODate } from '@/domain/types';

export interface GasFactors {
  zFactor: number;
  calorificValue: number;
}

/** Platzhalter für neue Zähler – „Werte aus deiner Gasrechnung übernehmen“ (Spec 4.2). */
export const DEFAULT_GAS_FACTORS: GasFactors = { zFactor: 0.95, calorificValue: 11 };

/** kWh = m³ × Zustandszahl × Brennwert */
export function m3ToKwh(m3: number, zFactor: number, calorificValue: number): number {
  return m3 * zFactor * calorificValue;
}

/** ct/kWh = (€/m³ × 100) ÷ (z × Hs) */
export function eurPerM3ToCtPerKwh(
  eurPerM3: number,
  zFactor: number,
  calorificValue: number,
): number {
  return (eurPerM3 * 100) / (zFactor * calorificValue);
}

export function ctPerKwhToEurPerM3(
  ctPerKwh: number,
  zFactor: number,
  calorificValue: number,
): number {
  return (ctPerKwh * zFactor * calorificValue) / 100;
}

/** Faktoren, die am Datum gelten (zuletzt „gültig ab“ ≤ Datum; davor die frühesten). */
export function gasFactorsAt(meter: { gasFactors?: GasFactorEntry[] }, date: ISODate): GasFactors {
  const entries = [...(meter.gasFactors ?? [])].sort((a, b) =>
    a.validFrom.localeCompare(b.validFrom),
  );
  const first = entries[0];
  if (!first) return DEFAULT_GAS_FACTORS;
  const valid = entries.filter((e) => e.validFrom <= date).at(-1) ?? first;
  return { zFactor: valid.zFactor, calorificValue: valid.calorificValue };
}

/** Neue Faktoren „gültig ab“ einfügen; gleiches Datum = Korrektur des vorhandenen Eintrags. */
export function upsertGasFactors(
  history: readonly GasFactorEntry[],
  entry: GasFactorEntry,
): GasFactorEntry[] {
  return [...history.filter((e) => e.validFrom !== entry.validFrom), entry].sort((a, b) =>
    a.validFrom.localeCompare(b.validFrom),
  );
}
