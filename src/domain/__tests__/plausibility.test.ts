import { checkReading, type PlausibilityInput } from '@/domain/plausibility';

const strom = { energyType: 'electricity' as const, decimals: 0 };
const history = [
  { date: '2026-01-01', value: 1000, kind: 'regular' as const },
  { date: '2026-01-11', value: 1100, kind: 'regular' as const },
  { date: '2026-01-21', value: 1200, kind: 'regular' as const },
  { date: '2026-01-31', value: 1300, kind: 'regular' as const },
];
const base: PlausibilityInput = {
  value: 1400,
  date: '2026-02-10',
  today: '2026-02-10',
  fractionDigits: 0,
  meter: strom,
  readings: history,
  baseLoadShare: 0.15,
};
const codes = (input: Partial<PlausibilityInput>) =>
  checkReading({ ...base, ...input }).issues.map((i) => `${i.level}:${i.code}`);

describe('checkReading – Testfall I', () => {
  it('Stand kleiner als vorher → Fehler', () => {
    expect(codes({ value: 1250 })).toContain('error:below_previous');
  });

  it('Tagesrate 3× Median → Warnung, Speichern bleibt möglich', () => {
    const result = checkReading({ ...base, value: 1300 + 300 });
    expect(result.issues.map((i) => `${i.level}:${i.code}`)).toEqual(['warning:rate_outlier']);
    expect(result.canSave).toBe(true);
  });

  it('normale Werte sind ohne Befund', () => {
    expect(codes({})).toEqual([]);
  });
});

describe('checkReading – weitere Regeln', () => {
  it('Datum in der Zukunft → Fehler', () => {
    expect(codes({ date: '2026-02-11' })).toContain('error:future_date');
    expect(checkReading({ ...base, date: '2026-02-11' }).canSave).toBe(false);
  });

  it('gleiches Datum wie vorhanden → Rückfrage „ersetzen?“', () => {
    expect(codes({ date: '2026-01-31', value: 1300 })).toEqual(['confirm:same_date']);
  });

  it('beim Bearbeiten zählt die eigene Ablesung nicht als Duplikat', () => {
    const readings = history.map((r, i) => ({ ...r, id: `r${i}` }));
    expect(codes({ readings, date: '2026-01-31', value: 1300, editingId: 'r3' })).toEqual([]);
  });

  it('nachgetragener Stand größer als der Folgestand → Fehler', () => {
    expect(codes({ date: '2026-01-15', value: 1250 })).toContain('error:above_next');
  });

  it('Rückgang mit Modulus → Überlauf-Rückfrage statt Fehler', () => {
    const result = checkReading({
      ...base,
      meter: { ...strom, rolloverModulus: 100000 },
      readings: [{ date: '2026-02-01', value: 99950, kind: 'regular' }],
      value: 30,
    });
    expect(result.issues.map((i) => `${i.level}:${i.code}`)).toEqual(['confirm:rollover']);
    expect(result.preview?.delta).toBe(80);
  });

  it('mehr Nachkommastellen als das Zählwerk → Hinweis', () => {
    expect(codes({ fractionDigits: 2, value: 1400.25 })).toContain('info:too_many_decimals');
  });

  it('liefert eine Vorschau mit Differenz, Tagen und kWh/Tag', () => {
    expect(checkReading(base).preview).toMatchObject({
      previousDate: '2026-01-31',
      delta: 100,
      days: 10,
      kwh: 100,
      perDay: 10,
    });
  });

  it('rechnet die Gas-Vorschau in kWh um und normiert den Median saisonal', () => {
    const gas = {
      energyType: 'gas' as const,
      decimals: 3,
      gasFactors: [{ validFrom: '2025-01-01', zFactor: 0.95, calorificValue: 11 }],
    };
    const readings = [
      { date: '2026-06-01', value: 100, kind: 'regular' as const },
      { date: '2026-06-15', value: 102, kind: 'regular' as const },
      { date: '2026-06-29', value: 104, kind: 'regular' as const },
      { date: '2026-07-13', value: 106, kind: 'regular' as const },
    ];
    // Im Januar ist deutlich mehr Verbrauch normal – das ist kein Ausreißer.
    const january = checkReading({
      ...base,
      meter: gas,
      readings,
      date: '2027-01-10',
      today: '2027-01-10',
      value: 191,
    });
    // Linear wären es 3,3× so viel pro Tag wie im Sommer – saisonal normiert ist das normal.
    expect(january.issues.map((i) => i.code)).not.toContain('rate_outlier');
    expect(january.preview?.kwh).toBeCloseTo(85 * 0.95 * 11, 9);
  });
});
