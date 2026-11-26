import { addMonths } from 'date-fns';
import { addDays, fromISODate, toISODate } from '@/domain/dates';
import type { Contract, ISODate, PricePeriod } from '@/domain/types';

/** Anzeigestatus aus den Daten statt aus einem gespeicherten Feld, das veralten kann. */
export function contractStatus(
  contract: Pick<Contract, 'deliveryStart' | 'status'> &
    Partial<Pick<Contract, 'deliveryEnd' | 'cancellation'>>,
  today: ISODate,
): Contract['status'] {
  if (contract.deliveryEnd && contract.deliveryEnd < today) return 'ended';
  if (contract.cancellation?.sentAt || contract.status === 'cancelled') return 'cancelled';
  if (contract.deliveryStart > today) return 'planned';
  return 'active';
}

/**
 * Spec 4.4 – Preisänderung: Sonderkündigungsrecht ohne Frist zum Wirksamwerden (§ 41 Abs. 5 EnWG);
 * Deadline = Tag vor Wirksamwerden. Mitteilung muss mindestens 1 Monat vorher kommen.
 */
export function priceChangeNotice(
  period: Pick<PricePeriod, 'validFrom'> & Partial<Pick<PricePeriod, 'changeNoticeReceivedAt'>>,
  today: ISODate,
) {
  const latestNotice = toISODate(addMonths(fromISODate(period.validFrom), -1));
  return {
    effectiveFrom: period.validFrom,
    deadline: addDays(period.validFrom, -1),
    lateNotice: period.changeNoticeReceivedAt
      ? period.changeNoticeReceivedAt > latestNotice
      : false,
    open: today < period.validFrom,
  };
}
