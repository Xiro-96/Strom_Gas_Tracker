import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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
import { addOffer } from '@/data/repositories/offers';
import { todayISO } from '@/domain/dates';
import { eurPerM3ToCtPerKwh, type GasFactors } from '@/domain/gas';
import type { EnergyType, Offer } from '@/domain/types';
import { parseDecimal } from '@/features/contracts/labels';
import { ENERGY } from '@/features/shared/energy';
import { formatCt, formatEur } from '@/lib/format';

const amount = (message: string) => z.string().refine((v) => parseDecimal(v) >= 0, message);
const optionalAmount = z
  .string()
  .refine(
    (v) => v.trim() === '' || parseDecimal(v) >= 0,
    'Bitte einen Betrag oder nichts eingeben.',
  );
const optionalMonths = z
  .string()
  .refine(
    (v) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) >= 0),
    'Ganze Monate angeben.',
  );

const schema = z.object({
  provider: z.string().trim().min(1, 'Bitte den Anbieter angeben.'),
  providerGroup: z.string().trim(),
  tariffName: z.string().trim().min(1, 'Bitte den Tarif angeben.'),
  energyPrice: amount('Bitte den Arbeitspreis angeben.'),
  energyPriceUnit: z.enum(['ct_per_kwh', 'eur_per_m3']),
  basePrice: amount('Bitte den Grundpreis angeben.'),
  basePriceUnit: z.enum(['year', 'month']),
  newCustomerBonus: optionalAmount,
  instantBonus: optionalAmount,
  minTermMonths: optionalMonths,
  guaranteeMonths: optionalMonths,
  guaranteeScope: z.enum(['full', 'limited', 'energy_only']),
  source: z.string().trim(),
  url: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^https?:\/\/\S+$/i.test(v),
      'Bitte einen Link mit https:// angeben.',
    ),
});
type Values = z.infer<typeof schema>;

