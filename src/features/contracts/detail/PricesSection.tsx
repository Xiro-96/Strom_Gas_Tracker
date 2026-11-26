import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { pricePeriods } from '@/data/repositories/contracts';
import { priceChangeNotice } from '@/domain/contractStatus';
import { isISODate } from '@/domain/dates';
import { ctPerKwhToEurPerM3, eurPerM3ToCtPerKwh, gasFactorsAt } from '@/domain/gas';
import type { Contract, ISODate, Meter, PricePeriod } from '@/domain/types';
import { Notice, Section } from '@/features/contracts/detail/Section';
import { parseDecimal } from '@/features/contracts/labels';
import { useDraft } from '@/features/contracts/useDraft';
import { formatCt, formatDate, formatEur, formatNumber } from '@/lib/format';

export function PricesSection({
  contract,
  periods,
  meter,
  today,
}: {
  contract: Contract;
  periods: PricePeriod[];
  meter: Meter | undefined;
  today: ISODate;
}) {
  const [adding, setAdding] = useState(false);
  const sorted = [...periods].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const isGas = contract.energyType === 'gas';
  const m3 = (p: PricePeriod) => {
    const f = gasFactorsAt(meter ?? {}, p.validFrom);
    return `${formatNumber(ctPerKwhToEurPerM3(p.energyPriceCt, f.zFactor, f.calorificValue), 4, 4)} €/m³`;
  };

  return (
    <Section
      title="Preise"
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
            Preisänderung erfassen
          </Button>
        )
      }
    >
      {sorted.slice(1).map((period, index) => {
        const notice = priceChangeNotice(period, today);
        if (!notice.open) return null;
        const previous = sorted[index];
        const increase =
          previous !== undefined &&
          (period.energyPriceCt > previous.energyPriceCt ||
            period.basePriceEurPerYear > previous.basePriceEurPerYear);
        return (
          <Notice key={period.id} tone="warning">
            <p className="font-medium">
              {increase ? 'Preiserhöhung' : 'Preisänderung'} zum {formatDate(period.validFrom)}
            </p>
            <p>
              Sonderkündigungsrecht ohne Frist bis {formatDate(notice.deadline)} – selbst kündigen,
              nicht über den neuen Anbieter.
            </p>
            {notice.lateNotice ? (
              <p>Die Mitteilung kam weniger als 1 Monat vor der Änderung.</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Info, ohne Gewähr · Quelle: § 41 Abs. 5 EnWG
            </p>
          </Notice>
        );
      })}
      <ul className="flex flex-col divide-y">
        {sorted.map((period) => (
          <li key={period.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">ab {formatDate(period.validFrom)}</span>
              <span className="text-muted-foreground">
                {formatCt(period.energyPriceCt)}
                {isGas ? ` (${m3(period)})` : ''} · {formatEur(period.basePriceEurPerYear)}/Jahr
              </span>
              {period.changeNoticeReceivedAt ? (
                <span className="text-xs text-muted-foreground">
                  Mitteilung erhalten am {formatDate(period.changeNoticeReceivedAt)}
                </span>
              ) : null}
            </div>
            {sorted.length > 1 ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Preis ab ${formatDate(period.validFrom)} löschen`}
                onClick={() => {
                  void pricePeriods.remove(period.id);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {adding ? (
        <PriceChangeForm
          contract={contract}
          meter={meter}
          existing={sorted}
          onDone={() => {
            setAdding(false);
          }}
        />
      ) : null}
    </Section>
  );
}

function PriceChangeForm({
  contract,
  meter,
  existing,
  onDone,
}: {
  contract: Contract;
  meter: Meter | undefined;
  existing: PricePeriod[];
  onDone: () => void;
}) {
  const { values, bind } = useDraft({
    validFrom: '',
    energyPrice: '',
    unit: 'ct_per_kwh',
    basePrice: '',
    noticeAt: '',
  });
  const [errors, setErrors] = useState<
    Partial<Record<'validFrom' | 'energyPrice' | 'basePrice', string>>
  >({});
  const isGas = contract.energyType === 'gas';
  const unitLabel = values.unit === 'eur_per_m3' ? '€/m³' : 'ct/kWh';

  const toCt = (value: number) => {
    if (values.unit !== 'eur_per_m3') return value;
    const f = gasFactorsAt(meter ?? {}, values.validFrom || contract.deliveryStart);
    return eurPerM3ToCtPerKwh(value, f.zFactor, f.calorificValue);
  };

  return (
    <form
      aria-label="Preisänderung"
      noValidate
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const energy = parseDecimal(values.energyPrice);
        const base = parseDecimal(values.basePrice);
        const next: typeof errors = {};
        if (!isISODate(values.validFrom)) next.validFrom = 'Bitte das Datum wählen.';
        else if (existing.some((p) => p.validFrom === values.validFrom))
          next.validFrom = 'Für diesen Tag gibt es schon einen Preis.';
        else if (values.validFrom <= contract.deliveryStart)
          next.validFrom = 'Eine Preisänderung liegt nach dem Lieferbeginn.';
        if (!(energy >= 0)) next.energyPrice = 'Bitte den Arbeitspreis angeben.';
        if (!(base >= 0)) next.basePrice = 'Bitte den Grundpreis angeben.';
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        void pricePeriods
          .add({
            contractId: contract.id,
            validFrom: values.validFrom,
            energyPriceCt: toCt(energy),
            basePriceEurPerYear: base,
            enteredAs: values.unit === 'eur_per_m3' ? 'eur_per_m3' : 'ct_per_kwh',
            ...(values.noticeAt ? { changeNoticeReceivedAt: values.noticeAt } : {}),
            ...(contract.isDemo ? { isDemo: true } : {}),
          })
          .then(() => {
            toast.success('Preisänderung gespeichert');
            onDone();
          });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gültig ab" error={errors.validFrom}>
          <Input type="date" {...bind('validFrom')} />
        </Field>
        <Field label="Mitteilung erhalten am">
          <Input type="date" {...bind('noticeAt')} />
        </Field>
        <Field label={`Arbeitspreis (${unitLabel})`} error={errors.energyPrice}>
          <Input inputMode="decimal" autoComplete="off" {...bind('energyPrice')} />
        </Field>
        {isGas ? (
          <Field label="Einheit">
            <NativeSelect {...bind('unit')}>
              <option value="ct_per_kwh">ct/kWh</option>
              <option value="eur_per_m3">€/m³</option>
            </NativeSelect>
          </Field>
        ) : null}
        <Field label="Grundpreis (€/Jahr)" error={errors.basePrice}>
          <Input inputMode="decimal" autoComplete="off" {...bind('basePrice')} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}
