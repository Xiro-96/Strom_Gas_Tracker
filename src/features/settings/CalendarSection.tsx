import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarExportButton } from '@/features/switch/CalendarExportButton';
import { useDeadlines } from '@/features/switch/useDeadlines';

/** Spec 7.3 (8) – Kalender-Export unter „Mehr“. */
export function CalendarSection() {
  const data = useDeadlines();
  if (data.status === 'loading') return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Kalender</h2>
        </CardTitle>
        <CardDescription>
          Alle Fristen mit Erinnerung und eine wiederkehrende Ablese-Erinnerung als .ics-Datei – für
          iPhone-, Android- und Google-Kalender. Nach Änderungen einfach neu exportieren.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CalendarExportButton
          deadlines={data.deadlines}
          readingIntervalDays={data.cost.energy.settings.readingIntervalDays}
          today={data.today}
        />
      </CardContent>
    </Card>
  );
}
