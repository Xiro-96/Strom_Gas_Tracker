import { db } from '@/data/db';
import type { Settings } from '@/domain/types';

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  weatherOptIn: false,
  readingIntervalDays: 14,
  gasBaseLoadShare: 0.15,
  cancellationBufferDays: 7,
  referenceTariffs: [],
  theme: 'dark',
};

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings' });
}
