import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/data/hooks';
import { updateSettings } from '@/data/repositories/settings';
import type { EnergyType, ReferenceTariff, Settings } from '@/domain/types';
import { parseDecimal } from '@/features/contracts/labels';
import { ENERGY, ENERGY_TYPES } from '@/features/shared/energy';

const text = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

/** Spec 7.3 (8) – Referenztarife (z. B. Grundversorgung) für Angebotsvergleich und Wechsel-Bilanz. */
export function ReferenceTariffsSection() {
  const settings = useSettings();
  if (!settings) return null;
  return <ReferenceForm key={settings.referenceTariffs.length} settings={settings} />;
}

function ReferenceForm({ settings }: { settings: Settings }) {
  const initial = (e: EnergyType) => settings.referenceTariffs.find((r) => r.energyType === e);
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        ENERGY_TYPES.map((e) => [
          e,
          {
            label: initial(e)?.label ?? 'Grundversorgung',
            ap: text(initial(e)?.energyPriceCt),
            gp: text(initial(e)?.basePriceEurPerYear),
          },
        ]),
      ) as Record<EnergyType, { label: string; ap: string; gp: string }>,
  );
  const set = (e: EnergyType, key: 'label' | 'ap' | 'gp', value: string) => {
    setValues((v) => ({ ...v, [e]: { ...v[e], [key]: value } }));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Referenztarife</h2>
        </CardTitle>
        <CardDescription>
          Vergleichsmaßstab für Angebote und die Wechsel-Bilanz – meist die Grundversorgung deines
          örtlichen Versorgers (brutto). Leer lassen, wenn nicht gewünscht.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          aria-label="Referenztarife"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const tariffs: ReferenceTariff[] = [];
            for (const e of ENERGY_TYPES) {
              const ap = parseDecimal(values[e].ap);
              const gp = parseDecimal(values[e].gp);
              if (ap > 0 && gp >= 0) {
                tariffs.push({
                  energyType: e,
                  label: values[e].label.trim() || 'Referenz',
                  energyPriceCt: ap,
                  basePriceEurPerYear: gp,
                });
              }
            }
            void updateSettings({ referenceTariffs: tariffs }).then(() =>
              toast.success('Referenztarife gespeichert'),
            );
          }}
        >
          {ENERGY_TYPES.map((e) => (
            <fieldset key={e} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-medium">{ENERGY[e].label}</legend>
              <Field label={`Bezeichnung ${ENERGY[e].label}`} className="col-span-2 sm:col-span-1">
                <Input
                  autoComplete="off"
                  value={values[e].label}
                  onChange={(ev) => {
                    set(e, 'label', ev.target.value);
                  }}
                />
              </Field>
              <Field label={`Arbeitspreis ${ENERGY[e].label} (ct/kWh)`}>
                <Input
                  inputMode="decimal"
                  value={values[e].ap}
                  onChange={(ev) => {
                    set(e, 'ap', ev.target.value);
                  }}
                />
              </Field>
              <Field label={`Grundpreis ${ENERGY[e].label} (€/Jahr)`}>
                <Input
                  inputMode="decimal"
                  value={values[e].gp}
                  onChange={(ev) => {
                    set(e, 'gp', ev.target.value);
                  }}
                />
              </Field>
            </fieldset>
          ))}
          <Button type="submit" variant="outline" className="self-start">
            Referenztarife speichern
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
