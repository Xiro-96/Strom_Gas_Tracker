import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { Field } from '@/components/common/Field';
import { Trash2 } from 'lucide-react';
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
import { createMeter, updateMeter } from '@/data/repositories/meters';
import { addReading } from '@/data/repositories/readings';
import { isISODate, todayISO } from '@/domain/dates';
import { DEFAULT_GAS_FACTORS, upsertGasFactors } from '@/domain/gas';
import { parseMeterInput } from '@/domain/parse';
import type { EnergyType, Meter } from '@/domain/types';
import { ENERGY } from '@/features/shared/energy';
import { formatDate, formatNumber, meterInputValue } from '@/lib/format';

type Mode = 'create' | 'edit';

const parseDecimal = (s: string) => parseMeterInput(s, { decimals: 4 });

function makeSchema(mode: Mode) {
  return z
    .object({
      energyType: z.enum(['electricity', 'gas']),
      name: z.string().trim().min(1, 'Bitte einen Namen angeben.').max(40, 'Höchstens 40 Zeichen.'),
      decimals: z.enum(['0', '1', '2', '3']),
      integerDigits: z.enum(['', '4', '5', '6', '7', '8']),
      meterNumber: z.string().trim().max(40, 'Höchstens 40 Zeichen.'),
      maloId: z
        .string()
        .trim()
        .regex(/^(\d{11})?$/, 'Die MaLo-ID hat genau 11 Ziffern.'),
      startValue: z.string(),
      startDate: z.string(),
      zFactor: z.string(),
      calorificValue: z.string(),
      /** Bearbeiten: ab wann die eingegebenen Gasfaktoren gelten. */
      factorsFrom: z.string(),
      gasHistory: z.array(
        z.object({ validFrom: z.string(), zFactor: z.number(), calorificValue: z.number() }),
      ),
    })
    .superRefine((v, ctx) => {
      if (mode === 'create') {
        const parsed = parseMeterInput(v.startValue, { decimals: Number(v.decimals) });
        if (!parsed.ok)
          ctx.addIssue({ code: 'custom', path: ['startValue'], message: parsed.error });
        if (!isISODate(v.startDate) || v.startDate > todayISO()) {
          ctx.addIssue({
            code: 'custom',
            path: ['startDate'],
            message: 'Bitte ein Datum bis heute wählen.',
          });
        }
      }
      if (v.energyType === 'gas') {
        if (mode === 'edit' && !isISODate(v.factorsFrom)) {
          ctx.addIssue({
            code: 'custom',
            path: ['factorsFrom'],
            message: 'Bitte ein Datum wählen.',
          });
        }
        const z = parseDecimal(v.zFactor);
        if (!z.ok || z.value < 0.8 || z.value > 1.1) {
          ctx.addIssue({
            code: 'custom',
            path: ['zFactor'],
            message: 'Üblich sind Werte zwischen 0,80 und 1,10.',
          });
        }
        const hs = parseDecimal(v.calorificValue);
        if (!hs.ok || hs.value < 8 || hs.value > 13) {
          ctx.addIssue({
            code: 'custom',
            path: ['calorificValue'],
            message: 'Üblich sind Werte zwischen 8 und 13 kWh/m³.',
          });
        }
      }
    });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

function defaults(meter: Meter | undefined, energyType: EnergyType): FormValues {
  const history = [...(meter?.gasFactors ?? [])].sort((a, b) =>
    a.validFrom.localeCompare(b.validFrom),
  );
  const latest = history.at(-1);
  const factors = latest ?? DEFAULT_GAS_FACTORS;
  const type = meter?.energyType ?? energyType;
  return {
    energyType: type,
    name: meter?.name ?? (type === 'gas' ? 'Gaszähler' : 'Stromzähler'),
    decimals: String(meter?.decimals ?? (type === 'gas' ? 3 : 1)) as FormValues['decimals'],
    integerDigits: (meter?.rolloverModulus
      ? String(Math.log10(meter.rolloverModulus))
      : '') as FormValues['integerDigits'],
    meterNumber: meter?.meterNumber ?? '',
    maloId: meter?.maloId ?? '',
    startValue: '',
    startDate: todayISO(),
    zFactor: meterInputValue(factors.zFactor, 4),
    calorificValue: meterInputValue(factors.calorificValue, 3),
    factorsFrom: latest?.validFrom ?? meter?.activeFrom ?? todayISO(),
    gasHistory: history,
  };
}

interface MeterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bearbeiten statt Anlegen. */
  meter?: Meter;
  defaultEnergy?: EnergyType;
}

