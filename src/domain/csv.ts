import { isISODate } from '@/domain/dates';
import { parseMeterInput } from '@/domain/parse';
import type { EnergyType, ISODate } from '@/domain/types';

export interface CsvReadingRow {
  line: number;
  date: ISODate;
  energyType: EnergyType;
  value: number;
  note?: string;
}

export interface CsvParseResult {
  rows: CsvReadingRow[];
  errors: { line: number; message: string }[];
}

type Column = 'date' | 'energy' | 'value' | 'note';
const DEFAULT_COLUMNS: Column[] = ['date', 'energy', 'value', 'note'];

const HEADER_ALIASES: Record<Column, RegExp> = {
  date: /^(datum|date|tag)$/i,
  energy: /^(energie|energieart|zähler|zaehler|typ|art|sparte|energy)$/i,
  value: /^(stand|zählerstand|zaehlerstand|wert|value|reading)$/i,
  note: /^(notiz|bemerkung|kommentar|note)$/i,
};

function parseDate(raw: string): ISODate | null {
  const trimmed = raw.trim();
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  const iso = de ? `${de[3]}-${de[2]?.padStart(2, '0')}-${de[1]?.padStart(2, '0')}` : trimmed;
  return isISODate(iso) ? iso : null;
}

function parseEnergy(raw: string): EnergyType | null {
  const v = raw.trim().toLowerCase();
  if (/^(strom|electricity|elektr)/.test(v)) return 'electricity';
  if (/^(gas|erdgas)/.test(v)) return 'gas';
  return null;
}

/**
 * Ablesungen aus CSV im Excel-DE-Format (Semikolon oder Tab, Dezimalkomma). Spalten per
 * Kopfzeile erkannt, sonst Datum;Energie;Stand[;Notiz].
 */
export function parseReadingsCsv(text: string): CsvParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const rows: CsvReadingRow[] = [];
  const errors: CsvParseResult['errors'] = [];
  const firstIndex = lines.findIndex((l) => l.trim() !== '');
  const first = lines[firstIndex];
  if (first === undefined) return { rows, errors: [{ line: 1, message: 'Die Datei ist leer.' }] };

  const delimiter = first.includes(';') ? ';' : first.includes('\t') ? '\t' : null;
  if (!delimiter) {
    return {
      rows,
      errors: [
        {
          line: firstIndex + 1,
          message: 'Bitte Semikolon (;) oder Tab als Trennzeichen verwenden.',
        },
      ],
    };
  }

  let columns = DEFAULT_COLUMNS;
  let start = firstIndex;
  const headerCells = first.split(delimiter).map((c) => c.trim());
  const mapped = headerCells.map(
    (cell) =>
      (Object.keys(HEADER_ALIASES) as Column[]).find((col) => HEADER_ALIASES[col].test(cell)) ??
      null,
  );
  if (mapped.includes('date')) {
    columns = mapped.map((m) => m ?? 'note');
    start = firstIndex + 1;
  }

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const lineNo = i + 1;
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const cells = raw.split(delimiter);
    const get = (col: Column) => cells[columns.indexOf(col)]?.trim() ?? '';

    const date = parseDate(get('date'));
    if (!date) {
      errors.push({ line: lineNo, message: `Ungültiges Datum „${get('date')}“.` });
      continue;
    }
    const energyType = parseEnergy(get('energy'));
    if (!energyType) {
      errors.push({
        line: lineNo,
        message: `Unbekannte Energieart „${get('energy')}“ (Strom oder Gas).`,
      });
      continue;
    }
    const parsed = parseMeterInput(get('value'), { decimals: 3 });
    if (!parsed.ok) {
      errors.push({ line: lineNo, message: `Stand „${get('value')}“: ${parsed.error}` });
      continue;
    }
    const note = columns.includes('note') ? get('note') : '';
    rows.push({ line: lineNo, date, energyType, value: parsed.value, ...(note ? { note } : {}) });
  }
  return { rows, errors };
}

const ENERGY_LABEL: Record<EnergyType, string> = { electricity: 'Strom', gas: 'Gas' };

/** CSV im Excel-DE-Format (Gegenstück zu parseReadingsCsv). */
export function toReadingsCsv(
  rows: readonly { date: ISODate; energyType: EnergyType; value: number; note?: string }[],
): string {
  const withNotes = rows.some((r) => r.note);
  const lines = [withNotes ? 'Datum;Energie;Stand;Notiz' : 'Datum;Energie;Stand'];
  for (const r of rows) {
    const date = `${r.date.slice(8, 10)}.${r.date.slice(5, 7)}.${r.date.slice(0, 4)}`;
    const value = String(r.value).replace('.', ',');
    lines.push([date, ENERGY_LABEL[r.energyType], value, ...(r.note ? [r.note] : [])].join(';'));
  }
  return `${lines.join('\r\n')}\r\n`;
}
