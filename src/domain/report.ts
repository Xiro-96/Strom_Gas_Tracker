import { monthlyCosts, type ContractBundle, type MonthlyCost } from '@/domain/costAnalysis';
import { delivers, pricePeriodAt } from '@/domain/costs';
import { daysInYear, yearOf } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import type { ISODate } from '@/domain/types';

export interface YearReport {
  year: number;
  kwh: number;
  /** Tage mit Verbrauchswert im Jahr */
  days: number;
  energyEur: number;
  baseEur: number;
  /** im Jahr erhaltene oder verrechnete Boni */
  bonusEur: number;
  effectiveCt: number;
  months: (MonthlyCost & { kwh: number })[];
  contracts: { id: string; provider: string; tariffName: string; from: ISODate; to?: ISODate }[];
  lastDataDay?: ISODate;
}

const bonusDate = (b: ContractBundle['bonuses'][number], c: ContractBundle) =>
  b.status === 'received'
    ? b.receivedAt
    : b.status === 'offset'
      ? (b.receivedAt ?? c.deliveryEnd)
      : undefined;

/** Spec Phase 4 – Jahresbericht: Verbrauch, Kosten, Boni, Effektivpreis, Monate, Verträge. */
export function yearReport(input: {
  year: number;
  daily: readonly DailyPoint[];
  bundles: readonly ContractBundle[];
}): YearReport {
  const prefix = String(input.year);
  const days = input.daily.filter((p) => p.date.startsWith(prefix));
  let energyEur = 0;
  let baseEur = 0;
  for (const { date, kwh } of days) {
    const bundle = input.bundles.find((b) => delivers(b, date));
    const price = bundle ? pricePeriodAt(bundle.periods, date) : undefined;
    if (!price) continue;
    energyEur += (kwh * price.energyPriceCt) / 100;
    baseEur += price.basePriceEurPerYear / daysInYear(yearOf(date));
  }
  const kwh = days.reduce((s, p) => s + p.kwh, 0);
  const bonusEur = input.bundles
    .flatMap((c) => c.bonuses.map((b) => ({ b, date: bonusDate(b, c) })))
    .filter(({ date }) => date?.startsWith(prefix))
    .reduce((s, { b }) => s + (b.receivedAmountEur ?? b.amountEur), 0);
  const contracts = input.bundles
    .filter(
      (c) =>
        c.deliveryStart <= `${prefix}-12-31` &&
        (!c.deliveryEnd || c.deliveryEnd >= `${prefix}-01-01`),
    )
    .map((c) => ({
      id: c.id,
      provider: c.provider,
      tariffName: c.tariffName,
      from: c.deliveryStart,
      ...(c.deliveryEnd ? { to: c.deliveryEnd } : {}),
    }));
  const last = days.at(-1)?.date;
  return {
    year: input.year,
    kwh,
    days: days.length,
    energyEur,
    baseEur,
    bonusEur,
    effectiveCt: kwh > 0 ? ((energyEur + baseEur - bonusEur) / kwh) * 100 : NaN,
    months: monthlyCosts(days, input.bundles)
      .filter((m) => m.month.startsWith(prefix))
      .map((m) => ({
        ...m,
        kwh: days.filter((p) => p.date.startsWith(m.month)).reduce((s, p) => s + p.kwh, 0),
      })),
    contracts,
    ...(last ? { lastDataDay: last } : {}),
  };
}
