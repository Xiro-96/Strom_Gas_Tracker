import type { EntityTable, Table } from 'dexie';
import { db } from '@/data/db';
import { isActive, nowISO, stamp, type NewEntity } from '@/data/entity';
import type { Bill, Bonus, Contract, PricePeriod, Transaction } from '@/domain/types';

export type NewContract = NewEntity<Contract>;

export interface NewContractBundle {
  contract: NewContract;
  price: Omit<NewEntity<PricePeriod>, 'contractId'>;
  bonuses: Omit<NewEntity<Bonus>, 'contractId'>[];
}

const FAR_FUTURE = '9999-12-31';
const label = (c: Pick<Contract, 'provider' | 'tariffName'>) => `${c.provider} (${c.tariffName})`;

/** Verträge einer Energieart dürfen sich zeitlich nicht überschneiden (Spec §5). */
async function assertNoOverlap(
  candidate: Pick<Contract, 'energyType' | 'deliveryStart'> & { deliveryEnd?: string },
  ignoreId?: string,
) {
  const others = (
    await db.contracts.where('energyType').equals(candidate.energyType).toArray()
  ).filter((c) => isActive(c) && c.id !== ignoreId);
  const end = candidate.deliveryEnd ?? FAR_FUTURE;
  const clash = others.find(
    (c) => candidate.deliveryStart <= (c.deliveryEnd ?? FAR_FUTURE) && c.deliveryStart <= end,
  );
  if (clash) {
    throw new Error(
      `Der Lieferzeitraum überschneidet sich mit ${label(clash)}. Bitte Lieferbeginn bzw. -ende anpassen.`,
    );
  }
}

export async function listContracts(): Promise<Contract[]> {
  return (await db.contracts.toArray())
    .filter(isActive)
    .sort((a, b) => a.deliveryStart.localeCompare(b.deliveryStart));
}

export async function getContract(id: string): Promise<Contract | undefined> {
  const contract = await db.contracts.get(id);
  return contract && isActive(contract) ? contract : undefined;
}

/** Vertrag + erste Preisperiode + Boni in einer Transaktion (Vertrags-Assistent). */
export async function createContract(bundle: NewContractBundle): Promise<Contract> {
  return db.transaction('rw', [db.contracts, db.pricePeriods, db.bonuses], async () => {
    await assertNoOverlap(bundle.contract);
    const contract = stamp<Contract>(bundle.contract);
    await db.contracts.add(contract);
    await db.pricePeriods.add(stamp<PricePeriod>({ ...bundle.price, contractId: contract.id }));
    if (bundle.bonuses.length) {
      await db.bonuses.bulkAdd(
        bundle.bonuses.map((b) => stamp<Bonus>({ ...b, contractId: contract.id })),
      );
    }
    return contract;
  });
}

/**
 * Ändert einen Vertrag. Standard: Felder zusammenführen. `replace`: `patch` ist der vollständige
 * neue Inhalt – fehlende optionale Felder (z. B. Lieferende) werden entfernt; id/Zeitstempel bleiben.
 */
export async function updateContract(
  id: string,
  patch: Partial<NewContract>,
  { replace = false }: { replace?: boolean } = {},
): Promise<void> {
  await db.transaction('rw', db.contracts, async () => {
    const current = await db.contracts.get(id);
    if (!current) throw new Error('Vertrag nicht gefunden.');
    const base = {
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      ...(current.isDemo ? { isDemo: true } : {}),
    };
    const next = (replace ? { ...base, ...patch } : { ...current, ...patch }) as Contract;
    await assertNoOverlap(next, id);
    await db.contracts.put({ ...next, updatedAt: nowISO() });
  });
}

const CHILD_TABLES = () =>
  [db.pricePeriods, db.bonuses, db.bills, db.transactions] as Table<{ contractId: string }>[];

export async function deleteContract(id: string): Promise<void> {
  const now = nowISO();
  await db.transaction('rw', [db.contracts, ...CHILD_TABLES()], async () => {
    await db.contracts.update(id, { deletedAt: now, updatedAt: now });
    for (const table of CHILD_TABLES()) {
      await table
        .where('contractId')
        .equals(id)
        .modify({ deletedAt: now, updatedAt: now } as never);
    }
  });
}

/** Gleiches CRUD für alle Vertragsbestandteile (Preise, Boni, Rechnungen, Transaktionen). */
function childRepo<
  T extends {
    id: string;
    contractId: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
  },
>(table: () => EntityTable<T, 'id'>, sortKey: (item: T) => string) {
  return {
    async list(contractIds?: readonly string[]): Promise<T[]> {
      const rows = contractIds
        ? await table()
            .where('contractId')
            .anyOf([...contractIds])
            .toArray()
        : await table().toArray();
      return rows.filter(isActive).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    },
    async add(input: NewEntity<T>): Promise<T> {
      const row = stamp<T>(input);
      await table().add(row);
      return row;
    },
    async update(id: string, patch: Partial<NewEntity<T>>): Promise<void> {
      await table()
        .where('id')
        .equals(id)
        .modify((row) => {
          Object.assign(row, patch, { updatedAt: nowISO() });
        });
    },
    async remove(id: string): Promise<void> {
      const now = nowISO();
      await table()
        .where('id')
        .equals(id)
        .modify((row) => {
          Object.assign(row, { deletedAt: now, updatedAt: now });
        });
    },
  };
}

export const pricePeriods = childRepo<PricePeriod>(
  () => db.pricePeriods,
  (p) => p.validFrom,
);
export const bonuses = childRepo<Bonus>(
  () => db.bonuses,
  (b) => b.createdAt,
);
export const bills = childRepo<Bill>(
  () => db.bills,
  (b) => b.periodTo,
);
export const transactions = childRepo<Transaction>(
  () => db.transactions,
  (t) => t.date,
);
