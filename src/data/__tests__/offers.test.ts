import { db } from '@/data/db';
import { addOffer, deleteOffer, listOffers, updateOffer } from '@/data/repositories/offers';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const input = {
  energyType: 'electricity' as const,
  provider: 'Angebot X',
  tariffName: 'Klar 12',
  energyPriceCt: 30,
  basePriceEurPerYear: 120,
  bonuses: [{ kind: 'new_customer' as const, amountEur: 100, requiresDeliveryMonths: 12 }],
  capturedAt: '2026-11-26',
};

describe('Angebote', () => {
  it('legt an, ändert und löscht weich; neueste zuerst', async () => {
    const a = await addOffer(input);
    await addOffer({ ...input, provider: 'Angebot Y', capturedAt: '2026-11-27' });
    expect((await listOffers()).map((o) => o.provider)).toEqual(['Angebot Y', 'Angebot X']);
    await updateOffer(a.id, { energyPriceCt: 29 });
    expect((await listOffers()).find((o) => o.id === a.id)?.energyPriceCt).toBe(29);
    await deleteOffer(a.id);
    expect((await listOffers()).map((o) => o.provider)).toEqual(['Angebot Y']);
    expect(await db.offers.count()).toBe(2);
  });
});
