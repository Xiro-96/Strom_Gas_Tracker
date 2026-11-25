import { analyzeEnergy } from '@/domain/analysis';
import type { Meter, Reading } from '@/domain/types';

const base = { createdAt: '', updatedAt: '' };
const meter = (id: string, energyType: Meter['energyType'], extra: Partial<Meter> = {}): Meter => ({
  ...base,
  id,
  energyType,
  name: id,
  unit: energyType === 'gas' ? 'm3' : 'kWh',
  decimals: 1,
  activeFrom: '2026-01-01',
  ...extra,
});
const reading = (
  meterId: string,
  date: string,
  value: number,
  kind: Reading['kind'] = 'regular',
): Reading => ({
  ...base,
  id: `${meterId}-${date}-${kind}`,
  meterId,
  date,
  value,
  kind,
});

describe('analyzeEnergy', () => {
  const meters = [
    meter('alt', 'electricity', { activeTo: '2026-03-10' }),
    meter('neu', 'electricity', { predecessorId: 'alt', activeFrom: '2026-03-10' }),
    meter('gas', 'gas'),
  ];
  const readings = [
    reading('alt', '2026-03-01', 12300),
    reading('alt', '2026-03-10', 12345, 'meter_removal'),
    reading('neu', '2026-03-10', 0, 'meter_install'),
    reading('neu', '2026-03-31', 150),
    reading('gas', '2026-03-01', 100),
  ];

  it('fasst die Zählerkette einer Energieart zusammen', () => {
    const result = analyzeEnergy(meters, readings, 'electricity', 0.15);
    expect(result.meters.map((m) => m.id)).toEqual(['alt', 'neu']);
    expect(result.currentMeter?.id).toBe('neu');
    expect(result.lastReading?.value).toBe(150);
    expect(result.intervals).toHaveLength(2);
    expect(result.daily.reduce((s, d) => s + d.kwh, 0)).toBeCloseTo(195, 9);
  });

  it('liefert für Energiearten ohne Intervalle leere Reihen', () => {
    const result = analyzeEnergy(meters, readings, 'gas', 0.15);
    expect(result.intervals).toEqual([]);
    expect(result.daily).toEqual([]);
    expect(result.lastReading?.value).toBe(100);
  });
});
