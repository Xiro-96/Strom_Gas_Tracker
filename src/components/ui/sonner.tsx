import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/app/theme/useTheme';

export function Toaster(props: ToasterProps) {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'rounded-2xl! border! border-border! bg-popover! text-popover-foreground! shadow-card!',
          description: 'text-muted-foreground!',
          actionButton: 'rounded-lg! bg-primary! text-primary-foreground! font-medium!',
        },
      }}
      {...props}
    />
  );
}
