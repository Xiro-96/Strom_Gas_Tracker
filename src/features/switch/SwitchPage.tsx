import { Repeat } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';
import { PageHeader } from '@/components/common/PageHeader';

export function SwitchPage() {
  return (
    <>
      <PageHeader
        title="Wechsel-Cockpit"
        description="Kündigen, Bonus sichern, Wechsel begleiten"
      />
      <ComingSoon
        icon={Repeat}
        phase={3}
        title="Kein Wechsel geplant"
        description="Countdown bis zur Kündigungsfrist, Bonus-Sicherheitscheck, Checkliste und fertige Texte für Kündigung und Zählerstandsmeldung."
      />
    </>
  );
}
