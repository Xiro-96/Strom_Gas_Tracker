import { db } from '@/data/db';
import { isActive, nowISO, stamp, type NewEntity } from '@/data/entity';
import type { ISODate, Meter, Reading } from '@/domain/types';

export type NewMeter = NewEntity<Meter>;

export async function listMeters(): Promise<Meter[]> {
  const meters = await db.meters.toArray();
  return meters
    .filter(isActive)
    .sort(
      (a, b) =>
        a.energyType.localeCompare(b.energyType) || a.activeFrom.localeCompare(b.activeFrom),
    );
}

export async function getMeter(id: string): Promise<Meter | undefined> {
  const meter = await db.meters.get(id);
  return meter && isActive(meter) ? meter : undefined;
}

export async function createMeter(input: NewMeter): Promise<Meter> {
  const meter = stamp<Meter>(input);
  await db.meters.add(meter);
  return meter;
}

export async function updateMeter(id: string, patch: Partial<NewMeter>): Promise<void> {
  await db.meters.update(id, { ...patch, updatedAt: nowISO() });
}

/** Soft-Delete inkl. aller Ablesungen des Zählers. */
export async function deleteMeter(id: string): Promise<void> {
  const now = nowISO();
  await db.transaction('rw', db.meters, db.readings, async () => {
    await db.meters.update(id, { deletedAt: now, updatedAt: now });
    await db.readings.where('meterId').equals(id).modify({ deletedAt: now, updatedAt: now });
  });
}

export interface ReplaceMeterInput {
  oldMeterId: string;
  date: ISODate;
  oldFinalValue: number;
  newMeter: Pick<Meter, 'name' | 'decimals'> &
    Partial<Pick<Meter, 'meterNumber' | 'maloId' | 'rolloverModulus' | 'gasFactors'>>;
  newStartValue: number;
}

/** Zählerwechsel: Ausbau-Stand am alten, neuer Zähler mit Vorgänger, Einbau-Stand am neuen. */
export async function replaceMeter(input: ReplaceMeterInput): Promise<Meter> {
  return db.transaction('rw', db.meters, db.readings, async () => {
    const old = await db.meters.get(input.oldMeterId);
    if (!old) throw new Error('Der bisherige Zähler wurde nicht gefunden.');
    const now = nowISO();
    await db.meters.update(old.id, { activeTo: input.date, updatedAt: now });
    const created = stamp<Meter>({
      energyType: old.energyType,
      unit: old.unit,
      activeFrom: input.date,
      predecessorId: old.id,
      maloId: input.newMeter.maloId ?? old.maloId,
      gasFactors: input.newMeter.gasFactors ?? old.gasFactors,
      ...input.newMeter,
    });
    await db.meters.add(created);
    await db.readings.bulkAdd([
      stamp<Reading>({
        meterId: old.id,
        date: input.date,
        value: input.oldFinalValue,
        kind: 'meter_removal',
      }),
      stamp<Reading>({
        meterId: created.id,
        date: input.date,
        value: input.newStartValue,
        kind: 'meter_install',
      }),
    ]);
    return created;
  });
}
