import type { AnnualForecast } from '@/domain/forecast';
import type {
  Bill,
  Bonus,
  BonusKind,
  Contract,
  EnergyType,
  ISODate,
  Meter,
  Transaction,
} from '@/domain/types';
import { parseMeterInput } from '@/domain/parse';
import { formatDate } from '@/lib/format';

export const CONTRACT_STATUS: Record<
  Contract['status'],
  { label: string; variant: 'savings' | 'secondary' | 'warning' | 'outline' }
> = {
  planned: { label: 'Geplant', variant: 'secondary' },
  active: { label: 'Aktiv', variant: 'savings' },
  cancelled: { label: 'Gekündigt', variant: 'warning' },
  ended: { label: 'Beendet', variant: 'outline' },
};

export const BONUS_KIND_LABEL: Record<BonusKind, string> = {
  new_customer: 'Neukundenbonus',
  instant: 'Sofortbonus',
  loyalty: 'Treuebonus',
  referral: 'Empfehlungsbonus',
  other: 'Sonstiger Bonus',
};

export const BONUS_STATUS_LABEL: Record<Bonus['status'], string> = {
  promised: 'zugesagt',
  due: 'fällig',
  received: 'erhalten',
  offset: 'verrechnet',
  disputed: 'strittig',
  forfeited: 'verfallen',
};

export const SETTLEMENT_LABEL: Record<Bonus['settlement'], string> = {
  offset_in_bill: 'mit Rechnung verrechnet',
  payout: 'Überweisung',
};

export const TRANSACTION_KIND_LABEL: Record<Transaction['kind'], string> = {
  installment: 'Abschlag (Abweichung)',
  bill_balance: 'Rechnungsausgleich',
  bonus_payout: 'Bonus-Auszahlung',
  refund: 'Erstattung',
  other: 'Sonstiges',
};

export const BILL_KIND_LABEL: Record<Bill['kind'], string> = {
  annual: 'Jahresrechnung',
  final: 'Schlussrechnung',
};

export const FORECAST_METHOD_LABEL: Record<AnnualForecast['method'], string> = {
  last365: 'Verbrauch der letzten 365 Tage',
  avg90: 'Ø der letzten 90 Tage × 365',
  normalYear: 'Gas-Normaljahr (Gradtage)',
};

export const NOTICE_UNIT_LABEL: Record<Contract['noticePeriod']['unit'], string> = {
  days: 'Tag(e)',
  weeks: 'Woche(n)',
  months: 'Monat(e)',
};

export const GUARANTEE_SCOPE_LABEL = {
  full: 'voll',
  limited: 'eingeschränkt (ohne Steuern/Abgaben)',
  energy_only: 'nur Energiepreis',
} as const;

/** Deutsche Dezimalzahl, auch mit Vorzeichen („-80“, „−12,5“); ungültig → NaN. */
export function parseDecimal(input: string): number {
  const trimmed = input.trim();
  const negative = /^[-−]/.test(trimmed);
  const result = parseMeterInput(negative ? trimmed.slice(1) : trimmed, { decimals: 4 });
  if (!result.ok) return NaN;
  return negative ? -result.value : result.value;
}

/** Aktueller Zähler je Energieart (ohne Ausbaudatum, sonst der zuletzt eingebaute). */
export function currentMeters(meters: readonly Meter[]): Partial<Record<EnergyType, Meter>> {
  const result: Partial<Record<EnergyType, Meter>> = {};
  for (const energy of ['electricity', 'gas'] as const) {
    const ofType = meters
      .filter((m) => m.energyType === energy)
      .sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
    const meter = ofType.find((m) => !m.activeTo) ?? ofType.at(-1);
    if (meter) result[energy] = meter;
  }
  return result;
}

export function deliveryLabel(contract: Pick<Contract, 'deliveryStart' | 'deliveryEnd'>): string {
  return contract.deliveryEnd
    ? `${formatDate(contract.deliveryStart)} – ${formatDate(contract.deliveryEnd)}`
    : `seit ${formatDate(contract.deliveryStart)}`;
}

/** Abschlag laut Plan, der heute gilt (vor Beginn: der erste). */
export function currentInstallment(contract: Pick<Contract, 'installmentPlan'>, today: ISODate) {
  const plan = [...contract.installmentPlan].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return plan.filter((e) => e.validFrom <= today).at(-1) ?? plan[0];
}
