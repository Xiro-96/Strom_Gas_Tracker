import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportBackup } from '@/data/backup/backup';
import { db } from '@/data/db';
import { createMeter } from '@/data/repositories/meters';
import { addReading, listReadings } from '@/data/repositories/readings';
import { getSettings } from '@/data/repositories/settings';
import { addDays, todayISO } from '@/domain/dates';
import { renderRoute } from '@/test/renderRoute';

const today = todayISO();

async function ownData() {
  const meter = await createMeter({
    energyType: 'electricity',
    name: 'Stromzähler',
    unit: 'kWh',
    decimals: 1,
    activeFrom: addDays(today, -40),
  });
  await addReading({ meterId: meter.id, date: addDays(today, -40), value: 1000, kind: 'regular' });
  return meter;
}

function captureDownloads() {
  const blobs: Blob[] = [];
  Object.assign(URL, {
    createObjectURL: vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:test';
    }),
    revokeObjectURL: vi.fn(),
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return {
    blobs,
    restore: () => {
      click.mockRestore();
    },
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Sicherung in „Mehr“', () => {
  it('erstellt eine Sicherungsdatei und merkt sich das Datum', async () => {
    const user = userEvent.setup();
    await ownData();
    const downloads = captureDownloads();
    renderRoute('/mehr');
    expect(await screen.findByText('Noch keine Sicherung erstellt.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sicherung erstellen' }));
    await waitFor(async () => {
      expect((await getSettings()).lastBackupAt).toBeDefined();
    });
    const [file] = downloads.blobs;
    const backup = JSON.parse((await file?.text()) ?? '{}') as {
      format: string;
      data: { readings: unknown[] };
    };
    expect(backup.format).toBe('strom-gas-tracker');
    expect(backup.data.readings).toHaveLength(1);
    expect(await screen.findByText(/^Letzte Sicherung:/)).toBeInTheDocument();
    downloads.restore();
  });

  it('stellt eine Sicherung nach Rückfrage wieder her (zusammenführen)', async () => {
    const user = userEvent.setup();
    await ownData();
    const text = JSON.stringify(await exportBackup({ includePhotos: false }));
    await db.delete();
    await db.open();
    renderRoute('/mehr');
    const input = await screen.findByLabelText('Sicherungsdatei wählen');
    await user.upload(input, new File([text], 'sicherung.json', { type: 'application/json' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sicherung wiederherstellen?' });
    expect(dialog).toHaveTextContent('1 Zähler, 1 Ablesungen');
    await user.click(within(dialog).getByRole('button', { name: 'Zusammenführen' }));
    await waitFor(async () => {
      expect(await listReadings()).toHaveLength(1);
    });
  });

  it('weist eine fremde Datei ab, ohne etwas zu ändern', async () => {
    const user = userEvent.setup();
    renderRoute('/mehr');
    const input = await screen.findByLabelText('Sicherungsdatei wählen');
    await user.upload(input, new File(['{"hallo":1}'], 'fremd.json', { type: 'application/json' }));
    expect(await screen.findByText(/keine Sicherung des Strom & Gas Trackers/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exportiert die Ablesungen als CSV für Excel', async () => {
    const user = userEvent.setup();
    await ownData();
    const downloads = captureDownloads();
    renderRoute('/mehr');
    await user.click(await screen.findByRole('button', { name: 'Ablesungen als CSV' }));
    await waitFor(() => {
      expect(downloads.blobs).toHaveLength(1);
    });
    const [blob] = downloads.blobs;
    if (!blob) throw new Error('Download fehlt');
    // UTF-8-BOM (EF BB BF), damit Excel Umlaute erkennt – text() entfernt ihn beim Dekodieren
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = await blob.text();
    expect(csv).toContain('Datum;Energie;Stand');
    expect(csv).toContain(';Strom;1000');
    downloads.restore();
  });
});

describe('Backup-Erinnerung', () => {
  it('erinnert 30 Tage nach den ersten eigenen Daten in der Übersicht', async () => {
    await ownData();
    const [reading] = await db.readings.toArray();
    if (!reading) throw new Error('Testdaten');
    await db.readings.update(reading.id, { createdAt: `${addDays(today, -31)}T10:00:00.000Z` });
    renderRoute('/');
    expect(await screen.findByRole('link', { name: /Zeit für eine Sicherung/ })).toHaveAttribute(
      'href',
      '/mehr',
    );
  });

  it('erinnert nicht bei frischen Daten', async () => {
    await ownData();
    renderRoute('/');
    await screen.findByRole('heading', { name: 'Strom' });
    expect(screen.queryByText('Zeit für eine Sicherung')).not.toBeInTheDocument();
  });
});
