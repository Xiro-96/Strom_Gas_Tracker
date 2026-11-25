import { distribute } from '@/domain/distribution';
import { monthlyTotals } from '@/domain/consumption';
import { buildIntervals, type IntervalMeter, type IntervalReading } from '@/domain/intervals';

const r = (
  meterId: string,
  date: string,
  value: number,
  kind: IntervalReading['kind'] = 'regular',
): IntervalReading => ({ meterId, date, value, kind });

describe('buildIntervals – Testfall G (Zählerwechsel)', () => {
  const meters: IntervalMeter[] = [
    { id: 'alt', energyType: 'electricity' },
    { id: 'neu', energyType: 'electricity', predecessorId: 'alt' },
  ];
  const readings = [
    r('neu', '2026-03-31', 150),
    r('alt', '2026-03-01', 12300),
    r('neu', '2026-03-10', 0, 'meter_install'),
    r('alt', '2026-03-10', 12345, 'meter_removal'),
  ];
  const { intervals, errors } = buildIntervals(readings, meters);

  it('bildet je Zähler eigene Intervalle ohne Sprung über den Wechsel', () => {
    expect(errors).toEqual([]);
    expect(intervals).toHaveLength(2);
    const [first, second] = intervals;
    expect(first).toMatchObject({ meterId: 'alt', from: '2026-03-01', to: '2026-03-10', days: 9 });
    expect(first?.perDay).toBeCloseTo(5.0, 10);
    expect(second).toMatchObject({
      meterId: 'neu',
      from: '2026-03-10',
      to: '2026-03-31',
      days: 21,
    });
    expect(second?.perDay).toBeCloseTo(150 / 21, 10);
    expect(second?.perDay).toBeCloseTo(7.14, 2);
  });

  it('summiert den März auf 195 kWh', () => {
    const daily = distribute(intervals, { energyType: 'electricity', baseLoadShare: 0.15 });
    const march = monthlyTotals(daily).find((m) => m.month === '2026-03');
    expect(march?.kwh).toBeCloseTo(195, 9);
  });
});

describe('buildIntervals – Überlauf', () => {
  it('rechnet 99.950 → 30 bei Modulus 100.000 als Δ 80', () => {
    const { intervals } = buildIntervals(
      [r('m', '2026-01-01', 99950), r('m', '2026-01-11', 30)],
      [{ id: 'm', energyType: 'electricity', rolloverModulus: 100000 }],
    );
    expect(intervals[0]?.delta).toBe(80);
    expect(intervals[0]?.rollover).toBe(true);
  });

  it('meldet einen Rückgang ohne Modulus als Fehler und lässt ihn aus', () => {
    const { intervals, errors } = buildIntervals(
      [r('m', '2026-01-01', 1000), r('m', '2026-01-11', 990)],
      [{ id: 'm', energyType: 'electricity' }],
    );
    expect(intervals).toEqual([]);
    expect(errors).toEqual([
      expect.objectContaining({
        meterId: 'm',
        from: '2026-01-01',
        to: '2026-01-11',
        reason: 'negative',
      }),
    ]);
  });
});

describe('buildIntervals – Gas', () => {
  it('rechnet m³ mit den Faktoren am Intervallbeginn in kWh um (Testfall B)', () => {
    const { intervals } = buildIntervals(
      [r('g', '2026-10-01', 5000), r('g', '2026-10-22', 5100)],
      [
        {
          id: 'g',
          energyType: 'gas',
          gasFactors: [{ validFrom: '2026-01-01', zFactor: 0.95, calorificValue: 11 }],
        },
      ],
    );
    expect(intervals[0]?.delta).toBeCloseTo(100, 9);
    expect(intervals[0]?.kwh).toBeCloseTo(1045, 9);
    expect(intervals[0]?.days).toBe(21);
  });

  it('ignoriert gelöschte Zähler-Unbekannte und gleiche Tage', () => {
    const { intervals } = buildIntervals(
      [r('g', '2026-10-01', 5000), r('g', '2026-10-01', 5000), r('x', '2026-10-05', 1)],
      [{ id: 'g', energyType: 'gas' }],
    );
    expect(intervals).toEqual([]);
  });
});