export function MeterFormDialog({
  open,
  onOpenChange,
  meter,
  defaultEnergy = 'electricity',
}: MeterFormDialogProps) {
  const mode: Mode = meter ? 'edit' : 'create';
  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(mode)),
    defaultValues: defaults(meter, defaultEnergy),
  });
  const { register, handleSubmit, control, setValue, reset, formState } = form;
  const energyType = useWatch({ control, name: 'energyType' });
  const errors = formState.errors;
  const history = useFieldArray({ control, name: 'gasHistory' });

  useEffect(() => {
    if (open) reset(defaults(meter, defaultEnergy));
  }, [open, meter, defaultEnergy, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const decimals = Number(v.decimals);
    const fields = {
      name: v.name,
      decimals,
      rolloverModulus: v.integerDigits ? 10 ** Number(v.integerDigits) : undefined,
      meterNumber: v.meterNumber || undefined,
      maloId: v.maloId || undefined,
    };
    const z = parseDecimal(v.zFactor);
    const hs = parseDecimal(v.calorificValue);
    const gasFactors =
      v.energyType === 'gas'
        ? upsertGasFactors(mode === 'edit' ? v.gasHistory : [], {
            validFrom: mode === 'edit' ? v.factorsFrom : v.startDate,
            zFactor: z.ok ? z.value : DEFAULT_GAS_FACTORS.zFactor,
            calorificValue: hs.ok ? hs.value : DEFAULT_GAS_FACTORS.calorificValue,
          })
        : undefined;
    if (meter) {
      await updateMeter(meter.id, { ...fields, ...(gasFactors ? { gasFactors } : {}) });
      toast.success('Zähler gespeichert');
    } else {
      const parsed = parseMeterInput(v.startValue, { decimals });
      const created = await createMeter({
        energyType: v.energyType,
        unit: v.energyType === 'gas' ? 'm3' : 'kWh',
        activeFrom: v.startDate,
        ...fields,
        ...(gasFactors ? { gasFactors } : {}),
      });
      if (parsed.ok) {
        await addReading({
          meterId: created.id,
          date: v.startDate,
          value: parsed.value,
          kind: 'regular',
        });
      }
      toast.success(`${ENERGY[v.energyType].label}zähler angelegt`);
    }
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meter ? 'Zähler bearbeiten' : 'Zähler anlegen'}</DialogTitle>
          <DialogDescription>
            Nur Name und Stand sind nötig. Zählernummer und MaLo-ID helfen beim Anbieterwechsel.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)} noValidate>
          {mode === 'create' ? (
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
                    if (value !== 'electricity' && value !== 'gas') return;
                    field.onChange(value);
                    setValue('name', value === 'gas' ? 'Gaszähler' : 'Stromzähler');
                    setValue('decimals', value === 'gas' ? '3' : '1');
                  }}
                >
                  {(['electricity', 'gas'] as const).map((type) => {
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

          <Field label="Name" error={errors.name?.message}>
            <Input autoComplete="off" {...register('name')} />
          </Field>

          {mode === 'create' ? (
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field
                label={`Aktueller Stand (${energyType === 'gas' ? 'm³' : 'kWh'})`}
                error={errors.startValue?.message}
              >
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="z. B. 12.345,6"
                  {...register('startValue')}
                />
              </Field>
              <Field label="Datum" error={errors.startDate?.message}>
                <Input type="date" max={todayISO()} {...register('startDate')} />
              </Field>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nachkommastellen" hint="Rote Ziffern am Zählwerk">
              <NativeSelect {...register('decimals')}>
                {['0', '1', '2', '3'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Vorkommastellen" hint="Für den Zählerüberlauf">
              <NativeSelect {...register('integerDigits')}>
                <option value="">unbekannt</option>
                {['4', '5', '6', '7', '8'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Zählernummer (optional)" error={errors.meterNumber?.message}>
              <Input autoComplete="off" {...register('meterNumber')} />
            </Field>
            <Field label="MaLo-ID (optional)" error={errors.maloId?.message}>
              <Input
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                {...register('maloId')}
              />
            </Field>
          </div>

          {energyType === 'gas' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zustandszahl z" error={errors.zFactor?.message}>
                <Input inputMode="decimal" autoComplete="off" {...register('zFactor')} />
              </Field>
              <Field label="Brennwert Hs (kWh/m³)" error={errors.calorificValue?.message}>
                <Input inputMode="decimal" autoComplete="off" {...register('calorificValue')} />
              </Field>
              {mode === 'edit' ? (
                <Field
                  label="Faktoren gültig ab"
                  className="col-span-2"
                  error={errors.factorsFrom?.message}
                  hint="Gleiches Datum = Korrektur, neues Datum = neuer Abschnitt (z. B. neue Jahresrechnung)."
                >
                  <Input type="date" {...register('factorsFrom')} />
                </Field>
              ) : null}
              <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                Werte aus deiner Gasrechnung übernehmen – sie hängen vom Netz ab, nicht vom
                Anbieter.
              </p>
              {mode === 'edit' && history.fields.length > 0 ? (
                <div className="col-span-2 flex flex-col gap-1">
                  <p className="text-xs font-medium">Bisherige Gasfaktoren</p>
                  <ul className="flex flex-col divide-y rounded-xl border text-sm">
                    {history.fields.map((entry, index) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <span>
                          ab {formatDate(entry.validFrom)}: z {formatNumber(entry.zFactor, 4, 4)} ·
                          Hs {formatNumber(entry.calorificValue, 3, 3)}
                        </span>
                        {history.fields.length > 1 ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Gasfaktoren ab ${formatDate(entry.validFrom)} entfernen`}
                            onClick={() => {
                              history.remove(index);
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {meter ? 'Speichern' : 'Zähler anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
