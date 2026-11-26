import { daysBetween } from '@/domain/dates';
import type { ISODate } from '@/domain/types';

export const BACKUP_INTERVAL_DAYS = 30;

/**
 * Spec Phase 4 – Backup-Erinnerung alle 30 Tage: ab den ersten eigenen Daten, danach ab der
 * letzten Sicherung. Zeitstempel als ISO-Zeit, verglichen wird das (UTC-)Datum.
 */
export function backupDue(input: {
  firstDataAt: string | undefined;
  lastBackupAt: string | undefined;
  today: ISODate;
}): { due: boolean; daysSince?: number | undefined } {
  if (!input.firstDataAt) return { due: false };
  const reference = (input.lastBackupAt ?? input.firstDataAt).slice(0, 10);
  const days = daysBetween(reference, input.today);
  if (days < BACKUP_INTERVAL_DAYS) return { due: false };
  return { due: true, daysSince: input.lastBackupAt ? days : undefined };
}
