import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Deadline } from '@/domain/deadlines';
import type { ISODate } from '@/domain/types';
import { calendarText, downloadCalendar } from '@/features/switch/calendar';

export function CalendarExportButton({
  deadlines,
  readingIntervalDays,
  today,
  variant = 'outline',
}: {
  deadlines: Deadline[];
  readingIntervalDays: number;
  today: ISODate;
  variant?: 'outline' | 'default';
}) {
  return (
    <Button
      variant={variant}
      onClick={() => {
        downloadCalendar(calendarText(deadlines, readingIntervalDays, today));
        toast.success('Kalenderdatei erstellt', {
          description: 'Öffnen und in den Kalender übernehmen – mit Erinnerungen.',
        });
      }}
    >
      <CalendarPlus aria-hidden="true" />
      Kalender exportieren (.ics)
    </Button>
  );
}
