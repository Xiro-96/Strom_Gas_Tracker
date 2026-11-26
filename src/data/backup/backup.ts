import type { Table } from 'dexie';
import { db as defaultDb, type TrackerDB } from '@/data/db';
import { isActive, nowISO } from '@/data/entity';
import { DEFAULT_SETTINGS } from '@/data/repositories/settings';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupSchema,
  type Backup,
  type BackupPhoto,
} from '@/data/backup/schema';
import { toReadingsCsv } from '@/domain/csv';
import type { Photo } from '@/domain/types';

const ENTITY_TABLES = [
  'meters',
  'readings',
  'contracts',
  'pricePeriods',
  'bonuses',
  'bills',
  'transactions',
  'offers',
] as const;

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = await blobBytes(blob);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head = '', data = ''] = dataUrl.split(',');
  const type = /^data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export const backupFileName = (date: string) => `strom-gas-tracker-sicherung-${date}.json`;

/** Spec Phase 4 – vollständige Sicherung (inkl. gelöschter Einträge für sauberes Zusammenführen). */
export async function exportBackup(
  { includePhotos }: { includePhotos: boolean },
  database: TrackerDB = defaultDb,
): Promise<Backup> {
  const [
    meters,
    readings,
    contracts,
    pricePeriods,
    bonuses,
    bills,
    transactions,
    offers,
    settings,
  ] = await Promise.all([
    database.meters.toArray(),
    database.readings.toArray(),
    database.contracts.toArray(),
    database.pricePeriods.toArray(),
    database.bonuses.toArray(),
    database.bills.toArray(),
    database.transactions.toArray(),
    database.offers.toArray(),
    database.settings.get('settings'),
  ]);
  const photos: BackupPhoto[] = [];
  if (includePhotos) {
    for (const p of await database.photos.toArray()) {
      const { blob, ...rest } = p;
      photos.push({ ...rest, dataUrl: await blobToDataUrl(blob) });
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    data: {
      meters,
      readings,
      contracts,
      pricePeriods,
      bonuses,
      bills,
      transactions,
      offers,
      ...(settings ? { settings: { ...DEFAULT_SETTINGS, ...settings } } : {}),
      ...(includePhotos ? { photos } : {}),
    },
  };
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string };

/** Backup-Datei prüfen (JSON, Format, Version, jede Zeile per zod) – erst danach importieren. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: 'Die Datei ist kein gültiges JSON – ist es wirklich eine Sicherung dieser App?',
    };
  }
  const head = raw as { format?: unknown; version?: unknown } | null;
  if (head?.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Das ist keine Sicherung des Strom & Gas Trackers.' };
  }
  if (typeof head.version === 'number' && head.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Die Sicherung stammt aus einer neueren App-Version (Format ${String(head.version)}). Bitte zuerst die App aktualisieren.`,
    };
  }
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue ? issue.path.join(' › ') : '';
    return {
      ok: false,
      error: `Die Sicherung ist beschädigt oder unvollständig (${where || 'Inhalt'}).`,
    };
  }
  return { ok: true, backup: result.data };
}

export interface ImportSummary {
  added: number;
  updated: number;
  unchanged: number;
  photos: number;
}

/**
 * Wiederherstellen: `replace` ersetzt alle Daten (und Einstellungen); `merge` führt zusammen –
 * gleiche ID: die neuere Änderung (`updatedAt`) gewinnt, Einstellungen des Geräts bleiben.
 */
export async function importBackup(
  backup: Backup,
  mode: 'merge' | 'replace',
  database: TrackerDB = defaultDb,
): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, updated: 0, unchanged: 0, photos: 0 };
  const tables = ENTITY_TABLES.map((name) => database.table(name));
  await database.transaction('rw', [...tables, database.photos, database.settings], async () => {
    if (mode === 'replace') {
      for (const table of [...tables, database.photos]) await table.clear();
    }
    for (const name of ENTITY_TABLES) {
      const table: Table<{ id: string; updatedAt: string }, string> = database.table(name);
      const rows: { id: string; updatedAt: string }[] = backup.data[name];
      for (const row of rows) {
        const existing = mode === 'merge' ? await table.get(row.id) : undefined;
        if (!existing) {
          await table.put(row);
          summary.added += 1;
        } else if (row.updatedAt > existing.updatedAt) {
          await table.put(row);
          summary.updated += 1;
        } else {
          summary.unchanged += 1;
        }
      }
    }
    for (const p of backup.data.photos ?? []) {
      if (mode === 'merge' && (await database.photos.get(p.id))) continue;
      const { dataUrl, ...rest } = p;
      const photo: Photo = { ...rest, blob: dataUrlToBlob(dataUrl) };
      await database.photos.put(photo);
      summary.photos += 1;
    }
    if (mode === 'replace' && backup.data.settings) {
      await database.settings.put(backup.data.settings);
    }
  });
  return summary;
}

/** Nach einer Sicherung: Zeitpunkt merken (Erinnerung alle 30 Tage). */
export async function markBackedUp(database: TrackerDB = defaultDb): Promise<void> {
  const current = await database.settings.get('settings');
  await database.settings.put({ ...DEFAULT_SETTINGS, ...current, lastBackupAt: nowISO() });
}

/** CSV-Export der Ablesungen (Excel-DE: `;`, Dezimalkomma) – Gegenstück zum CSV-Import. */
export async function exportReadingsCsv(database: TrackerDB = defaultDb): Promise<string> {
  const [meters, readings] = await Promise.all([
    database.meters.toArray(),
    database.readings.toArray(),
  ]);
  const energyOf = new Map(meters.map((m) => [m.id, m.energyType]));
  const rows = readings
    .filter(isActive)
    .flatMap((r) => {
      const energyType = energyOf.get(r.meterId);
      return energyType
        ? [{ date: r.date, energyType, value: r.value, ...(r.note ? { note: r.note } : {}) }]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.energyType.localeCompare(b.energyType));
  return toReadingsCsv(rows);
}
