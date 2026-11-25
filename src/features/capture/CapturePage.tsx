import { Flame, Gauge, Zap } from 'lucide-react';
import { useParams } from 'react-router';
import { ComingSoon } from '@/components/common/ComingSoon';
import { PageHeader } from '@/components/common/PageHeader';

const TITLES = {
  strom: { title: 'Strom ablesen', icon: Zap },
  gas: { title: 'Gas ablesen', icon: Flame },
} as const;

function isKnownEnergy(value: string | undefined): value is keyof typeof TITLES {
  return value === 'strom' || value === 'gas';
}

export function CapturePage() {
  const { energy } = useParams();
  const { title, icon } = isKnownEnergy(energy)
    ? TITLES[energy]
    : { title: 'Zählerstand erfassen', icon: Gauge };
  return (
    <>
      <PageHeader title={title} description="Zähler wählen, Wert tippen, speichern." />
      <ComingSoon
        icon={icon}
        phase={1}
        title="Schnellerfassung in Vorbereitung"
        description="Bald erfasst du hier einen Zählerstand in unter 10 Sekunden – mit Plausibilitätsprüfung, Live-Vorschau und Foto."
      />
    </>
  );
}
