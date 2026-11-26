import { addMonths } from 'date-fns';
import { fromISODate, toISODate } from '@/domain/dates';
import type { Contract, ISODate, Offer } from '@/domain/types';

export type OfferLike = Pick<
  Offer,
  | 'id'
  | 'energyType'
  | 'provider'
  | 'tariffName'
  | 'energyPriceCt'
  | 'basePriceEurPerYear'
  | 'bonuses'
> &
  Partial<
    Pick<Offer, 'providerGroup' | 'minTermMonths' | 'priceGuaranteeMonths' | 'priceGuaranteeScope'>
  >;

interface Price { energyPriceCt: number; basePriceEurPerYear: number }

const yearCost = (p: Price, kwh: number) => (kwh * p.energyPriceCt) / 100 + p.basePriceEurPerYear;

export interface OfferCosts {
  year1Eur: number;
  followYearEur: number;
  twoYearEur: number;
  bonusEur: number;
  effectiveYear1Ct: number;
  effectiveFollowCt: number;
}

/** Spec 6.8 – Jahr 1 = kWh × AP ÷ 100 + GP − Σ Boni · Folgejahr = kWh × AP ÷ 100 + GP. */
export function offerCosts(offer: Price & Pick<OfferLike, 'bonuses'>, kwh: number): OfferCosts {
  const bonusEur = offer.bonuses.reduce((s, b) => s + b.amountEur, 0);
  const followYearEur = yearCost(offer, kwh);
  const year1Eur = followYearEur - bonusEur;
  return {
    year1Eur,
    followYearEur,
    twoYearEur: year1Eur + followYearEur,
    bonusEur,
    effectiveYear1Ct: kwh > 0 ? (year1Eur / kwh) * 100 : NaN,
    effectiveFollowCt: kwh > 0 ? (followYearEur / kwh) * 100 : NaN,
  };
}

/**
 * Break-even-Verbrauch im Folgejahr: ab hier ist das Angebot mit dem niedrigeren Arbeitspreis
 * günstiger. `null`, wenn sich die Kosten nie schneiden (gleicher AP oder eins in beidem günstiger).
 */
export function breakEvenKwh(a: Price, b: Price): { kwh: number; cheaperAbove: 'a' | 'b' } | null {
  const apDiff = (a.energyPriceCt - b.energyPriceCt) / 100;
  if (apDiff === 0) return null;
  const kwh = (b.basePriceEurPerYear - a.basePriceEurPerYear) / apDiff;
  if (!(kwh > 0)) return null;
  return { kwh, cheaperAbove: apDiff > 0 ? 'b' : 'a' };
}

export interface RankedOffer<T extends OfferLike = OfferLike> {
  offer: T;
  costs: OfferCosts;
  rankYear1: number;
  rankTwoYear: number;
  /** aktueller Vertrag zum heutigen Preis (ohne Bonus) − Jahr 1 des Angebots */
  savingVsCurrentEur?: number;
  savingVsReferenceEur?: number;
}

/** Ranking nach Jahr 1 (Sortierung) und nach 2-Jahres-Summe (Rang), Ersparnis ggü. Vertrag/Referenz. */
export function rankOffers<T extends OfferLike>(
  offers: readonly T[],
  kwh: number,
  compare: { current?: Price | undefined; reference?: Price | undefined },
): RankedOffer<T>[] {
  const withCosts = offers.map((offer) => ({ offer, costs: offerCosts(offer, kwh) }));
  const byTwoYear = [...withCosts].sort((a, b) => a.costs.twoYearEur - b.costs.twoYearEur);
  const currentCost = compare.current ? yearCost(compare.current, kwh) : undefined;
  const referenceCost = compare.reference ? yearCost(compare.reference, kwh) : undefined;
  return [...withCosts]
    .sort((a, b) => a.costs.year1Eur - b.costs.year1Eur)
    .map((entry, i) => ({
      ...entry,
      rankYear1: i + 1,
      rankTwoYear: byTwoYear.indexOf(entry) + 1,
      ...(currentCost !== undefined
        ? { savingVsCurrentEur: currentCost - entry.costs.year1Eur }
        : {}),
      ...(referenceCost !== undefined
        ? { savingVsReferenceEur: referenceCost - entry.costs.year1Eur }
        : {}),
    }));
}

export type OfferWarningCode = 'recent_provider' | 'long_term' | 'limited_guarantee' | 'bait';

const norm = (s: string | undefined) => s?.trim().toLocaleLowerCase('de-DE') ?? '';

/** Spec 6.8 / 4.3 Falle 3 – Warnungen zu einem Angebot. */
export function offerWarnings(
  offer: OfferLike,
  ctx: { contracts: readonly Contract[]; today: ISODate; kwh: number },
): { code: OfferWarningCode; text: string }[] {
  const warnings: { code: OfferWarningCode; text: string }[] = [];
  const since = toISODate(addMonths(fromISODate(ctx.today), -12));
  const names = new Set([norm(offer.provider), norm(offer.providerGroup)].filter(Boolean));
  const recent = ctx.contracts.find(
    (c) =>
      (!c.deliveryEnd || c.deliveryEnd >= since) &&
      (names.has(norm(c.provider)) ||
        (c.providerGroup !== undefined && names.has(norm(c.providerGroup)))),
  );
  if (recent) {
    warnings.push({
      code: 'recent_provider',
      text: `Du warst in den letzten 12 Monaten bei ${recent.provider}${recent.providerGroup ? ` (${recent.providerGroup})` : ''} – der Neukundenbonus ist fraglich.`,
    });
  }
  if (offer.minTermMonths !== undefined && offer.minTermMonths > 12) {
    warnings.push({
      code: 'long_term',
      text: `Laufzeit ${String(offer.minTermMonths)} Monate – länger gebunden als 12 Monate.`,
    });
  }
  if (offer.priceGuaranteeScope === 'limited' || offer.priceGuaranteeScope === 'energy_only') {
    warnings.push({
      code: 'limited_guarantee',
      text:
        offer.priceGuaranteeScope === 'limited'
          ? 'Preisgarantie nur eingeschränkt – Steuern und Abgaben können sich ändern.'
          : 'Preisgarantie nur auf den Energiepreis – Netzentgelte, Steuern und Abgaben können sich ändern.',
    });
  }
  const costs = offerCosts(offer, ctx.kwh);
  if (costs.bonusEur > 0.2 * costs.followYearEur) {
    warnings.push({
      code: 'bait',
      text: 'Lockangebot: Die Boni sind mehr als 20 % der Jahreskosten – das Folgejahr prüfen.',
    });
  }
  return warnings;
}
