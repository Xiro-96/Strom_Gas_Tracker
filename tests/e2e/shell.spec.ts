import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Sammelt CSP-Verstöße und Laufzeitfehler – beides darf im Build nie auftreten. */
function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/Content Security Policy|Refused to/i.test(text)) problems.push(text);
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

test('lädt unter der Base ohne CSP-Verstöße', async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Übersicht' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Strom' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gas' })).toBeVisible();
  await page.goto('./#/mehr');
  await expect(page.getByRole('heading', { level: 1, name: 'Mehr' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('Bottom-Navigation: alle Einträge sichtbar und bedienbar', async ({ page }) => {
  await page.goto('./');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  for (const name of ['Übersicht', 'Verlauf', 'Zählerstand erfassen', 'Verträge', 'Mehr']) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  await nav.getByRole('link', { name: 'Verträge' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Verträge' })).toBeVisible();
  await expect(page).toHaveURL(/#\/vertraege$/);
  // Die Seitenleiste gehört nur auf breite Bildschirme.
  await expect(page.getByRole('navigation', { name: 'Seitenleiste' })).toBeHidden();
});

test('Inhalt am Seitenende wird nicht von der Bottom-Navigation verdeckt', async ({ page }) => {
  await page.goto('./#/mehr');
  const last = page.getByText(/Version \d+\.\d+\.\d+/);
  await last.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 10_000);
  const lastBox = await last.boundingBox();
  const navBox = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox();
  expect(lastBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  if (lastBox && navBox) expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(navBox.y);
});

test('Manifest ist gültig und alle Icons sind ladbar', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/Strom_Gas_Tracker/manifest.webmanifest');
  const response = await request.get('manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    short_name: string;
    start_url: string;
    scope: string;
    icons: { src: string; sizes: string; purpose?: string }[];
    shortcuts: { name: string }[];
  };
  expect(manifest.short_name).toBe('Energie');
  expect(manifest.start_url).toBe('/Strom_Gas_Tracker/');
  expect(manifest.scope).toBe('/Strom_Gas_Tracker/');
  expect(manifest.shortcuts.map((s) => s.name)).toEqual(['Strom ablesen', 'Gas ablesen']);
  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok(), icon.src).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }
});

test('Precache-Liste enthält keine doppelten URLs (Workbox bricht sonst still ab)', async ({
  request,
}) => {
  const sw = await (await request.get('sw.js')).text();
  const urls = [...sw.matchAll(/\{url:"([^"]+)"/g)].map((match) => match[1]);
  expect(urls.length).toBeGreaterThan(5);
  expect(urls).toContain('index.html');
  expect(urls.filter((url, index) => urls.indexOf(url) !== index)).toEqual([]);
});

test('startet nach dem ersten Besuch offline – auch per Deep-Link', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.goto('./#/vertraege');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Verträge' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await context.setOffline(false);
});

test('Shortcut „Gas ablesen“ öffnet die Schnellerfassung', async ({ page }) => {
  await page.goto('./?ablesen=gas');
  await expect(page).toHaveURL(/\/Strom_Gas_Tracker\/#\/erfassen\/gas$/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('Theme-Wahl überlebt einen Neustart ohne Aufblitzen', async ({ page }) => {
  await page.goto('./#/mehr');
  await page.getByRole('radio', { name: 'Hell' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  // theme-init.js setzt das Theme vor dem ersten Paint – direkt nach dem Laden prüfen.
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f7f8fa');
});

for (const theme of ['dark', 'light'] as const) {
  test(`Barrierefreiheit (axe, WCAG AA) im ${theme === 'dark' ? 'dunklen' : 'hellen'} Design`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('sgt-theme', value);
    }, theme);
    for (const path of ['./', './#/mehr', './#/verlauf']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Einblend-Animation abwarten, sonst misst axe halbtransparente Kontraste.
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      expect(serious, path).toEqual([]);
    }
  });
}

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('zeigt die Seitenleiste statt der Bottom-Navigation', async ({ page }) => {
    await page.goto('./');
    const sidebar = page.getByRole('navigation', { name: 'Seitenleiste' });
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();
    await sidebar.getByRole('link', { name: 'Wechsel-Cockpit' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Wechsel-Cockpit' })).toBeVisible();
  });
});
