import { createManifest } from '@/app/pwa/manifest';
import { THEME_COLORS } from '@/app/theme/theme';

const BASE = '/Strom_Gas_Tracker/';

describe('createManifest', () => {
  const manifest = createManifest(BASE);

  it('trägt Name und Kurzname laut Spezifikation', () => {
    expect(manifest.name).toBe('Strom & Gas Tracker');
    expect(manifest.short_name).toBe('Energie');
    expect(manifest.lang).toBe('de');
    expect(manifest.display).toBe('standalone');
  });

  it('setzt scope, start_url und id passend zur Base', () => {
    expect(manifest.scope).toBe(BASE);
    expect(manifest.start_url).toBe(BASE);
    expect(manifest.id).toBe(BASE);
  });

  it('nutzt die Dark-Hintergrundfarbe für Splash und Statusleiste', () => {
    expect(manifest.background_color).toBe(THEME_COLORS.dark);
    expect(manifest.theme_color).toBe(THEME_COLORS.dark);
  });

  it('bietet die Shortcuts „Strom ablesen“ und „Gas ablesen“ unter der Base', () => {
    expect(manifest.shortcuts?.map((s) => [s.name, s.url])).toEqual([
      ['Strom ablesen', `${BASE}?ablesen=strom`],
      ['Gas ablesen', `${BASE}?ablesen=gas`],
    ]);
  });
});
