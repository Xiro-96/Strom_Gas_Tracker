import {
  upsertGasFactors,
  ctPerKwhToEurPerM3,
  DEFAULT_GAS_FACTORS,
  eurPerM3ToCtPerKwh,
  gasFactorsAt,
  m3ToKwh,
} from '@/domain/gas';

describe('Gas-Umrechnung – Testfall B (Umrechnungsteil)', () => {
  it('rechnet 100 m³ mit z 0,9500 und Hs 11,000 in 1.045 kWh um', () => {
    expect(m3ToKwh(5100 - 5000, 0.95, 11)).toBeCloseTo(1045, 9);
  });

  it('1,045 €/m³ entsprechen 10,00 ct/kWh und umgekehrt', () => {
    expect(eurPerM3ToCtPerKwh(1.045, 0.95, 11)).toBeCloseTo(10, 9);
    expect(ctPerKwhToEurPerM3(10, 0.95, 11)).toBeCloseTo(1.045, 9);
  });
});

describe('gasFactorsAt', () => {
  const meter = {
    gasFactors: [
      { validFrom: '2026-01-01', zFactor: 0.95, calorificValue: 11 },
      { validFrom: '2025-01-01', zFactor: 0.94, calorificValue: 10.5 },
    ],
  };

  it('nimmt die zuletzt gültigen Faktoren', () => {
    expect(gasFactorsAt(meter, '2026-06-01')).toEqual({ zFactor: 0.95, calorificValue: 11 });
    expect(gasFactorsAt(meter, '2025-06-01')).toEqual({ zFactor: 0.94, calorificValue: 10.5 });
  });

  it('nimmt vor dem ersten „gültig ab“ die frühesten Faktoren', () => {
    expect(gasFactorsAt(meter, '2020-01-01')).toEqual({ zFactor: 0.94, calorificValue: 10.5 });
  });

  it('fällt ohne Faktoren auf die Platzhalter 0,9500 / 11,000 zurück', () => {
    expect(gasFactorsAt({}, '2026-01-01')).toEqual(DEFAULT_GAS_FACTORS);
    expect(DEFAULT_GAS_FACTORS).toEqual({ zFactor: 0.95, calorificValue: 11 });
  });
});

describe('Gasfaktoren-Historie', () => {
  const history = [
    { validFrom: '2025-01-01', zFactor: 0.95, calorificValue: 11 },
    { validFrom: '2026-01-01', zFactor: 0.94, calorificValue: 10.2 },
  ];

  it('fügt neue Werte mit „gültig ab“ sortiert ein', () => {
    const next = upsertGasFactors(history, {
      validFrom: '2025-07-01',
      zFactor: 0.93,
      calorificValue: 10.5,
    });
    expect(next.map((e) => e.validFrom)).toEqual(['2025-01-01', '2025-07-01', '2026-01-01']);
    expect(gasFactorsAt({ gasFactors: next }, '2025-08-01').zFactor).toBe(0.93);
  });

  it('korrigiert Werte bei gleichem Datum, statt sie zu verdoppeln', () => {
    const next = upsertGasFactors(history, {
      validFrom: '2026-01-01',
      zFactor: 0.9412,
      calorificValue: 10.274,
    });
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ validFrom: '2026-01-01', zFactor: 0.9412, calorificValue: 10.274 });
  });
});
