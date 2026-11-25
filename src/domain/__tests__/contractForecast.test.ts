import {
  contractForecast,
  contractPeriod,
  type ContractForecastInput,
} from '@/domain/contractForecast';
import { eachDay } from '@/domain/dates';

const newCustomerBonus = {
  kind: 'new_customer' as const,
  amountEur: 100,
  settlement: 'offset_in_bill' as const,
  status: 'promised' as const,
  requiresDeliveryMonths: 12,
};

const base: ContractForecastInput = {
  contract: {
    energyType: 'electricity',
    deliveryStart: '2026-01-01',
    deliveryEnd: '2026-12-31',
    installmentPlan: [{ validFrom: '2026-01-15', amountEur: 60, dayOfMonth: 15 }],
  },
  periods: [{ validFrom: '2026-01-01', energyPriceCt: 10, basePriceEurPerYear: 365 }],
  bonuses: [
    {
      kind: 'new_customer',
      amountEur: 100,
      settlement: 'offset_in_bill',
      status: 'promised',
      requiresDeliveryMonths: 12,
    },
  ],
  transactions: [],
  daily: eachDay('2026-01-01', '2026-07-01').map((date) => ({ date, kwh: 10 })),
  annualKwh: 3650,
  baseLoadShare: 0.15,
  today: '2026-06-30',
};

describe('contractForecast', () => {
  const result = contractForecast(base);

  it('rechnet Ist bis zur letzten Ablesung und prognostiziert den Rest bis Lieferende', () => {
    expect(result.periodFrom).toBe('2026-01-01');
    expect(result.periodTo).toBe('2026-12-31');
    expect(result.actual.kwh).toBeCloseTo(1810, 9);
    expect(result.projectedKwh).toBeCloseTo(1840, 9);
    expect(result.total.totalEur).toBeCloseTo(730, 6);
  });

  it('Saldo = Kosten − verrechnete Boni − Abschläge; Empfehlung für die restlichen Abschläge', () => {
    expect(result.offsetBonusEur).toBe(100);
    expect(result.installmentsEur).toBe(720);
    expect(result.balanceEur).toBeCloseTo(-90, 6);
    expect(result.paidEur).toBe(360);
    expect(result.remainingInstallments).toBe(6);
    expect(result.recommendedEur).toBeCloseTo(45, 6);
  });

  it('zählt verfallene Boni und Boni mit nicht erfüllter Mindestlieferzeit nicht', () => {
    expect(
      contractForecast({ ...base, bonuses: [{ ...newCustomerBonus, status: 'forfeited' }] })
        .offsetBonusEur,
    ).toBe(0);
    const early = contractForecast({
      ...base,
      contract: { ...base.contract, deliveryEnd: '2026-11-30' },
    });
    expect(early.offsetBonusEur).toBe(0);
    expect(early.bonusWarnings).toHaveLength(1);
  });

  it('zählt ausgezahlte Boni (Überweisung) nicht in den Saldo', () => {
    const payout = contractForecast({
      ...base,
      bonuses: [{ kind: 'instant', amountEur: 160, settlement: 'payout', status: 'received' }],
    });
    expect(payout.offsetBonusEur).toBe(0);
    expect(payout.bonusEur).toBe(160);
  });
});

describe('contractPeriod', () => {
  it('nimmt ohne Lieferende das laufende Vertragsjahr', () => {
    const contract = { deliveryStart: '2026-01-01' };
    expect(contractPeriod(contract, '2026-06-30')).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(contractPeriod(contract, '2027-03-01')).toEqual({
      from: '2027-01-01',
      to: '2027-12-31',
    });
  });

  it('nimmt mit Lieferende den Zeitraum bis dahin', () => {
    expect(
      contractPeriod({ deliveryStart: '2026-01-01', deliveryEnd: '2026-12-31' }, '2027-03-01'),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });
});
