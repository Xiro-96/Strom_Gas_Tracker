import { contractForecast } from '@/domain/contractForecast';
import {
  costBreakdown,
  delivers,
  effectivePriceCt,
  pricePeriodAt,
  type PriceLike,
} from '@/domain/costs';
import { addDays, daysInYear, eachDay, maxDate, minDate, monthKey, yearOf } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import { projectedDaily } from '@/domain/forecast';
import { installmentDueDates, type InstallmentEntry } from '@/domain/installments';
import type { Bonus, EnergyType, ISODate } from '@/domain/types';

export interface ContractBundle {
  id: string;
  provider: string;
  tariffName: string;
  energyType: EnergyType;
  deliveryStart: ISODate;
  deliveryEnd?: ISODate;
  installmentPlan: InstallmentEntry[];
  periods: PriceLike[];
  bonuses: (Pick<Bonus, 'kind' | 'amountEur' | 'settlement' | 'status'> &
    Partial<Pick<Bonus, 'requiresDeliveryMonths' | 'receivedAt' | 'receivedAmountEur'>>)[];
  transactions: { date: ISODate; amountEur: number }[];
}

export interface MonthlyCost {
  month: string;
  energyEur: number;
  baseEur: number;
  /** Negativ: erhaltene bzw. verrechnete Boni in diesem Monat. */
  bonusEur: number;
  installmentEur: number;
  /** Tage mit Verbrauch, aber ohne Vertrag (Lücke, nie 0 €). */
  uncoveredDays: number;
}

const bonusDate = (
  bonus: ContractBundle['bonuses'][number],
  contract: ContractBundle,
): ISODate | undefined => {
  if (bonus.status === 'received') return bonus.receivedAt;
  if (bonus.status === 'offset') return bonus.receivedAt ?? contract.deliveryEnd;
  return undefined;
};

