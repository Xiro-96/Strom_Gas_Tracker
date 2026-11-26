import { db, type WeatherCache } from '@/data/db';
import { addDays, daysBetween } from '@/domain/dates';
import type { ISODate, Settings } from '@/domain/types';

/** Wetter-Cache ohne Netz und ohne zod – darf in den Start-Chunk (Analyse, Hooks). */
/** Archivdaten liegen mit einigen Tagen Verzug vor. */
const ARCHIVE_DELAY_DAYS = 5;
const REFRESH_AFTER_DAYS = 3;
export const NORMAL_YEARS = 10;

export const locationKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

/** Benötigter Zeitraum: 10 volle Jahre fürs Normaljahr bis zur ersten Ablesung, bis vor wenigen Tagen. */
export function weatherRange(
  firstReading: ISODate | undefined,
  today: ISODate,
): { from: ISODate; to: ISODate } {
  const normalStart = `${String(Number(today.slice(0, 4)) - NORMAL_YEARS)}-01-01`;
  const from = firstReading && firstReading < normalStart ? firstReading : normalStart;
  return { from, to: addDays(today, -ARCHIVE_DELAY_DAYS) };
}

export function needsRefresh(
  cache: Pick<WeatherCache, 'from' | 'fetchedAt'> | undefined,
  range: { from: ISODate },
  today: ISODate,
): boolean {
  if (!cache) return true;
  if (cache.from > range.from) return true;
  return daysBetween(cache.fetchedAt.slice(0, 10), today) >= REFRESH_AFTER_DAYS;
}

/** Gecachte Temperaturen als Map (ohne Lücken-Einträge). */
export function cacheToSeries(cache: Pick<WeatherCache, 'from' | 'temps'>): Map<ISODate, number> {
  const series = new Map<ISODate, number>();
  cache.temps.forEach((t, i) => {
    if (t !== null) series.set(addDays(cache.from, i), t);
  });
  return series;
}

export async function loadWeatherSeries(
  settings: Pick<Settings, 'weatherOptIn' | 'location'>,
): Promise<Map<ISODate, number> | null> {
  if (!settings.weatherOptIn || !settings.location) return null;
  const cache = await db.weather.get(locationKey(settings.location.lat, settings.location.lon));
  return cache ? cacheToSeries(cache) : null;
}

export async function clearWeather(): Promise<void> {
  await db.weather.clear();
}
