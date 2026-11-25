import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

/** Leerzustand für Bereiche, die laut Roadmap in einer späteren Ausbaustufe kommen. */
export function ComingSoon({
  icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Geplant für Ausbaustufe {phase}
        </span>
      }
    />
  );
}
