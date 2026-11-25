import {
  averagePerDay,
  cumulativeByYear,
  lastWindowAverage,
  monthlyTotals,
  readingStatus,
  trendVsPreviousYear,
} from '@/domain/consumption';
import { eachDay } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';

const flat = (from: string, to: string, kwh: number): DailyPoint[] =>
  eachDay(from, to).map((date) => ({ date, kwh }));

describe('Verbrauchskennzahlen', () => {
  const daily = [...flat('2025-01-01', '2025-03-01', 10), ...flat('2026-01-01', '2026-03-01', 9)];

  it('bildet Monatssummen mit abgedeckten Tagen', () => {
    const months = monthlyTotals(daily);
    expect(months.find((m) => m.month === '2026-02')).toEqual({
      month: '2026-02',
      kwh: 9 * 28,
      coveredDays: 28,
      daysInMonth: 28,
    });
  });

  it('mittelt nur über abgedeckte Tage', () => {
    expect(averagePerDay(daily, '2026-01-01', '2026-02-01')).toBeCloseTo(9, 12);
    expect(averagePerDay(daily, '2027-01-01', '2027-02-01')).toBeNull();
  });

  it('nimmt für „letzte 30 Tage“ das Fenster bis zum letzten abgedeckten Tag', () => {
    expect(lastWindowAverage(daily, 30)).toEqual({
      from: '2026-01-30',
      to: '2026-03-01',
      perDay: 9,
    });
    expect(lastWindowAverage([], 30)).toBeNull();
  });

  it('vergleicht mit demselben Zeitraum im Vorjahr', () => {
    expect(trendVsPreviousYear(daily, '2026-01-29', '2026-03-01')).toBeCloseTo(-0.1, 12);
    expect(trendVsPreviousYear(daily, '2025-01-29', '2025-03-01')).toBeNull();
  });

  it('kumuliert je Jahr über den Tag im Jahr', () => {
    const years = cumulativeByYear(daily);
    expect(years.map((y) => y.year)).toEqual([2025, 2026]);
    expect(years[1]?.points.at(-1)).toEqual({ day: 59, date: '2026-02-28', kwh: 9 * 59 });
  });
});

describe('readingStatus', () => {
  it('ist fällig ab dem Ableseintervall und überfällig ab dem 1,5-fachen (14 → 21)', () => {
    expect(readingStatus(undefined, '2026-11-25', 14)).toEqual({ state: 'none', daysSince: null });
    expect(readingStatus('2026-11-20', '2026-11-25', 14)).toEqual({ state: 'ok', daysSince: 5 });
    expect(readingStatus('2026-11-11', '2026-11-25', 14)).toEqual({ state: 'due', daysSince: 14 });
    expect(readingStatus('2026-11-04', '2026-11-25', 14)).toEqual({
      state: 'overdue',
      daysSince: 21,
    });
  });
});
