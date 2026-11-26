import {
  breakEvenKwh,
  offerCosts,
  offerWarnings,
  rankOffers,
  type OfferLike,
} from '@/domain/offers';
import type { Contract } from '@/domain/types';

const offer = (o: Partial<OfferLike> = {}): OfferLike => ({
  id: 'x',
  energyType: 'electricity',
  provider: 'Angebot X',
  tariffName: 'Klar',
  energyPriceCt: 30,
  basePriceEurPerYear: 120,
  bonuses: [{ kind: 'new_customer', amountEur: 100 }],
  ...o,
});
const X = offer();
const Y = offer({
  id: 'y',
  provider: 'Angebot Y',
  energyPriceCt: 27,
  basePriceEurPerYear: 200,
  bonuses: [],
});

describe('Angebotsvergleich – Testfall J', () => {
  it('rechnet Jahr 1 (mit Bonus) und Folgejahr (ohne Bonus)', () => {
    expect(offerCosts(X, 3500)).toMatchObject({
      year1Eur: 1070,
      followYearEur: 1170,
      twoYearEur: 2240,
      bonusEur: 100,
    });
    expect(offerCosts(Y, 3500)).toMatchObject({
      year1Eur: 1145,
      followYearEur: 1145,
      twoYearEur: 2290,
    });
    expect(offerCosts(X, 3500).effectiveYear1Ct).toBeCloseTo((1070 / 3500) * 100, 9);
  });

  it('Break-even im Folgejahr bei 2.666,67 kWh – darüber ist Y günstiger', () => {
    const be = breakEvenKwh(X, Y);
    expect(be?.kwh).toBeCloseTo(2666.6667, 3);
    expect(be?.cheaperAbove).toBe('b');
    expect(breakEvenKwh(Y, X)?.cheaperAbove).toBe('a');
  });

  it('ohne Schnittpunkt kein Break-even', () => {
    expect(breakEvenKwh(X, offer({ basePriceEurPerYear: 150 }))).toBeNull();
    // günstiger in Arbeits- UND Grundpreis → immer günstiger
    expect(breakEvenKwh(X, offer({ energyPriceCt: 28, basePriceEurPerYear: 100 }))).toBeNull();
  });
});

describe('Ranking', () => {
  it('sortiert nach Jahr 1, nennt den Rang nach 2-Jahres-Summe und die Ersparnis', () => {
    const ranked = rankOffers([Y, X], 3500, {
      current: { energyPriceCt: 33, basePriceEurPerYear: 150 },
      reference: { energyPriceCt: 40, basePriceEurPerYear: 160 },
    });
    expect(ranked.map((r) => r.offer.id)).toEqual(['x', 'y']);
    expect(ranked.map((r) => r.rankTwoYear)).toEqual([1, 2]);
    // aktuell: 3.500 × 0,33 + 150 = 1.305 €; Referenz: 1.400 + 160 = 1.560 €
    expect(ranked[0]?.savingVsCurrentEur).toBeCloseTo(1305 - 1070, 9);
    expect(ranked[0]?.savingVsReferenceEur).toBeCloseTo(1560 - 1070, 9);
    expect(rankOffers([X], 3500, {})[0]?.savingVsCurrentEur).toBeUndefined();
  });
});

describe('Warnungen (Spec 6.8)', () => {
  const contract = (o: Partial<Contract>): Contract => ({
    id: 'c',
    createdAt: '',
    updatedAt: '',
    energyType: 'electricity',
    meterId: 'm',
    provider: 'Blitzwerk',
    providerGroup: 'Blitz-Konzern',
    tariffName: 'T',
    deliveryStart: '2025-01-01',
    deliveryEnd: '2025-12-31',
    termStartsAt: 'delivery',
    noticePeriod: { value: 1, unit: 'months' },
    renewal: { type: 'monthly' },
    installmentPlan: [],
    status: 'ended',
    ...o,
  });
  const codes = (o: OfferLike, contracts: Contract[] = [], today = '2026-11-26') =>
    offerWarnings(o, { contracts, today, kwh: 3500 }).map((w) => w.code);

  it('Anbieter oder Konzern in den letzten 12 Monaten genutzt', () => {
    expect(codes(offer({ provider: 'blitzwerk ' }), [contract({})])).toContain('recent_provider');
    expect(
      codes(offer({ provider: 'Funkenstrom', providerGroup: 'Blitz-Konzern' }), [contract({})]),
    ).toContain('recent_provider');
    expect(
      codes(offer({ provider: 'Blitzwerk' }), [contract({ deliveryEnd: '2025-10-31' })]),
    ).not.toContain('recent_provider');
    expect(
      codes(offer({ provider: 'Blitzwerk' }), [contract({ deliveryEnd: undefined })]),
    ).toContain('recent_provider');
  });

  it('lange Laufzeit, eingeschränkte Garantie, Lockangebot', () => {
    expect(codes(offer({ minTermMonths: 24 }))).toContain('long_term');
    expect(codes(offer({ minTermMonths: 12 }))).not.toContain('long_term');
    expect(codes(offer({ priceGuaranteeScope: 'limited' }))).toContain('limited_guarantee');
    expect(codes(offer({ priceGuaranteeScope: 'full' }))).not.toContain('limited_guarantee');
    // 300 € Bonus bei 1.170 € Jahreskosten = 25,6 % > 20 %
    expect(codes(offer({ bonuses: [{ kind: 'new_customer', amountEur: 300 }] }))).toContain('bait');
    expect(codes(X)).not.toContain('bait');
  });
});