/** Diagramm 4: Kosten je Monat (Arbeits- und Grundpreis), Boni negativ, Abschläge. */
export function monthlyCosts(
  daily: readonly DailyPoint[],
  bundles: readonly ContractBundle[],
): MonthlyCost[] {
  const months = new Map<string, MonthlyCost>();
  const get = (month: string) => {
    let entry = months.get(month);
    if (!entry) {
      entry = { month, energyEur: 0, baseEur: 0, bonusEur: 0, installmentEur: 0, uncoveredDays: 0 };
      months.set(month, entry);
    }
    return entry;
  };
  for (const { date, kwh } of daily) {
    const entry = get(monthKey(date));
    const bundle = bundles.find((b) => delivers(b, date));
    const price = bundle ? pricePeriodAt(bundle.periods, date) : undefined;
    if (!price) {
      entry.uncoveredDays += 1;
      continue;
    }
    entry.energyEur += (kwh * price.energyPriceCt) / 100;
    entry.baseEur += price.basePriceEurPerYear / daysInYear(yearOf(date));
  }
  const first = daily[0]?.date;
  const last = daily.at(-1)?.date;
  if (first && last) {
    for (const bundle of bundles) {
      // Abschläge nur innerhalb der Vertragslaufzeit und des betrachteten Zeitraums
      const from = maxDate(first, bundle.deliveryStart);
      const to = bundle.deliveryEnd ? minDate(last, bundle.deliveryEnd) : last;
      for (const due of installmentDueDates(bundle.installmentPlan, from, to)) {
        get(monthKey(due.date)).installmentEur += due.amountEur;
      }
      for (const tx of bundle.transactions) {
        if (tx.date >= first && tx.date <= last)
          get(monthKey(tx.date)).installmentEur += tx.amountEur;
      }
      for (const bonus of bundle.bonuses) {
        const date = bonusDate(bonus, bundle);
        if (date && date >= first && date <= last)
          get(monthKey(date)).bonusEur -= bonus.receivedAmountEur ?? bonus.amountEur;
      }
    }
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface CumulativePoint {
  date: ISODate;
  costEur: number;
  installmentsEur: number;
  projected: boolean;
}

/** Diagramm 5: kumulierte Kosten (Ist, danach Prognose) gegen kumulierte Abschläge im Vertragszeitraum. */
export function cumulativeCostSeries(input: {
  bundle: ContractBundle;
  daily: readonly DailyPoint[];
  annualKwh: number | null;
  baseLoadShare: number;
  today: ISODate;
  weight?: ((date: ISODate) => number) | undefined;
}): CumulativePoint[] {
  const { bundle } = input;
  const forecast = contractForecast({
    contract: bundle,
    periods: bundle.periods,
    bonuses: bundle.bonuses,
    transactions: bundle.transactions,
    daily: input.daily,
    annualKwh: input.annualKwh,
    baseLoadShare: input.baseLoadShare,
    today: input.today,
    weight: input.weight,
  });
  const end = addDays(forecast.periodTo, 1);
  const actual = input.daily.filter((p) => p.date >= forecast.periodFrom && p.date < end);
  const lastActual = actual.at(-1)?.date;
  const projectFrom = lastActual ? addDays(lastActual, 1) : forecast.periodFrom;
  const projected =
    input.annualKwh !== null && projectFrom < end
      ? projectedDaily(input.annualKwh, projectFrom, end, {
          energyType: bundle.energyType,
          baseLoadShare: input.baseLoadShare,
          ...(input.weight ? { weight: input.weight } : {}),
        })
      : [];
  const kwhByDay = new Map([...actual, ...projected].map((p) => [p.date, p.kwh]));
  const payments = new Map<ISODate, number>();
  for (const due of installmentDueDates(
    bundle.installmentPlan,
    forecast.periodFrom,
    forecast.periodTo,
  )) {
    payments.set(due.date, (payments.get(due.date) ?? 0) + due.amountEur);
  }
  for (const tx of bundle.transactions)
    payments.set(tx.date, (payments.get(tx.date) ?? 0) + tx.amountEur);

  const points: CumulativePoint[] = [];
  let cost = 0;
  let paid = 0;
  for (const date of eachDay(forecast.periodFrom, end)) {
    const price = pricePeriodAt(bundle.periods, date);
    const kwh = kwhByDay.get(date);
    if (price) {
      cost += price.basePriceEurPerYear / daysInYear(yearOf(date));
      if (kwh !== undefined) cost += (kwh * price.energyPriceCt) / 100;
    }
    paid += payments.get(date) ?? 0;
    points.push({
      date,
      costEur: cost,
      installmentsEur: paid,
      projected: !lastActual || date > lastActual,
    });
  }
  return points;
}

export interface EffectivePriceEntry {
  contractId: string;
  label: string;
  provider: string;
  year: number;
  withBonusCt: number;
  withoutBonusCt: number;
  kwh: number;
  /** false = Vertragsjahr läuft noch (Prognose). */
  complete: boolean;
}

/** Diagramm 7: Effektivpreis je Vertragsjahr mit und ohne Bonus. */
export function effectivePriceHistory(
  entries: readonly {
    bundle: ContractBundle;
    kwh: number;
    energyEur: number;
    baseEur: number;
    bonusEur: number;
    complete: boolean;
  }[],
): EffectivePriceEntry[] {
  return entries
    .map(({ bundle, kwh, energyEur, baseEur, bonusEur, complete }) => {
      const price = effectivePriceCt({ kwh, energyEur, baseEur, bonusEur });
      const year = yearOf(bundle.deliveryStart);
      return {
        contractId: bundle.id,
        label: `${bundle.provider} ${year}`,
        provider: bundle.provider,
        year,
        withBonusCt: price.withBonusCt,
        withoutBonusCt: price.withoutBonusCt,
        kwh,
        complete,
      };
    })
    .sort((a, b) => a.year - b.year);
}

/** Übersicht: Kosten des laufenden Monats bis heute – Ist bis zur letzten Ablesung, danach geschätzt. */
export function monthToDateCost(input: {
  bundles: readonly ContractBundle[];
  daily: readonly DailyPoint[];
  annualKwh: number | null;
  energyType: EnergyType;
  baseLoadShare: number;
  today: ISODate;
  weight?: ((date: ISODate) => number) | undefined;
}): { totalEur: number; kwh: number; days: number; estimatedDays: number } | null {
  const from = `${monthKey(input.today)}-01`;
  const end = addDays(input.today, 1);
  const actual = input.daily.filter((p) => p.date >= from && p.date < end);
  const lastAll = input.daily.at(-1)?.date;
  const projectFrom = lastAll && lastAll >= from ? addDays(lastAll, 1) : from;
  const projected =
    input.annualKwh !== null && projectFrom < end
      ? projectedDaily(input.annualKwh, projectFrom, end, {
          energyType: input.energyType,
          baseLoadShare: input.baseLoadShare,
          ...(input.weight ? { weight: input.weight } : {}),
        })
      : [];
  const series = [...actual, ...projected];
  let result: { totalEur: number; kwh: number; days: number; estimatedDays: number } | null = null;
  for (const bundle of input.bundles) {
    const part = costBreakdown(series, bundle, bundle.periods, from, end);
    if (part.days === 0) continue;
    result ??= { totalEur: 0, kwh: 0, days: 0, estimatedDays: 0 };
    result.totalEur += part.totalEur;
    result.kwh += part.kwh;
    result.days += part.days;
  }
  if (result) result.estimatedDays = projected.length;
  return result;
}
