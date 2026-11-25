import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMeters } from '@/data/hooks';
import type { Meter } from '@/domain/types';
import { MeterFormDialog } from '@/features/settings/MeterFormDialog';
import { ENERGY } from '@/features/shared/energy';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MetersSection() {
  const meters = useMeters();
  const [editing, setEditing] = useState<Meter | 'new' | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Zähler</h2>
        </CardTitle>
        <CardDescription>
          Nummern, Nachkommastellen und Gasfaktoren (aus der Gasrechnung).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {meters === undefined ? (
          <p className="text-sm text-muted-foreground">Lädt …</p>
        ) : meters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch kein Zähler angelegt.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {meters.map((meter) => {
              const meta = ENERGY[meter.energyType];
              const Icon = meta.icon;
              const factors = meter.gasFactors?.at(-1);
              return (
                <li key={meter.id} className="flex items-center gap-3 px-3 py-3">
                  <Icon aria-hidden="true" className={cn('size-5 shrink-0', meta.text)} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{meter.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {meter.meterNumber ? `Nr. ${meter.meterNumber} · ` : ''}
                      {meter.activeTo
                        ? `ausgebaut ${formatDate(meter.activeTo)}`
                        : `seit ${formatDate(meter.activeFrom)}`}
                      {factors
                        ? ` · z ${formatNumber(factors.zFactor, 4, 4)} · Hs ${formatNumber(factors.calorificValue, 3, 3)}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(meter);
                    }}
                    aria-label={`${meter.name} bearbeiten`}
                  >
                    Bearbeiten
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            setEditing('new');
          }}
        >
          <Plus aria-hidden="true" />
          Zähler hinzufügen
        </Button>
      </CardContent>
      <MeterFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        meter={editing && editing !== 'new' ? editing : undefined}
      />
    </Card>
  );
}
