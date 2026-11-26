import {
  describeBalance,
  formatCt,
  formatDate,
  formatDateShort,
  formatEur,
  formatKwh,
  formatMeterValue,
  formatMonth,
  formatPerDay,
  formatRelativeDays,
  formatTrend,
  meterInputValue,
} from '@/lib/format';

// Intl nutzt geschützte Leerzeichen (U+202F/U+00A0) vor Einheiten – für Tests normalisieren.
const n = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('format (de-DE)', () => {
  it('formatiert Geld, Energie und Zählerstände deutsch', () => {
    expect(n(formatEur(1234.564))).toBe('1.234,56 €');
    expect(n(formatKwh(3430.4))).toBe('3.430 kWh');
    expect(n(formatPerDay(9.44))).toBe('9,4 kWh/Tag');
    expect(n(formatMeterValue(12345.678, 3, 'm3'))).toBe('12.345,678 m³');
    expect(n(formatMeterValue(14321.6, 1, 'kWh'))).toBe('14.321,6 kWh');
  });

  it('formatiert Daten und Monate', () => {
    expect(formatDate('2026-11-25')).toBe('25.11.2026');
    expect(formatDateShort('2026-03-05')).toBe('05.03.');
    expect(formatMonth('2026-03')).toBe('März 2026');
  });

  it('beschreibt Abstände in Tagen menschlich', () => {
    expect(formatRelativeDays(0)).toBe('heute');
    expect(formatRelativeDays(1)).toBe('gestern');
    expect(formatRelativeDays(16)).toBe('vor 16 Tagen');
  });

  it('zeigt Trends mit Vorzeichen', () => {
    expect(n(formatTrend(-0.06))).toBe('−6 %');
    expect(n(formatTrend(0.04))).toBe('+4 %');
    expect(n(formatTrend(0))).toBe('±0 %');
  });

  it('bereitet den letzten Stand fürs Eingabefeld auf', () => {
    expect(meterInputValue(14321.6, 1)).toBe('14321,6');
    expect(meterInputValue(21234.56, 3)).toBe('21234,560');
    expect(meterInputValue(1234, 0)).toBe('1234');
  });

  it('formatiert Preise und Salden', () => {
    expect(formatCt(30.50523, 2)).toBe('30,51 ct/kWh');
    expect(formatCt(28.47)).toBe('28,47 ct/kWh');
    expect(formatCt(9.0512)).toBe('9,0512 ct/kWh');
    expect(describeBalance(-160).label).toBe('Guthaben');
    expect(n(describeBalance(-160).amount)).toBe('160,00 €');
    expect(describeBalance(42).label).toBe('Nachzahlung');
    expect(describeBalance(0.2).label).toBe('Ausgeglichen');
  });
});
