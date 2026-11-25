import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CaptureSheet } from '@/features/capture/CaptureSheet';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { MeterFormDialog } from '@/features/settings/MeterFormDialog';
import { energyFromSlug } from '@/features/shared/energy';

/** /erfassen[/strom|gas]: Übersicht im Hintergrund, Schnellerfassung als Sheet darüber. */
export function CapturePage() {
  const { energy } = useParams();
  const navigate = useNavigate();
  const [meterOpen, setMeterOpen] = useState(false);
  const initialEnergy = energyFromSlug(energy);
  return (
    <>
      <OverviewPage />
      <CaptureSheet
        open={!meterOpen}
        initialEnergy={initialEnergy}
        onOpenChange={(open) => {
          if (!open) void navigate('/', { replace: true });
        }}
        onCreateMeter={() => {
          setMeterOpen(true);
        }}
      />
      <MeterFormDialog
        open={meterOpen}
        defaultEnergy={initialEnergy}
        onOpenChange={(open) => {
          setMeterOpen(open);
        }}
      />
    </>
  );
}
