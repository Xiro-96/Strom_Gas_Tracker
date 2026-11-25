import type { ComponentProps } from 'react';
import { Slot } from 'radix-ui';
import { badgeVariants, type BadgeVariantProps } from '@/components/ui/badge-variants';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<'span'> & BadgeVariantProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
