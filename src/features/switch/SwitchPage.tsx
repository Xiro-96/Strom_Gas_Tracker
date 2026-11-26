import { Repeat } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cockpitContracts } from '@/domain/switch';
import { Section } from '@/features/contracts/detail/Section';
import { CalendarExportButton } from '@/features/switch/CalendarExportButton';
import { DeadlineList } from '@/features/switch/DeadlineList';
import { SwitchCard } from '@/features/switch/SwitchCard';
import { useDeadlines } from '@/features/switch/useDeadlines';

export function SwitchPage() {
  const data = useDeadlines();
  const header = (
    <PageHeader title="Wechsel-Cockpit" description="Kündigen, Bonus sichern, Wechsel begleiten" />
  );
  if (data.status === 'loading') {
    return (
      <>
        {header}
        <Card className="h-64 animate-pulse bg-muted/40" aria-busy="true" aria-label="Lädt" />
      </>
    );
  }
  const { cost, deadlines, today } = data;
  const contracts = cockpitContracts(cost.contracts.contracts, today);
  if (contracts.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Repeat}
          title="Kein laufender Vertrag"
          description="Lege deinen Vertrag an. Dann zeigt das Cockpit Kündigungsfrist, Bonus-Check, Checkliste und fertige Texte für den Wechsel."
          action={
            <Button asChild>
              <Link to="/vertraege">Zu den Verträgen</Link>
            </Button>
          }
        />
      </>
    );
  }
  return (
    <>
      {header}
      {contracts.map((contract) => (
        <SwitchCard
          key={contract.id}
          contract={contract}
          data={cost.contracts}
          meters={cost.energy.meters}
          readings={cost.energy.readings}
          deadlines={deadlines}
          today={today}
        />
      ))}
      <Section title="Alle Fristen" description="Auch als Kalenderdatei mit Erinnerungen">
        <DeadlineList deadlines={deadlines} today={today} label="Alle Fristen" />
        <CalendarExportButton
          deadlines={deadlines}
          readingIntervalDays={cost.energy.settings.readingIntervalDays}
          today={today}
        />
        <p className="text-xs text-muted-foreground">
          Info, ohne Gewähr: Der technische Stromwechsel läuft seit 06.06.2025 werktags binnen 24
          Stunden – Kündigungsfristen gelten trotzdem. Kündigung in Textform (E-Mail, Kundenportal)
          reicht. Quelle: Bundesnetzagentur, EnWG.
        </p>
      </Section>
    </>
  );
}
