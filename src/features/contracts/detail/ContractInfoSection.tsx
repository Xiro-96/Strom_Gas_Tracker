import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { updateContract, type NewContract } from '@/data/repositories/contracts';
import { isISODate } from '@/domain/dates';
import type { Contract } from '@/domain/types';
import { Section } from '@/features/contracts/detail/Section';
import { GUARANTEE_SCOPE_LABEL, NOTICE_UNIT_LABEL } from '@/features/contracts/labels';
import { useDraft } from '@/features/contracts/useDraft';
import { formatDate } from '@/lib/format';

export function ContractInfoSection({ contract }: { contract: Contract }) {
  const [editing, setEditing] = useState(false);
  const rows: [string, string | undefined][] = [
    ['Konzern/Marke', contract.providerGroup],
    ['Kundennummer', contract.customerNumber],
    ['Vertragsschluss', contract.contractDate ? formatDate(contract.contractDate) : undefined],
    ['Lieferbeginn', formatDate(contract.deliveryStart)],
    ['Lieferende', contract.deliveryEnd ? formatDate(contract.deliveryEnd) : 'offen'],
    [
      'Erstlaufzeit',
      contract.minTermMonths
        ? `${contract.minTermMonths} Monate ab ${contract.termStartsAt === 'delivery' ? 'Lieferbeginn' : 'Vertragsschluss'}`
        : undefined,
    ],
    [
      'Kündigungsfrist',
      `${contract.noticePeriod.value} ${NOTICE_UNIT_LABEL[contract.noticePeriod.unit]}`,
    ],
    [
      'Danach',
      contract.renewal.type === 'monthly'
        ? 'monatlich kündbar'
        : `Verlängerung um ${contract.renewal.months} Monate`,
    ],
    [
      'Preisgarantie',
      contract.priceGuarantee
        ? `bis ${formatDate(contract.priceGuarantee.until)}, ${GUARANTEE_SCOPE_LABEL[contract.priceGuarantee.scope]}`
        : undefined,
    ],
  ];
  return (
    <Section
      title="Vertragsdaten"
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
            Bearbeiten
          </Button>
        )
      }
    >
      {editing ? (
        <ContractInfoForm
          contract={contract}
          onDone={() => {
            setEditing(false);
          }}
        />
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows
            .filter((row): row is [string, string] => Boolean(row[1]))
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      )}
    </Section>
  );
}

function ContractInfoForm({ contract, onDone }: { contract: Contract; onDone: () => void }) {
  const { values, bind } = useDraft({
    provider: contract.provider,
    providerGroup: contract.providerGroup ?? '',
    tariffName: contract.tariffName,
    customerNumber: contract.customerNumber ?? '',
    contractDate: contract.contractDate ?? '',
    deliveryStart: contract.deliveryStart,
    deliveryEnd: contract.deliveryEnd ?? '',
    minTermMonths: contract.minTermMonths ? String(contract.minTermMonths) : '',
    noticeValue: String(contract.noticePeriod.value),
    noticeUnit: contract.noticePeriod.unit,
    guaranteeUntil: contract.priceGuarantee?.until ?? '',
    guaranteeScope: contract.priceGuarantee?.scope ?? 'limited',
  });
  const [error, setError] = useState<string>();

  return (
    <form
      aria-label="Vertragsdaten bearbeiten"
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !values.provider.trim() ||
          !values.tariffName.trim() ||
          !isISODate(values.deliveryStart)
        ) {
          setError('Anbieter, Tarif und Lieferbeginn sind Pflicht.');
          return;
        }
        if (isISODate(values.deliveryEnd) && values.deliveryEnd < values.deliveryStart) {
          setError('Das Lieferende liegt vor dem Lieferbeginn.');
          return;
        }
        const { deliveryEnd: _end, priceGuarantee: _guarantee, ...rest } = contract;
        const next: Partial<NewContract> = {
          ...rest,
          provider: values.provider.trim(),
          tariffName: values.tariffName.trim(),
          deliveryStart: values.deliveryStart,
          noticePeriod: {
            value: Math.max(0, Math.round(Number(values.noticeValue) || 0)),
            unit: values.noticeUnit,
          },
          ...(values.providerGroup.trim() ? { providerGroup: values.providerGroup.trim() } : {}),
          ...(values.customerNumber.trim() ? { customerNumber: values.customerNumber.trim() } : {}),
          ...(isISODate(values.contractDate) ? { contractDate: values.contractDate } : {}),
          ...(isISODate(values.deliveryEnd) ? { deliveryEnd: values.deliveryEnd } : {}),
          ...(Number(values.minTermMonths) > 0
            ? { minTermMonths: Number(values.minTermMonths) }
            : {}),
          ...(isISODate(values.guaranteeUntil)
            ? {
                priceGuarantee: {
                  until: values.guaranteeUntil,
                  scope: values.guaranteeScope,
                },
              }
            : {}),
        };
        updateContract(contract.id, next, { replace: true })
          .then(() => {
            toast.success('Vertragsdaten gespeichert');
            onDone();
          })
          .catch((e: unknown) => {
            setError(e instanceof Error ? e.message : String(e));
          });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Anbieter">
          <Input autoComplete="off" {...bind('provider')} />
        </Field>
        <Field label="Konzern/Marke">
          <Input autoComplete="off" {...bind('providerGroup')} />
        </Field>
        <Field label="Tarif">
          <Input autoComplete="off" {...bind('tariffName')} />
        </Field>
        <Field label="Kundennummer">
          <Input autoComplete="off" {...bind('customerNumber')} />
        </Field>
        <Field label="Vertragsschluss">
          <Input type="date" {...bind('contractDate')} />
        </Field>
        <Field label="Lieferbeginn">
          <Input type="date" {...bind('deliveryStart')} />
        </Field>
        <Field label="Lieferende">
          <Input type="date" {...bind('deliveryEnd')} />
        </Field>
        <Field label="Erstlaufzeit (Monate)">
          <Input inputMode="numeric" {...bind('minTermMonths')} />
        </Field>
        <Field label="Kündigungsfrist">
          <Input inputMode="numeric" {...bind('noticeValue')} />
        </Field>
        <Field label="Einheit">
          <NativeSelect {...bind('noticeUnit')}>
            {Object.entries(NOTICE_UNIT_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Preisgarantie bis">
          <Input type="date" {...bind('guaranteeUntil')} />
        </Field>
        <Field label="Umfang">
          <NativeSelect {...bind('guaranteeScope')}>
            {Object.entries(GUARANTEE_SCOPE_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}
