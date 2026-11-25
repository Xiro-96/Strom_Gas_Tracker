import { buildIntervals } from '@/domain/intervals';
import { db } from '@/data/db';
import { generateDemoData } from '@/data/demo/generate';
import { hasDemoData, loadDemoData, removeDemoData } from '@/data/repositories/demo';
import { importReadings } from '@/data/repositories/importReadings';
import { createMeter, listMeters } from '@/data/repositories/meters';
import { addReading, listReadings } from '@/data/repositories/readings';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Demo-Daten', () => {
  const demo = generateDemoData('2026-11-25');

  it('decken zwei Jahre ab, Ablesungen alle 14–21 Tage, nur aufsteigend', () => {
    for (const meter of demo.meters) {
      const readings = demo.readings.filter((r) => r.meterId === meter.id);
      expect(readings[0]?.date).toBe('2024-11-25');
      expect((readings.at(-1)?.date ?? '') <= '2026-11-25').toBe(true);
      const { intervals, errors } = buildIntervals(readings, [meter]);
      expect(errors).toEqual([]);
      for (const interval of intervals) {
        expect(interval.days).toBeGreaterThanOrEqual(1);
        expect(interval.days).toBeLessThanOrEqual(21);
      }
      expect(intervals.filter((i) => i.days >= 14).length).toBeGreaterThan(intervals.length * 0.8);
    }
  });

  it('haben realistische Saisonalität beim Gas (Januar ≫ Juli)', () => {
    const gas = demo.meters.find((m) => m.energyType === 'gas');
    const { intervals } = buildIntervals(
      demo.readings.filter((r) => r.meterId === gas?.id),
      gas ? [gas] : [],
    );
    const rate = (month: string) =>
      intervals.filter((i) => i.from.slice(5, 7) === month).reduce((s, i) => s + i.perDay, 0) /
      Math.max(1, intervals.filter((i) => i.from.slice(5, 7) === month).length);
    expect(rate('01')).toBeGreaterThan(rate('07') * 4);
  });

  it('enthalten zwei Anbieterwechsel je Energieart mit erfundenen Anbietern', () => {
    for (const energy of ['electricity', 'gas'] as const) {
      const contracts = demo.contracts.filter((c) => c.energyType === energy);
      expect(contracts).toHaveLength(3);
      expect(
        demo.readings.filter(
          (r) =>
            r.kind === 'switch' &&
            demo.meters.find((m) => m.id === r.meterId)?.energyType === energy,
        ),
      ).toHaveLength(2);
    }
    expect([...demo.meters, ...demo.readings, ...demo.contracts].every((e) => e.isDemo)).toBe(true);
  });

  it('ist deterministisch', () => {
    expect(generateDemoData('2026-11-25').readings).toEqual(demo.readings);
  });

  it('lässt sich laden und mit einem Klick wieder entfernen', async () => {
    await loadDemoData('2026-11-25');
    expect(await hasDemoData()).toBe(true);
    expect(await listMeters()).toHaveLength(2);
    await removeDemoData();
    expect(await hasDemoData()).toBe(false);
    expect(await listMeters()).toEqual([]);
    expect(await db.contracts.count()).toBe(0);
  });

  it('wird nicht in echte Daten gemischt', async () => {
    await createMeter({
      energyType: 'gas',
      name: 'Gas',
      unit: 'm3',
      decimals: 3,
      activeFrom: '2026-01-01',
    });
    await expect(loadDemoData('2026-11-25')).rejects.toThrow(/eigene Zähler/);
  });
});

describe('importReadings', () => {
  const rows = [
    { line: 2, date: '2025-11-03', energyType: 'electricity' as const, value: 14321.6 },
    { line: 3, date: '2025-11-03', energyType: 'gas' as const, value: 21234.567 },
    { line: 4, date: '2025-11-10', energyType: 'electricity' as const, value: 14387.6 },
  ];

  it('legt fehlende Zähler mit passenden Nachkommastellen an', async () => {
    const summary = await importReadings(rows);
    expect(summary).toMatchObject({
      created: 3,
      skipped: 0,
      conflicts: [],
      metersCreated: ['electricity', 'gas'],
    });
    const meters = await listMeters();
    expect(meters.find((m) => m.energyType === 'electricity')).toMatchObject({
      unit: 'kWh',
      decimals: 1,
      activeFrom: '2025-11-03',
    });
    expect(meters.find((m) => m.energyType === 'gas')).toMatchObject({ unit: 'm3', decimals: 3 });
  });

  it('überspringt identische Werte und meldet abweichende am selben Tag als Konflikt', async () => {
    const meter = await createMeter({
      energyType: 'electricity',
      name: 'Strom',
      unit: 'kWh',
      decimals: 1,
      activeFrom: '2025-12-01',
    });
    await addReading({ meterId: meter.id, date: '2025-11-03', value: 14321.6, kind: 'regular' });
    await addReading({ meterId: meter.id, date: '2025-11-10', value: 14400, kind: 'regular' });
    const summary = await importReadings(rows.filter((r) => r.energyType === 'electricity'));
    expect(summary.created).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.conflicts).toEqual([
      { date: '2025-11-10', energyType: 'electricity', existing: 14400, incoming: 14387.6 },
    ]);
    expect((await listMeters())[0]?.activeFrom).toBe('2025-11-03');
    expect(await listReadings()).toHaveLength(2);
  });

  it('warnt, wenn importierte Stände rückwärts laufen', async () => {
    const summary = await importReadings([
      { line: 1, date: '2026-01-01', energyType: 'electricity', value: 200 },
      { line: 2, date: '2026-01-10', energyType: 'electricity', value: 100 },
    ]);
    expect(summary.warnings).toHaveLength(1);
  });
});
