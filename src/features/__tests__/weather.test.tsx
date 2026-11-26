import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { loadDemoData } from '@/data/repositories/demo';
import { getSettings, updateSettings } from '@/data/repositories/settings';
import { addDays, eachDay, todayISO } from '@/domain/dates';
import { renderRoute } from '@/test/renderRoute';

const today = todayISO();

/** Erfundene, jahreszeitliche Tagesmittel (kalt im Januar, warm im Juli). */
function seasonalTemps(from: string, to: string) {
  return eachDay(from, to).map((d) => {
    const dayOfYear = (Number(d.slice(5, 7)) - 1) * 30.4 + Number(d.slice(8, 10));
    return Math.round((9 - 10 * Math.cos((2 * Math.PI * (dayOfYear - 15)) / 365)) * 10) / 10;
  });
}

const json = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Wetter in den Einstellungen', () => {
  it('fragt ohne Zustimmung nichts an', async () => {
    const fetchMock = vi.fn(() => json({}));
    vi.stubGlobal('fetch', fetchMock);
    await loadDemoData();
    renderRoute('/');
    await screen.findByRole('heading', { name: 'Gas' });
    renderRoute('/mehr');
    await screen.findByRole('heading', { name: 'Wetter (optional)' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Opt-in → Ort suchen → übernehmen → Wetterdaten laden', async () => {
    const user = userEvent.setup();
    const from = `${String(Number(today.slice(0, 4)) - 10)}-01-01`;
    const to = addDays(today, -5);
    const days = eachDay(from, addDays(to, 1));
    const fetchMock = vi.fn((url: string) =>
      url.startsWith('https://geocoding-api.open-meteo.com/')
        ? json({
            results: [
              {
                name: 'Musterstadt',
                latitude: 51.5,
                longitude: 7.25,
                admin1: 'NRW',
                country: 'Deutschland',
              },
            ],
          })
        : json({ daily: { time: days, temperature_2m_mean: seasonalTemps(from, addDays(to, 1)) } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/mehr');
    await user.click(await screen.findByLabelText(/Wetterdaten von Open-Meteo nutzen/));
    await user.type(await screen.findByLabelText('Ort suchen'), 'Musterstadt');
    await user.click(screen.getByRole('button', { name: 'Suchen' }));
    const results = await screen.findByRole('list', { name: 'Suchergebnisse' });
    expect(results).toHaveTextContent('Musterstadt, NRW, Deutschland');
    await user.click(within(results).getByRole('button', { name: 'Übernehmen' }));
    await waitFor(async () => {
      expect((await getSettings()).location).toEqual({
        name: 'Musterstadt, NRW, Deutschland',
        lat: 51.5,
        lon: 7.25,
      });
    });
    expect(
      await screen.findByText(new RegExp(`${String(days.length)} Tage ab`)),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([u]) => new URL(u).host)).toEqual([
      'geocoding-api.open-meteo.com',
      'archive-api.open-meteo.com',
    ]);
  });
});

describe('Witterungsbereinigte Gas-Auswertung', () => {
  async function demoWithWeather() {
    await loadDemoData();
    const from = `${String(Number(today.slice(0, 4)) - 10)}-01-01`;
    const to = addDays(today, -5);
    await db.weather.put({
      id: '51.50,7.25',
      lat: 51.5,
      lon: 7.25,
      from,
      temps: seasonalTemps(from, addDays(to, 1)),
      fetchedAt: new Date().toISOString(),
    });
    await updateSettings({
      weatherOptIn: true,
      location: { name: 'Musterstadt', lat: 51.5, lon: 7.25 },
    });
  }

  it('zeigt in der Gas-Karte den bereinigten Trend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({})),
    );
    await demoWithWeather();
    renderRoute('/');
    const gas = (await screen.findByRole('heading', { name: 'Gas' })).closest('[data-slot="card"]');
    expect(gas).toHaveTextContent(/bereinigt [+−±]/);
  });

  it('zeigt Diagramm 8 (Gas gegen Außentemperatur) mit Tabelle', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({})),
    );
    await demoWithWeather();
    renderRoute('/auswertung');
    await user.click(await screen.findByRole('radio', { name: 'Gas' }));
    expect(
      await screen.findByRole('heading', { name: 'Gas und Außentemperatur' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gas und Außentemperatur als Tabelle' }));
    const table = screen.getByRole('table', { name: 'Gas und Außentemperatur' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(10);
  });

  it('weist ohne Wetter auf die Einstellung hin', async () => {
    const user = userEvent.setup();
    await loadDemoData();
    renderRoute('/auswertung');
    await user.click(await screen.findByRole('radio', { name: 'Gas' }));
    expect(await screen.findByText(/Wetter unter „Mehr“ aktivieren/)).toBeInTheDocument();
  });
});
