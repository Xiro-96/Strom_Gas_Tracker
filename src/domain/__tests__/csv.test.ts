import { parseReadingsCsv, toReadingsCsv } from '@/domain/csv';

describe('parseReadingsCsv', () => {
  it('liest Excel-DE mit Kopfzeile, Semikolon und Dezimalkomma', () => {
    const csv = 'Datum;Energie;Stand\n03.11.2025;Strom;12.345,6\n03.11.2025;Gas;5000,125\n';
    expect(parseReadingsCsv(csv)).toEqual({
      rows: [
        { line: 2, date: '2025-11-03', energyType: 'electricity', value: 12345.6 },
        { line: 3, date: '2025-11-03', energyType: 'gas', value: 5000.125 },
      ],
      errors: [],
    });
  });

  it('akzeptiert Tabs, ISO-Datum, Spalten in anderer Reihenfolge und Notizen', () => {
    const csv = 'Stand\tDatum\tZähler\tNotiz\n100,5\t2026-01-02\tgas\tvom Foto\n';
    expect(parseReadingsCsv(csv).rows).toEqual([
      { line: 2, date: '2026-01-02', energyType: 'gas', value: 100.5, note: 'vom Foto' },
    ]);
  });

  it('funktioniert ohne Kopfzeile in der Standardreihenfolge Datum;Energie;Stand', () => {
    expect(parseReadingsCsv('1.2.2026;Strom;42').rows).toEqual([
      { line: 1, date: '2026-02-01', energyType: 'electricity', value: 42 },
    ]);
  });

  it('meldet fehlerhafte Zeilen mit Zeilennummer und überspringt Leerzeilen', () => {
    const csv =
      'Datum;Energie;Stand\n31.02.2026;Strom;1\n\n01.03.2026;Wasser;1\n02.03.2026;Gas;abc\n';
    const { rows, errors } = parseReadingsCsv(csv);
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 4, 5]);
  });

  it('verlangt Semikolon oder Tab als Trennzeichen', () => {
    expect(parseReadingsCsv('01.03.2026,Strom,1').errors[0]?.message).toMatch(/Semikolon/);
  });
});

describe('toReadingsCsv', () => {
  it('erzeugt eine Datei, die parseReadingsCsv wieder einliest', () => {
    const rows = [
      { date: '2025-11-03', energyType: 'electricity' as const, value: 14321.6 },
      { date: '2025-11-03', energyType: 'gas' as const, value: 21234.567 },
    ];
    const csv = toReadingsCsv(rows);
    expect(csv.split('\r\n')[0]).toBe('Datum;Energie;Stand');
    expect(csv).toContain('03.11.2025;Strom;14321,6');
    expect(parseReadingsCsv(csv).rows.map(({ line: _line, ...rest }) => rest)).toEqual(rows);
  });
});
