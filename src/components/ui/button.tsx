import type { ComponentProps } from 'react';
import { Slot } from 'radix-ui';
import { buttonVariants, type ButtonVariantProps } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ComponentProps<'button'> & ButtonVariantProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
