import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { seriousViolations } from './axe';

/** Lokales Datum als 'YYYY-MM-DD', `days` Tage ab heute. */
function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Alle Anfragen an fremde Hosts mitschreiben (Datenschutz: nur Open-Meteo nach Opt-in). */
function trackExternal(page: Page) {
  const hosts: string[] = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).host;
    if (host && !host.startsWith('localhost')) hosts.push(host);
  });
  return hosts;
}

test('Angebot erfassen → Ranking mit Warnung (Demo)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Demo-Daten laden/ }).click();
  await expect(page.getByRole('heading', { name: 'Strom' })).toBeVisible();
  await page.goto('./#/angebote');
  for (const [name, ap, gp, bonus] of [
    ['Lumen Stadtwerke', '28', '140', '100'],
    ['Funkenwerk', '30', '120', ''],
  ] as const) {
    await page.getByRole('button', { name: 'Angebot erfassen' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Angebot erfassen' });
    await dialog.getByLabel('Anbieter', { exact: true }).fill(name);
    await dialog.getByLabel('Tarif').fill('Test 12');
    await dialog.getByLabel('Arbeitspreis').fill(ap);
    await dialog.getByLabel('Grundpreis').fill(gp);
    if (bonus) await dialog.getByLabel('Neukundenbonus (€)').fill(bonus);
    await dialog.getByLabel('Garantie-Umfang').selectOption('full');
    await dialog.getByRole('button', { name: 'Angebot speichern' }).click();
    await expect(dialog).toBeHidden();
  }
  const list = page.getByRole('list', { name: 'Stromangebote nach Jahr 1' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').first()).toContainText('1. Lumen Stadtwerke');
  await expect(list.getByRole('listitem').first()).toContainText('Neukundenbonus ist fraglich');
  await expect(page.getByText(/kWh pro Jahr ist/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('Backup auf einem „zweiten Gerät“ wiederherstellen', async ({ page, browser }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Zähler anlegen/ }).click();
  const meterForm = page.getByRole('dialog', { name: 'Zähler anlegen' });
  await meterForm.getByLabel(/Aktueller Stand/).fill('1.234,5');
  await meterForm.getByLabel('Datum', { exact: true }).fill(shift(-10));
  await meterForm.getByRole('button', { name: 'Zähler anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Strom' })).toBeVisible();

  await page.goto('./#/mehr');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung erstellen' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^strom-gas-tracker-sicherung-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();
  const backup = JSON.parse(await readFile(path, 'utf8')) as { format: string };
  expect(backup.format).toBe('strom-gas-tracker');

  // „Zweites Gerät“: neuer Browser-Kontext mit leerem Speicher
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto('./#/mehr');
  await second.getByLabel('Sicherungsdatei wählen').setInputFiles(path);
  const dialog = second.getByRole('dialog', { name: 'Sicherung wiederherstellen?' });
  await expect(dialog).toContainText('1 Zähler, 1 Ablesungen');
  await dialog.getByRole('button', { name: 'Alles ersetzen' }).click();
  await second.goto('./#/verlauf');
  await expect(second.getByText(/1\.234,5\skWh/).first()).toBeVisible();
  await other.close();
});

test('Jahresbericht (Demo) druckbar und barrierearm', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Demo-Daten laden/ }).click();
  await expect(page.getByRole('heading', { name: 'Gas' })).toBeVisible();
  await page.goto('./#/bericht');
  await expect(
    page.getByRole('heading', { name: /^Jahresbericht \d{4}$/, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Strom' })).toContainText('Effektivpreis');
  await expect(page.getByRole('button', { name: 'Drucken / PDF' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  expect(await seriousViolations(page)).toEqual([]);
});

test('Wetter: keine Anfrage ohne Opt-in, danach nur Open-Meteo', async ({ page }) => {
  const external = trackExternal(page);
  const from = `${String(new Date().getFullYear() - 10)}-01-01`;
  await page.route('https://geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            name: 'Musterstadt',
            latitude: 51.5,
            longitude: 7.25,
            admin1: 'NRW',
            country: 'Deutschland',
          },
        ],
      },
    }),
  );
  await page.route('https://archive-api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: { daily: { time: [from, shift(-6)], temperature_2m_mean: [2.5, 8] } },
    }),
  );
  await page.goto('./');
  await page.getByRole('button', { name: /Demo-Daten laden/ }).click();
  await expect(page.getByRole('heading', { name: 'Gas' })).toBeVisible();
  await page.goto('./#/mehr');
  await expect(page.getByRole('heading', { name: 'Wetter (optional)' })).toBeVisible();
  expect(external).toEqual([]);

  await page.getByLabel(/Wetterdaten von Open-Meteo nutzen/).check();
  await page.getByLabel('Ort suchen').fill('Musterstadt');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await page
    .getByRole('list', { name: 'Suchergebnisse' })
    .getByRole('button', { name: 'Übernehmen' })
    .click();
  await expect(page.getByText(/Tage ab/)).toBeVisible();
  expect([...new Set(external)].sort()).toEqual([
    'archive-api.open-meteo.com',
    'geocoding-api.open-meteo.com',
  ]);
});

for (const theme of ['dark', 'light'] as const) {
  test(`Mehr und Angebote barrierearm (${theme})`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('sgt-theme', value);
    }, theme);
    await page.goto('./');
    await page.getByRole('button', { name: /Demo-Daten laden/ }).click();
    await expect(page.getByRole('heading', { name: 'Gas' })).toBeVisible();
    await page.goto('./#/mehr');
    await expect(page.getByRole('heading', { name: 'Sicherung' })).toBeVisible();
    await page.getByLabel(/Wetterdaten von Open-Meteo nutzen/).check();
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto('./#/angebote');
    await expect(page.getByText('Noch keine Stromangebote')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test('keine CSP-Verstöße – auch nicht auf Seiten mit Formularen (zod)', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  const violations = () =>
    page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
  await page.goto('./');
  await page.getByRole('button', { name: /Zähler anlegen/ }).click();
  const meterForm = page.getByRole('dialog', { name: 'Zähler anlegen' });
  // leer absenden → zod-Validierung läuft, dann gültig anlegen
  await meterForm.getByRole('button', { name: 'Zähler anlegen' }).click();
  await meterForm.getByLabel(/Aktueller Stand/).fill('1000');
  await meterForm.getByRole('button', { name: 'Zähler anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Strom' })).toBeVisible();
  expect(await violations()).toEqual([]);
  await page.goto('./#/vertraege');
  await page.getByRole('button', { name: 'Vertrag anlegen' }).click();
  await page
    .getByRole('dialog', { name: 'Neuer Vertrag' })
    .getByRole('button', { name: 'Weiter' })
    .click();
  expect(await violations()).toEqual([]);
  await page.goto('./#/angebote');
  await page.getByRole('button', { name: 'Angebot erfassen' }).first().click();
  await page
    .getByRole('dialog', { name: 'Angebot erfassen' })
    .getByRole('button', { name: 'Angebot speichern' })
    .click();
  await page.goto('./#/mehr');
  await expect(page.getByRole('heading', { name: 'Sicherung' })).toBeVisible();
  expect(await violations()).toEqual([]);
});
