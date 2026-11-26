import { expect, test } from '@playwright/test';
import { seriousViolations } from './axe';

/** Lokales Datum als 'YYYY-MM-DD', `days` Tage vor heute. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test('Vertrag anlegen → Kosten und Saldo sichtbar (Detail und Übersicht)', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));

  // Stromzähler mit Startstand vor 30 Tagen und einer Ablesung heute
  await page.goto('./');
  await page.getByRole('button', { name: /Zähler anlegen/ }).click();
  const meterForm = page.getByRole('dialog', { name: 'Zähler anlegen' });
  await meterForm.getByLabel(/Aktueller Stand/).fill('1000');
  await meterForm.getByLabel('Datum', { exact: true }).fill(daysAgo(30));
  await meterForm.getByRole('button', { name: 'Zähler anlegen' }).click();
  await page.goto('./#/erfassen/strom');
  const sheet = page.getByRole('dialog', { name: 'Strom ablesen' });
  await sheet.getByLabel(/Zählerstand/).fill('1300');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toBeHidden();

  // Vertrags-Assistent in 4 Schritten
  await page.goto('./#/vertraege');
  await page.getByRole('button', { name: 'Vertrag anlegen' }).click();
  const wizard = page.getByRole('dialog', { name: 'Neuer Vertrag' });
  await wizard.getByLabel('Anbieter', { exact: true }).fill('Blitzwerk');
  await wizard.getByLabel('Tarif', { exact: true }).fill('Öko 12');
  await wizard.getByLabel('Lieferbeginn').fill(daysAgo(30));
  expect(await seriousViolations(page)).toEqual([]);
  await wizard.getByRole('button', { name: 'Weiter' }).click();
  await wizard.getByLabel('Arbeitspreis (brutto)').fill('30');
  await wizard.getByLabel('Grundpreis (brutto)').fill('150');
  await wizard.getByRole('button', { name: 'Weiter' }).click();
  await wizard.getByRole('button', { name: /Bonus hinzufügen/ }).click();
  await wizard.getByLabel('Betrag (€)').fill('100');
  await wizard.getByRole('button', { name: 'Weiter' }).click();
  await wizard.getByLabel('Abschlag (€/Monat)').fill('80');
  await wizard.getByRole('button', { name: 'Vertrag anlegen' }).click();

  await expect(page.getByRole('heading', { name: 'Blitzwerk', level: 1 })).toBeVisible();
  await expect(page.getByText(/^Saldo: (Guthaben|Nachzahlung|Ausgeglichen)/)).toBeVisible();
  // 300 kWh × 30 ct = 90 € Arbeitskosten stecken in „Kosten bisher“
  await expect(page.getByText('Empfohlener Abschlag')).toBeVisible();
  await page.getByRole('button', { name: /So gerechnet/ }).click();
  await expect(page.getByText(/Kosten je Tag = kWh × Arbeitspreis/)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await seriousViolations(page)).toEqual([]);

  await page.goto('./');
  const costs = page.getByRole('link', { name: /^Vertrag Blitzwerk:/ });
  await expect(costs).toContainText('Kosten diesen Monat');
  await expect(costs).toContainText(/Guthaben|Nachzahlung|Ausgeglichen/);
  await page.reload();
  await expect(page.getByRole('link', { name: /^Vertrag Blitzwerk:/ })).toBeVisible();
  expect(problems).toEqual([]);
});

for (const theme of ['dark', 'light'] as const) {
  test(`Demo: Verträge, Detail und Kostendiagramme ohne Fehler und barrierearm (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('sgt-theme', value);
    }, theme);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(m.text());
    });
    await page.goto('./');
    await page.getByRole('button', { name: /Demo-Daten laden/ }).click();
    await expect(page.getByRole('heading', { name: 'Gas' })).toBeVisible();

    await page.goto('./#/vertraege');
    await expect(page.getByRole('heading', { name: 'Strom', level: 2 })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole('link').filter({ hasText: 'Aktiv' }).first().click();
    await expect(page.getByRole('heading', { name: 'Kosten und Saldo' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto('./#/auswertung');
    for (const name of [
      'Kosten je Monat',
      'Abschläge vs. Kosten',
      'Effektivpreis je Vertragsjahr',
    ]) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
    await page.getByRole('radio', { name: 'Laufender Vertrag' }).click();
    expect(await seriousViolations(page)).toEqual([]);
    expect(problems).toEqual([]);
  });
}
