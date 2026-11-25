import { History, Image, Pencil, Plus, Repeat, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { deleteReading, restoreReading } from '@/data/repositories/readings';
import type { Interval } from '@/domain/intervals';
import type { EnergyType, Reading } from '@/domain/types';
import { KIND_LABEL } from '@/features/history/kinds';
import { ReadingDialog } from '@/features/history/ReadingDialog';
import { MeterChangeDialog } from '@/features/history/MeterChangeDialog';
import { PhotoDialog } from '@/features/history/PhotoDialog';
import { ENERGY } from '@/features/shared/energy';
import { useEnergyData } from '@/features/shared/useEnergyData';
import { formatDate, formatMeterValue, formatNumber, formatPerDay, UNIT_LABEL } from '@/lib/format';

export function HistoryPage() {
  const data = useEnergyData();
  const [selected, setSelected] = useState<EnergyType | undefined>();
  const [editing, setEditing] = useState<Reading | 'new' | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [photo, setPhoto] = useState<{ id: string; title: string } | null>(null);

  if (data.status === 'loading') {
    return (
      <>
        <PageHeader title="Verlauf" description="Alle Ablesungen je Zähler" />
        <Card className="h-64 animate-pulse bg-muted/40" aria-busy="true" />
      </>
    );
  }
  const energy = selected && data.energies.includes(selected) ? selected : data.energies[0];
  const analysis = energy ? data.analyses[energy] : undefined;
  if (!energy || !analysis || analysis.readings.length === 0) {
    return (
      <>
        <PageHeader title="Verlauf" description="Alle Ablesungen je Zähler" />
        <EmptyState
          icon={History}
          title="Noch keine Ablesungen"
          description="Lege in der Übersicht einen Zähler an oder importiere Altdaten – dann siehst du hier jede Ablesung mit Verbrauch."
          action={
            <Button asChild>
              <Link to="/">Zur Übersicht</Link>
            </Button>
          }
        />
      </>
    );
  }

  const meterById = new Map(analysis.meters.map((m) => [m.id, m]));
  const intervalByEnd = new Map<string, Interval>(
    analysis.intervals.flatMap((i) => (i.toReadingId ? [[i.toReadingId, i]] : [])),
  );
  const current = analysis.currentMeter;
  const rows = [...analysis.readings].reverse();

  const remove = (reading: Reading) => {
    void deleteReading(reading.id).then(() =>
      toast('Ablesung gelöscht', {
        action: { label: 'Rückgängig', onClick: () => void restoreReading(reading.id) },
      }),
    );
  };

  return (
    <>
      <PageHeader
        title="Verlauf"
        description={`${analysis.readings.length} Ablesungen`}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus aria-hidden="true" />
            Nachtragen
          </Button>
        }
      />
      {data.energies.length > 1 ? (
        <ToggleGroup
          type="single"
          aria-label="Energieart"
          className="w-full sm:w-auto"
          value={energy}
          onValueChange={(v) => {
            if (v === 'electricity' || v === 'gas') setSelected(v);
          }}
        >
          {data.energies.map((type) => {
            const Icon = ENERGY[type].icon;
            return (
              <ToggleGroupItem key={type} value={type} aria-label={ENERGY[type].label}>
                <Icon aria-hidden="true" className={ENERGY[type].text} />
                {ENERGY[type].label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      ) : null}

      {analysis.errors.length > 0 ? (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            {analysis.errors.map((e) => (
              <p key={`${e.from}-${e.to}`}>
                Stand sinkt zwischen {formatDate(e.from)} und {formatDate(e.to)} – bitte prüfen
                (Tippfehler oder Zählerwechsel?).
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="py-1">
        <ul className="divide-y" aria-label={`Ablesungen ${ENERGY[energy].label}`}>
          {rows.map((reading) => {
            const meter = meterById.get(reading.meterId);
            if (!meter) return null;
            const interval = intervalByEnd.get(reading.id);
            return (
              <li key={reading.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatMeterValue(reading.value, meter.decimals, meter.unit)}
                    </span>
                    {reading.kind !== 'regular' ? (
                      <Badge variant="secondary">{KIND_LABEL[reading.kind]}</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(reading.date)}
                    {interval
                      ? ` · +${formatNumber(interval.delta, 0, meter.decimals)} ${UNIT_LABEL[meter.unit]} in ${interval.days} T. · ${formatPerDay(interval.perDay)}`
                      : ''}
                    {reading.note ? ` · ${reading.note}` : ''}
                  </p>
                </div>
                {reading.photoId ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Foto vom ${formatDate(reading.date)} ansehen`}
                    onClick={() => {
                      if (reading.photoId)
                        setPhoto({
                          id: reading.photoId,
                          title: `${meter.name} · ${formatDate(reading.date)}`,
                        });
                    }}
                  >
                    <Image aria-hidden="true" />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ablesung vom ${formatDate(reading.date)} bearbeiten`}
                  onClick={() => {
                    setEditing(reading);
                  }}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ablesung vom ${formatDate(reading.date)} löschen`}
                  onClick={() => {
                    remove(reading);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      {current ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            setChangeOpen(true);
          }}
        >
          <Repeat aria-hidden="true" />
          Zählerwechsel erfassen
        </Button>
      ) : null}

      {current ? (
        <ReadingDialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          meter={
            editing && editing !== 'new' ? (meterById.get(editing.meterId) ?? current) : current
          }
          readings={analysis.readings}
          baseLoadShare={data.settings.gasBaseLoadShare}
          reading={editing && editing !== 'new' ? editing : undefined}
        />
      ) : null}
      {current ? (
        <MeterChangeDialog
          open={changeOpen}
          onOpenChange={setChangeOpen}
          meter={current}
          lastReading={analysis.readings.filter((r) => r.meterId === current.id).at(-1)}
        />
      ) : null}
      <PhotoDialog
        photoId={photo?.id ?? null}
        title={photo?.title ?? ''}
        onClose={() => {
          setPhoto(null);
        }}
      />
    </>
  );
}
