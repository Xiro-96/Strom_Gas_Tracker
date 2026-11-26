import { backupDue } from '@/domain/reminders';

describe('Backup-Erinnerung alle 30 Tage', () => {
  it('ohne eigene Daten nie', () => {
    expect(
      backupDue({ firstDataAt: undefined, lastBackupAt: undefined, today: '2026-11-26' }),
    ).toEqual({ due: false });
  });

  it('erstmals 30 Tage nach den ersten eigenen Daten', () => {
    expect(
      backupDue({
        firstDataAt: '2026-11-01T10:00:00.000Z',
        lastBackupAt: undefined,
        today: '2026-11-26',
      }).due,
    ).toBe(false);
    expect(
      backupDue({
        firstDataAt: '2026-10-27T10:00:00.000Z',
        lastBackupAt: undefined,
        today: '2026-11-26',
      }),
    ).toEqual({
      due: true,
      daysSince: undefined,
    });
  });

  it('danach 30 Tage nach der letzten Sicherung', () => {
    expect(
      backupDue({
        firstDataAt: '2025-01-01T10:00:00.000Z',
        lastBackupAt: '2026-11-01T10:00:00.000Z',
        today: '2026-11-26',
      }).due,
    ).toBe(false);
    expect(
      backupDue({
        firstDataAt: '2025-01-01T10:00:00.000Z',
        lastBackupAt: '2026-10-20T10:00:00.000Z',
        today: '2026-11-26',
      }),
    ).toEqual({
      due: true,
      daysSince: 37,
    });
  });
});
