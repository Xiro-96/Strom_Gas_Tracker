import { Camera, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { IssueList } from '@/components/common/IssueList';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { addReading, deleteReading, savePhoto } from '@/data/repositories/readings';
import { todayISO } from '@/domain/dates';
import { parseMeterInput } from '@/domain/parse';
import { checkReading } from '@/domain/plausibility';
import type { EnergyType, Meter, Reading, Settings } from '@/domain/types';
import { ENERGY } from '@/features/shared/energy';
import { useEnergyData } from '@/features/shared/useEnergyData';
import {
  formatDate,
  formatMeterValue,
  formatNumber,
  formatPerDay,
  meterInputValue,
  UNIT_LABEL,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image';

interface CaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEnergy?: EnergyType;
  /** Wird angezeigt, wenn noch kein Zähler existiert. */
  onCreateMeter?: () => void;
}

/** Schnellerfassung (Spec 7.3): Zähler wählen, Wert tippen, speichern – in unter 10 Sekunden. */
export function CaptureSheet({
  open,
  onOpenChange,
  initialEnergy,
  onCreateMeter,
}: CaptureSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          // Fokus setzt das Zahlenfeld selbst (autoFocus + komplett markiert).
          e.preventDefault();
        }}
      >
        {open ? (
          <CaptureBody
            key={initialEnergy ?? 'auto'}
            initialEnergy={initialEnergy}
            onDone={() => {
              onOpenChange(false);
            }}
            onCreateMeter={onCreateMeter}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CaptureBody({
  initialEnergy,
  onDone,
  onCreateMeter,
}: {
  initialEnergy?: EnergyType;
  onDone: () => void;
  onCreateMeter?: () => void;
}) {
  const data = useEnergyData();
  const energies = data.status === 'ready' ? data.energies : [];
  const [energy, setEnergy] = useState<EnergyType | undefined>(initialEnergy);
  const active = energy && energies.includes(energy) ? energy : energies[0];
  const analysis = active && data.status === 'ready' ? data.analyses[active] : undefined;
  const meter = analysis?.currentMeter;
  const title = active ? `${ENERGY[active].label} ablesen` : 'Zählerstand erfassen';

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Zählerstand eingeben und speichern.
        </DialogDescription>
      </DialogHeader>
      {data.status === 'loading' ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Lädt …</p>
      ) : !meter || !active ? (
        <div className="flex flex-col gap-3 py-4 text-sm">
          <p className="text-muted-foreground">
            Lege zuerst einen Zähler an – dann geht das Ablesen in Sekunden.
          </p>
          {onCreateMeter ? <Button onClick={onCreateMeter}>Zähler anlegen</Button> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {energies.length > 1 ? (
            <ToggleGroup
              type="single"
              aria-label="Zähler"
              className="w-full"
              value={active}
              onValueChange={(value) => {
                if (value === 'electricity' || value === 'gas') setEnergy(value);
              }}
            >
              {energies.map((type) => {
                const Icon = ENERGY[type].icon;
                return (
                  <ToggleGroupItem
                    key={type}
                    value={type}
                    aria-label={ENERGY[type].label}
                    className="h-11"
                  >
                    <Icon aria-hidden="true" className={ENERGY[type].text} />
                    {ENERGY[type].label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          ) : null}
          <CaptureForm
            key={meter.id}
            energy={active}
            meter={meter}
            readings={analysis.readings.filter((r) => r.meterId === meter.id)}
            settings={data.settings}
            onDone={onDone}
          />
        </div>
      )}
    </>
  );
}

function CaptureForm({
  energy,
  meter,
  readings,
  settings,
  onDone,
}: {
  energy: EnergyType;
  meter: Meter;
  readings: Reading[];
  settings: Settings;
  onDone: () => void;
}) {
  const last = readings.at(-1);
  const today = todayISO();
  const [input, setInput] = useState(() =>
    last ? meterInputValue(last.value, meter.decimals) : '',
  );
  const [date, setDate] = useState(today);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = parseMeterInput(input, { decimals: meter.decimals, lastValue: last?.value });
  const check = parsed.ok
    ? checkReading({
        value: parsed.value,
        date,
        today,
        fractionDigits: parsed.fractionDigits,
        meter,
        readings,
        baseLoadShare: settings.gasBaseLoadShare,
      })
    : null;
  const unchanged = parsed.ok && last?.value === parsed.value && last.date === date;
  const replacesSameDay = check?.issues.some((i) => i.code === 'same_date') ?? false;
  const needsConfirm = check?.issues.some((i) => i.level === 'confirm') ?? false;
  const canSave = parsed.ok && Boolean(check?.canSave) && !unchanged && !saving;

  const save = async () => {
    if (!parsed.ok || !canSave) return;
    setSaving(true);
    try {
      const photoId = photo ? await savePhoto(await compressImage(photo)) : undefined;
      const reading = await addReading(
        {
          meterId: meter.id,
          date,
          value: parsed.value,
          kind: 'regular',
          ...(photoId ? { photoId } : {}),
        },
        { replaceSameDate: replacesSameDay },
      );
      const preview = check?.preview;
      toast.success(
        `${ENERGY[energy].label}: ${formatMeterValue(parsed.value, meter.decimals, meter.unit)} gespeichert`,
        {
          description: preview
            ? `${formatPerDay(preview.perDay)} seit ${formatDate(preview.previousDate)}`
            : undefined,
          action: {
            label: 'Rückgängig',
            onClick: () => {
              void deleteReading(reading.id);
            },
          },
        },
      );
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-col items-center gap-1 py-2">
        <Label htmlFor="stand" className="sr-only">
          Zählerstand in {UNIT_LABEL[meter.unit]}
        </Label>
        <div className="flex items-baseline justify-center gap-2">
          <input
            id="stand"
            // Schnellerfassung: Tippen soll den markierten letzten Stand sofort ersetzen (Spec 7.3).
            autoFocus
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            aria-invalid={parsed.ok ? undefined : true}
            className="w-full max-w-[12ch] bg-transparent text-center text-4xl font-semibold tracking-tight tabular-nums outline-none focus-visible:underline focus-visible:decoration-ring focus-visible:decoration-2 focus-visible:underline-offset-8 sm:text-5xl"
          />
          <span className="text-lg font-medium text-muted-foreground">
            {UNIT_LABEL[meter.unit]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {last
            ? `Zuletzt ${formatMeterValue(last.value, meter.decimals, meter.unit)} am ${formatDate(last.date)}`
            : 'Erster Stand für diesen Zähler'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ablesedatum">Datum</Label>
          <Input
            id="ablesedatum"
            type="date"
            max={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Foto</span>
          <label
            className={cn(
              'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-accent/50',
              photo && 'border-solid border-savings text-savings',
            )}
          >
            {photo ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Camera aria-hidden="true" className="size-4" />
            )}
            {photo ? 'Foto dabei' : 'Hinzufügen'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                setPhoto(e.target.files?.[0] ?? null);
              }}
            />
          </label>
        </div>
      </div>

      <div className="min-h-12 rounded-2xl bg-muted/60 px-4 py-3 text-sm" aria-live="polite">
        {!parsed.ok ? (
          <p className="text-danger">{parsed.error}</p>
        ) : check?.preview ? (
          <p>
            <span className="font-semibold tabular-nums">
              +{formatNumber(check.preview.delta, 0, meter.decimals)} {UNIT_LABEL[meter.unit]}
            </span>{' '}
            in {check.preview.days} {check.preview.days === 1 ? 'Tag' : 'Tagen'}
            {meter.unit === 'm3' ? ` (≈ ${formatNumber(check.preview.kwh, 0, 0)} kWh)` : ''} ·{' '}
            <span className="font-semibold tabular-nums">{formatPerDay(check.preview.perDay)}</span>
          </p>
        ) : unchanged ? (
          <p className="text-muted-foreground">
            Neuen Stand eintippen – der letzte ist schon markiert.
          </p>
        ) : last ? (
          <p className="text-muted-foreground">
            Die Vorschau erscheint, sobald der Stand plausibel ist.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Erster Stand – ab der nächsten Ablesung siehst du den Verbrauch.
          </p>
        )}
      </div>

      {check ? <IssueList issues={check.issues} /> : null}

      <Button type="submit" size="lg" disabled={!canSave}>
        {replacesSameDay
          ? 'Ersetzen und speichern'
          : needsConfirm
            ? 'Bestätigen und speichern'
            : 'Speichern'}
      </Button>
    </form>
  );
}
