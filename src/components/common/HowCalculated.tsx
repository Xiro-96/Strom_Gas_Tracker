import { Calculator } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** „So gerechnet“: Formel und eingesetzte Werte zum Nachvollziehen (Spec Phase 2). */
export function HowCalculated({
  children,
  label = 'So gerechnet',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Calculator aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={label} className="flex flex-col gap-2 text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
