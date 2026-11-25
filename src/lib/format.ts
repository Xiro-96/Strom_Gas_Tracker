import type { ISODate } from '@/domain/types';

const LOCALE = 'de-DE';
const nf = (min: number, max: number) =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });

const eur = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' });
const kwh0 = nf(0, 0);
const perDay = nf(1, 1);
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const longDateFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const toLocalDate = (iso: ISODate) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

export const UNIT_LABEL = { kWh: 'kWh', m3: 'm³' } as const;

export function formatNumber(value: number, minDigits = 0, maxDigits = minDigits): string {
  return nf(minDigits, maxDigits).format(value);
}

export function formatEur(value: number): string {
  return eur.format(value);
}

export function formatKwh(value: number, digits = 0): string {
  return `${digits === 0 ? kwh0.format(value) : nf(digits, digits).format(value)} kWh`;
}

export function formatPerDay(value: number): string {
  return `${perDay.format(value)} kWh/Tag`;
}

export function formatMeterValue(value: number, decimals: number, unit: 'kWh' | 'm3'): string {
  return `${nf(decimals, decimals).format(value)} ${UNIT_LABEL[unit]}`;
}

/** Vorbelegung fürs Eingabefeld: ohne Tausenderpunkte, mit allen Nachkommastellen des Zählwerks. */
export function meterInputValue(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

export function formatDate(iso: ISODate): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

export function formatDateShort(iso: ISODate): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

export function formatDateLong(iso: ISODate): string {
  return longDateFmt.format(toLocalDate(iso));
}

/** 'YYYY-MM' → „März 2026“ */
export function formatMonth(month: string): string {
  return monthFmt.format(toLocalDate(`${month}-01`));
}

/** 'YYYY-MM' → „Mär“ */
export function formatMonthShort(month: string): string {
  return monthShortFmt.format(toLocalDate(`${month}-01`)).replace('.', '');
}

export function formatRelativeDays(days: number): string {
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

/** −0,06 → „−6 %“ (echtes Minuszeichen), 0 → „±0 %“ */
export function formatTrend(ratio: number): string {
  const pct = Math.round(ratio * 100);
  if (pct === 0) return '±0 %';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`;
}

/** 28.47 → „28,47 ct/kWh“ (2–4 Nachkommastellen, Spec 6.1) */
export function formatCt(value: number): string {
  return `${nf(2, 4).format(value)} ct/kWh`;
}

/** Saldo > 0 = Nachzahlung, < 0 = Guthaben */
export function describeBalance(eur: number): {
  label: 'Guthaben' | 'Nachzahlung' | 'Ausgeglichen';
  amount: string;
} {
  if (Math.abs(eur) < 0.5) return { label: 'Ausgeglichen', amount: formatEur(0) };
  return { label: eur < 0 ? 'Guthaben' : 'Nachzahlung', amount: formatEur(Math.abs(eur)) };
}
