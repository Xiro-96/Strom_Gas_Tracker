import { History } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';
import { PageHeader } from '@/components/common/PageHeader';

export function HistoryPage() {
  return (
    <>
      <PageHeader title="Verlauf" description="Alle Ablesungen je Zähler" />
      <ComingSoon
        icon={History}
        phase={1}
        title="Noch keine Ablesungen"
        description="Hier siehst du jede Ablesung mit Differenz, Tagesverbrauch und Kosten – bearbeiten, löschen und Zählerwechsel inklusive."
      />
    </>
  );
}
