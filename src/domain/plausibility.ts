import { daysBetween } from '@/domain/dates';
import { sumWeights } from '@/domain/distribution';
import { gasFactorsAt } from '@/domain/gas';
import { buildIntervals, readingDelta, sortReadings } from '@/domain/intervals';
import type { EnergyType, GasFactorEntry, ISODate, ReadingKind } from '@/domain/types';

export type IssueLevel = 'error' | 'confirm' | 'warning' | 'info';
export type IssueCode =
  | 'future_date'
  | 'same_date'
  | 'below_previous'
  | 'above_next'
  | 'rollover'
  | 'rate_outlier'
  | 'too_many_decimals';

export interface Issue {
  level: IssueLevel;
  code: IssueCode;
  message: string;
}

export interface PlausibilityInput {
  value: number;
  date: ISODate;
  today: ISODate;
  /** Nachkommastellen der Eingabe (aus parseMeterInput). */
  fractionDigits: number;
  meter: {
    energyType: EnergyType;
    decimals: number;
    rolloverModulus?: number;
    gasFactors?: GasFactorEntry[];
  };
  /** Vorhandene Ablesungen dieses Zählers. */
  readings: readonly { id?: string; date: ISODate; value: number; kind: ReadingKind }[];
  baseLoadShare: number;
  /** Beim Bearbeiten: die Ablesung selbst nicht mitprüfen. */
  editingId?: string;
}

export interface ReadingPreview {
  previousDate: ISODate;
  previousValue: number;
  delta: number;
  days: number;
  kwh: number;
  perDay: number;
}

export interface ReadingCheck {
  issues: Issue[];
  /** false bei Fehlern; Rückfragen müssen in der UI bestätigt werden. */
  canSave: boolean;
  preview?: ReadingPreview;
}

const OUTLIER_THRESHOLD = 0.5;
const MEDIAN_WINDOW = 5;

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 3 });
const fmtDate = (d: ISODate) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Spec 6.7 – Plausibilität einer neuen oder bearbeiteten Ablesung. */
export function checkReading(input: PlausibilityInput): ReadingCheck {
  const { value, date, today, meter } = input;
  const issues: Issue[] = [];
  const others = sortReadings(
    input.readings.filter((r) => !input.editingId || r.id !== input.editingId),
  );

  if (date > today) {
    issues.push({
      level: 'error',
      code: 'future_date',
      message: 'Das Datum liegt in der Zukunft.',
    });
  }

  const sameDay = others.find((r) => r.date === date);
  if (sameDay) {
    issues.push({
      level: 'confirm',
      code: 'same_date',
      message: `Für den ${fmtDate(date)} gibt es schon einen Stand (${fmt(sameDay.value)}). Ersetzen?`,
    });
  }

  const previous = others.filter((r) => r.date < date).at(-1);
  const next = others.find((r) => r.date > date);
  let preview: ReadingPreview | undefined;

  if (previous) {
    const result = readingDelta(previous.value, value, meter.rolloverModulus);
    if (!result) {
      issues.push({
        level: 'error',
        code: 'below_previous',
        message: `Der Stand ist kleiner als der letzte (${fmt(previous.value)} am ${fmtDate(previous.date)}).`,
      });
    } else {
      if (result.rollover) {
        issues.push({
          level: 'confirm',
          code: 'rollover',
          message: `Ist das Zählwerk übergelaufen (über ${fmt((meter.rolloverModulus ?? 0) - 1)} hinaus)? Dann zählen wir ${fmt(result.delta)} als Verbrauch.`,
        });
      }
      const days = daysBetween(previous.date, date);
      if (days > 0) {
        const factor =
          meter.energyType === 'gas'
            ? (({ zFactor, calorificValue }) => zFactor * calorificValue)(
                gasFactorsAt(meter, previous.date),
              )
            : 1;
        const kwh = result.delta * factor;
        preview = {
          previousDate: previous.date,
          previousValue: previous.value,
          delta: result.delta,
          days,
          kwh,
          perDay: kwh / days,
        };
        const outlier = rateOutlier(input, others, previous.date, kwh);
        if (outlier) issues.push(outlier);
      }
    }
  }

  if (next && value > next.value) {
    issues.push({
      level: 'error',
      code: 'above_next',
      message: `Der Stand ist größer als der folgende (${fmt(next.value)} am ${fmtDate(next.date)}).`,
    });
  }

  if (input.fractionDigits > meter.decimals) {
    issues.push({
      level: 'info',
      code: 'too_many_decimals',
      message: `Dein Zähler zeigt nur ${meter.decimals} Nachkommastelle${meter.decimals === 1 ? '' : 'n'}.`,
    });
  }

  return { issues, canSave: !issues.some((i) => i.level === 'error'), preview };
}

/** Tagesrate weicht > 50 % vom Median der letzten 5 Intervalle ab (Gas: auf anteil normiert). */
function rateOutlier(
  input: PlausibilityInput,
  others: PlausibilityInput['readings'],
  previousDate: ISODate,
  newKwh: number,
): Issue | null {
  const { meter, date, baseLoadShare } = input;
  const normalize = (from: ISODate, to: ISODate, kwh: number) =>
    kwh / sumWeights(from, to, meter.energyType, baseLoadShare);
  const { intervals } = buildIntervals(
    others.filter((r) => r.date <= previousDate).map((r) => ({ ...r, meterId: 'm' })),
    [{ id: 'm', ...meter }],
  );
  const recent = intervals.slice(-MEDIAN_WINDOW);
  if (recent.length < 2) return null;
  const typical = median(recent.map((i) => normalize(i.from, i.to, i.kwh)));
  if (typical <= 0) return null;
  const current = normalize(previousDate, date, newKwh);
  if (Math.abs(current - typical) / typical <= OUTLIER_THRESHOLD) return null;
  const days = daysBetween(previousDate, date);
  const typicalPerDay =
    (typical * sumWeights(previousDate, date, meter.energyType, baseLoadShare)) / days;
  return {
    level: 'warning',
    code: 'rate_outlier',
    message: `Ungewöhnlich: ${fmt(newKwh / days)} kWh/Tag statt sonst etwa ${fmt(typicalPerDay)}. Tippfehler?`,
  };
}
