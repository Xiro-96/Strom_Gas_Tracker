export type ParseResult =
  { ok: true; value: number; fractionDigits: number } | { ok: false; error: string };

export interface ParseOptions {
  /** Nachkommastellen des Zählwerks. */
  decimals: number;
  /** Letzter bekannter Stand – entscheidet bei mehrdeutigen Eingaben wie „5.100“. */
  lastValue?: number;
}

const fail = (error: string): ParseResult => ({ ok: false, error });
const THOUSANDS = /^\d{1,3}(\.\d{3})+$/;

/**
 * Liest Zählerstände in deutscher Schreibweise robust ein (Spec 6.1):
 * „12.345,678“, „12345,678“, „5.100,5“ … Bei Mehrdeutigkeit (nur Punkte) gewinnt die Lesart,
 * die zur Nachkommastellenzahl des Zählers und zum letzten Stand passt.
 */
export function parseMeterInput(input: string, { decimals, lastValue }: ParseOptions): ParseResult {
  const s = input.replace(/[\s\u00a0\u202f']/g, '');
  if (s === '') return fail('Bitte einen Zählerstand eingeben.');
  if (s.startsWith('-')) return fail('Ein Zählerstand kann nicht negativ sein.');
  if (!/^[\d.,]+$/.test(s)) return fail('Bitte nur Ziffern, Punkt und Komma verwenden.');

  const commas = s.split(',').length - 1;
  if (commas > 1) return fail('Mehr als ein Komma – bitte prüfen.');

  if (commas === 1) {
    const [intPart = '', frac = ''] = s.split(',');
    if (frac.includes('.')) return fail('Nach dem Komma darf kein Punkt stehen.');
    if (intPart.includes('.') && !THOUSANDS.test(intPart)) {
      return fail('Die Tausenderpunkte stehen an der falschen Stelle.');
    }
    const digits = intPart.replace(/\./g, '');
    if (digits === '' && frac === '') return fail('Bitte einen Zählerstand eingeben.');
    return {
      ok: true,
      value: Number(`${digits || '0'}.${frac || '0'}`),
      fractionDigits: frac.length,
    };
  }

  const dots = s.split('.').length - 1;
  if (dots === 0) return { ok: true, value: Number(s), fractionDigits: 0 };

  const asThousands = THOUSANDS.test(s) ? Number(s.replace(/\./g, '')) : undefined;
  const decimalMatch = dots === 1 ? /^(\d+)\.(\d+)$/.exec(s) : null;
  const asDecimal = decimalMatch ? Number(s) : undefined;
  const decimalDigits = decimalMatch?.[2]?.length ?? 0;

  if (asThousands !== undefined && asDecimal !== undefined) {
    // Nur ein Punkt, genau drei Ziffern dahinter: „5.100“
    if (decimals < 3) return { ok: true, value: asThousands, fractionDigits: 0 };
    if (lastValue === undefined) return { ok: true, value: asThousands, fractionDigits: 0 };
    const pick = closestNotBelow([asThousands, asDecimal], lastValue);
    return { ok: true, value: pick, fractionDigits: pick === asDecimal ? decimalDigits : 0 };
  }
  if (asThousands !== undefined) return { ok: true, value: asThousands, fractionDigits: 0 };
  if (asDecimal !== undefined) return { ok: true, value: asDecimal, fractionDigits: decimalDigits };
  return fail('Diese Zahl kann ich nicht lesen – bitte prüfen.');
}

function closestNotBelow(candidates: number[], reference: number): number {
  const notBelow = candidates.filter((c) => c >= reference);
  const pool = notBelow.length > 0 ? notBelow : candidates;
  return pool.reduce((best, c) =>
    Math.abs(c - reference) < Math.abs(best - reference) ? c : best,
  );
}
