import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { createContract } from '@/data/repositories/contracts';
import { bonusSafety, formatDuration } from '@/domain/bonus';
import { isISODate, todayISO } from '@/domain/dates';
import { eurPerM3ToCtPerKwh, gasFactorsAt } from '@/domain/gas';
import { parseMeterInput } from '@/domain/parse';
import type { BonusKind, EnergyType, Meter } from '@/domain/types';
import { ENERGY } from '@/features/shared/energy';
import { formatCt, formatDate, formatEur, formatNumber } from '@/lib/format';

const num = (s: string) => {
  const r = parseMeterInput(s, { decimals: 4 });
  return r.ok ? r.value : NaN;
};
const optionalDate = z
  .string()
  .refine((v) => v === '' || isISODate(v), 'Bitte ein gültiges Datum wählen.');
const amount = (message: string) => z.string().refine((v) => Number.isFinite(num(v)), message);

const schema = z.object({
  energyType: z.enum(['electricity', 'gas']),
  provider: z.string().trim().min(1, 'Bitte den Anbieter angeben.'),
  providerGroup: z.string().trim(),
  tariffName: z.string().trim().min(1, 'Bitte den Tarifnamen angeben.'),
  customerNumber: z.string().trim(),
  contractDate: optionalDate,
  deliveryStart: z.string().refine(isISODate, 'Bitte den Lieferbeginn angeben.'),
  energyPrice: amount('Bitte den Arbeitspreis angeben.'),
  energyPriceUnit: z.enum(['ct_per_kwh', 'eur_per_m3']),
  basePrice: amount('Bitte den Grundpreis angeben.'),
  basePriceUnit: z.enum(['year', 'month']),
  bonuses: z.array(
    z.object({
      kind: z.enum(['instant', 'new_customer', 'loyalty', 'referral', 'other']),
      amount: amount('Betrag fehlt.'),
      settlement: z.enum(['payout', 'offset_in_bill']),
      requiresDeliveryMonths: z.string(),
      condition: z.string(),
    }),
  ),
  minTermMonths: z.string(),
  termStartsAt: z.enum(['delivery', 'contract']),
  noticeValue: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, 'Ganze Zahl angeben.'),
  noticeUnit: z.enum(['days', 'weeks', 'months']),
  renewal: z.enum(['monthly', '12']),
  guaranteeUntil: optionalDate,
  guaranteeScope: z.enum(['full', 'limited', 'energy_only']),
  deliveryEnd: optionalDate,
  installmentAmount: amount('Bitte den monatlichen Abschlag angeben.'),
  installmentDay: z.string(),
});
type Values = z.infer<typeof schema>;
/** Vorbelegung, z. B. aus einem Angebot (Werte wie eingegeben, Dezimalkomma). */
export type WizardInitial = Partial<Omit<Values, 'bonuses'>> & { bonuses?: Values['bonuses'] };

const STEPS: { title: string; fields: FieldPath<Values>[] }[] = [
  {
    title: 'Anbieter & Tarif',
    fields: ['provider', 'tariffName', 'contractDate', 'deliveryStart'],
  },
  { title: 'Preise', fields: ['energyPrice', 'basePrice'] },
  { title: 'Boni', fields: ['bonuses'] },
  {
    title: 'Laufzeit, Fristen, Abschlag',
    fields: ['noticeValue', 'guaranteeUntil', 'deliveryEnd', 'installmentAmount'],
  },
];

const BONUS_KINDS: { value: BonusKind; label: string }[] = [
  { value: 'new_customer', label: 'Neukundenbonus' },
  { value: 'instant', label: 'Sofortbonus' },
  { value: 'loyalty', label: 'Treuebonus' },
  { value: 'referral', label: 'Empfehlung' },
  { value: 'other', label: 'Sonstiger' },
];

interface ContractWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zähler je Energieart (aktueller Zähler); bestimmt Auswahl und Gasfaktoren. */
  meters: Partial<Record<EnergyType, Meter>>;
  defaultEnergy?: EnergyType;
  initial?: WizardInitial;
}

/** Vertrags-Assistent (Spec 7.3): Anbieter & Tarif → Preise → Boni → Laufzeit, Fristen, Abschlag. */
export function ContractWizard(props: ContractWizardProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>{props.open ? <WizardForm {...props} /> : null}</DialogContent>
    </Dialog>
  );
}

