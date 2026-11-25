import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        electricity: 'border-transparent bg-electricity-soft text-electricity',
        gas: 'border-transparent bg-gas-soft text-gas',
        savings: 'border-transparent bg-savings/15 text-savings',
        warning: 'border-transparent bg-warning/15 text-warning',
        danger: 'border-transparent bg-danger/15 text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
