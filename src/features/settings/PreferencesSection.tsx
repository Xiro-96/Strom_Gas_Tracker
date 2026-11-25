import { Field } from '@/components/common/Field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { useSettings } from '@/data/hooks';
import { updateSettings } from '@/data/repositories/settings';

const INTERVALS = [7, 10, 14, 21, 28, 30];
const BASE_LOADS = [0.1, 0.15, 0.2, 0.25, 0.3];

export function PreferencesSection() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Ablesen &amp; Auswertung</h2>
        </CardTitle>
        <CardDescription>
          Ab dem 1,5-fachen Intervall gilt eine Ablesung als überfällig.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Ableseintervall">
          <NativeSelect
            value={String(settings.readingIntervalDays)}
            onChange={(e) => void updateSettings({ readingIntervalDays: Number(e.target.value) })}
          >
            {INTERVALS.map((d) => (
              <option key={d} value={d}>
                alle {d} Tage{d === 14 ? ' (Standard)' : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Gas-Grundlast"
          hint="Anteil Warmwasser/Kochen am Gasverbrauch – verteilt das Jahr ohne Heizung."
        >
          <NativeSelect
            value={String(settings.gasBaseLoadShare)}
            onChange={(e) => void updateSettings({ gasBaseLoadShare: Number(e.target.value) })}
          >
            {BASE_LOADS.map((b) => (
              <option key={b} value={b}>
                {Math.round(b * 100)} %{b === 0.15 ? ' (Standard)' : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </CardContent>
    </Card>
  );
}
