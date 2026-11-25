# Entscheidungen

Kurzprotokoll der Entscheidungen innerhalb der Spezifikation (`docs/MASTER_PROMPT.md`).
Format: Datum · Entscheidung · Grund.

## Phase 0 – Fundament (25.11.2026)

1. **TypeScript 6.0 statt 7.0.** typescript-eslint (8.74) unterstützt nur `typescript < 6.1`.
   TS 7 (nativer Compiler) folgt, sobald typescript-eslint es offiziell unterstützt.
2. **shadcn/ui-Komponenten von Hand übernommen** (`src/components/ui`), nicht per CLI. Die
   Registry war aus der Build-Umgebung nicht erreichbar. Code und Stil entsprechen shadcn/ui
   (Radix über das Paket `radix-ui`, `cva`, `cn`). `components.json` liegt bei, damit die CLI
   später genutzt werden kann. cva-Varianten liegen in eigenen `*-variants.ts`-Dateien (React
   Fast Refresh verlangt reine Komponenten-Exporte).
3. **Theme-Speicher:** `localStorage` (`sgt-theme`) plus `public/theme-init.js`, das das Theme vor
   dem ersten Paint setzt (kein Aufblitzen; als Datei der eigenen Origin CSP-konform, kein
   Inline-Skript). Dark ist Standard und steht schon im ausgelieferten HTML. Ab Phase 1 spiegelt
   `Settings.theme` (Dexie) die Wahl; `localStorage` bleibt der Boot-Cache.
4. **Manifest-Shortcuts als Query** (`?ablesen=strom|gas`) statt Hash-URL: Fragmente in
   Shortcut-URLs kommen nicht auf allen Plattformen an. `applyLaunchAction` macht daraus vor dem
   Start des Hash-Routers `#/erfassen/strom|gas` und entfernt den Query-String.
5. **CSP nur im Build** (Vite-Plugin, `<meta>` direkt nach `charset`). `script-src 'self'`
   strikt; `style-src` erlaubt `'unsafe-inline'`, weil sonner/Radix zur Laufzeit `<style>`
   setzen. `connect-src` nur `'self'` und die drei Open-Meteo-Hosts.
6. **`motion` nicht im Phase-0-Bundle.** Der Seitenwechsel ist eine CSS-Animation
   (tw-animate-css); `motion` kostete rund 45 KB gzip. Ab Phase 1 nur gezielt (Bottom-Sheet,
   Gesten) über `LazyMotion`. `prefers-reduced-motion` schaltet Animationen global ab.
7. **Precache:** nur lateinische Schrift-Subsets (Deutsch braucht keine anderen). `webmanifest`
   steht nicht in `globPatterns`, weil das Plugin es selbst hinzufügt. Doppelte URLs mit
   abweichender Revision ließen Workbox das Precaching **still** abbrechen (SW aktiv, Cache
   leer, offline weiß). Ein E2E-Test prüft auf Duplikate.
8. **Playwright:** Projekt „iPhone 15“-Viewport mit Touch, gerendert in **Chromium** (Service
   Worker und Offline-Emulation zuverlässig). WebKit steht unter „Später“. Lokal kann ein
   vorinstalliertes Chromium per `PW_CHROMIUM_EXECUTABLE` genutzt werden.
9. **Barrierefreiheit per axe-core** (E2E, WCAG 2.1 AA, dunkel und hell) statt
   `eslint-plugin-jsx-a11y`, das ESLint 10 noch nicht unterstützt.
10. **npm audit:** 4 × „moderate“ in `workbox-build` → `glob`/`minimatch`. Nur Build-Zeit,
    nichts davon landet in der App. Bei neuer Workbox-Version erneut prüfen.
11. **Node:** `.nvmrc` = `lts/*` (CI nimmt die aktuelle LTS); `engines` ≥ 22.22 (Mindestversion
    von React Router 8).
12. **Bottom-Navigation:** Der zentrale (＋)-Button heißt barrierefrei „Zählerstand erfassen“ und
    hat einen festen Amber→Cyan-Verlauf (Strom → Gas), der in beiden Themes kontrastreich bleibt.
13. **Kein Lizenzfeld gesetzt.** Die Lizenzwahl für das öffentliche Repo trifft der
    Repo-Inhaber.
14. **Deploy-Workflow:** ein Workflow `ci.yml`. Job `verify` (Lint, Typecheck, Test, Build, E2E)
    läuft bei jedem Push/PR; Job `deploy` nur auf `main` (GitHub Pages über
    `actions/deploy-pages`).
