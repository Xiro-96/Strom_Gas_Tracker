import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { updateContract } from '@/data/repositories/contracts';
import type { ContractForecast } from '@/domain/contractForecast';
import { isISODate } from '@/domain/dates';
import type { Contract } from '@/domain/types';
import { Section } from '@/features/contracts/detail/Section';
import { parseDecimal } from '@/features/contracts/labels';
import { useDraft } from '@/features/contracts/useDraft';
import { formatDate, formatEur } from '@/lib/format';

export function InstallmentsSection({
  contract,
  forecast,
}: {
  contract: Contract;
  forecast: ContractForecast | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const plan = [...contract.installmentPlan].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const savePlan = (next: Contract['installmentPlan']) =>
    updateContract(contract.id, { installmentPlan: next });

  return (
    <Section
      title="Abschläge"
      action={
        editing ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" />
            Abschlag ändern
          </Button>
        )
      }
    >
      <ul className="flex flex-col divide-y">
        {plan.map((entry) => (
          <li
            key={entry.validFrom}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span>
              ab {formatDate(entry.validFrom)}:{' '}
              <span className="font-medium">{formatEur(entry.amountEur)}</span> am{' '}
              {entry.dayOfMonth}. des Monats
            </span>
            {plan.length > 1 ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Abschlag ab ${formatDate(entry.validFrom)} löschen`}
                onClick={() => {
                  void savePlan(plan.filter((e) => e !== entry));
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {forecast ? (
        <p className="text-xs text-muted-foreground">
          Bis heute gezahlt (laut Plan und Abweichungen): {formatEur(forecast.paidEur)} · noch{' '}
          {forecast.remainingInstallments} Abschläge bis {formatDate(forecast.periodTo)}.
        </p>
      ) : null}
      {editing ? (
        <InstallmentForm
          plan={plan}
          onSave={async (entry) => {
            await savePlan(
              [...plan.filter((e) => e.validFrom !== entry.validFrom), entry].sort((a, b) =>
                a.validFrom.localeCompare(b.validFrom),
              ),
            );
            toast.success('Abschlag gespeichert');
            setEditing(false);
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
      ) : null}
    </Section>
  );
}

function InstallmentForm({
  plan,
  onSave,
  onCancel,
}: {
  plan: Contract['installmentPlan'];
  onSave: (entry: Contract['installmentPlan'][number]) => Promise<void>;
  onCancel: () => void;
}) {
  const last = plan.at(-1);
  const { values, bind } = useDraft({
    validFrom: '',
    amount: '',
    day: String(last?.dayOfMonth ?? 15),
  });
  const [errors, setErrors] = useState<{ validFrom?: string; amount?: string }>({});
  return (
    <form
      aria-label="Abschlag ändern"
      noValidate
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = parseDecimal(values.amount);
        const next: typeof errors = {};
        if (!isISODate(values.validFrom)) next.validFrom = 'Bitte das Datum wählen.';
        if (!(amount >= 0)) next.amount = 'Bitte den Betrag angeben.';
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        void onSave({
          validFrom: values.validFrom,
          amountEur: amount,
          dayOfMonth: Number(values.day),
        });
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="Gültig ab" error={errors.validFrom}>
          <Input type="date" {...bind('validFrom')} />
        </Field>
        <Field label="Betrag (€)" error={errors.amount}>
          <Input inputMode="decimal" autoComplete="off" {...bind('amount')} />
        </Field>
        <Field label="Abbuchung am">
          <NativeSelect {...bind('day')}>
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <option key={d} value={d}>
                {d}.
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}
