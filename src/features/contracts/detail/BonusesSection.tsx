import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { bonuses as bonusRepo } from '@/data/repositories/contracts';
import {
  bonusExpectedDate,
  bonusSafety,
  effectiveBonusStatus,
  formatDuration,
} from '@/domain/bonus';
import type { Bonus, BonusKind, Contract, ISODate } from '@/domain/types';
import { Notice, Section } from '@/features/contracts/detail/Section';
import {
  BONUS_KIND_LABEL,
  BONUS_STATUS_LABEL,
  parseDecimal,
  SETTLEMENT_LABEL,
} from '@/features/contracts/labels';
import { useDraft } from '@/features/contracts/useDraft';
import { formatDate, formatEur } from '@/lib/format';

const STATUSES = Object.keys(BONUS_STATUS_LABEL) as Bonus['status'][];

export function BonusesSection({
  contract,
  bonuses,
  today,
}: {
  contract: Contract;
  bonuses: Bonus[];
  today: ISODate;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Section
      title="Boni"
      action={
        adding ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Plus aria-hidden="true" />
            Bonus
          </Button>
        )
      }
    >
      {bonuses.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">Kein Bonus erfasst.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {bonuses.map((bonus) => (
          <BonusItem key={bonus.id} bonus={bonus} contract={contract} today={today} />
        ))}
      </ul>
      {adding ? (
        <BonusForm
          contract={contract}
          onDone={() => {
            setAdding(false);
          }}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        Info, ohne Gewähr: Eine Klausel, nach der der Bonus bei berechtigter Kündigung (z. B. wegen
        Preiserhöhung) entfällt, halten die Verbraucherzentralen für unwirksam. Quelle:
        Verbraucherzentralen.
      </p>
    </Section>
  );
}

function BonusItem({
  bonus,
  contract,
  today,
}: {
  bonus: Bonus;
  contract: Contract;
  today: ISODate;
}) {
  const label = BONUS_KIND_LABEL[bonus.kind];
  const status = effectiveBonusStatus(bonus, contract.deliveryStart, today);
  const safety = bonus.requiresDeliveryMonths
    ? bonusSafety(contract.deliveryStart, contract.deliveryEnd, bonus.requiresDeliveryMonths)
    : null;
  const settled = status === 'received' || status === 'offset';

  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-medium">
            {label} · {formatEur(bonus.amountEur)}
          </span>
          <span className="text-muted-foreground">
            {SETTLEMENT_LABEL[bonus.settlement]}
            {bonus.requiresDeliveryMonths
              ? ` · nach ${bonus.requiresDeliveryMonths} Monaten Belieferung`
              : ''}
          </span>
          {bonus.condition ? (
            <span className="text-xs text-muted-foreground">„{bonus.condition}“</span>
          ) : null}
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${label} löschen`}
          onClick={() => {
            void bonusRepo.remove(bonus.id);
          }}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Status">
          <NativeSelect
            aria-label={`Status ${label}`}
            value={status}
            onChange={(event) => {
              const next = event.target.value as Bonus['status'];
              const settles = next === 'received' || next === 'offset';
              void bonusRepo.update(bonus.id, {
                status: next,
                ...(settles && !bonus.receivedAt ? { receivedAt: today } : {}),
              });
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {BONUS_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {settled ? (
          <Field label={status === 'offset' ? 'Verrechnet am' : 'Eingang am'}>
            <Input
              type="date"
              value={bonus.receivedAt ?? ''}
              onChange={(event) => {
                if (event.target.value)
                  void bonusRepo.update(bonus.id, { receivedAt: event.target.value });
              }}
            />
          </Field>
        ) : (
          <p className="pb-2 text-xs text-muted-foreground">
            erwartet ab {formatDate(bonusExpectedDate(bonus, contract.deliveryStart))}
          </p>
        )}
      </div>
      {status === 'due' ? (
        <Badge variant="warning">
          {bonus.kind === 'instant'
            ? 'Sofortbonus eingegangen? Bitte prüfen.'
            : 'Fällig – Rechnung auf Bonus prüfen.'}
        </Badge>
      ) : null}
      {safety && !settled ? (
        safety.ok === false ? (
          <Notice tone="danger">
            Bonus in Gefahr: nur {safety.delivered ? formatDuration(safety.delivered) : '–'}{' '}
            Belieferung. Nötiges Lieferende: mindestens {formatDate(safety.requiredEnd)}.
          </Notice>
        ) : safety.ok ? (
          <Notice tone="savings">
            Bonus gesichert: {bonus.requiresDeliveryMonths} Monate Belieferung am{' '}
            {formatDate(safety.requiredEnd)} erreicht.
          </Notice>
        ) : (
          <p className="text-xs text-muted-foreground">
            {bonus.requiresDeliveryMonths} Monate Belieferung erreicht am{' '}
            {formatDate(safety.requiredEnd)} – das Lieferende darf nicht davor liegen.
          </p>
        )
      ) : null}
    </li>
  );
}

function BonusForm({ contract, onDone }: { contract: Contract; onDone: () => void }) {
  const { values, bind } = useDraft({
    kind: 'new_customer',
    amount: '',
    settlement: 'offset_in_bill',
    months: '12',
    condition: '',
  });
  const [error, setError] = useState<string>();
  return (
    <form
      aria-label="Bonus hinzufügen"
      noValidate
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = parseDecimal(values.amount);
        if (!(amount > 0)) {
          setError('Bitte den Betrag angeben.');
          return;
        }
        const months = Number(values.months);
        void bonusRepo
          .add({
            contractId: contract.id,
            kind: values.kind as BonusKind,
            amountEur: amount,
            condition: values.condition,
            settlement: values.settlement === 'payout' ? 'payout' : 'offset_in_bill',
            ...(months > 0 ? { requiresDeliveryMonths: months } : {}),
            status: 'promised',
            ...(contract.isDemo ? { isDemo: true } : {}),
          })
          .then(() => {
            toast.success('Bonus gespeichert');
            onDone();
          });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Art">
          <NativeSelect {...bind('kind')}>
            {Object.entries(BONUS_KIND_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Betrag (€)" error={error}>
          <Input inputMode="decimal" autoComplete="off" {...bind('amount')} />
        </Field>
        <Field label="Auszahlung">
          <NativeSelect {...bind('settlement')}>
            <option value="offset_in_bill">mit Rechnung verrechnet</option>
            <option value="payout">Überweisung</option>
          </NativeSelect>
        </Field>
        <Field label="Mindestbelieferung (Monate)">
          <Input inputMode="numeric" {...bind('months')} />
        </Field>
      </div>
      <Field label="Bedingung (Wortlaut AGB)">
        <Input autoComplete="off" {...bind('condition')} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}
