import { parseMeterInput } from '@/domain/parse';

const value = (input: string, opts: Parameters<typeof parseMeterInput>[1]) => {
  const result = parseMeterInput(input, opts);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe('parseMeterInput – Testfall I', () => {
  it('liest deutsche Schreibweisen mit Tausenderpunkt und Dezimalkomma', () => {
    expect(value('12.345,678', { decimals: 3 })).toBe(12345.678);
    expect(value('12345,678', { decimals: 3 })).toBe(12345.678);
    expect(value('5.100,5', { decimals: 1 })).toBe(5100.5);
  });

  it('liest „1.234“ am Stromzähler ohne Nachkommastellen als 1234', () => {
    expect(value('1.234', { decimals: 0 })).toBe(1234);
  });
});

describe('parseMeterInput – Robustheit', () => {
  it('ignoriert Leerzeichen und akzeptiert ganze Zahlen', () => {
    expect(value(' 14 321,6 ', { decimals: 1 })).toBe(14321.6);
    expect(value('42', { decimals: 0 })).toBe(42);
  });

  it('löst „5.100“ am Gaszähler (3 Nachkommastellen) über den letzten Stand auf', () => {
    expect(value('5.100', { decimals: 3, lastValue: 5000 })).toBe(5100);
    expect(value('5.100', { decimals: 3, lastValue: 5.05 })).toBe(5.1);
  });

  it('nimmt bei Punkt mit 1–2 Nachkommastellen den Punkt als Dezimaltrenner', () => {
    expect(value('14321.6', { decimals: 1 })).toBe(14321.6);
  });

  it('meldet die Zahl der Nachkommastellen', () => {
    const result = parseMeterInput('100,1234', { decimals: 3 });
    expect(result.ok && result.fractionDigits).toBe(4);
  });

  it('lehnt Unsinn, negative Werte und mehrere Kommas ab', () => {
    expect(parseMeterInput('', { decimals: 1 }).ok).toBe(false);
    expect(parseMeterInput('abc', { decimals: 1 }).ok).toBe(false);
    expect(parseMeterInput('-5', { decimals: 1 }).ok).toBe(false);
    expect(parseMeterInput('1,2,3', { decimals: 1 }).ok).toBe(false);
    expect(parseMeterInput('1.23.4', { decimals: 1 }).ok).toBe(false);
  });
});
