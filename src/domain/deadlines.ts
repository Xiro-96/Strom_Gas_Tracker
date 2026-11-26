import { addMonths } from 'date-fns';
import { bonusExpectedDate, requiredDeliveryEnd } from '@/domain/bonus';
import { addDays, daysBetween, fromISODate, toISODate } from '@/domain/dates';
import type {
  Bill,
  Bonus,
  Contract,
  EnergyType,
  ISODate,
  Meter,
  PricePeriod,
  Reading,
  Settings,
} from '@/domain/types';

/** Spec 6.6 / § 40c EnWG */
export const FINAL_BILL_DAYS = 42;
export const CREDIT_PAYOUT_DAYS = 14;
/** „bald“ = innerhalb von 14 Tagen */
export const SOON_DAYS = 14;

type Notice = Contract['noticePeriod'];
type TermFields = Pick<Contract, 'deliveryStart' | 'termStartsAt' | 'noticePeriod' | 'renewal'> &
  Partial<Pick<Contract, 'contractDate' | 'minTermMonths'>>;

const minusNotice = (date: ISODate, notice: Notice): ISODate => {
  switch (notice.unit) {
    case 'months':
      return toISODate(addMonths(fromISODate(date), -notice.value));
    case 'weeks':
      return addDays(date, -7 * notice.value);
    case 'days':
      return addDays(date, -notice.value);
  }
};

/** Spec 6.6 – Kündigungs-Deadline (Zugang beim Anbieter) = (Laufzeitende + 1 Tag − Frist) − 1 Tag. */
export function cancellationDeadline(end: ISODate, notice: Notice): ISODate {
  return addDays(minusNotice(addDays(end, 1), notice), -1);
}

const termStart = (c: TermFields) =>
  c.termStartsAt === 'contract' && c.contractDate ? c.contractDate : c.deliveryStart;

/** Ende der Erstlaufzeit = Start + Erstlaufzeit − 1 Tag (BGB § 188); ohne Angabe undefined. */
export function termEnd(c: TermFields): ISODate | undefined {
  return c.minTermMonths ? requiredDeliveryEnd(termStart(c), c.minTermMonths) : undefined;
}

/**
 * Nächstes **festes** Laufzeitende, dessen Kündigungsfrist heute noch nicht verstrichen ist:
 * die Erstlaufzeit, danach bei fester Verlängerung die Folgeperioden. Bei monatlicher Verlängerung
 * nach der Erstlaufzeit gibt es kein festes Ende mehr (undefined).
 */
export function nextTermEnd(c: TermFields, today: ISODate): ISODate | undefined {
  const first = termEnd(c);
  if (!first || !c.minTermMonths) return undefined;
  if (cancellationDeadline(first, c.noticePeriod) >= today) return first;
  if (c.renewal.type !== 'fixed') return undefined;
  for (let k = 1; k < 100; k += 1) {
    const end = requiredDeliveryEnd(termStart(c), c.minTermMonths + k * c.renewal.months);
    if (cancellationDeadline(end, c.noticePeriod) >= today) return end;
  }
  return undefined;
}

/** Kleinstes Lieferende, für das eine Kündigung heute noch rechtzeitig ist. */
function endForNoticeFrom(today: ISODate, notice: Notice): ISODate {
  let end = addDays(
    notice.unit === 'months'
      ? toISODate(addMonths(fromISODate(addDays(today, 1)), notice.value))
      : addDays(addDays(today, 1), notice.unit === 'weeks' ? 7 * notice.value : notice.value),
    -1,
  );
  // Monatsenden (31.01. + 1 Monat → 28.02.) können einen Tag zu früh landen
  while (cancellationDeadline(end, notice) < today) end = addDays(end, 1);
  return end;
}

/** Spec 6.6 – frühestmögliches Lieferende bei Kündigung heute. */
export function earliestDeliveryEnd(c: TermFields, today: ISODate): ISODate | undefined {
  const fixed = nextTermEnd(c, today);
  if (fixed) return fixed;
  return c.renewal.type === 'monthly' ? endForNoticeFrom(today, c.noticePeriod) : undefined;
}

