import { addDays, eachDay } from '@/domain/dates';
import type { Interval } from '@/domain/intervals';
import {
  adjustedTrend,
  degreeDay,
  normalDegreeDays,
  normalYearTotal,
  temperatureScatter,
  weatherWeight,
} from '@/domain/weather';

describe('Gradtagzahl G20/15', () => {
  it('zählt 20 − Tagesmittel nur unter 15 °C', () => {
    expect(degreeDay(5)).toBe(15);
    expect(degreeDay(-3)).toBe(23);
    expect(degreeDay(14.9)).toBeCloseTo(5.1, 9);
    expect(degreeDay(15)).toBe(0);
    expect(degreeDay(22)).toBe(0);
  });
});

/** Temperaturreihe: Winter (Dez–Feb) 0 °C, sonst 20 °C, optional Verschiebung je Jahr. */
const series = (from: string, to: string, winter = 0) =>
  new Map(
    eachDay(from, to).map((d) => {
      const m = Number(d.slice(5, 7));
      return [d, m === 12 || m <= 2 ? winter : 20] as const;
    }),
  );

describe('Normaljahr', () => {
  const temps = series('2016-01-01', '2026-01-01');
  const normal = normalDegreeDays(
    temps,
    [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  );

  it('mittelt die Gradtage je Kalendertag über die Referenzjahre', () => {
    expect(normal.get('01-15')).toBe(20);
    expect(normal.get('07-15')).toBe(0);
    // Dez + Jan + Feb (28 Tage, ohne 29.02.) = 31 + 31 + 28 = 90 Tage × 20
    expect(normalYearTotal(normal)).toBe(1800);
  });

  it('gewichtet Tage mit gemessener Temperatur, sonst mit dem Normaljahr', () => {
    const weight = weatherWeight({
      temps: new Map([['2026-01-10', 10]]),
      normal,
      baseLoadShare: 0,
    });
    if (!weight) throw new Error('Gewicht fehlt');
    expect(weight('2026-01-10')).toBeCloseTo(10 / 1800, 12); // gemessen: 20 − 10
    expect(weight('2026-01-11')).toBeCloseTo(20 / 1800, 12); // Normaljahr
    expect(weight('2026-07-01')).toBe(0);
    const withBase = weatherWeight({ temps: new Map(), normal, baseLoadShare: 0.15 });
    if (!withBase) throw new Error('Gewicht fehlt');
    expect(withBase('2026-07-01')).toBeCloseTo(0.15 / 365, 12);
  });

  it('fällt ohne Heizgradtage im Normaljahr auf null', () => {
    expect(weatherWeight({ temps: new Map(), normal: new Map(), baseLoadShare: 0.15 })).toBeNull();
  });
});

describe('Witterungsbereinigter Trend – „mehr geheizt oder nur kälter?“', () => {
  it('rechnet die Wetterwirkung heraus', () => {
    // Vorjahr: 10 kWh/Tag bei 10 Gradtagen; jetzt: 20 kWh/Tag bei 20 Gradtagen (doppelt so kalt)
    const window = eachDay('2025-01-01', '2025-01-31');
    const daily = [
      ...window.map((d) => ({ date: d, kwh: 10 })),
      ...window.map((d) => ({ date: d.replace('2025', '2026'), kwh: 20 })),
    ];
    const weight = (d: string) => (d.startsWith('2026') ? 20 : 10);
    const t = adjustedTrend(daily, '2026-01-01', '2026-01-31', weight);
    expect(t?.raw).toBeCloseTo(1, 9); // +100 % Verbrauch …
    expect(t?.adjusted).toBeCloseTo(0, 9); // … aber bereinigt ±0 %: nur kälter
  });

  it('ohne vollständiges Vorjahr kein Trend', () => {
    const daily = eachDay('2026-01-01', '2026-01-31').map((d) => ({ date: d, kwh: 20 }));
    expect(adjustedTrend(daily, '2026-01-01', '2026-01-31', () => 1)).toBeNull();
  });
});

describe('Diagramm 8 – Gas gegen Temperatur', () => {
  const iv = (from: string, days: number, perDay: number): Interval =>
    ({ meterId: 'm', from, to: addDays(from, days), days, kwh: perDay * days, perDay }) as Interval;

  it('mittelt die Temperatur je Intervall und legt eine Regressionsgerade durch', () => {
    // kWh/Tag = 60 − 2 × Temperatur
    const temps = new Map<string, number>([
      ...eachDay('2026-01-01', '2026-01-15').map((d) => [d, 0] as const),
      ...eachDay('2026-03-01', '2026-03-15').map((d) => [d, 10] as const),
      ...eachDay('2026-05-01', '2026-05-15').map((d) => [d, 20] as const),
    ]);
    const s = temperatureScatter(
      [
        iv('2026-01-01', 14, 60),
        iv('2026-03-01', 14, 40),
        iv('2026-05-01', 14, 20),
        iv('2026-07-01', 14, 18),
      ],
      temps,
    );
    expect(s.points.map((p) => [p.meanTemp, p.perDay])).toEqual([
      [0, 60],
      [10, 40],
      [20, 20],
    ]); // Juli ohne Temperaturen entfällt
    expect(s.regression?.slope).toBeCloseTo(-2, 9);
    expect(s.regression?.intercept).toBeCloseTo(60, 9);
    expect(s.regression?.r2).toBeCloseTo(1, 9);
  });

  it('braucht mindestens 3 Punkte für eine Gerade', () => {
    expect(temperatureScatter([], new Map()).regression).toBeNull();
  });
});
