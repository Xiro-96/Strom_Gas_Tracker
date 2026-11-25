import { useMemo } from 'react';
import { useMeters, useReadings, useSettings } from '@/data/hooks';
import { analyzeEnergy, type EnergyAnalysis } from '@/domain/analysis';
import type { EnergyType, Meter, Reading, Settings } from '@/domain/types';
import { ENERGY_TYPES } from '@/features/shared/energy';

export type EnergyData =
  | { status: 'loading' }
  | {
      status: 'ready';
      meters: Meter[];
      readings: Reading[];
      settings: Settings;
      /** Energiearten mit mindestens einem Zähler. */
      energies: EnergyType[];
      analyses: Partial<Record<EnergyType, EnergyAnalysis>>;
    };

/** Live-Daten + memoisierte Auswertung je Energieart (Intervalle, Tagesreihe). */
export function useEnergyData(): EnergyData {
  const meters = useMeters();
  const readings = useReadings();
  const settings = useSettings();
  return useMemo<EnergyData>(() => {
    if (!meters || !readings || !settings) return { status: 'loading' };
    const energies = ENERGY_TYPES.filter((e) => meters.some((m) => m.energyType === e));
    const analyses: Partial<Record<EnergyType, EnergyAnalysis>> = {};
    for (const e of energies)
      analyses[e] = analyzeEnergy(meters, readings, e, settings.gasBaseLoadShare);
    return { status: 'ready', meters, readings, settings, energies, analyses };
  }, [meters, readings, settings]);
}
