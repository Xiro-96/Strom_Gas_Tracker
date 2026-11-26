import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import {
  bills,
  bonuses,
  listContracts,
  pricePeriods,
  transactions,
} from '@/data/repositories/contracts';
import { hasDemoData } from '@/data/repositories/demo';
import { listOffers } from '@/data/repositories/offers';
import { listMeters } from '@/data/repositories/meters';
import { firstOwnDataAt, listReadings } from '@/data/repositories/readings';
import { getSettings } from '@/data/repositories/settings';
import { locationKey, loadWeatherSeries } from '@/data/weatherCache';
import type {
  Bill,
  Bonus,
  Contract,
  ISODate,
  Meter,
  Offer,
  PricePeriod,
  Reading,
  Settings,
  Transaction,
} from '@/domain/types';

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

export interface ContractData {
  contracts: Contract[];
  pricePeriods: PricePeriod[];
  bonuses: Bonus[];
  bills: Bill[];
  transactions: Transaction[];
}

/** Alle Verträge samt Preisen, Boni, Rechnungen und Transaktionen – live. */
export function useContractData(): ContractData | undefined {
  return useLiveQuery(async () => {
    const [c, p, b, bi, t] = await Promise.all([
      listContracts(),
      pricePeriods.list(),
      bonuses.list(),
      bills.list(),
      transactions.list(),
    ]);
    return { contracts: c, pricePeriods: p, bonuses: b, bills: bi, transactions: t };
  }, []);
}

export function useOffers(): Offer[] | undefined {
  return useLiveQuery(listOffers, []);
}

/** Für die Backup-Erinnerung: erste eigene Daten und letzte Sicherung. */
export function useBackupStatus(): { firstDataAt?: string; lastBackupAt?: string } | undefined {
  return useLiveQuery(async () => {
    const [firstDataAt, settings] = await Promise.all([firstOwnDataAt(), getSettings()]);
    return {
      ...(firstDataAt ? { firstDataAt } : {}),
      ...(settings.lastBackupAt ? { lastBackupAt: settings.lastBackupAt } : {}),
    };
  }, []);
}

/** Tagesmitteltemperaturen (nur mit Wetter-Opt-in und Ort); `null` = keine Wetterdaten. */
export function useWeatherSeries(): Map<ISODate, number> | null | undefined {
  return useLiveQuery(async () => loadWeatherSeries(await getSettings()), []);
}

/** Stand des Wetter-Caches für die Einstellungen. */
export function useWeatherInfo():
  { from: ISODate; days: number; fetchedAt: string } | null | undefined {
  return useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings.location) return null;
    const cache = await db.weather.get(locationKey(settings.location.lat, settings.location.lon));
    return cache
      ? { from: cache.from, days: cache.temps.length, fetchedAt: cache.fetchedAt }
      : null;
  }, []);
}
