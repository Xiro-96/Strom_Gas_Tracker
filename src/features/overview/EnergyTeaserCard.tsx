import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EnergyTeaserCardProps {
  title: string;
  icon: LucideIcon;
  tone: 'electricity' | 'gas';
  captureTo: string;
}

const TONES = {
  electricity: { icon: 'bg-electricity-soft text-electricity', glow: 'from-electricity/15' },
  gas: { icon: 'bg-gas-soft text-gas', glow: 'from-gas/15' },
} as const;

export function EnergyTeaserCard({ title, icon: Icon, tone, captureTo }: EnergyTeaserCardProps) {
  const t = TONES[tone];
  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 bg-linear-to-br to-transparent',
          t.glow,
        )}
      />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-base">
          <span className={cn('grid size-9 place-items-center rounded-xl', t.icon)}>
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            –<span className="ml-1.5 text-base font-medium text-muted-foreground">kWh/Tag</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Noch keine Ablesungen</p>
        </div>
        <Link
          to={captureTo}
          className="text-sm font-medium underline-offset-4 hover:underline"
          aria-label={`${title} ablesen`}
        >
          Ablesen →
        </Link>
      </CardContent>
    </Card>
  );
}
