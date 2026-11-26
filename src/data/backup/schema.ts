import { z } from 'zod';
import type {
  Bill,
  Bonus,
  Contract,
  Meter,
  Offer,
  PricePeriod,
  Reading,
  Settings,
  Transaction,
} from '@/domain/types';

/** Backup-Format (Spec Phase 4): versioniert, jede Zeile per zod geprüft, unbekannte Felder entfallen. */
export const BACKUP_FORMAT = 'strom-gas-tracker';
export const BACKUP_VERSION = 1;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum erwartet (JJJJ-MM-TT)');
const energyType = z.enum(['electricity', 'gas']);
const bonusKind = z.enum(['instant', 'new_customer', 'loyalty', 'referral', 'other']);
const scope = z.enum(['full', 'limited', 'energy_only']);
const base = {
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  isDemo: z.boolean().optional(),
};

export const meterSchema: z.ZodType<Meter> = z.object({
  ...base,
  energyType,
  name: z.string(),
  unit: z.enum(['kWh', 'm3']),
  decimals: z.number().int().min(0).max(4),
  rolloverModulus: z.number().positive().optional(),
  meterNumber: z.string().optional(),
  maloId: z.string().optional(),
  activeFrom: isoDate,
  activeTo: isoDate.optional(),
  predecessorId: z.string().optional(),
  gasFactors: z
    .array(z.object({ validFrom: isoDate, zFactor: z.number(), calorificValue: z.number() }))
    .optional(),
});

export const readingSchema: z.ZodType<Reading> = z.object({
  ...base,
  meterId: z.string(),
  date: isoDate,
  time: z.string().optional(),
  value: z.number(),
  kind: z.enum(['regular', 'switch', 'meter_install', 'meter_removal', 'from_bill', 'estimated']),
  photoId: z.string().optional(),
  note: z.string().optional(),
});

const switchStep = z.enum([
  'offer_chosen',
  'cancelled',
  'confirmed',
  'new_contract',
  'switch_reading',
  'reported',
  'final_bill',
  'bonus_checked',
  'credit_received',
]);

export const contractSchema: z.ZodType<Contract> = z.object({
  ...base,
  energyType,
  meterId: z.string(),
  provider: z.string(),
  providerGroup: z.string().optional(),
  tariffName: z.string(),
  customerNumber: z.string().optional(),
  contractNumber: z.string().optional(),
  contractDate: isoDate.optional(),
  deliveryStart: isoDate,
  deliveryEnd: isoDate.optional(),
  minTermMonths: z.number().int().positive().optional(),
  termStartsAt: z.enum(['delivery', 'contract']),
  noticePeriod: z.object({
    value: z.number().int().min(0),
    unit: z.enum(['days', 'weeks', 'months']),
  }),
  renewal: z.union([
    z.object({ type: z.literal('monthly') }),
    z.object({ type: z.literal('fixed'), months: z.number().int().positive() }),
  ]),
  priceGuarantee: z.object({ until: isoDate, scope }).optional(),
  installmentPlan: z.array(
    z.object({
      validFrom: isoDate,
      amountEur: z.number(),
      dayOfMonth: z.number().int().min(1).max(31),
    }),
  ),
  cancellation: z
    .object({
      sentAt: isoDate.optional(),
      channel: z.string().optional(),
      confirmedAt: isoDate.optional(),
      confirmedEnd: isoDate.optional(),
      reason: z.enum(['regular', 'price_change', 'move']).optional(),
    })
    .optional(),
  status: z.enum(['planned', 'active', 'cancelled', 'ended']),
  notes: z.string().optional(),
  switchChecklist: z.partialRecord(switchStep, isoDate).optional(),
});

export const pricePeriodSchema: z.ZodType<PricePeriod> = z.object({
  ...base,
  contractId: z.string(),
  validFrom: isoDate,
  energyPriceCt: z.number(),
  basePriceEurPerYear: z.number(),
  enteredAs: z.enum(['ct_per_kwh', 'eur_per_m3']).optional(),
  changeNoticeReceivedAt: isoDate.optional(),
});

