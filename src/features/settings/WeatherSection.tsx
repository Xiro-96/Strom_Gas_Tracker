import { CloudSun, MapPin, RefreshCw, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSettings, useWeatherInfo } from '@/data/hooks';
import type { Settings } from '@/domain/types';
import { updateSettings } from '@/data/repositories/settings';
import { clearWeather, searchPlaces, syncWeatherOnStart, type Place } from '@/data/weather';
import { todayISO } from '@/domain/dates';
import { formatDate } from '@/lib/format';

const placeLabel = (p: Place) => [p.name, p.region, p.country].filter(Boolean).join(', ');

/** Spec Phase 4 – Wetter-Opt-in (Open-Meteo) mit Ortssuche; einzige externe Anfrage der App. */
export function WeatherSection() {
  const settings = useSettings();
  if (!settings) return null;
  return <WeatherForm settings={settings} />;
}

function WeatherForm({ settings }: { settings: Settings }) {
  const info = useWeatherInfo();
  // Die Wahl gilt sofort (die Live-Abfrage der Einstellungen folgt einen Moment später)
  const [choice, setChoice] = useState<boolean | null>(null);
  const optIn = choice ?? settings.weatherOptIn;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const optInId = useId();
  const queryId = useId();

  const refresh = async () => {
    setBusy(true);
    const result = await syncWeatherOnStart(todayISO());
    setBusy(false);
    if (result === 'failed')
      toast.error('Wetterdaten konnten nicht geladen werden – später erneut versuchen.');
    else if (result === 'updated') toast.success('Wetterdaten geladen');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Wetter (optional)</h2>
        </CardTitle>
        <CardDescription>
          Mit Tagestemperaturen wird Gas witterungsbereinigt ausgewertet: „Hast du mehr geheizt oder
          war es nur kälter?“
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label htmlFor={optInId} className="flex items-start gap-3 text-sm">
          <input
            id={optInId}
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            checked={optIn}
            onChange={(e) => {
              const on = e.target.checked;
              setChoice(on);
              void updateSettings({ weatherOptIn: on }).then(async () => {
                if (!on) {
                  await clearWeather();
                  setResults(null);
                } else if (settings.location) {
                  await refresh();
                }
              });
            }}
          />
          <span>
            Wetterdaten von Open-Meteo nutzen
            <span className="block text-xs text-muted-foreground">
              Dabei gehen nur der gesuchte Ortsname und die Koordinaten des Orts an open-meteo.com –
              keine Verbräuche, keine persönlichen Daten. Ohne Zustimmung findet keine Anfrage
              statt.
            </span>
          </span>
        </label>

        {optIn ? (
          <>
            {settings.location ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-sm">
                <MapPin aria-hidden="true" className="size-4 text-muted-foreground" />
                <span className="flex-1">
                  {settings.location.name}
                  <span className="block text-xs text-muted-foreground">
                    {info
                      ? `${String(info.days)} Tage ab ${formatDate(info.from)}, geladen am ${formatDate(info.fetchedAt.slice(0, 10))}`
                      : 'Noch keine Wetterdaten geladen.'}
                  </span>
                </span>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
                  <RefreshCw aria-hidden="true" />
                  Aktualisieren
                </Button>
              </div>
            ) : null}
            <form
              className="flex items-end gap-2"
              aria-label="Ortssuche"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim().length < 2) return;
                setBusy(true);
                searchPlaces(query)
                  .then(setResults)
                  .catch(() => {
                    toast.error('Die Ortssuche ist gerade nicht erreichbar.');
                  })
                  .finally(() => {
                    setBusy(false);
                  });
              }}
            >
              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor={queryId} className="text-sm font-medium">
                  {settings.location ? 'Anderen Ort suchen' : 'Ort suchen'}
                </label>
                <Input
                  id={queryId}
                  autoComplete="off"
                  placeholder="z. B. Postleitzahl oder Ort"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                  }}
                />
              </div>
              <Button type="submit" variant="outline" disabled={busy}>
                <Search aria-hidden="true" />
                Suchen
              </Button>
            </form>
            {results ? (
              results.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kein Ort gefunden.</p>
              ) : (
                <ul
                  aria-label="Suchergebnisse"
                  className="flex flex-col divide-y rounded-xl border"
                >
                  {results.map((p) => (
                    <li
                      key={`${String(p.lat)},${String(p.lon)}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span>{placeLabel(p)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void updateSettings({
                            location: { name: placeLabel(p), lat: p.lat, lon: p.lon },
                          }).then(async () => {
                            setResults(null);
                            setQuery('');
                            await refresh();
                          });
                        }}
                      >
                        Übernehmen
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </>
        ) : null}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CloudSun aria-hidden="true" className="size-3.5" />
          Wetterdaten: Open-Meteo.com (CC BY 4.0)
        </p>
      </CardContent>
    </Card>
  );
}
