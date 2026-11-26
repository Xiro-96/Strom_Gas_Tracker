import { db } from '@/data/db';
import { updateSettings } from '@/data/repositories/settings';
import {
  cacheToSeries,
  loadWeatherSeries,
  needsRefresh,
  refreshWeather,
  searchPlaces,
  syncWeather,
  weatherRange,
} from '@/data/weather';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const json = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

const archive = {
  daily: { time: ['2026-01-01', '2026-01-02', '2026-01-03'], temperature_2m_mean: [1.5, null, -2] },
};

describe('Wetter – Open-Meteo nur nach Opt-in', () => {
  it('sucht Orte und liefert Name, Region und Koordinaten', async () => {
    const fetchMock = vi.fn(() =>
      json({
        results: [
          {
            name: 'Musterstadt',
            latitude: 51.5,
            longitude: 7.25,
            admin1: 'Nordrhein-Westfalen',
            country: 'Deutschland',
          },
        ],
      }),
    );
    expect(await searchPlaces(' Musterstadt ', fetchMock)).toEqual([
      {
        name: 'Musterstadt',
        region: 'Nordrhein-Westfalen',
        country: 'Deutschland',
        lat: 51.5,
        lon: 7.25,
      },
    ]);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toMatch(
      /^https:\/\/geocoding-api\.open-meteo\.com\/v1\/search\?name=Musterstadt&count=5&language=de/,
    );
    expect(await searchPlaces('Nirgendwo', () => json({}))).toEqual([]);
  });

  it('lädt Tagesmittel, speichert lückenlos und liest sie als Reihe', async () => {
    const fetchMock = vi.fn(() => json(archive));
    const cache = await refreshWeather(
      { lat: 51.5, lon: 7.25 },
      { from: '2026-01-01', to: '2026-01-03' },
      fetchMock,
    );
    expect(cache).toMatchObject({ id: '51.50,7.25', from: '2026-01-01', temps: [1.5, null, -2] });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('https://archive-api.open-meteo.com/v1/archive?');
    expect(url).toContain('daily=temperature_2m_mean');
    expect([...cacheToSeries(cache)]).toEqual([
      ['2026-01-01', 1.5],
      ['2026-01-03', -2],
    ]);
  });

  it('fragt ohne Opt-in oder ohne Ort nichts an', async () => {
    const fetchMock = vi.fn(() => json(archive));
    expect(await syncWeather('2026-01-01', '2026-11-26', fetchMock)).toBe('skipped');
    await updateSettings({ weatherOptIn: true });
    expect(await syncWeather('2026-01-01', '2026-11-26', fetchMock)).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await loadWeatherSeries({ weatherOptIn: false, location: { name: 'X', lat: 1, lon: 2 } }),
    ).toBeNull();
  });

  it('aktualisiert mit Opt-in nur bei Bedarf und bleibt bei Netzfehlern still', async () => {
    await updateSettings({
      weatherOptIn: true,
      location: { name: 'Musterstadt', lat: 51.5, lon: 7.25 },
    });
    const fetchMock = vi.fn(() => json(archive));
    // Cache beginnt am 01.01.2026, gebraucht wird ab 2016 → laden
    expect(await syncWeather('2026-01-01', '2026-11-26', fetchMock)).toBe('updated');
    const location = { name: 'Musterstadt', lat: 51.5, lon: 7.25 };
    expect((await loadWeatherSeries({ weatherOptIn: true, location }))?.get('2026-01-03')).toBe(-2);
    // deckt den Zeitraum ab und ist frisch → keine Anfrage
    await db.weather.update('51.50,7.25', { from: '2016-01-01' });
    expect(await syncWeather('2026-01-01', '2026-11-26', fetchMock)).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // veraltet, aber Netz weg → still scheitern, Cache bleibt
    await db.weather.update('51.50,7.25', { fetchedAt: '2026-11-01T00:00:00.000Z' });
    expect(await syncWeather('2026-01-01', '2026-11-26', () => json({}, false))).toBe('failed');
    expect(await db.weather.count()).toBe(1);
  });

  it('braucht 10 Normaljahre und Daten bis wenige Tage vor heute', () => {
    expect(weatherRange('2025-03-01', '2026-11-26')).toEqual({
      from: '2016-01-01',
      to: '2026-11-21',
    });
    expect(weatherRange('2014-05-01', '2026-11-26').from).toBe('2014-05-01');
    expect(needsRefresh(undefined, { from: '2016-01-01' }, '2026-11-26')).toBe(true);
    expect(
      needsRefresh(
        { from: '2016-01-01', fetchedAt: '2026-11-25T08:00:00Z' },
        { from: '2016-01-01' },
        '2026-11-26',
      ),
    ).toBe(false);
  });
});
