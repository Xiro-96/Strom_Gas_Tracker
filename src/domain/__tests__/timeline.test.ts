import { providerTimeline } from '@/domain/timeline';
import type { Bill, Bonus, Contract, PricePeriod } from '@/domain/types';

const base = { createdAt: '', updatedAt: '' };
const contract = (o: Partial<Contract>): Contract => ({
  ...base,
  id: 'c',
  energyType: 'electricity',
  meterId: 'm',
  provider: 'Blitzwerk',
  tariffName: 'T',
  deliveryStart: '2025-01-01',
  termStartsAt: 'delivery',
  noticePeriod: { value: 1, unit: 'months' },
  renewal: { type: 'monthly' },
  installmentPlan: [],
  status: 'active',
  ...o,
});
const price = (contractId: string, validFrom: string, ct: number): PricePeriod => ({
  ...base,
  id: `p-${contractId}-${validFrom}`,
  contractId,
  validFrom,
  energyPriceCt: ct,
  basePriceEurPerYear: 120,
});

describe('providerTimeline – Diagramm 6', () => {
  const contracts = [
    contract({
      id: 'e1',
      provider: 'Blitzwerk',
      deliveryStart: '2025-01-01',
      deliveryEnd: '2025-12-31',
      cancellation: { sentAt: '2025-11-20' },
    }),
    contract({ id: 'e2', provider: 'Neuwerk', deliveryStart: '2026-01-01' }),
    contract({ id: 'g1', energyType: 'gas', provider: 'blitzwerk ', deliveryStart: '2025-03-01' }),
  ];
  const bonuses: Bonus[] = [
    {
      ...base,
      id: 'b',
      contractId: 'e1',
      kind: 'instant',
      amountEur: 50,
      condition: '',
      settlement: 'payout',
      status: 'received',
      receivedAt: '2025-03-01',
    },
  ];
  const bills: Bill[] = [
    {
      ...base,
      id: 'r',
      contractId: 'e1',
      kind: 'final',
      periodFrom: '2025-01-01',
      periodTo: '2025-12-31',
      issuedAt: '2026-01-20',
    },
  ];
  const t = providerTimeline({
    contracts,
    pricePeriods: [
      price('e1', '2025-01-01', 30),
      price('e1', '2025-07-01', 33),
      price('e2', '2026-01-01', 28),
    ],
    bonuses,
    bills,
    today: '2026-11-26',
  });

  it('bildet je Energieart eine Zeile mit einem Band je Vertrag', () => {
    expect(t.rows.map((r) => r.energyType)).toEqual(['electricity', 'gas']);
    expect(t.rows[0]?.bands).toEqual([
      expect.objectContaining({
        contractId: 'e1',
        from: '2025-01-01',
        to: '2025-12-31',
        open: false,
        energyPriceCt: 30,
      }),
      expect.objectContaining({
        contractId: 'e2',
        from: '2026-01-01',
        to: '2026-11-26',
        open: true,
        energyPriceCt: 28,
      }),
    ]);
    expect(t.from).toBe('2025-01-01');
    expect(t.to).toBe('2026-11-26');
  });

  it('gibt demselben Anbieter in Strom und Gas dieselbe Farbe (Reihenfolge des ersten Auftretens)', () => {
    expect(t.providers).toEqual(['Blitzwerk', 'Neuwerk']);
    const colorOf = (id: string) =>
      t.rows.flatMap((r) => r.bands).find((b) => b.contractId === id)?.colorIndex;
    expect([colorOf('e1'), colorOf('e2'), colorOf('g1')]).toEqual([0, 1, 0]);
  });

  it('setzt Marker für Kündigung, Bonus und Rechnung', () => {
    expect(t.rows[0]?.markers.map((m) => [m.kind, m.date])).toEqual([
      ['bonus', '2025-03-01'],
      ['cancellation', '2025-11-20'],
      ['bill', '2026-01-20'],
    ]);
  });

  it('ohne Verträge leer', () => {
    expect(
      providerTimeline({
        contracts: [],
        pricePeriods: [],
        bonuses: [],
        bills: [],
        today: '2026-11-26',
      }).rows,
    ).toEqual([]);
  });
});
