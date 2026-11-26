import { db } from '@/data/db';
import { isActive, nowISO, stamp, type NewEntity } from '@/data/entity';
import type { Offer } from '@/domain/types';

export type NewOffer = NewEntity<Offer>;

/** Angebote, neueste zuerst. */
export async function listOffers(): Promise<Offer[]> {
  return (await db.offers.toArray())
    .filter(isActive)
    .sort(
      (a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.createdAt.localeCompare(a.createdAt),
    );
}

export async function addOffer(input: NewOffer): Promise<Offer> {
  const offer = stamp<Offer>(input);
  await db.offers.add(offer);
  return offer;
}

export async function updateOffer(id: string, patch: Partial<NewOffer>): Promise<void> {
  await db.offers.update(id, { ...patch, updatedAt: nowISO() });
}

export async function deleteOffer(id: string): Promise<void> {
  const now = nowISO();
  await db.offers.update(id, { deletedAt: now, updatedAt: now });
}
