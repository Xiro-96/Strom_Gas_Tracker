import { addMonths, getDate } from 'date-fns';
import { addDays, daysBetween, fromISODate, toISODate } from '@/domain/dates';
import type { Bonus, ISODate } from '@/domain/types';

/**
 * Letzter Tag nach `months` Monaten ab `start` (inklusive), nach § 188 BGB: Vortag des Monatstags;
 * fehlt der Monatstag im Zielmonat (31.01. → Februar), endet die Frist am Monatsletzten.
 * Spec 6.6: „Lieferbeginn + n Monate − 1 Tag“.
 */
export function requiredDeliveryEnd(start: ISODate, months: number): ISODate {
  const startDate = fromISODate(start);
  const target = addMonths(startDate, months);
  if (getDate(target) !== getDate(startDate)) return toISODate(target); // auf Monatsende gekürzt
  return addDays(toISODate(target), -1);
}

export interface Duration {
  months: number;
  days: number;
}

/** Belieferte Dauer von `start` bis `lastDay` (beide inklusive) in Monaten und Resttagen. */
export function deliveredDuration(start: ISODate, lastDay: ISODate): Duration {
  let months = 0;
  while (requiredDeliveryEnd(start, months + 1) <= lastDay) months += 1;
  const lastFull = months === 0 ? addDays(start, -1) : requiredDeliveryEnd(start, months);
  return { months, days: daysBetween(lastFull, lastDay) };
}

export function formatDuration({ months, days }: Duration): string {
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} ${months === 1 ? 'Monat' : 'Monate'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'Tag' : 'Tage'}`);
  return parts.join(' und ') || '0 Tage';
}

export interface BonusSafety {
  /** true = gesichert, false = Bonus in Gefahr, null = noch kein Lieferende geplant. */
  ok: boolean | null;
  requiredEnd: ISODate;
  delivered?: Duration;
}

/** Spec 6.6 – Bonus-Sicherheitscheck: letzter Liefertag ≥ Lieferbeginn + n Monate − 1 Tag. */
export function bonusSafety(
  deliveryStart: ISODate,
  lastDeliveryDay: ISODate | undefined,
  months: number,
): BonusSafety {
  const requiredEnd = requiredDeliveryEnd(deliveryStart, months);
  if (!lastDeliveryDay) return { ok: null, requiredEnd };
  return {
    ok: lastDeliveryDay >= requiredEnd,
    requiredEnd,
    delivered: deliveredDuration(deliveryStart, lastDeliveryDay),
  };
}

/** Erwartete Fälligkeit: Sofortbonus spätestens 3 Monate nach Lieferbeginn, sonst nach n Liefermonaten. */
export function bonusExpectedDate(
  bonus: Pick<Bonus, 'kind'> & Partial<Pick<Bonus, 'requiresDeliveryMonths' | 'expectedDate'>>,
  deliveryStart: ISODate,
): ISODate {
  if (bonus.expectedDate) return bonus.expectedDate;
  const months = bonus.kind === 'instant' ? 3 : (bonus.requiresDeliveryMonths ?? 12);
  return toISODate(addMonths(fromISODate(deliveryStart), months));
}

/** Zugesagte Boni werden ab dem Fälligkeitstag als „fällig“ geführt (Erinnerung: eingegangen?). */
export function effectiveBonusStatus(
  bonus: Pick<Bonus, 'kind' | 'status'> &
    Partial<Pick<Bonus, 'requiresDeliveryMonths' | 'expectedDate'>>,
  deliveryStart: ISODate,
  today: ISODate,
): Bonus['status'] {
  if (bonus.status === 'promised' && today >= bonusExpectedDate(bonus, deliveryStart)) return 'due';
  return bonus.status;
}
