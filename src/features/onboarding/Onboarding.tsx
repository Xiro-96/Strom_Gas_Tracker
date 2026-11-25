import { FileUp, Gauge, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppLogo } from '@/components/common/AppLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { loadDemoData } from '@/data/repositories/demo';
import { ImportDialog } from '@/features/settings/ImportDialog';
import { MeterFormDialog } from '@/features/settings/MeterFormDialog';

/** Erster Start: Zähler anlegen, Altdaten importieren oder mit Demo-Daten ausprobieren. */
export function Onboarding() {
  const [meterOpen, setMeterOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const options = [
    {
      icon: Gauge,
      title: 'Zähler anlegen',
      text: 'Strom oder Gas mit aktuellem Stand – dauert eine Minute.',
      action: () => {
        setMeterOpen(true);
      },
    },
    {
      icon: FileUp,
      title: 'Ablesungen importieren',
      text: 'Altdaten aus einer CSV-Datei übernehmen (Excel: Datum;Energie;Stand).',
      action: () => {
        setImportOpen(true);
      },
    },
    {
      icon: Sparkles,
      title: 'Demo-Daten laden',
      text: 'Zwei erfundene Jahre zum Ausprobieren – mit einem Klick wieder entfernt.',
      action: () => {
        void loadDemoData()
          .then(() => toast.success('Demo-Daten geladen'))
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : String(error)),
          );
      },
    },
  ];

  return (
    <section aria-labelledby="willkommen" className="flex flex-col gap-4">
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-electricity/10 via-transparent to-gas/15"
        />
        <CardContent className="relative flex items-center gap-4">
          <AppLogo className="size-14 shrink-0" />
          <div>
            <h2 id="willkommen" className="text-lg font-semibold">
              Willkommen beim Strom &amp; Gas Tracker
            </h2>
            <p className="text-sm text-muted-foreground">
              Deine Daten bleiben auf diesem Gerät. Wie möchtest du starten?
            </p>
          </div>
        </CardContent>
      </Card>
      <ul className="grid gap-3 sm:grid-cols-3">
        {options.map(({ icon: Icon, title, text, action }) => (
          <li key={title}>
            <Button
              variant="outline"
              className="h-auto w-full flex-col items-start gap-2 rounded-2xl p-4 text-left whitespace-normal"
              onClick={action}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="text-base font-semibold">{title}</span>
              <span className="text-sm font-normal text-muted-foreground">{text}</span>
            </Button>
          </li>
        ))}
      </ul>
      <MeterFormDialog open={meterOpen} onOpenChange={setMeterOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </section>
  );
}
