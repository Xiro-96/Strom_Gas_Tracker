import { Tags } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';
import { PageHeader } from '@/components/common/PageHeader';

export function OffersPage() {
  return (
    <>
      <PageHeader title="Angebote" description="Mit deinem echten Verbrauch vergleichen" />
      <ComingSoon
        icon={Tags}
        phase={4}
        title="Noch keine Angebote erfasst"
        description="Trage Angebote aus Vergleichsportalen ein und sieh Jahr 1 mit Bonus und das Folgejahr ohne Bonus nebeneinander."
      />
    </>
  );
}
