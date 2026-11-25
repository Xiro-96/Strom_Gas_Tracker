import { FileText } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';
import { PageHeader } from '@/components/common/PageHeader';

export function ContractsPage() {
  return (
    <>
      <PageHeader title="Verträge" description="Anbieter, Preise, Boni, Abschläge und Fristen" />
      <ComingSoon
        icon={FileText}
        phase={2}
        title="Noch keine Verträge"
        description="Lege Verträge mit Preisperioden, Boni und Abschlagsplan an – über alle jährlichen Wechsel hinweg."
      />
    </>
  );
}
