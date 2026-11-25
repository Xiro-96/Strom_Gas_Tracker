import { useMemo } from 'react';
import { useContractData, type ContractData } from '@/data/hooks';
import { contractForecast, type ContractForecast } from '@/domain/contractForecast';
import {
  cumulativeCostSeries,
  effectivePriceHistory,
  monthlyCosts,
  type ContractBundle,
  type CumulativePoint,
  type EffectivePriceEntry,
  type MonthlyCost,
} from '@/domain/costAnalysis';
import { delivers } from '@/domain/costs';
import { todayISO } from '@/domain/dates';
import { forecastAnnual, type AnnualForecast } from '@/domain/forecast';
import type { Contract, EnergyType } from '@/domain/types';
import { useEnergyData } from '@/features/shared/useEnergyData';

export interface EnergyCosts {
  energyType: EnergyType;
  bundles: ContractBundle[];
  /** Vertrag, der heute liefert – sonst der zuletzt begonnene. */
  current?: ContractBundle;
  currentForecast?: ContractForecast;
  annual: AnnualForecast | null;
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
    transactions: data.transactions.filter((t) => t.contractId === contract.id),
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
          })
        : null;
      const current = bundles.find((b) => delivers(b, today)) ?? bundles.at(-1);
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
        });
      const forecasts = bundles.map((bundle) => ({ bundle, forecast: forecastFor(bundle) }));
      byEnergy[energyType] = {
        energyType,
        bundles,
        current,
        currentForecast: forecasts.find((f) => f.bundle.id === current?.id)?.forecast,
        annual,
        monthly: monthlyCosts(daily, bundles),
        cumulative: current
          ? cumulativeCostSeries({
              bundle: current,
              daily,
              annualKwh: annual?.kwh ?? null,
              baseLoadShare: energy.settings.gasBaseLoadShare,
              today,
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
