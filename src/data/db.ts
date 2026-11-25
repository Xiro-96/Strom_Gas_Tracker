import Dexie, { type EntityTable } from 'dexie';
import type {
  Bill,
  Bonus,
  Contract,
  Meter,
  Offer,
  Photo,
  PricePeriod,
  Reading,
  Settings,
  Transaction,
} from '@/domain/types';

/**
 * Lokale Datenbank (IndexedDB über Dexie). Nur Repositories in `src/data` greifen darauf zu –
 * so kann später ein Sync-Adapter folgen, ohne die UI umzubauen.
 *
 * Migrationen: Schemaänderungen immer als neue Version anhängen, nie bestehende ändern, z. B.
 *   this.version(2).stores({ readings: 'id, meterId, date, [meterId+date], kind' })
 *     .upgrade((tx) => tx.table('readings').toCollection().modify((r) => { … }));
 */
export class TrackerDB extends Dexie {
  meters!: EntityTable<Meter, 'id'>;
  readings!: EntityTable<Reading, 'id'>;
  contracts!: EntityTable<Contract, 'id'>;
  pricePeriods!: EntityTable<PricePeriod, 'id'>;
  bonuses!: EntityTable<Bonus, 'id'>;
  bills!: EntityTable<Bill, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  offers!: EntityTable<Offer, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'strom-gas-tracker') {
    super(name);
    this.version(1).stores({
      meters: 'id, energyType',
      readings: 'id, meterId, date, [meterId+date]',
      contracts: 'id, meterId, energyType, deliveryStart',
      pricePeriods: 'id, contractId, validFrom',
      bonuses: 'id, contractId, status',
      bills: 'id, contractId',
      transactions: 'id, contractId, date',
      offers: 'id, energyType',
      photos: 'id',
      settings: 'id',
    });
  }
}

export const db = new TrackerDB();

/** Alle Tabellen mit Fachdaten (für Demo-Entfernen, Backup …). */
export const DATA_TABLES = [
  'meters',
  'readings',
  'contracts',
  'pricePeriods',
  'bonuses',
  'bills',
  'transactions',
  'offers',
] as const;
