import { requiredDeliveryEnd } from '@/domain/bonus';
import { addDays, daysBetween } from '@/domain/dates';
import { earliestDeliveryEnd } from '@/domain/deadlines';
import type { Bill, Bonus, Contract, ISODate, Meter, SwitchStep } from '@/domain/types';
import { formatDate, formatMeterValue } from '@/lib/format';

export type { SwitchStep } from '@/domain/types';

/** Spec 7.3 (6) – Checkliste des Wechsel-Cockpits in fester Reihenfolge. */
export const SWITCH_STEPS: readonly { step: SwitchStep; label: string }[] = [
  { step: 'offer_chosen', label: 'Neues Angebot gewählt' },
  { step: 'cancelled', label: 'Gekündigt' },
  { step: 'confirmed', label: 'Kündigungsbestätigung erhalten' },
  { step: 'new_contract', label: 'Neuer Vertrag mit bestätigtem Lieferbeginn' },
  { step: 'switch_reading', label: 'Zählerstand am Wechseltag mit Foto' },
  { step: 'reported', label: 'Zählerstand an beide Anbieter gemeldet' },
  { step: 'final_bill', label: 'Schlussrechnung erhalten' },
  { step: 'bonus_checked', label: 'Bonus geprüft' },
  { step: 'credit_received', label: 'Guthaben erhalten' },
];

const ENERGY_WORD = { electricity: 'Strom', gas: 'Gas' } as const;
const SETTLED_BONUS: Bonus['status'][] = ['received', 'offset', 'disputed', 'forfeited'];

export interface SwitchStepState {
  step: SwitchStep;
  label: string;
  done: boolean;
  /** true = aus den Daten erkannt, false = Haken von Hand (oder offen). */
  auto: boolean;
  date?: ISODate;
}

/** Fortschritt eines Wechsels: aus den Daten erkannt, sonst manuelle Haken (`switchChecklist`). */
export function switchProgress(input: {
  contract: Contract;
  successor?: Contract | undefined;
  bonuses: readonly Bonus[];
  bills: readonly Bill[];
  /** Ablesedaten derselben Energieart */
  readingDates: readonly ISODate[];
}): SwitchStepState[] {
  const { contract, successor } = input;
  const switchDay = contract.deliveryEnd ? addDays(contract.deliveryEnd, 1) : undefined;
  const finalBill = input.bills.find((b) => b.contractId === contract.id && b.kind === 'final');
  const bonusesToCheck = input.bonuses.filter(
    (b) => b.contractId === contract.id && b.kind !== 'instant',
  );

  const auto: Partial<Record<SwitchStep, ISODate | true>> = {};
  if (successor) auto.offer_chosen = successor.contractDate ?? true;
  if (contract.cancellation?.sentAt) auto.cancelled = contract.cancellation.sentAt;
  if (contract.cancellation?.confirmedAt) auto.confirmed = contract.cancellation.confirmedAt;
  if (successor && switchDay && successor.deliveryStart === switchDay) auto.new_contract = true;
  const switchReading =
    switchDay && input.readingDates.find((d) => Math.abs(daysBetween(d, switchDay)) <= 1);
  if (switchReading) auto.switch_reading = switchReading;
  if (finalBill) auto.final_bill = finalBill.issuedAt ?? true;
  if (bonusesToCheck.length > 0 && bonusesToCheck.every((b) => SETTLED_BONUS.includes(b.status)))
    auto.bonus_checked = true;
  if (finalBill && ((finalBill.balanceEur ?? 0) >= 0 || finalBill.balanceSettledAt))
    auto.credit_received = finalBill.balanceSettledAt ?? true;

  return SWITCH_STEPS.map(({ step, label }) => {
    const detected = auto[step];
    if (detected !== undefined) {
      return {
        step,
        label,
        done: true,
        auto: true,
        ...(detected === true ? {} : { date: detected }),
      };
    }
    const manual = contract.switchChecklist?.[step];
    return { step, label, done: Boolean(manual), auto: false, ...(manual ? { date: manual } : {}) };
  });
}

