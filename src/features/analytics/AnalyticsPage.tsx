import { ChartNoAxesCombined } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';
import { PageHeader } from '@/components/common/PageHeader';

export function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Auswertung" description="Verbrauch und Kosten im Zeitverlauf" />
      <ComingSoon
        icon={ChartNoAxesCombined}
        phase={1}
        title="Noch keine Daten für Diagramme"
        description="Tagesverbrauch, Monatswerte und der Jahresvergleich erscheinen, sobald Ablesungen vorhanden sind."
      />
    </>
  );
}