export const bonusSchema: z.ZodType<Bonus> = z.object({
  ...base,
  contractId: z.string(),
  kind: bonusKind,
  amountEur: z.number(),
  condition: z.string(),
  requiresDeliveryMonths: z.number().int().positive().optional(),
  consumptionDependent: z.boolean().optional(),
  settlement: z.enum(['payout', 'offset_in_bill']),
  expectedDate: isoDate.optional(),
  status: z.enum(['promised', 'due', 'received', 'offset', 'disputed', 'forfeited']),
  receivedAt: isoDate.optional(),
  receivedAmountEur: z.number().optional(),
});

export const billSchema: z.ZodType<Bill> = z.object({
  ...base,
  contractId: z.string(),
  kind: z.enum(['annual', 'final']),
  periodFrom: isoDate,
  periodTo: isoDate,
  issuedAt: isoDate.optional(),
  consumptionKwh: z.number().optional(),
  totalEur: z.number().optional(),
  balanceEur: z.number().optional(),
  bonusIncluded: z.boolean().optional(),
  balanceSettledAt: isoDate.optional(),
});

export const transactionSchema: z.ZodType<Transaction> = z.object({
  ...base,
  contractId: z.string(),
  date: isoDate,
  amountEur: z.number(),
  kind: z.enum(['installment', 'bill_balance', 'bonus_payout', 'refund', 'other']),
  note: z.string().optional(),
});

export const offerSchema: z.ZodType<Offer> = z.object({
  ...base,
  energyType,
  provider: z.string(),
  providerGroup: z.string().optional(),
  tariffName: z.string(),
  energyPriceCt: z.number(),
  basePriceEurPerYear: z.number(),
  bonuses: z.array(
    z.object({
      kind: bonusKind,
      amountEur: z.number(),
      requiresDeliveryMonths: z.number().int().positive().optional(),
    }),
  ),
  minTermMonths: z.number().int().positive().optional(),
  priceGuaranteeMonths: z.number().int().min(0).optional(),
  priceGuaranteeScope: scope.optional(),
  source: z.string().optional(),
  url: z
    .string()
    .regex(/^https?:\/\//i, 'Nur http(s)-Links')
    .optional(),
  capturedAt: isoDate,
});

export const settingsSchema: z.ZodType<Settings> = z.object({
  id: z.literal('settings'),
  location: z.object({ name: z.string(), lat: z.number(), lon: z.number() }).optional(),
  weatherOptIn: z.boolean(),
  readingIntervalDays: z.number().int().positive(),
  gasBaseLoadShare: z.number().min(0).max(1),
  cancellationBufferDays: z.number().int().min(0),
  referenceTariffs: z.array(
    z.object({
      energyType,
      label: z.string(),
      energyPriceCt: z.number(),
      basePriceEurPerYear: z.number(),
    }),
  ),
  theme: z.enum(['system', 'dark', 'light']),
  lastBackupAt: z.string().optional(),
});

/** Fotos als Data-URL (nur Bilder). */
export const photoSchema = z.object({
  ...base,
  takenAt: z.string(),
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp|heic|heif|gif);base64,[A-Za-z0-9+/=]+$/),
});
export type BackupPhoto = z.infer<typeof photoSchema>;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  data: z.object({
    meters: z.array(meterSchema),
    readings: z.array(readingSchema),
    contracts: z.array(contractSchema),
    pricePeriods: z.array(pricePeriodSchema),
    bonuses: z.array(bonusSchema),
    bills: z.array(billSchema),
    transactions: z.array(transactionSchema),
    offers: z.array(offerSchema),
    settings: settingsSchema.optional(),
    photos: z.array(photoSchema).optional(),
  }),
});
export type Backup = z.infer<typeof backupSchema>;
