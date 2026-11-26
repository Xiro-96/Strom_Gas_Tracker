import { db } from '@/data/db';
import {
  bills,
  bonuses,
  createContract,
  deleteContract,
  listContracts,
  pricePeriods,
  setSwitchStep,
  transactions,
  updateContract,
  type NewContractBundle,
} from '@/data/repositories/contracts';
import { createMeter } from '@/data/repositories/meters';

let meterId = '';
beforeEach(async () => {
  await db.delete();
  await db.open();
  meterId = (
    await createMeter({
      energyType: 'electricity',
      name: 'Strom',
      unit: 'kWh',
      decimals: 1,
      activeFrom: '2025-01-01',
    })
  ).id;
});

const bundle = (deliveryStart: string, deliveryEnd?: string): NewContractBundle => ({
  contract: {
    energyType: 'electricity',
    meterId,
    provider: 'Beispielwerk',
    tariffName: 'Klar 12',
    deliveryStart,
    ...(deliveryEnd ? { deliveryEnd } : {}),
    termStartsAt: 'delivery',
    noticePeriod: { value: 1, unit: 'months' },
    renewal: { type: 'monthly' },
    installmentPlan: [{ validFrom: deliveryStart, amountEur: 90, dayOfMonth: 15 }],
    status: 'active',
  },
  price: { validFrom: deliveryStart, energyPriceCt: 30, basePriceEurPerYear: 150 },
  bonuses: [
    {
      kind: 'new_customer',
      amountEur: 100,
      condition: 'nach 12 Monaten',
      settlement: 'offset_in_bill',
      status: 'promised',
      requiresDeliveryMonths: 12,
    },
  ],
});

describe('Verträge', () => {
  it('legt Vertrag, erste Preisperiode und Boni in einem Schritt an', async () => {
    const contract = await createContract(bundle('2026-01-01', '2026-12-31'));
    expect(await listContracts()).toHaveLength(1);
    expect((await pricePeriods.list([contract.id]))[0]).toMatchObject({
      energyPriceCt: 30,
      contractId: contract.id,
    });
    expect((await bonuses.list([contract.id]))[0]).toMatchObject({ amountEur: 100 });
  });

  it('lehnt überlappende Verträge derselben Energieart ab', async () => {
    await createContract(bundle('2026-01-01', '2026-12-31'));
    await expect(createContract(bundle('2026-12-01'))).rejects.toThrow(/überschneidet/);
    await expect(createContract(bundle('2027-01-01'))).resolves.toBeDefined();
  });

  it('prüft Überlappung auch beim Bearbeiten (ohne sich selbst)', async () => {
    const a = await createContract(bundle('2026-01-01', '2026-12-31'));
    const b = await createContract(bundle('2027-01-01'));
    await expect(
      updateContract(a.id, { deliveryEnd: '2026-12-31', notes: 'ok' }),
    ).resolves.toBeUndefined();
    await expect(updateContract(b.id, { deliveryStart: '2026-12-15' })).rejects.toThrow(
      /überschneidet/,
    );
  });

  it('ersetzt beim Bearbeiten optionale Felder (z. B. Lieferende entfernen)', async () => {
    const c = await createContract(bundle('2026-01-01', '2026-12-31'));
    const { id: _id, createdAt: _c, updatedAt: _u, deliveryEnd: _end, ...rest } = c;
    await updateContract(c.id, { ...rest, tariffName: 'Klar 24' }, { replace: true });
    const [saved] = await listContracts();
    expect(saved).toMatchObject({ id: c.id, createdAt: c.createdAt, tariffName: 'Klar 24' });
    expect(saved?.deliveryEnd).toBeUndefined();
  });

  it('löscht weich inklusive Preisen, Boni, Rechnungen und Transaktionen', async () => {
    const c = await createContract(bundle('2026-01-01'));
    await bills.add({
      contractId: c.id,
      kind: 'final',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
    });
    await transactions.add({
      contractId: c.id,
      date: '2026-02-01',
      amountEur: -160,
      kind: 'bonus_payout',
    });
    await deleteContract(c.id);
    expect(await listContracts()).toEqual([]);
    expect(await pricePeriods.list([c.id])).toEqual([]);
    expect(await bonuses.list([c.id])).toEqual([]);
    expect(await bills.list([c.id])).toEqual([]);
    expect(await transactions.list([c.id])).toEqual([]);
  });

  it('aktualisiert Bonus-Status und Preisperioden', async () => {
    const c = await createContract(bundle('2026-01-01'));
    const [bonus] = await bonuses.list([c.id]);
    if (!bonus) throw new Error('Bonus fehlt');
    await bonuses.update(bonus.id, {
      status: 'received',
      receivedAt: '2026-02-03',
      receivedAmountEur: 100,
    });
    expect((await bonuses.list([c.id]))[0]).toMatchObject({
      status: 'received',
      receivedAmountEur: 100,
    });
    await pricePeriods.add({
      contractId: c.id,
      validFrom: '2026-07-01',
      energyPriceCt: 33,
      basePriceEurPerYear: 150,
      changeNoticeReceivedAt: '2026-05-20',
    });
    expect((await pricePeriods.list([c.id])).map((p) => p.energyPriceCt)).toEqual([30, 33]);
  });
});

describe('Wechsel-Checkliste', () => {
  it('setzt und entfernt Haken, ohne andere Felder zu ändern', async () => {
    const c = await createContract(bundle('2026-01-01', '2026-12-31'));
    await setSwitchStep(c.id, 'reported', '2027-01-02');
    await setSwitchStep(c.id, 'offer_chosen', '2026-11-20');
    let [saved] = await listContracts();
    expect(saved?.switchChecklist).toEqual({ reported: '2027-01-02', offer_chosen: '2026-11-20' });
    expect(saved?.deliveryEnd).toBe('2026-12-31');
    await setSwitchStep(c.id, 'reported', null);
    [saved] = await listContracts();
    expect(saved?.switchChecklist).toEqual({ offer_chosen: '2026-11-20' });
  });
});