export function OfferDialog({
  open,
  onOpenChange,
  energyType,
  gasFactors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  energyType: EnergyType;
  gasFactors: GasFactors;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <OfferForm
            energyType={energyType}
            gasFactors={gasFactors}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OfferForm({
  energyType,
  gasFactors,
  onDone,
}: {
  energyType: EnergyType;
  gasFactors: GasFactors;
  onDone: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: '',
      providerGroup: '',
      tariffName: '',
      energyPrice: '',
      energyPriceUnit: 'ct_per_kwh',
      basePrice: '',
      basePriceUnit: 'year',
      newCustomerBonus: '',
      instantBonus: '',
      minTermMonths: '12',
      guaranteeMonths: '12',
      guaranteeScope: 'limited',
      source: 'Vergleichsportal',
      url: '',
    },
  });
  const { register, handleSubmit, control, formState } = form;
  const errors = formState.errors;
  const v = useWatch({ control });
  const isGas = energyType === 'gas';
  const toCt = (value: number, unit: string | undefined) =>
    unit === 'eur_per_m3'
      ? eurPerM3ToCtPerKwh(value, gasFactors.zFactor, gasFactors.calorificValue)
      : value;
  const previewCt = toCt(parseDecimal(v.energyPrice ?? ''), v.energyPriceUnit);
  const previewBase = parseDecimal(v.basePrice ?? '') * (v.basePriceUnit === 'month' ? 12 : 1);

  const onSubmit = handleSubmit(async (values) => {
    const bonuses: Offer['bonuses'] = [];
    const nc = parseDecimal(values.newCustomerBonus);
    if (nc > 0) bonuses.push({ kind: 'new_customer', amountEur: nc, requiresDeliveryMonths: 12 });
    const instant = parseDecimal(values.instantBonus);
    if (instant > 0) bonuses.push({ kind: 'instant', amountEur: instant });
    await addOffer({
      energyType,
      provider: values.provider,
      ...(values.providerGroup ? { providerGroup: values.providerGroup } : {}),
      tariffName: values.tariffName,
      energyPriceCt: toCt(parseDecimal(values.energyPrice), values.energyPriceUnit),
      basePriceEurPerYear:
        parseDecimal(values.basePrice) * (values.basePriceUnit === 'month' ? 12 : 1),
      bonuses,
      ...(values.minTermMonths ? { minTermMonths: Number(values.minTermMonths) } : {}),
      ...(values.guaranteeMonths
        ? {
            priceGuaranteeMonths: Number(values.guaranteeMonths),
            priceGuaranteeScope: values.guaranteeScope,
          }
        : {}),
      ...(values.source ? { source: values.source } : {}),
      ...(values.url ? { url: values.url } : {}),
      capturedAt: todayISO(),
    });
    toast.success(`Angebot ${values.provider} gespeichert`);
    onDone();
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Angebot erfassen</DialogTitle>
        <DialogDescription>
          {ENERGY[energyType].label}: Preise brutto, wie im Vergleichsportal oder beim Anbieter
          angegeben.
        </DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={(e) => void onSubmit(e)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Anbieter" error={errors.provider?.message}>
            <Input autoComplete="off" {...register('provider')} />
          </Field>
          <Field label="Konzern/Marke (optional)" hint="Für die Neukunden-Warnung">
            <Input autoComplete="off" {...register('providerGroup')} />
          </Field>
        </div>
        <Field label="Tarif" error={errors.tariffName?.message}>
          <Input autoComplete="off" {...register('tariffName')} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <Field label="Arbeitspreis" error={errors.energyPrice?.message}>
            <Input inputMode="decimal" autoComplete="off" {...register('energyPrice')} />
          </Field>
          <Field label="Einheit">
            <NativeSelect {...register('energyPriceUnit')}>
              <option value="ct_per_kwh">ct/kWh</option>
              {isGas ? <option value="eur_per_m3">€/m³</option> : null}
            </NativeSelect>
          </Field>
        </div>
        {isGas && v.energyPriceUnit === 'eur_per_m3' && Number.isFinite(previewCt) ? (
          <p className="-mt-2 text-xs text-muted-foreground">= {formatCt(previewCt)}</p>
        ) : null}
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <Field label="Grundpreis" error={errors.basePrice?.message}>
            <Input inputMode="decimal" autoComplete="off" {...register('basePrice')} />
          </Field>
          <Field label="pro">
            <NativeSelect {...register('basePriceUnit')}>
              <option value="year">Jahr</option>
              <option value="month">Monat</option>
            </NativeSelect>
          </Field>
        </div>
        {v.basePriceUnit === 'month' && Number.isFinite(previewBase) ? (
          <p className="-mt-2 text-xs text-muted-foreground">= {formatEur(previewBase)} pro Jahr</p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Neukundenbonus (€)"
            error={errors.newCustomerBonus?.message}
            hint="nach 12 Monaten"
          >
            <Input inputMode="decimal" autoComplete="off" {...register('newCustomerBonus')} />
          </Field>
          <Field label="Sofortbonus (€)" error={errors.instantBonus?.message}>
            <Input inputMode="decimal" autoComplete="off" {...register('instantBonus')} />
          </Field>
          <Field label="Erstlaufzeit (Monate)" error={errors.minTermMonths?.message}>
            <Input inputMode="numeric" {...register('minTermMonths')} />
          </Field>
          <Field label="Preisgarantie (Monate)" error={errors.guaranteeMonths?.message}>
            <Input inputMode="numeric" {...register('guaranteeMonths')} />
          </Field>
          <Field label="Garantie-Umfang">
            <NativeSelect {...register('guaranteeScope')}>
              <option value="limited">eingeschränkt</option>
              <option value="full">voll</option>
              <option value="energy_only">nur Energiepreis</option>
            </NativeSelect>
          </Field>
          <Field label="Quelle">
            <Input autoComplete="off" {...register('source')} />
          </Field>
        </div>
        <Field label="Link (optional)" error={errors.url?.message}>
          <Input type="url" inputMode="url" autoComplete="off" {...register('url')} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            Angebot speichern
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
