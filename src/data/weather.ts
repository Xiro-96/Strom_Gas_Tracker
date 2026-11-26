import { z } from 'zod';
import { db, type WeatherCache } from '@/data/db';
import { nowISO } from '@/data/entity';
import { getSettings } from '@/data/repositories/settings';
import { addDays, daysBetween, eachDay } from '@/domain/dates';
import type { ISODate, Settings } from '@/domain/types';

/** Spec 3/11 – einzige externe Anfrage: Open-Meteo, nur nach Opt-in (Hosts stehen in der CSP). */
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
/** Archivdaten liegen mit einigen Tagen Verzug vor. */
const ARCHIVE_DELAY_DAYS = 5;
const REFRESH_AFTER_DAYS = 3;
export const NORMAL_YEARS = 10;

export interface Place {
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
}

type Fetch = (url: string) => Promise<Response>;

export const locationKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

const geocodingSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
});

const archiveSchema = z.object({
  daily: z.object({
    time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    temperature_2m_mean: z.array(z.number().nullable()),
  }),
});

/** Ortssuche (Open-Meteo Geocoding). Nur aufrufen, wenn der Nutzer Wetter aktiviert hat. */
export async function searchPlaces(query: string, fetchImpl: Fetch = fetch): Promise<Place[]> {
  const params = new URLSearchParams({
    name: query.trim(),
    count: '5',
    language: 'de',
    format: 'json',
  });
  const response = await fetchImpl(`${GEOCODING_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('Die Ortssuche ist gerade nicht erreichbar.');
  const data = geocodingSchema.parse(await response.json());
  return (data.results ?? []).map((r) => ({
    name: r.name,
    ...(r.admin1 ? { region: r.admin1 } : {}),
    ...(r.country ? { country: r.country } : {}),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

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

/** Tagesmittel aus dem Open-Meteo-Archiv laden und lokal speichern. */
export async function refreshWeather(
  location: { lat: number; lon: number },
  range: { from: ISODate; to: ISODate },
  fetchImpl: Fetch = fetch,
): Promise<WeatherCache> {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    start_date: range.from,
    end_date: range.to,
    daily: 'temperature_2m_mean',
    timezone: 'Europe/Berlin',
  });
  const response = await fetchImpl(`${ARCHIVE_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('Wetterdaten sind gerade nicht erreichbar.');
  const { daily } = archiveSchema.parse(await response.json());
  const byDay = new Map(daily.time.map((d, i) => [d, daily.temperature_2m_mean[i] ?? null]));
  const from = daily.time[0] ?? range.from;
  const last = daily.time.at(-1) ?? range.to;
  const cache: WeatherCache = {
    id: locationKey(location.lat, location.lon),
    lat: location.lat,
    lon: location.lon,
    from,
    temps: eachDay(from, addDays(last, 1)).map((d) => byDay.get(d) ?? null),
    fetchedAt: nowISO(),
  };
  await db.weather.put(cache);
  return cache;
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

/** Beim App-Start: nur mit Opt-in und Ort, nur wenn nötig. Fehler bleiben still (Promille-Fallback). */
export async function syncWeather(
  firstReading: ISODate | undefined,
  today: ISODate,
  fetchImpl: Fetch = fetch,
): Promise<'skipped' | 'fresh' | 'updated' | 'failed'> {
  const settings = await getSettings();
  if (!settings.weatherOptIn || !settings.location) return 'skipped';
  const range = weatherRange(firstReading, today);
  const cache = await db.weather.get(locationKey(settings.location.lat, settings.location.lon));
  if (!needsRefresh(cache, range, today)) return 'fresh';
  try {
    await refreshWeather(settings.location, range, fetchImpl);
    return 'updated';
  } catch {
    return 'failed';
  }
}

export async function clearWeather(): Promise<void> {
  await db.weather.clear();
}

/** App-Start: erste Ablesung ermitteln und bei Bedarf aktualisieren (nur mit Opt-in). */
export async function syncWeatherOnStart(
  today: ISODate,
): Promise<'skipped' | 'fresh' | 'updated' | 'failed'> {
  const first = await db.readings.orderBy('date').first();
  return syncWeather(first?.date, today);
}
