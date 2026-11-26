import { ChartNoAxesCombined, FlaskConical } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useHasDemoData } from '@/data/hooks';
import { removeDemoData } from '@/data/repositories/demo';
import { todayISO } from '@/domain/dates';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { EnergyCard } from '@/features/overview/EnergyCard';
import { DeadlineBar } from '@/features/overview/DeadlineBar';
import { useDeadlines } from '@/features/switch/useDeadlines';
import { formatDateLong } from '@/lib/format';

export function OverviewPage() {
  const fristen = useDeadlines();
  const cost = fristen.status === 'ready' ? fristen.cost : fristen;
  const data = cost.status === 'ready' ? cost.energy : cost;
  const hasDemo = useHasDemoData();

  return (
    <>
      <PageHeader title="Übersicht" description={formatDateLong(todayISO())} />
      {data.status === 'loading' ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Lädt">
          {[0, 1].map((i) => (
            <Card key={i} className="h-44 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : data.energies.length === 0 ? (
        <Onboarding />
      ) : (
        <>
          {hasDemo ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <FlaskConical aria-hidden="true" className="size-4" />
                Demo-Daten aktiv – alles erfunden.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void removeDemoData().then(() => toast.success('Demo-Daten entfernt'));
                }}
              >
                Entfernen
              </Button>
            </div>
          ) : null}
          {fristen.status === 'ready' ? (
            <DeadlineBar deadlines={fristen.deadlines} today={fristen.today} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {data.energies.map((energy) => {
              const analysis = data.analyses[energy];
              return analysis ? (
                <EnergyCard
                  key={energy}
                  analysis={analysis}
                  readingIntervalDays={data.settings.readingIntervalDays}
                  baseLoadShare={data.settings.gasBaseLoadShare}
                  costs={cost.status === 'ready' ? cost.byEnergy[energy] : undefined}
                />
              ) : null;
            })}
          </div>
          <Link
            to="/auswertung"
            className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium hover:bg-accent/50"
          >
            <ChartNoAxesCombined aria-hidden="true" className="size-5 text-muted-foreground" />
            Verbrauch im Detail: Tageswerte, Monate, Jahresvergleich
          </Link>
        </>
      )}
    </>
  );
}
