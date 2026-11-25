import { db } from '@/data/db';
import { isActive, nowISO, stamp } from '@/data/entity';
import type { CsvReadingRow } from '@/domain/csv';
import { DEFAULT_GAS_FACTORS } from '@/domain/gas';
import { buildIntervals } from '@/domain/intervals';
import type { EnergyType, Meter, Reading } from '@/domain/types';

export interface ImportSummary {
  created: number;
  skipped: number;
  conflicts: { date: string; energyType: EnergyType; existing: number; incoming: number }[];
  metersCreated: EnergyType[];
  warnings: string[];
}

const decimalsOf = (value: number) => (String(value).split('.')[1] ?? '').length;
const fmtDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const LABEL: Record<EnergyType, string> = { electricity: 'Strom', gas: 'Gas' };

/** Aktueller Zähler einer Energieart: ohne Ausbaudatum, sonst der zuletzt eingebaute. */
function currentMeter(meters: Meter[], energyType: EnergyType): Meter | undefined {
  const candidates = meters
    .filter((m) => m.energyType === energyType)
    .sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
  return candidates.filter((m) => !m.activeTo).at(-1) ?? candidates.at(-1);
}

/**
 * Importiert Ablesungen (z. B. Altdaten aus einer CSV). Fehlende Zähler werden mit sinnvollen
 * Standardwerten angelegt; identische Stände übersprungen; abweichende Stände am selben Tag nie
 * überschrieben, sondern als Konflikt gemeldet.
 */
export async function importReadings(rows: readonly CsvReadingRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    skipped: 0,
    conflicts: [],
    metersCreated: [],
    warnings: [],
  };

  await db.transaction('rw', db.meters, db.readings, async () => {
    const meters = (await db.meters.toArray()).filter(isActive);
    for (const energyType of ['electricity', 'gas'] as const) {
      const typeRows = rows
        .filter((r) => r.energyType === energyType)
        .sort((a, b) => a.date.localeCompare(b.date));
      const earliest = typeRows[0]?.date;
      if (!earliest) continue;

      let meter = currentMeter(meters, energyType);
      if (!meter) {
        const decimals = Math.max(
          energyType === 'gas' ? 3 : 0,
          ...typeRows.map((r) => decimalsOf(r.value)),
        );
        meter = stamp<Meter>({
          energyType,
          name: energyType === 'gas' ? 'Gaszähler' : 'Stromzähler',
          unit: energyType === 'gas' ? 'm3' : 'kWh',
          decimals: Math.min(decimals, 3),
          activeFrom: earliest,
          ...(energyType === 'gas'
            ? { gasFactors: [{ validFrom: earliest, ...DEFAULT_GAS_FACTORS }] }
            : {}),
        });
        await db.meters.add(meter);
        meters.push(meter);
        summary.metersCreated.push(energyType);
      } else if (earliest < meter.activeFrom) {
        await db.meters.update(meter.id, { activeFrom: earliest, updatedAt: nowISO() });
      }

      const existing = (await db.readings.where('meterId').equals(meter.id).toArray()).filter(
        isActive,
      );
      const byDate = new Map(existing.map((r) => [r.date, r]));
      const toAdd: Reading[] = [];
      for (const row of typeRows) {
        const same = byDate.get(row.date);
        if (same) {
          if (Math.abs(same.value - row.value) < 1e-9) summary.skipped += 1;
          else
            summary.conflicts.push({
              date: row.date,
              energyType,
              existing: same.value,
              incoming: row.value,
            });
          continue;
        }
        const reading = stamp<Reading>({
          meterId: meter.id,
          date: row.date,
          value: row.value,
          kind: 'regular',
          ...(row.note ? { note: row.note } : {}),
        });
        byDate.set(row.date, reading);
        toAdd.push(reading);
      }
      await db.readings.bulkAdd(toAdd);
      summary.created += toAdd.length;

      const { errors } = buildIntervals([...byDate.values()], [meter]);
      for (const e of errors) {
        summary.warnings.push(
          `${LABEL[energyType]}: Stand sinkt zwischen ${fmtDate(e.from)} und ${fmtDate(e.to)} (${e.startValue} → ${e.endValue}).`,
        );
      }
    }
  });
  return summary;
}
