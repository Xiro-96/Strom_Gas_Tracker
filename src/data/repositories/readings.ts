import { db } from '@/data/db';
import { isActive, nowISO, stamp, type NewEntity } from '@/data/entity';
import { sortReadings } from '@/domain/intervals';
import type { Photo, Reading } from '@/domain/types';

export type NewReading = NewEntity<Reading>;

export async function listReadings(meterIds?: readonly string[]): Promise<Reading[]> {
  const readings = meterIds
    ? await db.readings
        .where('meterId')
        .anyOf([...meterIds])
        .toArray()
    : await db.readings.toArray();
  return sortReadings(readings.filter(isActive));
}

export async function addReading(
  input: NewReading,
  options: { replaceSameDate?: boolean } = {},
): Promise<Reading> {
  const reading = stamp<Reading>(input);
  await db.transaction('rw', db.readings, async () => {
    if (options.replaceSameDate) {
      const now = nowISO();
      await db.readings
        .where('[meterId+date]')
        .equals([input.meterId, input.date])
        .filter(isActive)
        .modify({ deletedAt: now, updatedAt: now });
    }
    await db.readings.add(reading);
  });
  return reading;
}

export async function updateReading(id: string, patch: Partial<NewReading>): Promise<void> {
  await db.readings.update(id, { ...patch, updatedAt: nowISO() });
}

export async function deleteReading(id: string): Promise<void> {
  const now = nowISO();
  await db.readings.update(id, { deletedAt: now, updatedAt: now });
}

export async function restoreReading(id: string): Promise<void> {
  await db.readings.update(id, { deletedAt: undefined, updatedAt: nowISO() });
}

export async function savePhoto(blob: Blob): Promise<string> {
  const photo = stamp<Photo>({ blob, takenAt: nowISO() });
  await db.photos.add(photo);
  return photo.id;
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return db.photos.get(id);
}

/** Zeitpunkt der ersten eigenen (nicht Demo-)Ablesung – Start der Backup-Erinnerung. */
export async function firstOwnDataAt(): Promise<string | undefined> {
  const own = (await db.readings.toArray()).filter((r) => isActive(r) && !r.isDemo);
  return own.reduce<string | undefined>(
    (min, r) => (!min || r.createdAt < min ? r.createdAt : min),
    undefined,
  );
}
