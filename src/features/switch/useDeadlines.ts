import { useMemo } from 'react';
import { collectDeadlines, type Deadline } from '@/domain/deadlines';
import { useCostData } from '@/features/contracts/useCostData';

/** Alle Fristen (Spec 6.6) aus Verträgen, Ablesungen und Einstellungen – memoisiert. */
export function useDeadlines() {
  const cost = useCostData();
  return useMemo(() => {
    if (cost.status === 'loading') return { status: 'loading' as const };
    const { contracts, energy, today } = cost;
    const deadlines: Deadline[] = collectDeadlines({
      contracts: contracts.contracts,
      pricePeriods: contracts.pricePeriods,
      bonuses: contracts.bonuses,
      bills: contracts.bills,
      readings: energy.readings,
      meters: energy.meters,
      settings: energy.settings,
      today,
    });
    return { status: 'ready' as const, deadlines, cost, today };
  }, [cost]);
}
