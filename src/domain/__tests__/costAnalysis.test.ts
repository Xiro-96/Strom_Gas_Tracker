import {
  monthToDateCost,
  cumulativeCostSeries,
  effectivePriceHistory,
  monthlyCosts,
  type ContractBundle,
} from '@/domain/costAnalysis';
import { eachDay } from '@/domain/dates';

const bundle = (overrides: Partial<ContractBundle> = {}): ContractBundle => ({
  id: 'c1',
  provider: 'Beispielwerk',
  tariffName: 'Klar',
  energyType: 'electricity',
  deliveryStart: '2026-01-01',
  deliveryEnd: '2026-12-31',
  installmentPlan: [{ validFrom: '2026-01-15', amountEur: 30, dayOfMonth: 15 }],
  periods: [
    { validFrom: '2026-01-01', energyPriceCt: 10, basePriceEurPerYear: 365 },
    { validFrom: '2026-02-01', energyPriceCt: 20, basePriceEurPerYear: 365 },
  ],
  bonuses: [
    {
      kind: 'instant',
      amountEur: 50,
      settlement: 'payout',
      status: 'received',
      receivedAt: '2026-02-03',
    },
  ],
  transactions: [],
  ...overrides,
});

describe('monthlyCosts – Diagramm 4', () => {
  const daily = eachDay('2026-01-01', '2026-03-01').map((date) => ({ date, kwh: 10 }));
  const months = monthlyCosts(daily, [bundle()]);

  it('trennt Arbeits- und Grundpreis je Monat und nimmt den Preis des Tages', () => {
    expect(months.map((m) => m.month)).toEqual(['2026-01', '2026-02']);
    expect(months[0]?.energyEur).toBeCloseTo(31 * 10 * 0.1, 9);
    expect(months[1]?.energyEur).toBeCloseTo(28 * 10 * 0.2, 9);
    expect(months[0]?.baseEur).toBeCloseTo(31, 9);
  });

  it('zeigt Boni negativ im Monat des Eingangs und Abschläge je Monat', () => {
    expect(months[0]?.bonusEur).toBe(0);
    expect(months[1]?.bonusEur).toBe(-50);
    expect(months.map((m) => m.installmentEur)).toEqual([30, 30]);
  });

  it('markiert Verbrauch ohne Vertrag als Lücke statt 0 €', () => {
    const gap = monthlyCosts([{ date: '2025-12-31', kwh: 10 }], [bundle()]);
    expect(gap[0]).toMatchObject({ month: '2025-12', energyEur: 0, uncoveredDays: 1 });
  });
});

describe('cumulativeCostSeries – Diagramm 5', () => {
  it('läuft bis zum Lieferende, Ist durchgezogen, Prognose danach', () => {
    const series = cumulativeCostSeries({
      bundle: bundle({
        periods: [{ validFrom: '2026-01-01', energyPriceCt: 10, basePriceEurPerYear: 365 }],
        bonuses: [],
      }),
      daily: eachDay('2026-01-01', '2026-07-01').map((date) => ({ date, kwh: 10 })),
      annualKwh: 3650,
      baseLoadShare: 0.15,
      today: '2026-06-30',
    });
    expect(series[0]?.date).toBe('2026-01-01');
    expect(series.at(-1)?.date).toBe('2026-12-31');
    expect(series.at(-1)?.costEur).toBeCloseTo(730, 6);
    expect(series.at(-1)?.installmentsEur).toBe(360);
    expect(series.find((p) => p.date === '2026-06-30')?.projected).toBe(false);
    expect(series.find((p) => p.date === '2026-07-01')?.projected).toBe(true);
  });
});

describe('effectivePriceHistory – Diagramm 7', () => {
  it('liefert je Vertragsjahr den Effektivpreis mit und ohne Bonus', () => {
    const history = effectivePriceHistory([
      { bundle: bundle(), kwh: 3500, energyEur: 980, baseEur: 150, bonusEur: 200, complete: true },
    ]);
    expect(history).toEqual([
      expect.objectContaining({ label: 'Beispielwerk 2026', complete: true }),
    ]);
    expect(history[0]?.withBonusCt.toFixed(2)).toBe('26.57');
    expect(history[0]?.withoutBonusCt.toFixed(2)).toBe('32.29');
  });
});

describe('monthToDateCost – Kosten laufender Monat (Übersicht)', () => {
  const input = {
    bundles: [bundle()],
    daily: eachDay('2026-10-01', '2026-11-21').map((date) => ({ date, kwh: 10 })),
    annualKwh: 3650,
    energyType: 'electricity' as const,
    baseLoadShare: 0.15,
    today: '2026-11-25',
  };

  it('rechnet Ist bis zur letzten Ablesung und schätzt die Tage bis heute', () => {
    const result = monthToDateCost(input);
    // 25 Tage × (10 kWh × 20 ct + 1 €/Tag Grundpreis)
    expect(result?.totalEur).toBeCloseTo(25 * 3, 9);
    expect(result?.kwh).toBeCloseTo(250, 9);
    expect(result?.estimatedDays).toBe(5);
  });

  it('ohne Prognose zählen nur gemessene Tage', () => {
    const result = monthToDateCost({ ...input, annualKwh: null });
    expect(result?.kwh).toBeCloseTo(200, 9);
    expect(result?.estimatedDays).toBe(0);
  });

  it('liefert null, wenn im Monat kein Vertrag liefert', () => {
    expect(monthToDateCost({ ...input, today: '2027-02-10' })).toBeNull();
  });
});
