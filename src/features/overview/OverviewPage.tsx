import { Flame, Zap } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EnergyTeaserCard } from '@/features/overview/EnergyTeaserCard';

const today = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function OverviewPage() {
  return (
    <>
      <PageHeader title="Übersicht" description={today.format(new Date())} />
      <div className="grid gap-4 sm:grid-cols-2">
        <EnergyTeaserCard title="Strom" icon={Zap} tone="electricity" captureTo="/erfassen/strom" />
        <EnergyTeaserCard title="Gas" icon={Flame} tone="gas" captureTo="/erfassen/gas" />
      </div>
      <p className="text-sm text-muted-foreground">
        Sobald du Zähler anlegst und Stände erfasst, erscheinen hier Verbrauch, Kosten, Prognosen
        und Fristen.
      </p>
    </>
  );
}
