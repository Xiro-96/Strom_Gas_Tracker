import {
  addDays as addDaysFns,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isValid,
  parseISO,
} from 'date-fns';
import type { ISODate } from '@/domain/types';

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Lokales Datum (Mitternacht) – date-fns liest reine Datumsstrings als lokale Zeit. */
export function fromISODate(date: ISODate): Date {
  return parseISO(date);
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function isISODate(value: string): boolean {
  if (!ISO_PATTERN.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && toISODate(parsed) === value;
}

/** Kalendertage von a bis b (b − a). Nie über Millisekunden rechnen (Sommerzeit). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISODate(addDaysFns(parseISO(date), days));
}

/** Alle Tage im halboffenen Intervall [from, to). */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = [];
  const count = daysBetween(from, to);
  const start = parseISO(from);
  for (let i = 0; i < count; i++) days.push(toISODate(addDaysFns(start, i)));
  return days;
}

export function yearOf(date: ISODate): number {
  return Number(date.slice(0, 4));
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

export function daysInMonth(date: ISODate): number {
  return getDaysInMonth(parseISO(date));
}

/** Tag im Jahr, 1-basiert (1. Januar = 1). */
export function dayOfYear(date: ISODate): number {
  return daysBetween(`${date.slice(0, 4)}-01-01`, date) + 1;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}
