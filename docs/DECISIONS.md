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
15. **Bibliotheken für Daten, Formulare und Diagramme** (Dexie, dexie-react-hooks, zod,
    react-hook-form, date-fns, Recharts, fake-indexeddb) kommen mit ihrer ersten Nutzung in
    Phase 1/2 dazu, nicht schon in Phase 0 („nichts aus späteren Phasen vorziehen“, keine
    ungenutzten Abhängigkeiten).
16. **Messwerte Phase 0** (Lighthouse 12, mobil, lokaler Preview-Build): Performance 94,
    Accessibility 100, Best Practices 100, SEO 100. JS-Bundle ca. 137 KB gzip, Precache 15 Dateien.

## Phase 1 – Zähler und Verbrauch (25.11.2026)

17. **CSV-Import der Ablesungen aus Phase 4 vorgezogen** (Excel-DE, `;` oder Tab, Dezimalkomma). So
    kommen echte Altdaten privat auf das Gerät, nie ins öffentliche Repo. Fehlende Zähler legt der
    Import an; abweichende Stände am selben Tag werden nie überschrieben, sondern gemeldet.
18. **Gasfaktoren je Intervall:** Es gelten die Faktoren am Intervallbeginn (keine Aufteilung
    innerhalb eines Intervalls). Das Formular in Phase 1 ersetzt die Faktoren (gelten dann für alle
    Ablesungen); eine zeitabhängige Historie in der UI folgt in Phase 2.
19. **Überlauf:** Ein Rückgang gilt nur dann als Überlauf, wenn die Vorkommastellen des Zählers bekannt
    sind und Δ < Modulus/2 ist. Die Erfassung fragt nach („Bestätigen und speichern“).
20. **Ausreißer:** Median der letzten 5 Intervalle, ab 2 Intervallen. Gas wird über die
    Gradtag-Gewichte normiert, damit Winterwerte nicht als Tippfehler gelten.
21. **Ablesestatus:** fällig ab dem Ableseintervall, überfällig ab dem 1,5-fachen (14 → 21 Tage).
22. **Schnellerfassung als Route** `/erfassen[/strom|gas]` mit der Übersicht dahinter (Deep-Link,
    Manifest-Shortcut, Zurück-Taste schließt). Formularzustand per `key`-Remount statt `setState` in
    Effekten (React-Compiler-Regeln).
23. **Diagrammfarben:** eigene Tokens `--chart-electricity` / `--chart-gas`, mit dem
    dataviz-Validator für hell und dunkel geprüft (Lightness-Band, CVD, Kontrast). Das Vorjahr ist
    eine Vergleichsreihe (gestrichelt bzw. blasser Balken), keine eigene Kategorie.
24. **Bundle:** Auswertung (Recharts) und Zählerformular (zod, react-hook-form) werden lazy geladen;
    Start-JS ca. 202 KB gzip.
25. **Fotos** werden in Phase 1 unkomprimiert gespeichert; Komprimierung (≤ 1600 px) folgt in Phase 4.
26. **Ablesungen am selben Tag:** Ausbau vor Einbau sortiert (`sortReadings`), damit der Zählerwechsel
    ohne Sprung ausgewertet wird.
