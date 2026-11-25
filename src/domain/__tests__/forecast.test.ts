import { eachDay } from '@/domain/dates';
import { distribute } from '@/domain/distribution';
import { forecastAnnual } from '@/domain/forecast';
import type { Interval } from '@/domain/intervals';

const interval = (from: string, to: string, kwh: number): Interval => ({
  meterId: 'm',
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

describe('forecastAnnual – Gas (Normaljahr, Testfall C)', () => {
  const october = [interval('2026-10-01', '2026-11-01', 1000)];

  it('b = 0: Oktober = 80 ‰ → 12.500 kWh/Jahr', () => {
    const daily = distribute(october, { energyType: 'gas', baseLoadShare: 0 });
    const result = forecastAnnual(daily, october, { energyType: 'gas', baseLoadShare: 0 });
    expect(result?.kwh).toBeCloseTo(12500, 6);
    expect(result?.method).toBe('normalYear');
  });

  it('b = 0,15: Anteil 0,08074 → ≈ 12.385 kWh/Jahr', () => {
    const daily = distribute(october, { energyType: 'gas', baseLoadShare: 0.15 });
    const result = forecastAnnual(daily, october, { energyType: 'gas', baseLoadShare: 0.15 });
    expect(Math.round(result?.kwh ?? 0)).toBe(12385);
  });

  it('kennzeichnet wenige Intervalle (< 3) als unsicher und gibt eine Spanne', () => {
    const daily = distribute(october, { energyType: 'gas', baseLoadShare: 0.15 });
    const result = forecastAnnual(daily, october, { energyType: 'gas', baseLoadShare: 0.15 });
    expect(result?.uncertain).toBe(true);
    expect(result?.range?.[0]).toBeLessThan(result?.kwh ?? 0);
    expect(result?.range?.[1]).toBeGreaterThan(result?.kwh ?? 0);
  });

  it('nutzt höchstens die letzten 365 Tage als Basis', () => {
    const intervals = [
      interval('2024-01-01', '2025-01-01', 99999),
      interval('2025-01-01', '2026-01-01', 15000),
    ];
    const daily = distribute(intervals, { energyType: 'gas', baseLoadShare: 0.15 });
    const result = forecastAnnual(daily, intervals, { energyType: 'gas', baseLoadShare: 0.15 });
    expect(result?.kwh).toBeCloseTo(15000, 6);
    expect(result?.basis).toEqual({ from: '2025-01-01', to: '2026-01-01', days: 365 });
  });
});

describe('forecastAnnual – Strom (Spec 6.4)', () => {
  it('mit ≥ 365 Tagen: Verbrauch der letzten 365 Tage', () => {
    const intervals = [
      interval('2025-01-01', '2025-07-01', 1810),
      interval('2025-07-01', '2026-01-01', 1840),
      interval('2026-01-01', '2026-01-11', 100),
    ];
    const daily = distribute(intervals, { energyType: 'electricity', baseLoadShare: 0.15 });
    const result = forecastAnnual(daily, intervals, {
      energyType: 'electricity',
      baseLoadShare: 0.15,
    });
    expect(result?.method).toBe('last365');
    expect(result?.uncertain).toBe(false);
    const expected = 100 + 1840 + (1810 / 181) * 171; // Fenster 11.01.2025–10.01.2026: 171 + 184 + 10 Tage
    expect(result?.kwh).toBeCloseTo(expected, 6);
  });

  it('mit < 365 Tagen: Ø der letzten 90 Tage × 365, als unsicher markiert', () => {
    const days = eachDay('2026-06-01', '2026-10-01').length;
    const intervals = [interval('2026-06-01', '2026-10-01', days * 8)];
    const daily = distribute(intervals, { energyType: 'electricity', baseLoadShare: 0.15 });
    const result = forecastAnnual(daily, intervals, {
      energyType: 'electricity',
      baseLoadShare: 0.15,
    });
    expect(result?.method).toBe('avg90');
    expect(result?.kwh).toBeCloseTo(8 * 365, 6);
    expect(result?.uncertain).toBe(true);
  });

  it('liefert ohne Verbrauch keine Prognose', () => {
    expect(forecastAnnual([], [], { energyType: 'electricity', baseLoadShare: 0.15 })).toBeNull();
  });
});