function WizardForm({ onOpenChange, meters, defaultEnergy, initial }: ContractWizardProps) {
  const navigate = useNavigate();
  const energies = (['electricity', 'gas'] as const).filter((e) => meters[e]);
  const [step, setStep] = useState(0);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      energyType:
        defaultEnergy && meters[defaultEnergy] ? defaultEnergy : (energies[0] ?? 'electricity'),
      provider: '',
      providerGroup: '',
      tariffName: '',
      customerNumber: '',
      contractDate: '',
      deliveryStart: todayISO(),
      energyPrice: '',
      energyPriceUnit: 'ct_per_kwh',
      basePrice: '',
      basePriceUnit: 'year',
      bonuses: [],
      minTermMonths: '12',
      termStartsAt: 'delivery',
      noticeValue: '1',
      noticeUnit: 'months',
      renewal: 'monthly',
      guaranteeUntil: '',
      guaranteeScope: 'limited',
      deliveryEnd: '',
      installmentAmount: '',
      installmentDay: '15',
      ...initial,
    },
  });
  const { register, control, handleSubmit, trigger, formState } = form;
  const errors = formState.errors;
  const bonusArray = useFieldArray({ control, name: 'bonuses' });
  const v = useWatch({ control });
  const energyType = v.energyType ?? 'electricity';
  const meter = meters[energyType];
  const factors = meter ? gasFactorsAt(meter, v.deliveryStart ?? todayISO()) : undefined;

  const energyPriceCt = (() => {
    const value = num(v.energyPrice ?? '');
    if (!Number.isFinite(value)) return NaN;
    if (v.energyPriceUnit === 'eur_per_m3' && factors)
      return eurPerM3ToCtPerKwh(value, factors.zFactor, factors.calorificValue);
    return value;
  })();
  const basePerYear = (() => {
    const value = num(v.basePrice ?? '');
    return v.basePriceUnit === 'month' ? value * 12 : value;
  })();
  const newCustomerMonths = (v.bonuses ?? [])
    .filter((b) => b.kind === 'new_customer')
    .map((b) => Number(b.requiresDeliveryMonths) || 12);
  const safety =
    newCustomerMonths.length && v.deliveryStart && isISODate(v.deliveryStart)
      ? bonusSafety(
          v.deliveryStart,
          v.deliveryEnd === '' ? undefined : v.deliveryEnd,
          Math.max(...newCustomerMonths),
        )
      : null;

  const next = async () => {
    const ok = await trigger(STEPS[step]?.fields ?? []);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!meter) return;
    const today = todayISO();
    const status =
      values.deliveryStart > today
        ? 'planned'
        : values.deliveryEnd && values.deliveryEnd < today
          ? 'ended'
          : 'active';
    try {
      const contract = await createContract({
        contract: {
          energyType: values.energyType,
          meterId: meter.id,
          provider: values.provider,
          ...(values.providerGroup ? { providerGroup: values.providerGroup } : {}),
          tariffName: values.tariffName,
          ...(values.customerNumber ? { customerNumber: values.customerNumber } : {}),
          ...(values.contractDate ? { contractDate: values.contractDate } : {}),
          deliveryStart: values.deliveryStart,
          ...(values.deliveryEnd ? { deliveryEnd: values.deliveryEnd } : {}),
          ...(values.minTermMonths ? { minTermMonths: Number(values.minTermMonths) } : {}),
          termStartsAt: values.termStartsAt,
          noticePeriod: { value: Number(values.noticeValue), unit: values.noticeUnit },
          renewal:
            values.renewal === 'monthly' ? { type: 'monthly' } : { type: 'fixed', months: 12 },
          ...(values.guaranteeUntil
            ? { priceGuarantee: { until: values.guaranteeUntil, scope: values.guaranteeScope } }
            : {}),
          installmentPlan: [
            {
              validFrom: values.deliveryStart,
              amountEur: num(values.installmentAmount),
              dayOfMonth: Number(values.installmentDay),
            },
          ],
          status,
        },
        price: {
          validFrom: values.deliveryStart,
          energyPriceCt,
          basePriceEurPerYear: basePerYear,
          enteredAs: values.energyPriceUnit,
        },
        bonuses: values.bonuses.map((b) => ({
          kind: b.kind,
          amountEur: num(b.amount),
          condition: b.condition,
          settlement: b.settlement,
          ...(b.requiresDeliveryMonths
            ? { requiresDeliveryMonths: Number(b.requiresDeliveryMonths) }
            : {}),
          status: 'promised' as const,
        })),
      });
      toast.success(`Vertrag ${values.provider} angelegt`);
      onOpenChange(false);
      void navigate(`/vertraege/${contract.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Neuer Vertrag</DialogTitle>
        <DialogDescription>
          Schritt {step + 1} von {STEPS.length}: {STEPS[step]?.title}
        </DialogDescription>
      </DialogHeader>
      <ol className="grid grid-cols-4 gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className={`h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </ol>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) void next();
          else void onSubmit(e);
        }}
      >
        {step === 0 ? (
          <>
            {energies.length > 1 ? (
              <Controller
                control={control}
                name="energyType"
                render={({ field }) => (
                  <ToggleGroup
                    type="single"
                    aria-label="Energieart"
                    className="w-full"
                    value={field.value}
                    onValueChange={(value) => {
                      if (value === 'electricity' || value === 'gas') field.onChange(value);
                    }}
                  >
                    {energies.map((type) => {
                      const Icon = ENERGY[type].icon;
                      return (
                        <ToggleGroupItem key={type} value={type} aria-label={ENERGY[type].label}>
                          <Icon aria-hidden="true" className={ENERGY[type].text} />
                          {ENERGY[type].label}
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                )}
              />
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Anbieter" error={errors.provider?.message}>
                <Input autoComplete="off" {...register('provider')} />
              </Field>
              <Field label="Konzern/Marke (optional)" hint="Für Neukunden-Regeln">
                <Input autoComplete="off" {...register('providerGroup')} />
              </Field>
            </div>
            <Field label="Tarif" error={errors.tariffName?.message}>
              <Input autoComplete="off" {...register('tariffName')} />
            </Field>
            <Field label="Kundennummer (optional)">
              <Input autoComplete="off" {...register('customerNumber')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vertragsschluss" error={errors.contractDate?.message}>
                <Input type="date" {...register('contractDate')} />
              </Field>
              <Field
                label="Lieferbeginn"
                error={errors.deliveryStart?.message}
                hint="Maßgeblich für Boni"
              >
                <Input type="date" {...register('deliveryStart')} />
              </Field>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="grid grid-cols-[1fr_auto] items-start gap-3">
              <Field label="Arbeitspreis (brutto)" error={errors.energyPrice?.message}>
                <Input inputMode="decimal" autoComplete="off" {...register('energyPrice')} />
              </Field>
              <Field label="Einheit">
                <NativeSelect {...register('energyPriceUnit')}>
                  <option value="ct_per_kwh">ct/kWh</option>
                  {energyType === 'gas' ? <option value="eur_per_m3">€/m³</option> : null}
                </NativeSelect>
              </Field>
            </div>
            {energyType === 'gas' && factors && Number.isFinite(energyPriceCt) ? (
              <p className="-mt-2 text-xs text-muted-foreground">
                = {formatCt(energyPriceCt)} ⇔{' '}
                {formatNumber(
                  (energyPriceCt * factors.zFactor * factors.calorificValue) / 100,
                  3,
                  4,
                )}{' '}
                €/m³ (z {formatNumber(factors.zFactor, 4, 4)}, Hs{' '}
                {formatNumber(factors.calorificValue, 3, 3)})
              </p>
            ) : null}
            <div className="grid grid-cols-[1fr_auto] items-start gap-3">
              <Field label="Grundpreis (brutto)" error={errors.basePrice?.message}>
                <Input inputMode="decimal" autoComplete="off" {...register('basePrice')} />
              </Field>
              <Field label="pro">
                <NativeSelect {...register('basePriceUnit')}>
                  <option value="year">Jahr</option>
                  <option value="month">Monat</option>
                </NativeSelect>
              </Field>
            </div>
            {v.basePriceUnit === 'month' && Number.isFinite(basePerYear) ? (
              <p className="-mt-2 text-xs text-muted-foreground">
                = {formatEur(basePerYear)} pro Jahr
              </p>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {bonusArray.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein Bonus? Dann einfach weiter.</p>
            ) : null}
            {bonusArray.fields.map((field, index) => (
              <fieldset key={field.id} className="flex flex-col gap-3 rounded-2xl border p-3">
                <legend className="px-1 text-sm font-medium">Bonus {index + 1}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Art">
                    <NativeSelect {...register(`bonuses.${index}.kind`)}>
                      {BONUS_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Betrag (€)" error={errors.bonuses?.[index]?.amount?.message}>
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      {...register(`bonuses.${index}.amount`)}
                    />
                  </Field>
                  <Field label="Auszahlung">
                    <NativeSelect {...register(`bonuses.${index}.settlement`)}>
                      <option value="offset_in_bill">mit Rechnung verrechnet</option>
                      <option value="payout">Überweisung</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Mindestbelieferung (Monate)">
                    <Input
                      inputMode="numeric"
                      {...register(`bonuses.${index}.requiresDeliveryMonths`)}
                    />
                  </Field>
                </div>
                <Field label="Bedingung (Wortlaut AGB)">
                  <Input autoComplete="off" {...register(`bonuses.${index}.condition`)} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    bonusArray.remove(index);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Entfernen
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => {
                const hasNewCustomer = (v.bonuses ?? []).some((b) => b.kind === 'new_customer');
                bonusArray.append({
                  kind: hasNewCustomer ? 'instant' : 'new_customer',
                  amount: '',
                  settlement: hasNewCustomer ? 'payout' : 'offset_in_bill',
                  requiresDeliveryMonths: hasNewCustomer ? '' : '12',
                  condition: '',
                });
              }}
            >
              <Plus aria-hidden="true" />
              Bonus hinzufügen
            </Button>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Erstlaufzeit (Monate)">
                <Input inputMode="numeric" {...register('minTermMonths')} />
              </Field>
              <Field label="Laufzeit ab">
                <NativeSelect {...register('termStartsAt')}>
                  <option value="delivery">Lieferbeginn</option>
                  <option value="contract">Vertragsschluss</option>
                </NativeSelect>
              </Field>
              <Field label="Kündigungsfrist" error={errors.noticeValue?.message}>
                <Input inputMode="numeric" {...register('noticeValue')} />
              </Field>
              <Field label="Einheit">
                <NativeSelect {...register('noticeUnit')}>
                  <option value="months">Monat(e)</option>
                  <option value="weeks">Woche(n)</option>
                  <option value="days">Tag(e)</option>
                </NativeSelect>
              </Field>
              <Field label="Danach">
                <NativeSelect {...register('renewal')}>
                  <option value="monthly">monatlich kündbar</option>
                  <option value="12">Verlängerung um 12 Monate</option>
                </NativeSelect>
              </Field>
              <Field
                label="Geplantes Lieferende"
                error={errors.deliveryEnd?.message}
                hint="Letzter Liefertag, falls bekannt"
              >
                <Input type="date" {...register('deliveryEnd')} />
              </Field>
              <Field label="Preisgarantie bis" error={errors.guaranteeUntil?.message}>
                <Input type="date" {...register('guaranteeUntil')} />
              </Field>
              <Field label="Umfang">
                <NativeSelect {...register('guaranteeScope')}>
                  <option value="limited">eingeschränkt (ohne Steuern/Abgaben)</option>
                  <option value="full">voll</option>
                  <option value="energy_only">nur Energiepreis</option>
                </NativeSelect>
              </Field>
              <Field label="Abschlag (€/Monat)" error={errors.installmentAmount?.message}>
                <Input inputMode="decimal" autoComplete="off" {...register('installmentAmount')} />
              </Field>
              <Field label="Abbuchung am">
                <NativeSelect {...register('installmentDay')}>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                    <option key={d} value={d}>
                      {d}.
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {safety?.ok === false ? (
              <p
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                Bonus in Gefahr: nur {safety.delivered ? formatDuration(safety.delivered) : '–'}{' '}
                Belieferung. Für den Neukundenbonus muss das Lieferende mindestens am{' '}
                {formatDate(safety.requiredEnd)} liegen.
              </p>
            ) : safety?.ok ? (
              <p className="rounded-xl border border-savings/30 bg-savings/10 px-3 py-2 text-sm text-savings">
                Bonus gesichert: 12 Monate Belieferung bis {formatDate(safety.requiredEnd)}{' '}
                erreicht.
              </p>
            ) : null}
          </>
        ) : null}

        <DialogFooter>
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep((s) => s - 1);
              }}
            >
              Zurück
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Abbrechen
            </Button>
          )}
          <Button type="submit" disabled={formState.isSubmitting}>
            {step < STEPS.length - 1 ? 'Weiter' : 'Vertrag anlegen'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
