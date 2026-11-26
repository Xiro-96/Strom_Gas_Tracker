import { z } from '@/lib/zod';
import { db, type WeatherCache } from '@/data/db';
import {
  cacheToSeries,
  clearWeather,
  locationKey,
  loadWeatherSeries,
  needsRefresh,
  NORMAL_YEARS,
  weatherRange,
} from '@/data/weatherCache';
import { nowISO } from '@/data/entity';
import { getSettings } from '@/data/repositories/settings';
import { addDays, eachDay } from '@/domain/dates';
import type { ISODate } from '@/domain/types';

/** Spec 3/11 – einzige externe Anfrage: Open-Meteo, nur nach Opt-in (Hosts stehen in der CSP). */
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

export interface Place {
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
}

type Fetch = (url: string) => Promise<Response>;

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

/** App-Start: erste Ablesung ermitteln und bei Bedarf aktualisieren (nur mit Opt-in). */
export async function syncWeatherOnStart(
  today: ISODate,
): Promise<'skipped' | 'fresh' | 'updated' | 'failed'> {
  const first = await db.readings.orderBy('date').first();
  return syncWeather(first?.date, today);
}

export {
  cacheToSeries,
  clearWeather,
  locationKey,
  loadWeatherSeries,
  needsRefresh,
  NORMAL_YEARS,
  weatherRange,
};
