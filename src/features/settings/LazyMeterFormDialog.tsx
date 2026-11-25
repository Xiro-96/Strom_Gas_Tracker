import { lazy, Suspense, type ComponentProps } from 'react';

// Formular samt zod/react-hook-form erst beim Öffnen laden – spart ~75 KB gzip beim Start.
const MeterFormDialogImpl = lazy(async () => ({
  default: (await import('@/features/settings/MeterFormDialog')).MeterFormDialog,
}));

type Props = ComponentProps<typeof MeterFormDialogImpl>;

export function MeterFormDialog(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <MeterFormDialogImpl {...props} />
    </Suspense>
  );
}
