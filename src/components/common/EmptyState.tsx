import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
