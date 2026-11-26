import { useLiveQuery } from 'dexie-react-hooks';
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
import { listReadings } from '@/data/repositories/readings';
import { getSettings } from '@/data/repositories/settings';
import type {
  Bill,
  Bonus,
  Contract,
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
