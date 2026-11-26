import type { ContractBundle } from '@/domain/costAnalysis';
import { eachDay } from '@/domain/dates';
import { switchSavings } from '@/domain/savings';
import { yearReport } from '@/domain/report';

const bundle = (overrides: Partial<ContractBundle> = {}): ContractBundle => ({
  id: 'c1',
  provider: 'Blitzwerk',
  tariffName: 'Öko',
  energyType: 'electricity',
  deliveryStart: '2026-01-01',
  installmentPlan: [{ validFrom: '2026-01-01', amountEur: 100, dayOfMonth: 15 }],
  periods: [{ validFrom: '2026-01-01', energyPriceCt: 30, basePriceEurPerYear: 365 }],
  bonuses: [],
  transactions: [],
  ...overrides,
});
const daily = eachDay('2026-01-01', '2027-01-01').map((date) => ({ date, kwh: 10 }));
const reference = { energyPriceCt: 40, basePriceEurPerYear: 365 };

describe('Wechsel-Bilanz', () => {
  it('vergleicht jeden belieferten Tag mit dem Referenztarif, Boni mindern die Kosten', () => {
    const s = switchSavings({
      bundles: [
        bundle({
          bonuses: [
            {
              kind: 'new_customer',
              amountEur: 100,
              settlement: 'offset_in_bill',
              status: 'offset',
            },
          ],
        }),
      ],
      daily,
      reference,
    });
    // Referenz 365 × (4 € + 1 €) = 1.825 €; tatsächlich 365 × (3 € + 1 €) = 1.460 € − 100 € Bonus
    expect(s).toMatchObject({ since: '2026-01-01', days: 365 });
    expect(s?.referenceEur).toBeCloseTo(1825, 9);
    expect(s?.actualEur).toBeCloseTo(1460, 9);
    expect(s?.bonusEur).toBe(100);
    expect(s?.savedEur).toBeCloseTo(465, 9);
  });

  it('zählt nur zugesagte Boni nicht und lässt Tage ohne Vertrag aus', () => {
    const s = switchSavings({
      bundles: [
        bundle({
          deliveryStart: '2026-07-01',
          bonuses: [
            {
              kind: 'new_customer',
              amountEur: 100,
              settlement: 'offset_in_bill',
              status: 'promised',
            },
          ],
        }),
      ],
      daily,
      reference,
    });
    expect(s?.since).toBe('2026-07-01');
    expect(s?.days).toBe(184);
    expect(s?.bonusEur).toBe(0);
  });

  it('ohne Vertragstage keine Bilanz', () => {
    expect(switchSavings({ bundles: [], daily, reference })).toBeNull();
  });
});

describe('Jahresbericht', () => {
  it('fasst Verbrauch, Kosten, Boni, Effektivpreis und Monate eines Jahres zusammen', () => {
    const r = yearReport({
      year: 2026,
      daily,
      bundles: [
        bundle({
          bonuses: [
            {
              kind: 'instant',
              amountEur: 50,
              settlement: 'payout',
              status: 'received',
              receivedAt: '2026-03-01',
            },
          ],
        }),
      ],
    });
    expect(r.kwh).toBe(3650);
    expect(r.days).toBe(365);
    expect(r.energyEur).toBeCloseTo(1095, 9);
    expect(r.baseEur).toBeCloseTo(365, 9);
    expect(r.bonusEur).toBe(50);
    expect(r.effectiveCt).toBeCloseTo(((1095 + 365 - 50) / 3650) * 100, 9);
    expect(r.months).toHaveLength(12);
    expect(r.months[1]).toMatchObject({ month: '2026-02', kwh: 280 });
    expect(r.contracts.map((c) => c.provider)).toEqual(['Blitzwerk']);
    expect(r.lastDataDay).toBe('2026-12-31');
  });
});
