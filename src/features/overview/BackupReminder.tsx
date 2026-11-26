import { ChevronRight, DatabaseBackup } from 'lucide-react';
import { Link } from 'react-router';
import { useBackupStatus } from '@/data/hooks';
import { todayISO } from '@/domain/dates';
import { backupDue } from '@/domain/reminders';

/** Spec Phase 4 – Backup-Erinnerung alle 30 Tage. */
export function BackupReminder() {
  const status = useBackupStatus();
  if (!status) return null;
  const reminder = backupDue({
    firstDataAt: status.firstDataAt,
    lastBackupAt: status.lastBackupAt,
    today: todayISO(),
  });
  if (!reminder.due) return null;
  return (
    <Link
      to="/mehr"
      className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-accent/40"
    >
      <DatabaseBackup aria-hidden="true" className="size-5 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Zeit für eine Sicherung</span>
        <span className="block text-xs text-muted-foreground">
          {reminder.daysSince !== undefined
            ? `Letzte Sicherung vor ${String(reminder.daysSince)} Tagen.`
            : 'Deine Daten liegen nur auf diesem Gerät.'}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
