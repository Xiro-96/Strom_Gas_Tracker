import { annualCostEur, costBreakdown, effectivePriceCt, pricePeriodAt } from '@/domain/costs';
import { distribute } from '@/domain/distribution';
import { buildIntervals } from '@/domain/intervals';

const contract = { deliveryStart: '2026-01-01' };

describe('costBreakdown – Testfall A (Preiswechsel mitten im Intervall)', () => {
  const { intervals } = buildIntervals(
    [
      { meterId: 'm', date: '2026-01-01', value: 10000, kind: 'regular' },
      { meterId: 'm', date: '2026-01-22', value: 10210, kind: 'regular' },
    ],
    [{ id: 'm', energyType: 'electricity' }],
  );
  const daily = distribute(intervals, { energyType: 'electricity', baseLoadShare: 0.15 });
  const periods = [
    { validFrom: '2026-01-01', energyPriceCt: 30, basePriceEurPerYear: 120 },
    { validFrom: '2026-01-15', energyPriceCt: 25, basePriceEurPerYear: 120 },
  ];
  const result = costBreakdown(daily, contract, periods, '2026-01-01', '2026-01-22');

  it('21 Tage, 10,0 kWh/Tag, Arbeit 59,50 €, Grundpreis 6,90 €, gesamt 66,40 €', () => {
    expect(result.days).toBe(21);
    expect(result.kwh / result.coveredDays).toBeCloseTo(10, 9);
    expect(result.energyEur).toBeCloseTo(59.5, 9);
    expect(result.baseEur).toBeCloseTo((120 * 21) / 365, 9);
    expect(result.baseEur.toFixed(2)).toBe('6.90');
    expect(result.totalEur.toFixed(2)).toBe('66.40');
  });
});

describe('costBreakdown – Testfall B (Gas)', () => {
  it('1.045 kWh, Arbeit 104,50 €, Grundpreis 8,63 €, gesamt 113,13 €', () => {
    const { intervals } = buildIntervals(
      [
        { meterId: 'g', date: '2026-10-01', value: 5000, kind: 'regular' },
        { meterId: 'g', date: '2026-10-22', value: 5100, kind: 'regular' },
      ],
      [
        {
          id: 'g',
          energyType: 'gas',
          gasFactors: [{ validFrom: '2026-01-01', zFactor: 0.95, calorificValue: 11 }],
        },
      ],
    );
    const daily = distribute(intervals, { energyType: 'gas', baseLoadShare: 0.15 });
    const result = costBreakdown(
      daily,
      contract,
      [{ validFrom: '2026-01-01', energyPriceCt: 10, basePriceEurPerYear: 150 }],
      '2026-10-01',
      '2026-10-22',
    );
    expect(result.kwh).toBeCloseTo(1045, 9);
    expect(result.energyEur).toBeCloseTo(104.5, 9);
    expect(result.baseEur.toFixed(2)).toBe('8.63');
    expect(result.totalEur.toFixed(2)).toBe('113.13');
  });
});

describe('costBreakdown – Lücken', () => {
  it('rechnet Tage ohne Vertrag nicht und zählt Vertragstage ohne Ablesung als offen', () => {
    const daily = [
      { date: '2025-12-31', kwh: 10 },
      { date: '2026-01-01', kwh: 10 },
    ];
    const result = costBreakdown(
      daily,
      contract,
      [{ validFrom: '2026-01-01', energyPriceCt: 30, basePriceEurPerYear: 365 }],
      '2025-12-31',
      '2026-01-03',
    );
    expect(result.days).toBe(2); // 01.01. und 02.01. gehören zum Vertrag
    expect(result.coveredDays).toBe(1);
    expect(result.missingDays).toBe(1);
    expect(result.energyEur).toBeCloseTo(3, 9);
    expect(result.baseEur).toBeCloseTo(2, 9);
  });

  it('respektiert das Lieferende (letzter Liefertag inklusive)', () => {
    const daily = [
      { date: '2026-01-01', kwh: 1 },
      { date: '2026-01-02', kwh: 1 },
    ];
    const result = costBreakdown(
      daily,
      { deliveryStart: '2026-01-01', deliveryEnd: '2026-01-01' },
      [{ validFrom: '2026-01-01', energyPriceCt: 100, basePriceEurPerYear: 0 }],
      '2026-01-01',
      '2026-01-03',
    );
    expect(result.days).toBe(1);
    expect(result.energyEur).toBeCloseTo(1, 9);
  });
});

describe('pricePeriodAt', () => {
  it('nimmt die zuletzt gültige Preisperiode', () => {
    const periods = [
      { validFrom: '2026-06-01', energyPriceCt: 2, basePriceEurPerYear: 0 },
      { validFrom: '2026-01-01', energyPriceCt: 1, basePriceEurPerYear: 0 },
    ];
    expect(pricePeriodAt(periods, '2026-05-31')?.energyPriceCt).toBe(1);
    expect(pricePeriodAt(periods, '2026-06-01')?.energyPriceCt).toBe(2);
    expect(pricePeriodAt(periods, '2025-12-31')).toBeUndefined();
  });
});

describe('effectivePriceCt – Testfall D', () => {
  it('1.130 € ohne Bonus, Jahr 1 930 € → 26,57 ct/kWh, Folgejahr 32,29 ct/kWh', () => {
    const result = effectivePriceCt({
      kwh: 3500,
      energyEur: 3500 * 0.28,
      baseEur: 150,
      bonusEur: 150 + 50,
    });
    expect(result.totalWithoutBonusEur).toBeCloseTo(1130, 9);
    expect(result.totalWithBonusEur).toBeCloseTo(930, 9);
    expect(result.withBonusCt.toFixed(2)).toBe('26.57');
    expect(result.withoutBonusCt.toFixed(2)).toBe('32.29');
  });
});

describe('annualCostEur – Jahreskosten zum aktuellen Preis', () => {
  it('rechnet kWh × Arbeitspreis + Grundpreis, ohne Boni', () => {
    expect(
      annualCostEur(3000, { validFrom: '2026-01-01', energyPriceCt: 30, basePriceEurPerYear: 150 }),
    ).toBeCloseTo(1050, 9);
  });
});
