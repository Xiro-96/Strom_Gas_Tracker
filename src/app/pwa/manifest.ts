import type { ManifestOptions } from 'vite-plugin-pwa';
// Relativer Import: diese Datei wird auch von vite.config.ts (Node) geladen.
import { THEME_COLORS } from '../theme/theme.ts';

/** Web-App-Manifest. Icons ergänzt der PWA-Assets-Generator (pwa-assets.config.ts). */
export function createManifest(base: string): Partial<ManifestOptions> {
  return {
    id: base,
    name: 'Strom & Gas Tracker',
    short_name: 'Energie',
    description:
      'Zählerstände in Sekunden erfassen, Verbrauch und Kosten verstehen, Verträge, Boni und Fristen im Griff – offline und privat.',
    lang: 'de',
    dir: 'ltr',
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    categories: ['finance', 'utilities', 'productivity'],
    shortcuts: [
      {
        name: 'Strom ablesen',
        short_name: 'Strom',
        description: 'Stromzählerstand erfassen',
        url: `${base}?ablesen=strom`,
      },
      {
        name: 'Gas ablesen',
        short_name: 'Gas',
        description: 'Gaszählerstand erfassen',
        url: `${base}?ablesen=gas`,
      },
    ],
  };
}
