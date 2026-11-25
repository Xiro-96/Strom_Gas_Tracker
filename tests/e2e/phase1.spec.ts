import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function seriousViolations(page: Page) {
  // Einblend-Animationen (Toasts, Seitenwechsel) abwarten – sonst misst axe halbtransparente Kontraste.
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('Onboarding → Ablesung erfassen (< 10 s) → Übersicht zeigt den Wert', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Zähler anlegen/ }).click();
  const form = page.getByRole('dialog', { name: 'Zähler anlegen' });
  await form.getByLabel(/Aktueller Stand/).fill('14.321,6');
  await form.getByRole('button', { name: 'Zähler anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Strom' })).toBeVisible();

  // Schnellerfassung wie am Zähler: (+) → tippen → Speichern
  const started = Date.now();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Zählerstand erfassen' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Strom ablesen' });
  const input = sheet.getByLabel(/Zählerstand/);
  await expect(input).toBeFocused();
  await page.keyboard.type('14400');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/14\.400,0\skWh gespeichert/)).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);

  await expect(sheet).toBeHidden();
  await expect(page.getByText(/14\.400,0\skWh/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/14\.400,0\skWh/).first()).toBeVisible();
});

test('Demo-Daten: Übersicht, Verlauf und Diagramme 1–3 ohne Fehler und barrierearm', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  await page.goto('./');
  await page.getByRole('button', { name: /Demo-Daten laden/ }).click();
  await expect(page.getByRole('heading', { name: 'Gas' })).toBeVisible();
  await expect(page.getByText(/kWh\/Tag/).first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.goto('./#/verlauf');
  await expect(
    page.getByRole('list', { name: 'Ablesungen Strom' }).getByRole('listitem').first(),
  ).toBeVisible();

  await page.goto('./#/auswertung');
  for (const name of ['Tagesverbrauch', 'Monatsverbrauch', 'Kumuliert im Jahr']) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  await expect(page.locator('.recharts-surface')).toHaveCount(3);
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test('Altdaten per CSV einfügen und importieren', async ({ page }) => {
  await page.goto('./#/mehr');
  await page.getByRole('button', { name: 'Ablesungen importieren' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ablesungen importieren' });
  await dialog
    .getByLabel(/Text einfügen/)
    .fill(
      'Datum;Energie;Stand\n01.10.2026;Strom;100,5\n15.10.2026;Strom;250,5\n01.10.2026;Gas;50,000\n15.10.2026;Gas;60,000',
    );
  await expect(dialog.getByText(/Erkannt:/)).toContainText('2 Strom- und 2 Gasstände');
  await dialog.getByRole('button', { name: 'Importieren' }).click();
  await expect(dialog.getByText(/4 neu · 0 schon vorhanden/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Fertig' }).click();
  await page.goto('./');
  // 150 kWh in 14 Tagen = 10,7 kWh/Tag (Zahl und Einheit stehen in getrennten Elementen)
  await expect(page.locator('main')).toContainText('10,7kWh/Tag');
});