export type DeadlineKind =
  | 'cancellation'
  | 'price_guarantee_end'
  | 'special_cancellation'
  | 'instant_bonus_check'
  | 'new_customer_bonus_check'
  | 'final_bill_due'
  | 'credit_due'
  | 'switch_reading'
  | 'next_reading';

export interface Deadline {
  id: string;
  kind: DeadlineKind;
  date: ISODate;
  /** Empfohlener Termin (Kündigung: Deadline − Puffer). */
  recommendedDate?: ISODate;
  title: string;
  detail: string;
  energyType: EnergyType;
  contractId?: string;
  done: boolean;
}

export interface DeadlineInput {
  contracts: readonly Contract[];
  pricePeriods: readonly PricePeriod[];
  bonuses: readonly Bonus[];
  bills: readonly Bill[];
  readings: readonly Reading[];
  meters: readonly Meter[];
  settings: Pick<Settings, 'cancellationBufferDays' | 'readingIntervalDays'>;
  today: ISODate;
}

const ENERGY_LABEL: Record<EnergyType, string> = { electricity: 'Strom', gas: 'Gas' };
const SETTLED: Bonus['status'][] = ['received', 'offset', 'forfeited'];
const de = (iso: ISODate) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Spec 6.6 – alle automatischen Termine, nach Datum sortiert. */
export function collectDeadlines(input: DeadlineInput): Deadline[] {
  const { today, settings } = input;
  const out: Deadline[] = [];
  const readingDatesByEnergy = new Map<EnergyType, ISODate[]>();
  for (const r of input.readings) {
    const meter = input.meters.find((m) => m.id === r.meterId);
    if (!meter) continue;
    const list = readingDatesByEnergy.get(meter.energyType) ?? [];
    list.push(r.date);
    readingDatesByEnergy.set(meter.energyType, list);
  }

  for (const c of input.contracts) {
    const who = c.provider;
    const energy = c.energyType;
    const base = { energyType: energy, contractId: c.id };
    const ended = c.deliveryEnd !== undefined && c.deliveryEnd < today;

    // Kündigungsfrist – nur solange noch nicht gekündigt; geplantes Lieferende hat Vorrang.
    if (!c.cancellation?.sentAt && !ended) {
      const end = c.deliveryEnd ?? nextTermEnd(c, today);
      if (end) {
        const date = cancellationDeadline(end, c.noticePeriod);
        out.push({
          ...base,
          id: `cancellation-${c.id}`,
          kind: 'cancellation',
          date,
          recommendedDate: addDays(date, -settings.cancellationBufferDays),
          title: `${who} kündigen`,
          detail: `Kündigung muss spätestens am ${de(date)} beim Anbieter sein – für Lieferende ${de(end)}.`,
          done: false,
        });
      }
    }

    if (c.priceGuarantee && (!c.deliveryEnd || c.priceGuarantee.until < c.deliveryEnd)) {
      out.push({
        ...base,
        id: `price_guarantee_end-${c.id}`,
        kind: 'price_guarantee_end',
        date: c.priceGuarantee.until,
        title: `Preisgarantie ${who} endet`,
        detail: 'Danach kann der Anbieter die Preise ändern – Angebote vergleichen.',
        done: false,
      });
    }

    const periods = input.pricePeriods
      .filter((p) => p.contractId === c.id)
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    for (const p of periods.slice(1)) {
      const date = addDays(p.validFrom, -1);
      out.push({
        ...base,
        id: `special_cancellation-${p.id}`,
        kind: 'special_cancellation',
        date,
        title: `Sonderkündigung ${who} möglich`,
        detail: `Preisänderung zum ${de(p.validFrom)}: Kündigung ohne Frist bis ${de(date)} (§ 41 Abs. 5 EnWG, Info ohne Gewähr).`,
        done: false,
      });
    }

    const finalBill = input.bills.find((b) => b.contractId === c.id && b.kind === 'final');
    for (const b of input.bonuses.filter((x) => x.contractId === c.id)) {
      const done = SETTLED.includes(b.status);
      if (b.kind === 'instant') {
        out.push({
          ...base,
          id: `instant_bonus_check-${b.id}`,
          kind: 'instant_bonus_check',
          date: bonusExpectedDate(b, c.deliveryStart),
          title: `Sofortbonus ${who} eingegangen?`,
          detail: 'Sofortboni kommen meist innerhalb von 3 Monaten nach Lieferbeginn.',
          done,
        });
      } else {
        const date =
          finalBill?.issuedAt ??
          (c.deliveryEnd
            ? addDays(c.deliveryEnd, FINAL_BILL_DAYS)
            : bonusExpectedDate(b, c.deliveryStart));
        out.push({
          ...base,
          id: `new_customer_bonus_check-${b.id}`,
          kind: 'new_customer_bonus_check',
          date,
          title: `Bonus ${who} in der Rechnung prüfen`,
          detail: 'Boni fehlen gern in der Schlussrechnung – prüfen und sonst reklamieren.',
          done,
        });
      }
    }

    if (c.deliveryEnd) {
      const switchDay = addDays(c.deliveryEnd, 1);
      const readDays = readingDatesByEnergy.get(energy) ?? [];
      out.push({
        ...base,
        id: `switch_reading-${c.id}`,
        kind: 'switch_reading',
        date: switchDay,
        title: `Wechseltag: ${ENERGY_LABEL[energy]} ablesen`,
        detail: 'Zählerstand mit Foto festhalten und an den alten und den neuen Anbieter melden.',
        done: readDays.some((d) => Math.abs(daysBetween(d, switchDay)) <= 1),
      });
      out.push({
        ...base,
        id: `final_bill_due-${c.id}`,
        kind: 'final_bill_due',
        date: addDays(c.deliveryEnd, FINAL_BILL_DAYS),
        title: `Schlussrechnung ${who} fällig`,
        detail: 'Spätestens 6 Wochen nach Lieferende (§ 40c EnWG, Info ohne Gewähr).',
        done: finalBill !== undefined,
      });
    }

    for (const bill of input.bills.filter((b) => b.contractId === c.id)) {
      if (bill.balanceEur === undefined || bill.balanceEur >= 0 || !bill.issuedAt) continue;
      out.push({
        ...base,
        id: `credit_due-${bill.id}`,
        kind: 'credit_due',
        date: addDays(bill.issuedAt, CREDIT_PAYOUT_DAYS),
        title: `Guthaben ${who} fällig`,
        detail: 'Guthaben aus der Rechnung binnen 2 Wochen (§ 40c EnWG, Info ohne Gewähr).',
        done: bill.balanceSettledAt !== undefined,
      });
    }
  }

  for (const [energy, dates] of readingDatesByEnergy) {
    const last = dates.reduce((a, b) => (a > b ? a : b));
    const date = addDays(last, settings.readingIntervalDays);
    out.push({
      id: `next_reading-${energy}`,
      kind: 'next_reading',
      date,
      title: `${ENERGY_LABEL[energy]} ablesen`,
      detail: `Letzte Ablesung am ${de(last)} – Intervall ${settings.readingIntervalDays} Tage.`,
      energyType: energy,
      done: false,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

/** Fristen, die nach ihrem Datum einfach verfallen (statt „überfällig“ zu werden). */
const EXPIRING: DeadlineKind[] = [
  'cancellation',
  'special_cancellation',
  'price_guarantee_end',
  'switch_reading',
];

export type DeadlineState = 'done' | 'overdue' | 'expired' | 'soon' | 'later';

export function deadlineState(
  d: Pick<Deadline, 'kind' | 'date' | 'done'>,
  today: ISODate,
): DeadlineState {
  if (d.done) return 'done';
  if (d.date < today) return EXPIRING.includes(d.kind) ? 'expired' : 'overdue';
  return daysBetween(today, d.date) <= SOON_DAYS ? 'soon' : 'later';
}
