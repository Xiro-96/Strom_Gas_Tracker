import { eachDay } from '@/domain/dates';
import { cumulativeYears, monthlyComparison, rangeBounds, stepSeries } from '@/domain/charts';
import type { Interval } from '@/domain/intervals';

const iv = (from: string, to: string, perDay: number): Interval => ({
  meterId: 'm',
  from,
  to,
  days: 0,
  startValue: 0,
  endValue: 0,
  delta: 0,
  kwh: 0,
  perDay,
  rollover: false,
});

describe('rangeBounds', () => {
  it('bildet die Zeiträume relativ zum letzten Datentag', () => {
    expect(rangeBounds('3m', '2026-11-25')).toEqual({ from: '2026-08-26', to: '2026-11-26' });
    expect(rangeBounds('12m', '2026-11-25')).toEqual({ from: '2025-11-26', to: '2026-11-26' });
    expect(rangeBounds('year', '2026-11-25')).toEqual({ from: '2026-01-01', to: '2027-01-01' });
    expect(rangeBounds('all', '2026-11-25')).toEqual({ from: '0000-01-01', to: '2026-11-26' });
  });
});

describe('stepSeries – Diagramm 1', () => {
  it('erzeugt Stufen mit echter Intervallbreite und Schlusspunkt', () => {
    const points = stepSeries(
      [iv('2026-01-01', '2026-01-15', 10), iv('2026-01-15', '2026-02-05', 12)],
      {
        from: '2025-01-01',
        to: '2027-01-01',
      },
    );
    expect(points.map((p) => [p.date, p.perDay])).toEqual([
      ['2026-01-01', 10],
      ['2026-01-15', 12],
      ['2026-02-05', 12],
    ]);
  });

  it('unterbricht die Linie bei Lücken (nie stillschweigend 0)', () => {
    const points = stepSeries(
      [iv('2026-01-01', '2026-01-10', 10), iv('2026-02-01', '2026-02-10', 8)],
      {
        from: '2025-01-01',
        to: '2027-01-01',
      },
    );
    expect(points.map((p) => [p.date, p.perDay])).toEqual([
      ['2026-01-01', 10],
      ['2026-01-10', 10],
      ['2026-01-10', null],
      ['2026-02-01', 8],
      ['2026-02-10', 8],
    ]);
  });

  it('verschiebt das Vorjahr um ein Jahr nach vorn und schneidet auf den Zeitraum zu', () => {
    const points = stepSeries(
      [iv('2025-01-01', '2025-01-15', 10)],
      { from: '2026-01-05', to: '2026-02-01' },
      1,
    );
    expect(points.map((p) => [p.date, p.perDay])).toEqual([
      ['2026-01-05', 10],
      ['2026-01-15', 10],
    ]);
  });
});

describe('monthlyComparison – Diagramm 2', () => {
  it('stellt jedem Monat das Vorjahr gegenüber und markiert unvollständige Monate', () => {
    const daily = [
      ...eachDay('2025-03-01', '2025-04-01').map((date) => ({ date, kwh: 9 })),
      ...eachDay('2026-03-01', '2026-03-16').map((date) => ({ date, kwh: 10 })),
    ];
    const months = monthlyComparison(daily, { from: '2026-03-01', to: '2026-04-01' });
    expect(months).toEqual([
      {
        month: '2026-03',
        kwh: 150,
        complete: false,
        coveredDays: 15,
        previousKwh: 279,
        previousComplete: true,
      },
    ]);
  });
});

describe('cumulativeYears – Diagramm 3', () => {
  it('liefert je Jahr eine kumulierte Kurve, höchstens die letzten drei Jahre', () => {
    const daily = ['2023', '2024', '2025', '2026'].flatMap((y) =>
      eachDay(`${y}-01-01`, `${y}-01-03`).map((date) => ({ date, kwh: 1 })),
    );
    const years = cumulativeYears(daily, 3);
    expect(years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(years[2]?.points).toEqual([
      { day: 1, date: '2026-01-01', kwh: 1 },
      { day: 2, date: '2026-01-02', kwh: 2 },
    ]);
  });
});
