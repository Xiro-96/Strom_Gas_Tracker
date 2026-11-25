import { useLiveQuery } from 'dexie-react-hooks';
import { hasDemoData } from '@/data/repositories/demo';
import { listMeters } from '@/data/repositories/meters';
import { listReadings } from '@/data/repositories/readings';
import { getSettings } from '@/data/repositories/settings';
import type { Meter, Reading, Settings } from '@/domain/types';

/** Live-Abfragen für Komponenten – `undefined` heißt „lädt noch“. */
export function useMeters(): Meter[] | undefined {
  return useLiveQuery(listMeters, []);
}

export function useReadings(): Reading[] | undefined {
  return useLiveQuery(() => listReadings(), []);
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}

export function useHasDemoData(): boolean | undefined {
  return useLiveQuery(hasDemoData, []);
}
