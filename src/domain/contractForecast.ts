import { bonusSafety, requiredDeliveryEnd } from '@/domain/bonus';
import {
  costBreakdown,
  effectivePriceCt,
  type CostBreakdown,
  type PriceLike,
} from '@/domain/costs';
import { addDays, maxDate } from '@/domain/dates';
import type { DailyPoint } from '@/domain/distribution';
import { projectedDaily } from '@/domain/forecast';
import {
  balance,
  installmentDueDates,
  paidUntil,
  recommendedInstallment,
  type InstallmentEntry,
} from '@/domain/installments';
import type { Bonus, BonusKind, EnergyType, ISODate } from '@/domain/types';

export interface ContractForecastInput {
  contract: {
    energyType: EnergyType;
    deliveryStart: ISODate;
    deliveryEnd?: ISODate;
    installmentPlan: InstallmentEntry[];
  };
  periods: readonly PriceLike[];
  bonuses: readonly (Pick<Bonus, 'kind' | 'amountEur' | 'settlement' | 'status'> &
    Partial<Pick<Bonus, 'requiresDeliveryMonths'>>)[];
  transactions: readonly { date: ISODate; amountEur: number }[];
  /** Tatsächliche Tageswerte (aus Ablesungen). */
  daily: readonly DailyPoint[];
  /** Jahresprognose in kWh für den Rest des Zeitraums; null = keine Prognose möglich. */
  annualKwh: number | null;
  baseLoadShare: number;
  today: ISODate;
}

export interface BonusWarning {
  kind: BonusKind;
  amountEur: number;
  requiredEnd: ISODate;
}

export interface ContractForecast {
  periodFrom: ISODate;
  /** Letzter Tag des Abrechnungszeitraums (inklusive). */
  periodTo: ISODate;
  actual: CostBreakdown;
  projectedKwh: number;
  total: CostBreakdown;
  /** Alle Boni des Vertrags (ohne verfallene/strittige). */
  bonusEur: number;
  /** Davon mit der Rechnung verrechnet – nur diese mindern den Saldo. */
  offsetBonusEur: number;
  /** Boni, deren Mindestbelieferung mit dem geplanten Lieferende nicht erreicht wird. */
  bonusWarnings: BonusWarning[];
  installmentsEur: number;
  paidEur: number;
  remainingInstallments: number;
  balanceEur: number;
  recommendedEur: number;
  effective: ReturnType<typeof effectivePriceCt>;
}

/** Abrechnungszeitraum: bis Lieferende, sonst das Vertragsjahr, in dem `today` liegt. */
export function contractPeriod(
  contract: { deliveryStart: ISODate; deliveryEnd?: ISODate },
  today: ISODate,
) {
  if (contract.deliveryEnd) return { from: contract.deliveryStart, to: contract.deliveryEnd };
  let year = 1;
  while (requiredDeliveryEnd(contract.deliveryStart, 12 * year) < today) year += 1;
  const from =
    year === 1
      ? contract.deliveryStart
      : addDays(requiredDeliveryEnd(contract.deliveryStart, 12 * (year - 1)), 1);
  return { from, to: requiredDeliveryEnd(contract.deliveryStart, 12 * year) };
}

const COUNTED: Bonus['status'][] = ['promised', 'due', 'received', 'offset'];

/** Spec 6.4/6.5 – Kostenprognose bis Lieferende, Saldo und empfohlener Abschlag. */
export function contractForecast(input: ContractForecastInput): ContractForecast {
  const { contract, periods, today } = input;
  const { from: periodFrom, to: periodTo } = contractPeriod(contract, today);
  const end = addDays(periodTo, 1);

  const actualDaily = input.daily.filter((p) => p.date >= periodFrom && p.date < end);
  const lastActual = actualDaily.at(-1)?.date;
  const projectFrom = lastActual ? maxDate(addDays(lastActual, 1), periodFrom) : periodFrom;
  const projected =
    input.annualKwh !== null && projectFrom < end
      ? projectedDaily(input.annualKwh, projectFrom, end, {
          energyType: contract.energyType,
          baseLoadShare: input.baseLoadShare,
        })
      : [];

  const actual = costBreakdown(
    actualDaily,
    contract,
    periods,
    periodFrom,
    lastActual ? addDays(lastActual, 1) : periodFrom,
  );
  const total = costBreakdown([...actualDaily, ...projected], contract, periods, periodFrom, end);
  const projectedKwh = projected.reduce((s, p) => s + p.kwh, 0);

  const bonusWarnings: BonusWarning[] = [];
  let bonusEur = 0;
  let offsetBonusEur = 0;
  for (const bonus of input.bonuses) {
    if (!COUNTED.includes(bonus.status)) continue;
    if (bonus.requiresDeliveryMonths) {
      const safety = bonusSafety(
        contract.deliveryStart,
        contract.deliveryEnd,
        bonus.requiresDeliveryMonths,
      );
      if (safety.ok === false) {
        bonusWarnings.push({
          kind: bonus.kind,
          amountEur: bonus.amountEur,
          requiredEnd: safety.requiredEnd,
        });
        continue;
      }
    }
    bonusEur += bonus.amountEur;
    if (bonus.settlement === 'offset_in_bill') offsetBonusEur += bonus.amountEur;
  }

  const due = installmentDueDates(contract.installmentPlan, periodFrom, periodTo);
  const txInPeriod = input.transactions.filter((t) => t.date >= periodFrom && t.date <= periodTo);
  const installmentsEur =
    due.reduce((s, d) => s + d.amountEur, 0) + txInPeriod.reduce((s, t) => s + t.amountEur, 0);
  const paidEur = paidUntil(
    contract.installmentPlan,
    input.transactions,
    today < periodTo ? today : periodTo,
    periodFrom,
  );
  const remainingInstallments = due.filter((d) => d.date > today).length;
  const costEur = total.totalEur;

  return {
    periodFrom,
    periodTo,
    actual,
    projectedKwh,
    total,
    bonusEur,
    offsetBonusEur,
    bonusWarnings,
    installmentsEur,
    paidEur,
    remainingInstallments,
    balanceEur: balance({ costEur, offsetBonusEur, installmentsEur }),
    recommendedEur: recommendedInstallment({
      costEur,
      offsetBonusEur,
      paidEur,
      remaining: remainingInstallments,
    }),
    effective: effectivePriceCt({
      kwh: total.kwh,
      energyEur: total.energyEur,
      baseEur: total.baseEur,
      bonusEur,
    }),
  };
}
