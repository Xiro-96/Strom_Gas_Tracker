import type { ContractBundle } from '@/domain/costAnalysis';
import { delivers, pricePeriodAt, type PriceLike } from '@/domain/costs';
import { daysInYear, yearOf } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import type { ISODate } from '@/domain/types';

export interface SwitchSavings {
  since: ISODate;
  days: number;
  referenceEur: number;
  actualEur: number;
  bonusEur: number;
  /** Referenzkosten − (tatsächliche Kosten − Boni); negativ = Mehrkosten */
  savedEur: number;
}

const COUNTED = ['received', 'offset'];

/**
 * Spec Phase 4 – Wechsel-Bilanz: „Durch Wechseln gespart seit …“ gegenüber dem Referenztarif.
 * Jeder Tag mit Verbrauch und liefernder Preisperiode zählt; Tage ohne Vertrag sind Lücken.
 * Boni zählen erst, wenn sie erhalten oder verrechnet sind.
 */
export function switchSavings(input: {
  bundles: readonly ContractBundle[];
  daily: readonly DailyPoint[];
  reference: Pick<PriceLike, 'energyPriceCt' | 'basePriceEurPerYear'>;
}): SwitchSavings | null {
  let since: ISODate | undefined;
  let days = 0;
  let referenceEur = 0;
  let actualEur = 0;
  for (const { date, kwh } of input.daily) {
    const bundle = input.bundles.find((b) => delivers(b, date));
    const price = bundle ? pricePeriodAt(bundle.periods, date) : undefined;
    if (!price) continue;
    since ??= date;
    days += 1;
    const yearDays = daysInYear(yearOf(date));
    referenceEur +=
      (kwh * input.reference.energyPriceCt) / 100 + input.reference.basePriceEurPerYear / yearDays;
    actualEur += (kwh * price.energyPriceCt) / 100 + price.basePriceEurPerYear / yearDays;
  }
  if (!since) return null;
  const bonusEur = input.bundles
    .flatMap((b) => b.bonuses)
    .filter((b) => COUNTED.includes(b.status))
    .reduce((s, b) => s + (b.receivedAmountEur ?? b.amountEur), 0);
  return {
    since,
    days,
    referenceEur,
    actualEur,
    bonusEur,
    savedEur: referenceEur - (actualEur - bonusEur),
  };
}
