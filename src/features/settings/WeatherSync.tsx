import { useEffect } from 'react';
import { syncWeatherOnStart } from '@/data/weather';
import { todayISO } from '@/domain/dates';

/** Lädt beim Start fehlende Wetterdaten – nur mit Opt-in und Ort; Fehler bleiben still. */
export function WeatherSync() {
  useEffect(() => {
    // Komfortfunktion: Fehler (offline, Datenbank geschlossen) dürfen nie stören
    syncWeatherOnStart(todayISO()).catch(() => undefined);
  }, []);
  return null;
}
