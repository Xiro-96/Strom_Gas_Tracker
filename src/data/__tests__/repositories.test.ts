import { db } from '@/data/db';
import {
  createMeter,
  deleteMeter,
  listMeters,
  replaceMeter,
  updateMeter,
} from '@/data/repositories/meters';
import {
  addReading,
  deleteReading,
  listReadings,
  restoreReading,
  updateReading,
} from '@/data/repositories/readings';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '@/data/repositories/settings';

const stromInput = {
  energyType: 'electricity' as const,
  name: 'Strom',
  unit: 'kWh' as const,
  decimals: 1,
  activeFrom: '2026-01-01',
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Zähler-Repository', () => {
  it('legt Zähler mit UUID und Zeitstempeln an', async () => {
    const meter = await createMeter(stromInput);
    expect(meter.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(meter.createdAt).toBe(meter.updatedAt);
    expect(await listMeters()).toEqual([meter]);
  });

  it('aktualisiert und löscht weich (Soft-Delete)', async () => {
    const meter = await createMeter(stromInput);
    await updateMeter(meter.id, { name: 'Hausstrom' });
    expect((await listMeters())[0]?.name).toBe('Hausstrom');
    await deleteMeter(meter.id);
    expect(await listMeters()).toEqual([]);
    expect((await db.meters.get(meter.id))?.deletedAt).toBeDefined();
  });

  it('bildet beim Zählerwechsel eine Kette: Ausbau, neuer Zähler, Einbau', async () => {
    const old = await createMeter(stromInput);
    const created = await replaceMeter({
      oldMeterId: old.id,
      date: '2026-03-10',
      oldFinalValue: 12345,
      newMeter: { name: 'Strom (neu)', decimals: 1, meterNumber: 'NEU-1' },
      newStartValue: 0,
    });
    const meters = await listMeters();
    expect(meters.find((m) => m.id === old.id)?.activeTo).toBe('2026-03-10');
    expect(created).toMatchObject({
      predecessorId: old.id,
      activeFrom: '2026-03-10',
      energyType: 'electricity',
    });
    const readings = await listReadings();
    expect(readings.map((r) => [r.meterId === old.id ? 'alt' : 'neu', r.kind, r.value])).toEqual([
      ['alt', 'meter_removal', 12345],
      ['neu', 'meter_install', 0],
    ]);
  });
});

describe('Ablesungen-Repository', () => {
  it('speichert, sortiert nach Datum und filtert nach Zähler', async () => {
    const meter = await createMeter(stromInput);
    await addReading({ meterId: meter.id, date: '2026-02-01', value: 200, kind: 'regular' });
    await addReading({ meterId: meter.id, date: '2026-01-01', value: 100, kind: 'regular' });
    expect((await listReadings([meter.id])).map((r) => r.value)).toEqual([100, 200]);
    expect(await listReadings(['anderer'])).toEqual([]);
  });

  it('ersetzt auf Wunsch eine Ablesung am selben Tag', async () => {
    const meter = await createMeter(stromInput);
    await addReading({ meterId: meter.id, date: '2026-01-01', value: 100, kind: 'regular' });
    await addReading(
      { meterId: meter.id, date: '2026-01-01', value: 101, kind: 'regular' },
      { replaceSameDate: true },
    );
    expect((await listReadings()).map((r) => r.value)).toEqual([101]);
  });

  it('löscht weich und stellt wieder her (Rückgängig)', async () => {
    const meter = await createMeter(stromInput);
    const reading = await addReading({
      meterId: meter.id,
      date: '2026-01-01',
      value: 1,
      kind: 'regular',
    });
    await deleteReading(reading.id);
    expect(await listReadings()).toEqual([]);
    await restoreReading(reading.id);
    expect(await listReadings()).toHaveLength(1);
  });

  it('bearbeitet Wert und Notiz und setzt updatedAt neu', async () => {
    const meter = await createMeter(stromInput);
    const reading = await addReading({
      meterId: meter.id,
      date: '2026-01-01',
      value: 1,
      kind: 'regular',
    });
    await new Promise((r) => setTimeout(r, 2));
    await updateReading(reading.id, { value: 2, note: 'korrigiert' });
    const [updated] = await listReadings();
    expect(updated).toMatchObject({ value: 2, note: 'korrigiert' });
    expect(updated?.updatedAt).not.toBe(reading.updatedAt);
  });
});

describe('Einstellungen', () => {
  it('liefert Standardwerte und speichert Änderungen', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({
      readingIntervalDays: 14,
      gasBaseLoadShare: 0.15,
      cancellationBufferDays: 7,
      weatherOptIn: false,
      theme: 'dark',
    });
    await updateSettings({ readingIntervalDays: 21 });
    expect((await getSettings()).readingIntervalDays).toBe(21);
  });
});
