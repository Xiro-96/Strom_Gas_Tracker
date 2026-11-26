import {
  exportBackup,
  exportReadingsCsv,
  importBackup,
  markBackedUp,
  parseBackup,
} from '@/data/backup/backup';
import { db, TrackerDB } from '@/data/db';
import { createContract, transactions } from '@/data/repositories/contracts';
import { createMeter } from '@/data/repositories/meters';
import { addOffer } from '@/data/repositories/offers';
import { addReading, deleteReading, savePhoto } from '@/data/repositories/readings';
import { getSettings, updateSettings } from '@/data/repositories/settings';

import { Blob as NodeBlob } from 'node:buffer';

// jsdom-Blobs lassen sich von fake-indexeddb nicht klonen (im Browser speichert IndexedDB Blobs
// problemlos) – hier daher die Blob-Klasse von Node, damit Fotos wirklich gespeichert werden.
beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

let second: TrackerDB;

beforeEach(async () => {
  await db.delete();
  await db.open();
  second = new TrackerDB('zweites-geraet');
  await second.delete();
  await second.open();
});

afterEach(async () => {
  await second.delete();
});

async function seed() {
  const meter = await createMeter({
    energyType: 'gas',
    name: 'Gaszähler',
    unit: 'm3',
    decimals: 3,
    activeFrom: '2026-01-01',
    gasFactors: [{ validFrom: '2026-01-01', zFactor: 0.95, calorificValue: 11 }],
  });
  const photoId = await savePhoto(
    new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }),
  );
  await addReading({ meterId: meter.id, date: '2026-01-01', value: 100, kind: 'regular' });
  const gone = await addReading({
    meterId: meter.id,
    date: '2026-01-10',
    value: 120,
    kind: 'regular',
  });
  await deleteReading(gone.id);
  await addReading({
    meterId: meter.id,
    date: '2026-01-20',
    value: 150.5,
    kind: 'regular',
    photoId,
    note: 'mit Foto; Test',
  });
  const contract = await createContract({
    contract: {
      energyType: 'gas',
      meterId: meter.id,
      provider: 'Flammhaus',
      tariffName: 'Gas 12',
      deliveryStart: '2026-01-01',
      termStartsAt: 'delivery',
      noticePeriod: { value: 1, unit: 'months' },
      renewal: { type: 'monthly' },
      installmentPlan: [{ validFrom: '2026-01-01', amountEur: 90, dayOfMonth: 15 }],
      status: 'active',
      switchChecklist: { reported: '2026-01-02' },
    },
    price: { validFrom: '2026-01-01', energyPriceCt: 10, basePriceEurPerYear: 150 },
    bonuses: [
      {
        kind: 'new_customer',
        amountEur: 100,
        condition: '',
        settlement: 'offset_in_bill',
        requiresDeliveryMonths: 12,
        status: 'promised',
      },
    ],
  });
  await transactions.add({
    contractId: contract.id,
    date: '2026-02-15',
    amountEur: -90,
    kind: 'installment',
  });
  await addOffer({
    energyType: 'gas',
    provider: 'Funkenwerk',
    tariffName: 'Plus',
    energyPriceCt: 9,
    basePriceEurPerYear: 140,
    bonuses: [],
    capturedAt: '2026-11-20',
    url: 'https://example.org/angebot',
  });
  await updateSettings({ readingIntervalDays: 21, cancellationBufferDays: 10 });
}

const dump = async (database: TrackerDB) => ({
  meters: await database.meters.toArray(),
  readings: await database.readings.toArray(),
  contracts: await database.contracts.toArray(),
  pricePeriods: await database.pricePeriods.toArray(),
  bonuses: await database.bonuses.toArray(),
  transactions: await database.transactions.toArray(),
  offers: await database.offers.toArray(),
});

