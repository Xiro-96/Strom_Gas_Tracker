import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import { createManifest } from './src/app/pwa/manifest.ts';
import { buildCsp, injectCsp } from './src/app/security/csp.ts';

export const BASE = '/Strom_Gas_Tracker/';

/** Fügt die CSP nur im Build ein – der Dev-Server (HMR) bräuchte sonst Ausnahmen. */
function cspPlugin(): Plugin {
  return {
    name: 'sgt-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => injectCsp(html, buildCsp()),
    },
  };
}

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true, injectThemeColor: false },
      manifest: createManifest(BASE),
      workbox: {
        // Kein `webmanifest` hier: das Plugin fügt das Manifest selbst hinzu. Doppelte URLs mit
        // abweichender Revision lassen Workbox das Precaching still abbrechen (E2E-Test prüft das).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Nur lateinische Schrift-Subsets offline vorhalten (Deutsch braucht nichts anderes).
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        cleanupOutdatedCaches: true,
      },
    }),
    cspPlugin(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
