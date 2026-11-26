import { useEffect } from 'react';
import { getSettings } from '@/data/repositories/settings';
import { todayISO } from '@/domain/dates';

/**
 * Lädt beim Start fehlende Wetterdaten – nur mit Opt-in und Ort. Der Netz-Teil (mit zod) wird
 * erst dann nachgeladen, damit der Start ohne Wetter nichts zusätzlich lädt. Fehler bleiben still.
 */
export function WeatherSync() {
  useEffect(() => {
    getSettings()
      .then(async (settings) => {
        if (!settings.weatherOptIn || !settings.location) return;
        const { syncWeatherOnStart } = await import('@/data/weather');
        await syncWeatherOnStart(todayISO());
      })
      .catch(() => undefined);
  }, []);
  return null;
}