describe('Backup – Abnahme: zweites Gerät', () => {
  it('stellt nach Export und Import alles wieder her (inkl. Fotos, Einstellungen, Gelöschtem)', async () => {
    await seed();
    const text = JSON.stringify(await exportBackup({ includePhotos: true }));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const summary = await importBackup(parsed.backup, 'replace', second);
    expect(summary.photos).toBe(1);
    expect(await dump(second)).toEqual(await dump(db));
    const [photo] = await second.photos.toArray();
    expect(photo?.blob.type).toBe('image/jpeg');
    expect(photo?.blob.size).toBe(4);
    const settings = await second.settings.get('settings');
    expect(settings).toMatchObject({ readingIntervalDays: 21, cancellationBufferDays: 10 });
  });

  it('lässt Fotos auf Wunsch weg', async () => {
    await seed();
    const backup = await exportBackup({ includePhotos: false });
    expect(backup.data.photos).toBeUndefined();
    expect(backup.data.readings.find((r) => r.photoId)).toBeDefined();
  });
});

describe('Backup – Zusammenführen', () => {
  it('neuere Änderung gewinnt, Neues kommt dazu, Einstellungen des Geräts bleiben', async () => {
    await seed();
    const backup = await exportBackup({ includePhotos: false });
    // Gerät 2 hat eine eigene, neuere Version eines Angebots und eine ältere Version des Zählers
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(parsed.backup, 'replace', second);
    const [offer] = await second.offers.toArray();
    const [meter] = await second.meters.toArray();
    if (!offer || !meter) throw new Error('Testdaten');
    await second.offers.update(offer.id, {
      energyPriceCt: 8.5,
      updatedAt: '2999-01-01T00:00:00.000Z',
    });
    await second.meters.update(meter.id, { name: 'Alt', updatedAt: '2000-01-01T00:00:00.000Z' });
    await second.settings.put({ ...(await getSettings()), readingIntervalDays: 7 });

    const summary = await importBackup(parsed.backup, 'merge', second);
    expect((await second.offers.get(offer.id))?.energyPriceCt).toBe(8.5);
    expect((await second.meters.get(meter.id))?.name).toBe('Gaszähler');
    expect(summary.updated).toBe(1);
    expect((await second.settings.get('settings'))?.readingIntervalDays).toBe(7);
  });
});

const errorOf = (text: string) => {
  const result = parseBackup(text);
  return result.ok ? '' : result.error;
};

describe('Backup – nur nach Prüfung', () => {
  it('meldet kaputtes JSON, fremde Dateien, neuere Versionen und beschädigte Zeilen deutsch', async () => {
    expect(errorOf('{kaputt')).toContain('kein gültiges JSON');
    expect(errorOf('{"hallo":1}')).toContain('keine Sicherung');
    expect(errorOf('{"format":"strom-gas-tracker","version":2}')).toContain('neueren App-Version');
    await seed();
    const backup = await exportBackup({ includePhotos: false });
    const broken = JSON.parse(JSON.stringify(backup)) as {
      data: { readings: { value: unknown }[] };
    };
    const [first] = broken.data.readings;
    if (first) first.value = 'zwölf';
    expect(errorOf(JSON.stringify(broken))).toContain('readings › 0 › value');
  });

  it('weist unsichere Links und fremde Datenformate in Fotos ab', async () => {
    await seed();
    const backup = await exportBackup({ includePhotos: true });
    const evil = JSON.parse(JSON.stringify(backup)) as {
      data: { offers: { url?: string }[]; photos: { dataUrl: string }[] };
    };
    const [offer] = evil.data.offers;
    if (offer) offer.url = 'javascript:alert(1)';
    expect(parseBackup(JSON.stringify(evil)).ok).toBe(false);
    const [photo] = evil.data.photos;
    if (offer) offer.url = 'https://example.org';
    if (photo) photo.dataUrl = 'data:text/html;base64,PHNjcmlwdD4=';
    expect(parseBackup(JSON.stringify(evil)).ok).toBe(false);
  });
});

describe('CSV-Export und Sicherungszeitpunkt', () => {
  it('exportiert aktive Ablesungen im Excel-DE-Format', async () => {
    await seed();
    const csv = await exportReadingsCsv();
    expect(csv.split('\r\n')).toEqual([
      'Datum;Energie;Stand;Notiz',
      '01.01.2026;Gas;100',
      '20.01.2026;Gas;150,5;mit Foto; Test',
      '',
    ]);
  });

  it('merkt sich den Zeitpunkt der letzten Sicherung', async () => {
    await markBackedUp();
    expect((await getSettings()).lastBackupAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
