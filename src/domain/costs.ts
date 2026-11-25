import { daysInYear, eachDay, yearOf } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import type { ISODate, PricePeriod } from '@/domain/types';

export type PriceLike = Pick<PricePeriod, 'validFrom' | 'energyPriceCt' | 'basePriceEurPerYear'>;
export interface DeliveryLike {
  deliveryStart: ISODate;
  /** Letzter Liefertag (inklusive). */
  deliveryEnd?: ISODate;
}

/** Preisperiode, die am Tag gilt (zuletzt „gültig ab“ ≤ Tag). */
export function pricePeriodAt<T extends PriceLike>(
  periods: readonly T[],
  date: ISODate,
): T | undefined {
  return [...periods]
    .filter((p) => p.validFrom <= date)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1);
}

export function delivers(contract: DeliveryLike, date: ISODate): boolean {
  return date >= contract.deliveryStart && (!contract.deliveryEnd || date <= contract.deliveryEnd);
}

export interface CostBreakdown {
  from: ISODate;
  to: ISODate;
  /** Vertragstage im Zeitraum. */
  days: number;
  /** davon mit Verbrauchswert. */
  coveredDays: number;
  /** Vertragstage ohne Verbrauchswert (z. B. seit der letzten Ablesung). */
  missingDays: number;
  kwh: number;
  energyEur: number;
  baseEur: number;
  totalEur: number;
}

/**
 * Spec 6.3 – Kosten(d) = kWh(d) × Arbeitspreis(d) ÷ 100 + Grundpreis_Jahr(d) ÷ Tage_im_Kalenderjahr(d)
 * für jeden Vertragstag in [from, to). Tage ohne Vertrag zählen nicht (Lücke, nie 0 €).
 */
export function costBreakdown(
  daily: readonly DailyPoint[],
  contract: DeliveryLike,
  periods: readonly PriceLike[],
  from: ISODate,
  to: ISODate,
): CostBreakdown {
  const kwhByDay = new Map(daily.map((p) => [p.date, p.kwh]));
  const sorted = [...periods].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const result: CostBreakdown = {
    from,
    to,
    days: 0,
    coveredDays: 0,
    missingDays: 0,
    kwh: 0,
    energyEur: 0,
    baseEur: 0,
    totalEur: 0,
  };
  for (const day of eachDay(from, to)) {
    if (!delivers(contract, day)) continue;
    const price = sorted.filter((p) => p.validFrom <= day).at(-1);
    if (!price) continue;
    result.days += 1;
    result.baseEur += price.basePriceEurPerYear / daysInYear(yearOf(day));
    const kwh = kwhByDay.get(day);
    if (kwh === undefined) {
      result.missingDays += 1;
      continue;
    }
    result.coveredDays += 1;
    result.kwh += kwh;
    result.energyEur += (kwh * price.energyPriceCt) / 100;
  }
  result.totalEur = result.energyEur + result.baseEur;
  return result;
}

/** Effektivpreis = (Arbeitskosten + Grundkosten − Boni) ÷ kWh × 100 (Spec 6.3). */
export function effectivePriceCt(input: {
  kwh: number;
  energyEur: number;
  baseEur: number;
  bonusEur: number;
}) {
  const totalWithoutBonusEur = input.energyEur + input.baseEur;
  const totalWithBonusEur = totalWithoutBonusEur - input.bonusEur;
  return {
    totalWithoutBonusEur,
    totalWithBonusEur,
    withoutBonusCt: input.kwh > 0 ? (totalWithoutBonusEur / input.kwh) * 100 : NaN,
    withBonusCt: input.kwh > 0 ? (totalWithBonusEur / input.kwh) * 100 : NaN,
  };
}
