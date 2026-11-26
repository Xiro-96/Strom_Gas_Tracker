import { useMemo } from 'react';
import { useContractData, type ContractData } from '@/data/hooks';
import { contractForecast, type ContractForecast } from '@/domain/contractForecast';
import {
  cumulativeCostSeries,
  effectivePriceHistory,
  monthlyCosts,
  monthToDateCost,
  type ContractBundle,
  type CumulativePoint,
  type EffectivePriceEntry,
  type MonthlyCost,
} from '@/domain/costAnalysis';
import { annualCostEur, delivers, pricePeriodAt } from '@/domain/costs';
import { todayISO } from '@/domain/dates';
import { forecastAnnual, type AnnualForecast } from '@/domain/forecast';
import { installmentTransactions } from '@/domain/installments';
import { switchSavings, type SwitchSavings } from '@/domain/savings';
import type { Contract, EnergyType } from '@/domain/types';
import { useEnergyData } from '@/features/shared/useEnergyData';

export interface EnergyCosts {
  energyType: EnergyType;
  bundles: ContractBundle[];
  /** Vertrag, der heute liefert – sonst der zuletzt begonnene. */
  current?: ContractBundle;
  currentForecast?: ContractForecast;
  /** Prognose je Vertrag (Schlüssel: Vertrags-ID). */
  forecasts: Partial<Record<string, ContractForecast>>;
  annual: AnnualForecast | null;
  /** Jahreskosten der Prognose zum heute gültigen Preis (ohne Boni). */
  annualCostEur: number | null;
  /** Vertrag, der heute liefert (für Kosten und Abschlags-Check in der Übersicht). */
  active?: ContractBundle;
  monthToDate: ReturnType<typeof monthToDateCost>;
  /** Wechsel-Bilanz ggü. Referenztarif (nur mit Referenztarif) */
  savings: SwitchSavings | null;
  monthly: MonthlyCost[];
  cumulative: CumulativePoint[];
  effective: EffectivePriceEntry[];
}

export function toBundle(contract: Contract, data: ContractData): ContractBundle {
  return {
    id: contract.id,
    provider: contract.provider,
    tariffName: contract.tariffName,
    energyType: contract.energyType,
    deliveryStart: contract.deliveryStart,
    ...(contract.deliveryEnd ? { deliveryEnd: contract.deliveryEnd } : {}),
    installmentPlan: contract.installmentPlan,
    periods: data.pricePeriods.filter((p) => p.contractId === contract.id),
    bonuses: data.bonuses.filter((b) => b.contractId === contract.id),
    transactions: installmentTransactions(
      data.transactions.filter((t) => t.contractId === contract.id),
    ),
  };
}

/** Verbrauch × Verträge → Kosten, Prognose, Saldo und Diagrammreihen je Energieart (memoisiert). */
export function useCostData() {
  const energy = useEnergyData();
  const contracts = useContractData();
  return useMemo(() => {
    if (energy.status === 'loading' || !contracts) return { status: 'loading' as const };
    const today = todayISO();
    const byEnergy: Partial<Record<EnergyType, EnergyCosts>> = {};
    for (const energyType of ['electricity', 'gas'] as const) {
      const analysis = energy.analyses[energyType];
      const bundles = contracts.contracts
        .filter((c) => c.energyType === energyType)
        .map((c) => toBundle(c, contracts));
      if (!analysis && bundles.length === 0) continue;
      const daily = analysis?.daily ?? [];
      const annual = analysis
        ? forecastAnnual(daily, analysis.intervals, {
            energyType,
            baseLoadShare: energy.settings.gasBaseLoadShare,
            ...(analysis.weight ? { weight: analysis.weight } : {}),
          })
        : null;
      const active = bundles.find((b) => delivers(b, today));
      const current = active ?? bundles.at(-1);
      const price = active ? pricePeriodAt(active.periods, today) : undefined;
      const forecastFor = (bundle: ContractBundle) =>
        contractForecast({
          contract: bundle,
          periods: bundle.periods,
          bonuses: bundle.bonuses,
          transactions: bundle.transactions,
          daily,
          annualKwh: annual?.kwh ?? null,
          baseLoadShare: energy.settings.gasBaseLoadShare,
          today,
          weight: analysis?.weight,
        });
      const forecasts = bundles.map((bundle) => ({ bundle, forecast: forecastFor(bundle) }));
      byEnergy[energyType] = {
        energyType,
        bundles,
        current,
        currentForecast: forecasts.find((f) => f.bundle.id === current?.id)?.forecast,
        forecasts: Object.fromEntries(forecasts.map((f) => [f.bundle.id, f.forecast])),
        annual,
        annualCostEur: annual && price ? annualCostEur(annual.kwh, price) : null,
        ...(active ? { active } : {}),
        monthToDate: monthToDateCost({
          bundles,
          daily,
          annualKwh: annual?.kwh ?? null,
          energyType,
          baseLoadShare: energy.settings.gasBaseLoadShare,
          today,
          weight: analysis?.weight,
        }),
        savings: (() => {
          const reference = energy.settings.referenceTariffs.find(
            (r) => r.energyType === energyType,
          );
          return reference ? switchSavings({ bundles, daily, reference }) : null;
        })(),
        monthly: monthlyCosts(daily, bundles),
        cumulative: current
          ? cumulativeCostSeries({
              bundle: current,
              daily,
              annualKwh: annual?.kwh ?? null,
              baseLoadShare: energy.settings.gasBaseLoadShare,
              today,
              weight: analysis?.weight,
            })
          : [],
        effective: effectivePriceHistory(
          forecasts
            .filter(({ forecast }) => forecast.total.kwh > 0)
            .map(({ bundle, forecast }) => ({
              bundle,
              kwh: forecast.total.kwh,
              energyEur: forecast.total.energyEur,
              baseEur: forecast.total.baseEur,
              bonusEur: forecast.bonusEur,
              complete: forecast.periodTo < today,
            })),
        ),
      };
    }
    return { status: 'ready' as const, energy, contracts, byEnergy, today };
  }, [energy, contracts]);
}
