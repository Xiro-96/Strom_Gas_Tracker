import { useEffect } from 'react';
import { todayISO } from '@/domain/dates';

/** Lädt beim Start fehlende Wetterdaten – nur mit Opt-in und Ort; Fehler bleiben still. */
export function WeatherSync() {
  useEffect(() => {
    // Komfortfunktion: Fehler (offline, Datenbank geschlossen) dürfen nie stören
    // Netz-Teil (mit zod) erst bei Bedarf laden – hält den Start-Chunk klein
    import('@/data/weather')
      .then(({ syncWeatherOnStart }) => syncWeatherOnStart(todayISO()))
      .catch(() => undefined);
  }, []);
  return null;
}
