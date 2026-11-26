import { useMemo } from 'react';
import { useMeters, useReadings, useSettings, useWeatherSeries } from '@/data/hooks';
import { analyzeEnergy, type EnergyAnalysis } from '@/domain/analysis';
import { todayISO } from '@/domain/dates';
import { normalDegreeDays, weatherWeight } from '@/domain/weather';
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
      /** Tagesmitteltemperaturen, falls Wetter aktiviert und geladen */
      temps: ReadonlyMap<string, number> | null;
    };

/** Live-Daten + memoisierte Auswertung je Energieart (Intervalle, Tagesreihe). */
export function useEnergyData(): EnergyData {
  const meters = useMeters();
  const readings = useReadings();
  const settings = useSettings();
  const temps = useWeatherSeries();
  return useMemo<EnergyData>(() => {
    // Wetter blockiert den ersten Inhalt nicht: ohne (noch) geladene Temperaturen gilt Promille
    if (!meters || !readings || !settings) return { status: 'loading' };
    // Normaljahr = die letzten 10 vollen Jahre (Spec 6.2)
    const thisYear = Number(todayISO().slice(0, 4));
    const normal = temps
      ? normalDegreeDays(
          temps,
          Array.from({ length: 10 }, (_, i) => thisYear - 10 + i),
        )
      : null;
    const gasWeight =
      temps && normal
        ? weatherWeight({ temps, normal, baseLoadShare: settings.gasBaseLoadShare })
        : null;
    const energies = ENERGY_TYPES.filter((e) => meters.some((m) => m.energyType === e));
    const analyses: Partial<Record<EnergyType, EnergyAnalysis>> = {};
    for (const e of energies)
      analyses[e] = analyzeEnergy(
        meters,
        readings,
        e,
        settings.gasBaseLoadShare,
        e === 'gas' ? (gasWeight ?? undefined) : undefined,
      );
    return { status: 'ready', meters, readings, settings, energies, analyses, temps: temps ?? null };
  }, [meters, readings, settings, temps]);
}
