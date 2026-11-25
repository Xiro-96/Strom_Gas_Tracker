/** Datenmodell laut Spezifikation §5. Datumswerte sind immer 'YYYY-MM-DD' (lokal). */
export type EnergyType = 'electricity' | 'gas';
export type ISODate = string;

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  isDemo?: boolean;
}

export interface GasFactorEntry {
  validFrom: ISODate;
  zFactor: number;
  calorificValue: number;
}

export interface Meter extends BaseEntity {
  energyType: EnergyType;
  name: string;
  unit: 'kWh' | 'm3';
  /** Nachkommastellen des Zählwerks (Gas meist 3). */
  decimals: number;
  /** z. B. 100000 bei 5 Vorkommastellen. */
  rolloverModulus?: number;
  meterNumber?: string;
  maloId?: string;
  activeFrom: ISODate;
  activeTo?: ISODate;
  /** Zählerwechsel-Kette: Vorgänger dieses Zählers. */
  predecessorId?: string;
  gasFactors?: GasFactorEntry[];
}

export type ReadingKind =
  'regular' | 'switch' | 'meter_install' | 'meter_removal' | 'from_bill' | 'estimated';

export interface Reading extends BaseEntity {
  meterId: string;
  date: ISODate;
  /** 'HH:mm', im MVP nur Anzeige. */
  time?: string;
  value: number;
  kind: ReadingKind;
  photoId?: string;
  note?: string;
}

export type BonusKind = 'instant' | 'new_customer' | 'loyalty' | 'referral' | 'other';
export type PriceGuaranteeScope = 'full' | 'limited' | 'energy_only';

export interface Contract extends BaseEntity {
  energyType: EnergyType;
  meterId: string;
  provider: string;
  providerGroup?: string;
  tariffName: string;
  customerNumber?: string;
  contractNumber?: string;
  contractDate?: ISODate;
  deliveryStart: ISODate;
  deliveryEnd?: ISODate;
  minTermMonths?: number;
  termStartsAt: 'delivery' | 'contract';
  noticePeriod: { value: number; unit: 'days' | 'weeks' | 'months' };
  renewal: { type: 'monthly' } | { type: 'fixed'; months: number };
  priceGuarantee?: { until: ISODate; scope: PriceGuaranteeScope };
  installmentPlan: { validFrom: ISODate; amountEur: number; dayOfMonth: number }[];
  cancellation?: {
    sentAt?: ISODate;
    channel?: string;
    confirmedAt?: ISODate;
    confirmedEnd?: ISODate;
    reason?: 'regular' | 'price_change' | 'move';
  };
  status: 'planned' | 'active' | 'cancelled' | 'ended';
  notes?: string;
}

export interface PricePeriod extends BaseEntity {
  contractId: string;
  validFrom: ISODate;
  /** ct/kWh brutto – intern immer so. */
  energyPriceCt: number;
  basePriceEurPerYear: number;
  enteredAs?: 'ct_per_kwh' | 'eur_per_m3';
  changeNoticeReceivedAt?: ISODate;
}

export interface Bonus extends BaseEntity {
  contractId: string;
  kind: BonusKind;
  amountEur: number;
  condition: string;
  requiresDeliveryMonths?: number;
  consumptionDependent?: boolean;
  settlement: 'payout' | 'offset_in_bill';
  expectedDate?: ISODate;
  status: 'promised' | 'due' | 'received' | 'offset' | 'disputed' | 'forfeited';
  receivedAt?: ISODate;
  receivedAmountEur?: number;
}

export interface Bill extends BaseEntity {
  contractId: string;
  kind: 'annual' | 'final';
  periodFrom: ISODate;
  periodTo: ISODate;
  issuedAt?: ISODate;
  consumptionKwh?: number;
  totalEur?: number;
  /** + Nachzahlung, − Guthaben */
  balanceEur?: number;
  bonusIncluded?: boolean;
  balanceSettledAt?: ISODate;
}

export interface Transaction extends BaseEntity {
  contractId: string;
  date: ISODate;
  /** + an den Anbieter, − vom Anbieter */
  amountEur: number;
  kind: 'installment' | 'bill_balance' | 'bonus_payout' | 'refund' | 'other';
  note?: string;
}

export interface Offer extends BaseEntity {
  energyType: EnergyType;
  provider: string;
  providerGroup?: string;
  tariffName: string;
  energyPriceCt: number;
  basePriceEurPerYear: number;
  bonuses: { kind: BonusKind; amountEur: number; requiresDeliveryMonths?: number }[];
  minTermMonths?: number;
  priceGuaranteeMonths?: number;
  priceGuaranteeScope?: PriceGuaranteeScope;
  source?: string;
  url?: string;
  capturedAt: ISODate;
}

export interface Photo extends BaseEntity {
  blob: Blob;
  takenAt: string;
}

export interface ReferenceTariff {
  energyType: EnergyType;
  label: string;
  energyPriceCt: number;
  basePriceEurPerYear: number;
}

export interface Settings {
  id: 'settings';
  location?: { name: string; lat: number; lon: number };
  weatherOptIn: boolean;
  /** Default 14, „überfällig“ ab 21. */
  readingIntervalDays: number;
  /** Anteil Warmwasser/Kochen, Default 0,15. */
  gasBaseLoadShare: number;
  /** Default 7. */
  cancellationBufferDays: number;
  referenceTariffs: ReferenceTariff[];
  theme: 'system' | 'dark' | 'light';
  lastBackupAt?: string;
}
