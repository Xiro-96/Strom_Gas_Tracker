import { addDays } from '@/domain/dates';
import { dayWeight, distribute, heatingShare, sumWeights } from '@/domain/distribution';
import type { Interval } from '@/domain/intervals';

describe('Gradtagzahlen-Verteilung – Testfall C', () => {
  it('Oktober hat ohne Grundlast den Anteil 80 ‰ → 12.500 kWh/Jahr', () => {
    const share = sumWeights('2026-10-01', '2026-11-01', 'gas', 0);
    expect(share).toBeCloseTo(0.08, 12);
    expect(1000 / share).toBeCloseTo(12500, 6);
  });

  it('mit Grundlast 0,15 ist der Anteil 0,08074 → ≈ 12.385 kWh/Jahr', () => {
    const share = sumWeights('2026-10-01', '2026-11-01', 'gas', 0.15);
    expect(share).toBeCloseTo(0.08074, 5);
    expect(Math.round(1000 / share)).toBe(12385);
  });

  it('Teilzeitraum 01.–15.11. (b = 0) ergibt 60 ‰', () => {
    expect(sumWeights('2026-11-01', '2026-11-16', 'gas', 0)).toBeCloseTo(0.06, 12);
  });

  it('ein ganzes Jahr summiert sich immer auf 1 – auch im Schaltjahr', () => {
    for (const b of [0, 0.15, 1]) {
      expect(sumWeights('2026-01-01', '2027-01-01', 'gas', b)).toBeCloseTo(1, 10);
      expect(sumWeights('2028-01-01', '2029-01-01', 'gas', b)).toBeCloseTo(1, 10);
    }
  });

  it('verteilt Juni–August gemeinsam (40 ‰ auf 92 Tage)', () => {
    expect(heatingShare('2026-07-15')).toBeCloseTo(0.04 / 92, 14);
    expect(heatingShare('2026-01-15')).toBeCloseTo(0.17 / 31, 14);
  });

  it('gewichtet Strom gleichmäßig', () => {
    expect(dayWeight('2026-01-01', 'electricity', 0.15)).toBe(1);
    expect(sumWeights('2026-01-01', '2026-01-22', 'electricity', 0.15)).toBe(21);
  });
});

describe('distribute', () => {
  const interval = (from: string, to: string, kwh: number): Interval => ({
    meterId: 'g',
    from,
    to,
    days: 0,
    startValue: 0,
    endValue: 0,
    delta: kwh,
    kwh,
    perDay: 0,
    rollover: false,
  });

  it('verteilt Gas über ein Intervall mit Monatswechsel saisonal, Summe bleibt erhalten', () => {
    const daily = distribute([interval('2026-09-20', '2026-10-11', 210)], {
      energyType: 'gas',
      baseLoadShare: 0.15,
    });
    expect(daily).toHaveLength(21);
    const total = daily.reduce((sum, d) => sum + d.kwh, 0);
    expect(total).toBeCloseTo(210, 9);
    const sep = daily.find((d) => d.date === '2026-09-25')?.kwh ?? 0;
    const oct = daily.find((d) => d.date === '2026-10-05')?.kwh ?? 0;
    expect(oct).toBeGreaterThan(sep);
  });

  it('lässt Tage ohne Ablesung als Lücke weg (nie stillschweigend 0)', () => {
    const daily = distribute(
      [interval('2026-01-01', '2026-01-03', 2), interval('2026-01-05', '2026-01-06', 1)],
      { energyType: 'electricity', baseLoadShare: 0 },
    );
    expect(daily.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-05']);
    expect(addDays('2026-01-02', 1)).toBe('2026-01-03');
  });
});
