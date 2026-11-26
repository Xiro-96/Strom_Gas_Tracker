import { expect, test } from '@playwright/test';
import { seriousViolations } from './axe';

/** Lokales Datum als 'YYYY-MM-DD', `days` Tage ab heute. */
function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test('Frist in der Übersicht → Cockpit → Haken, Kündigungstext, Kalenderdatei', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));

  await page.goto('./');
  await page.getByRole('button', { name: /Zähler anlegen/ }).click();
  const meterForm = page.getByRole('dialog', { name: 'Zähler anlegen' });
  await meterForm.getByLabel(/Aktueller Stand/).fill('1000');
  await meterForm.getByLabel('Datum', { exact: true }).fill(shift(-30));
  await meterForm.getByRole('button', { name: 'Zähler anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Strom' })).toBeVisible();

  // Vertrag mit geplantem Lieferende in 40 Tagen und 1 Monat Frist
  await page.goto('./#/vertraege');
  await page.getByRole('button', { name: 'Vertrag anlegen' }).click();
  const wizard = page.getByRole('dialog', { name: 'Neuer Vertrag' });
  await wizard.getByLabel('Anbieter', { exact: true }).fill('Blitzwerk');
  await wizard.getByLabel('Tarif', { exact: true }).fill('Öko 12');
  await wizard.getByLabel('Kundennummer (optional)').fill('K-1000-7');
  await wizard.getByLabel('Lieferbeginn').fill(shift(-30));
  await wizard.getByRole('button', { name: 'Weiter' }).click();
  await wizard.getByLabel('Arbeitspreis (brutto)').fill('30');
  await wizard.getByLabel('Grundpreis (brutto)').fill('150');
  await wizard.getByRole('button', { name: 'Weiter' }).click();
  await wizard.getByRole('button', { name: 'Weiter' }).click();
  await wizard.getByLabel('Geplantes Lieferende').fill(shift(40));
  await wizard.getByLabel('Abschlag (€/Monat)').fill('80');
  await wizard.getByRole('button', { name: 'Vertrag anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Blitzwerk', level: 1 })).toBeVisible();

  // Übersicht: Fristen-Leiste → Cockpit
  await page.goto('./');
  const bar = page.getByRole('link', { name: /Blitzwerk kündigen · noch \d+ Tage/ });
  await expect(bar).toBeVisible();
  await bar.click();
  await expect(page).toHaveURL(/#\/wechsel$/);
  const card = page.getByRole('region', { name: 'Strom: Blitzwerk' });
  await expect(card.getByText('Kündigen bis')).toBeVisible();

  const offer = card.getByRole('checkbox', { name: /Neues Angebot gewählt/ });
  await offer.click();
  await expect(offer).toBeChecked();
  await expect(card.getByText('1 von 9 erledigt')).toBeVisible();

  await card.locator('summary', { hasText: 'Kündigungsschreiben' }).click();
  await card.getByRole('button', { name: 'Kopieren' }).first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('hilfsweise zum nächstmöglichen Termin');
  expect(copied).toContain('Kundennummer: K-1000-7');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Kalender exportieren (.ics)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('strom-gas-fristen.ics');
  const path = await file.path();
  const { readFile } = await import('node:fs/promises');
  const ics = await readFile(path, 'utf8');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics).toContain('SUMMARY:Blitzwerk kündigen');
  expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=14');
  expect(problems).toEqual([]);
});

for (const theme of ['dark', 'light'] as const) {
  test(`Demo: Cockpit, Zeitstrahl und Fristen-Leiste barrierearm (${theme})`, async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(m.text());
    });
    await page.addInitScript((value) => {
      localStorage.setItem('sgt-theme', value);
    }, theme);
    await page.goto('./');
    await page.getByRole('button', { name: /Demo-Daten laden/ }).click();
    await expect(page.getByRole('link', { name: /kündigen · noch \d+ Tage/ })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto('./#/vertraege');
    await expect(page.getByRole('heading', { name: 'Anbieter-Zeitstrahl' })).toBeVisible();
    await page.getByRole('button', { name: /^Gas: .* – läuft/ }).click();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto('./#/wechsel');
    await expect(page.getByRole('heading', { name: 'Alle Fristen' })).toBeVisible();
    await page.locator('summary', { hasText: 'Kündigungsschreiben' }).first().click();
    expect(await seriousViolations(page)).toEqual([]);
    expect(problems).toEqual([]);
  });
}