/**
 * Lieferende, das Kündigungsfrist **und** Bonus sichert: das spätere aus frühestmöglichem
 * Lieferende und nötiger Mindestbelieferung der (nicht verfallenen) Boni.
 */
export function suggestedDeliveryEnd(
  contract: Contract,
  bonuses: readonly Bonus[],
  today: ISODate,
): { date: ISODate; reason: 'term' | 'bonus' } | undefined {
  const earliest = earliestDeliveryEnd(contract, today);
  const bonusEnd = bonuses
    .filter(
      (b) => b.contractId === contract.id && b.requiresDeliveryMonths && b.status !== 'forfeited',
    )
    .map((b) => requiredDeliveryEnd(contract.deliveryStart, b.requiresDeliveryMonths ?? 12))
    .reduce<ISODate | undefined>((max, d) => (!max || d > max ? d : max), undefined);
  if (bonusEnd && (!earliest || bonusEnd > earliest)) return { date: bonusEnd, reason: 'bonus' };
  return earliest ? { date: earliest, reason: 'term' } : undefined;
}

const SIGNATURE = ['Mit freundlichen Grüßen', '[Vor- und Nachname]'];

/** Spec 7.3 (6) – Kündigung in Textform. Name und Anschrift bleiben Platzhalter (nie gespeichert). */
export function cancellationLetter(input: {
  contract: Contract;
  meter: Meter | undefined;
  endDate: ISODate;
}): { subject: string; body: string } {
  const { contract, meter } = input;
  const customer = contract.customerNumber ?? '[Kundennummer]';
  const word = ENERGY_WORD[contract.energyType];
  const body = [
    '[Vor- und Nachname]',
    '[Straße und Hausnummer]',
    '[PLZ und Ort]',
    '',
    `An: ${contract.provider}`,
    '',
    `Kündigung meines ${word}liefervertrags`,
    `Tarif: ${contract.tariffName}`,
    `Kundennummer: ${customer}`,
    `Zählernummer: ${meter?.meterNumber ?? '[Zählernummer]'}`,
    ...(meter?.maloId ? [`MaLo-ID: ${meter.maloId}`] : []),
    '',
    'Sehr geehrte Damen und Herren,',
    '',
    `hiermit kündige ich den oben genannten Vertrag zum ${formatDate(input.endDate)}, hilfsweise zum nächstmöglichen Termin.`,
    '',
    'Bitte bestätigen Sie mir den Eingang dieser Kündigung und das Lieferende schriftlich.',
    '',
    ...SIGNATURE,
  ].join('\n');
  return { subject: `Kündigung ${word}liefervertrag – Kundennummer ${customer}`, body };
}

/** Spec 7.3 (6) – Zählerstandsmeldung: Datum, Stand, Zählernummer, MaLo-ID. */
export function meterReadingMessage(input: {
  meter: Meter;
  reading: { date: ISODate; value: number };
  customerNumber?: string | undefined;
}): { subject: string; body: string } {
  const { meter, reading } = input;
  const word = ENERGY_WORD[meter.energyType];
  const body = [
    'Sehr geehrte Damen und Herren,',
    '',
    'hiermit melde ich meinen Zählerstand zum Lieferantenwechsel:',
    '',
    `Datum: ${formatDate(reading.date)}`,
    `Zählerstand: ${formatMeterValue(reading.value, meter.decimals, meter.unit)}`,
    `Zählernummer: ${meter.meterNumber ?? '[Zählernummer]'}`,
    `MaLo-ID: ${meter.maloId ?? '[MaLo-ID]'}`,
    ...(input.customerNumber ? [`Kundennummer: ${input.customerNumber}`] : []),
    '',
    'Ein Foto des Zählerstands liegt mir vor und kann auf Wunsch nachgereicht werden.',
    '',
    ...SIGNATURE,
  ].join('\n');
  return { subject: `Zählerstand ${word} zum ${formatDate(reading.date)}`, body };
}
