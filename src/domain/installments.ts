import { endOfMonth, getDaysInMonth } from 'date-fns';
import { fromISODate, toISODate } from '@/domain/dates';
import type { ISODate } from '@/domain/types';

export interface InstallmentEntry {
  validFrom: ISODate;
  amountEur: number;
  dayOfMonth: number;
}

/** Fällige Abschläge mit Datum in [from, to] laut Plan; Tag 29–31 in kurzen Monaten = Monatsende. */
export function installmentDueDates(
  plan: readonly InstallmentEntry[],
  from: ISODate,
  to: ISODate,
): { date: ISODate; amountEur: number }[] {
  const entries = [...plan].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const first = entries[0];
  if (!first) return [];
  const result: { date: ISODate; amountEur: number }[] = [];
  const cursor = fromISODate(`${first.validFrom.slice(0, 7)}-01`);
  const end = fromISODate(to);
  while (cursor <= end) {
    const monthStart = toISODate(cursor);
    const monthEnd = toISODate(endOfMonth(cursor));
    // Eintrag, der in diesem Monat gilt (spätestens am Monatsende gültig)
    const entry = entries.filter((e) => e.validFrom <= monthEnd).at(-1);
    if (entry) {
      const day = Math.min(entry.dayOfMonth, getDaysInMonth(cursor));
      const date = `${monthStart.slice(0, 8)}${String(day).padStart(2, '0')}`;
      if (date >= entry.validFrom && date >= from && date <= to)
        result.push({ date, amountEur: entry.amountEur });
    }
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

/** Bis `until` (inklusive) gezahlt: Abschläge laut Plan + Abweichungen als Transaktionen. */
export function paidUntil(
  plan: readonly InstallmentEntry[],
  transactions: readonly { date: ISODate; amountEur: number }[],
  until: ISODate,
  from = '0000-01-01',
): number {
  const planned = installmentDueDates(plan, from, until).reduce((s, d) => s + d.amountEur, 0);
  const extra = transactions
    .filter((t) => t.date >= from && t.date <= until)
    .reduce((s, t) => s + t.amountEur, 0);
  return planned + extra;
}

/** Spec 6.5 – Saldo = Prognosekosten − verrechnete Boni − Abschläge (> 0 Nachzahlung, < 0 Guthaben). */
export function balance({
  costEur,
  offsetBonusEur,
  installmentsEur,
}: {
  costEur: number;
  offsetBonusEur: number;
  installmentsEur: number;
}) {
  return costEur - offsetBonusEur - installmentsEur;
}

/** Empfohlener Abschlag = (Prognosekosten − verrechnete Boni − bereits gezahlt) ÷ verbleibende Abschläge. */
export function recommendedInstallment(input: {
  costEur: number;
  offsetBonusEur: number;
  paidEur: number;
  remaining: number;
}) {
  if (input.remaining <= 0) return NaN;
  return (input.costEur - input.offsetBonusEur - input.paidEur) / input.remaining;
}
