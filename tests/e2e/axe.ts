import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * Schwere axe-Verstöße (WCAG 2.1 AA). Wartet auf den Service Worker und Einblend-Animationen.
 * Toasts sind ausgenommen: Sie blenden zu zufälliger Zeit ein/aus, axe misst sie dann halbtransparent
 * (falscher Kontrastfehler). Ihre Farben sind die Popover-Tokens, die auf jeder Seite mitgeprüft werden.
 */
export async function seriousViolations(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-sonner-toaster]')
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
