import { DATA_TABLES, db } from '@/data/db';
import { generateDemoData } from '@/data/demo/generate';
import { isActive } from '@/data/entity';
import { todayISO } from '@/domain/dates';
import type { ISODate } from '@/domain/types';

export async function hasDemoData(): Promise<boolean> {
  return (await db.meters.filter((m) => m.isDemo === true).count()) > 0;
}

/** Lädt erfundene Demo-Daten – nur, solange keine eigenen Zähler existieren. */
export async function loadDemoData(today: ISODate = todayISO()): Promise<void> {
  const own = await db.meters.filter((m) => isActive(m) && !m.isDemo).count();
  if (own > 0) {
    throw new Error(
      'Es gibt schon eigene Zähler. Demo-Daten werden nicht mit echten Daten gemischt.',
    );
  }
  await removeDemoData();
  const demo = generateDemoData(today);
  await db.transaction(
    'rw',
    [db.meters, db.readings, db.contracts, db.pricePeriods, db.bonuses],
    async () => {
      await db.meters.bulkAdd(demo.meters);
      await db.readings.bulkAdd(demo.readings);
      await db.contracts.bulkAdd(demo.contracts);
      await db.pricePeriods.bulkAdd(demo.pricePeriods);
      await db.bonuses.bulkAdd(demo.bonuses);
    },
  );
}

/** Entfernt alle Demo-Datensätze endgültig (ein Klick). */
export async function removeDemoData(): Promise<void> {
  const tables = DATA_TABLES.map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.filter((e: { isDemo?: boolean }) => e.isDemo === true).delete();
    }
  });
}
