import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import type { ContractData } from '@/data/hooks';
import { setSwitchStep } from '@/data/repositories/contracts';
import { bonusSafety, formatDuration } from '@/domain/bonus';
import { contractStatus } from '@/domain/contractStatus';
import { addDays, daysBetween } from '@/domain/dates';
import { earliestDeliveryEnd, type Deadline } from '@/domain/deadlines';
import {
  cancellationLetter,
  meterReadingMessage,
  successorOf,
  suggestedDeliveryEnd,
  switchProgress,
} from '@/domain/switch';
import type { Contract, ISODate, Meter, Reading } from '@/domain/types';
import { Notice, Section } from '@/features/contracts/detail/Section';
import { BONUS_KIND_LABEL } from '@/features/contracts/labels';
import { ENERGY } from '@/features/shared/energy';
import { DeadlineList } from '@/features/switch/DeadlineList';
import { TextGenerator } from '@/features/switch/TextGenerator';
import { formatCountdown, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const FLOW = [
  { status: 'active', label: 'Aktiv' },
  { status: 'cancelled', label: 'Gekündigt' },
  { status: 'ended', label: 'Beendet' },
] as const;

const SETTLED = ['received', 'offset', 'forfeited'];

/** Wechsel-Cockpit für einen Vertrag: Status, Countdown, Bonus-Check, Checkliste, Texte, Fristen. */
export function SwitchCard({
  contract,
  data,
  meters,
  readings,
  deadlines,
  today,
}: {
  contract: Contract;
  data: ContractData;
  meters: Meter[];
  readings: Reading[];
  deadlines: Deadline[];
  today: ISODate;
}) {
  const energy = ENERGY[contract.energyType];
  const Icon = energy.icon;
  const status = contractStatus(contract, today);
  const flowIndex = status === 'ended' ? 2 : status === 'cancelled' ? 1 : 0;
  const bonuses = data.bonuses.filter((b) => b.contractId === contract.id);
  const bills = data.bills.filter((b) => b.contractId === contract.id);
  const successor = successorOf(contract, data.contracts);
  const energyMeterIds = new Set(
    meters.filter((m) => m.energyType === contract.energyType).map((m) => m.id),
  );
  const energyReadings = readings
    .filter((r) => energyMeterIds.has(r.meterId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const progress = switchProgress({
    contract,
    successor,
    bonuses,
    bills,
    readingDates: energyReadings.map((r) => r.date),
  });
  const doneCount = progress.filter((p) => p.done).length;
  const cancelled = Boolean(contract.cancellation?.sentAt);
  const suggestion =
    !cancelled && status !== 'ended' ? suggestedDeliveryEnd(contract, bonuses, today) : undefined;
  const plannedEnd = contract.deliveryEnd ?? suggestion?.date;
  const own = deadlines.filter((d) => d.contractId === contract.id);
  const cancelDeadline = own.find((d) => d.kind === 'cancellation');

  const switchDay = contract.deliveryEnd ? addDays(contract.deliveryEnd, 1) : undefined;
  const switchReading = switchDay
    ? energyReadings.find((r) => Math.abs(daysBetween(r.date, switchDay)) <= 1)
    : undefined;
  const reportReading = switchReading ?? energyReadings.at(-1);
  const reportMeter = meters.find((m) => m.id === reportReading?.meterId);
  const contractMeter = meters.find((m) => m.id === contract.meterId) ?? reportMeter;

  const bonusChecks = bonuses
    .filter((b) => b.requiresDeliveryMonths && !SETTLED.includes(b.status))
    .map((b) => ({
      bonus: b,
      safety: bonusSafety(contract.deliveryStart, plannedEnd, b.requiresDeliveryMonths ?? 12),
    }));

  return (
    <Section
      title={`${energy.label}: ${contract.provider}`}
      description={`${contract.tariffName} · seit ${formatDate(contract.deliveryStart)}`}
      action={<Icon aria-hidden="true" className={cn('size-5', energy.text)} />}
    >
      <ol aria-label="Vertragsstatus" className="grid grid-cols-3 gap-1 text-center text-xs">
        {FLOW.map((step, i) => (
          <li
            key={step.status}
            aria-current={i === flowIndex ? 'step' : undefined}
            className={cn(
              'rounded-full border px-2 py-1',
              i === flowIndex &&
                'border-transparent bg-primary font-medium text-primary-foreground',
              i < flowIndex && 'text-muted-foreground line-through decoration-1',
            )}
          >
            {step.label}
          </li>
        ))}
      </ol>

      {status === 'ended' ? (
        <Notice tone="muted">
          Beendet am {formatDate(contract.deliveryEnd ?? today)} – jetzt Schlussrechnung, Bonus und
          Guthaben im Blick behalten.
        </Notice>
      ) : cancelled ? (
        <Notice tone="savings">
          <p className="font-medium">
            Gekündigt am {formatDate(contract.cancellation?.sentAt ?? today)}
            {contract.cancellation?.channel ? ` (${contract.cancellation.channel})` : ''}
          </p>
          <p>
            {contract.deliveryEnd
              ? `Lieferende ${formatDate(contract.deliveryEnd)} · ${formatCountdown(daysBetween(today, contract.deliveryEnd))}`
              : 'Lieferende noch nicht bestätigt – Bestätigung abwarten und in der Vertragsseite eintragen.'}
          </p>
        </Notice>
      ) : cancelDeadline ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">Kündigen bis</p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatDate(cancelDeadline.date)}{' '}
            <span className="text-base font-medium text-muted-foreground">
              · {formatCountdown(daysBetween(today, cancelDeadline.date))}
            </span>
          </p>
          {cancelDeadline.recommendedDate && cancelDeadline.recommendedDate >= today ? (
            <p className="text-xs text-muted-foreground">
              Empfohlen bis {formatDate(cancelDeadline.recommendedDate)} (Puffer für Post und
              Bearbeitung)
            </p>
          ) : null}
        </div>
      ) : (
        <Notice tone="muted">
          Monatlich kündbar. Bei Kündigung heute endet die Lieferung frühestens am{' '}
          {formatDate(earliestDeliveryEnd(contract, today) ?? today)}.
        </Notice>
      )}

      {suggestion ? (
        <p className="text-sm">
          <span className="font-medium">Vorschlag: Lieferende {formatDate(suggestion.date)}</span> –{' '}
          {suggestion.reason === 'bonus'
            ? 'so lange muss geliefert werden, damit der Bonus sicher ist; die Frist ist damit auch gewahrt.'
            : 'frühestmöglich mit gewahrter Kündigungsfrist.'}
        </p>
      ) : null}

      {bonusChecks.map(({ bonus, safety }) =>
        safety.ok === false ? (
          <Notice key={bonus.id} tone="danger">
            {BONUS_KIND_LABEL[bonus.kind]} in Gefahr: nur{' '}
            {safety.delivered ? formatDuration(safety.delivered) : '–'} Belieferung. Nötiges
            Lieferende: mindestens {formatDate(safety.requiredEnd)}.
          </Notice>
        ) : safety.ok ? (
          <Notice key={bonus.id} tone="savings">
            {BONUS_KIND_LABEL[bonus.kind]} gesichert: {bonus.requiresDeliveryMonths} Monate
            Belieferung am {formatDate(safety.requiredEnd)} erreicht.
          </Notice>
        ) : (
          <Notice key={bonus.id} tone="muted">
            {BONUS_KIND_LABEL[bonus.kind]}: Lieferende mindestens {formatDate(safety.requiredEnd)}.
          </Notice>
        ),
      )}

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center justify-between text-sm font-semibold">
          Checkliste
          <span className="text-xs font-normal text-muted-foreground">
            {doneCount} von {progress.length} erledigt
          </span>
        </h3>
        <ul className="flex flex-col gap-1.5">
          {progress.map((p) => (
            <li key={p.step}>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  checked={p.done}
                  disabled={p.auto}
                  onChange={(event) => {
                    void setSwitchStep(contract.id, p.step, event.target.checked ? today : null);
                  }}
                />
                <span className={cn(p.done && 'text-muted-foreground')}>
                  {p.label}
                  {p.date ? ` · ${formatDate(p.date)}` : ''}
                  {p.auto ? (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-xs">
                      <CheckCircle2 aria-hidden="true" className="size-3" />
                      automatisch erkannt
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Texte</h3>
        {status !== 'ended' && plannedEnd ? (
          <TextGenerator
            title="Kündigungsschreiben"
            {...cancellationLetter({ contract, meter: contractMeter, endDate: plannedEnd })}
          />
        ) : null}
        {reportReading && reportMeter ? (
          <TextGenerator
            title={`Zählerstandsmeldung (${formatDate(reportReading.date)})`}
            {...meterReadingMessage({
              meter: reportMeter,
              reading: reportReading,
              customerNumber: contract.customerNumber,
            })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Für die Zählerstandsmeldung zuerst am Wechseltag ablesen.
          </p>
        )}
        {switchDay && !switchReading && switchDay >= today ? (
          <p className="text-xs text-muted-foreground">
            Am Wechseltag ({formatDate(switchDay)}) ablesen, Foto machen und an beide Anbieter
            melden – ohne Meldung schätzt der Netzbetreiber.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Fristen</h3>
        <DeadlineList deadlines={own} today={today} label={`Fristen ${contract.provider}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <Link
          to={`/vertraege/${contract.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          Vertrag öffnen
        </Link>
        {successor ? (
          <Badge variant="secondary">
            Danach: {successor.provider} ab {formatDate(successor.deliveryStart)}
          </Badge>
        ) : null}
      </div>
    </Section>
  );
}
