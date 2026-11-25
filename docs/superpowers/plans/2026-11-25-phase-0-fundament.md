# Phase 0 – Fundament: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lauffähige, installierbare, offline startende PWA-Hülle „Strom & Gas Tracker“ mit App-Shell, Theme, Routing, CI und Deploy auf GitHub Pages.

**Architecture:** Vite-SPA unter `base: '/Strom_Gas_Tracker/'` mit `createHashRouter`. Die App-Shell (Bottom-Nav mobil, Sidebar ab `md`) rendert Platzhalter-Screens mit Leerzustand. vite-plugin-pwa (`generateSW`, `registerType: 'prompt'`) liefert Manifest, Precache und einen Update-Toast. Eine CSP wird nur im Build per `<meta>` eingefügt.

**Tech Stack:** Node LTS, npm, Vite 8, React 19, TypeScript 6.0 (strict; TS 7 ist mit typescript-eslint noch nicht kompatibel), Tailwind CSS 4, shadcn/ui-Stil (Radix + cva, Komponenten von Hand übernommen), lucide-react, motion, sonner, React Router 8, vite-plugin-pwa 2 + @vite-pwa/assets-generator 2, Vitest 5 + Testing Library + jsdom, Playwright + @axe-core/playwright, ESLint 10 (flat config) + Prettier.

**Spec:** `docs/superpowers/specs/2026-11-25-strom-gas-tracker-design.md` (identisch mit `docs/MASTER_PROMPT.md`), Abschnitte 3, 7.1, 8 (Phase 0), 10, 11, 12.

## Global Constraints

- Repo ist öffentlich: keine persönlichen Daten in Code, Tests, Fixtures, Screenshots, Commits.
- Kein Tracking, keine Analytics, keine CDNs zur Laufzeit; Schrift lokal (`@fontsource-variable/inter`).
- `connect-src` nur `'self'` und Open-Meteo; kein `dangerouslySetInnerHTML`.
- TypeScript strict, `noUncheckedIndexedAccess`, kein `any`.
- Vor jedem Commit grün: `npm run lint && npm run typecheck && npm test && npm run build`.
- Durchgehend Deutsch in der UI. Dark Mode ist Standard; Light und System sind umschaltbar.
- Farben: Strom = Amber (`Zap`), Gas = Blau/Cyan (`Flame`), Ersparnis = Grün, Warnung = Orange/Rot.
- Mobile Bottom-Nav: **Übersicht · Verlauf · (＋) · Verträge · Mehr**; Desktop: Sidebar.
- Manifest: Name „Strom & Gas Tracker“, Kurzname „Energie“, `scope`/`start_url` = `/Strom_Gas_Tracker/`, Shortcuts „Strom ablesen“ und „Gas ablesen“.
- Nichts aus späteren Phasen vorziehen (keine Dexie-Daten, keine Domain-Logik).
- Conventional Commits.

## Review Focus

1. **Unterpfad `/Strom_Gas_Tracker/`:** Assets, SW-Scope, Manifest und Deep-Links (`#/vertraege`) müssen unter der Base funktionieren, auch nach einem Offline-Reload. → E2E „Deep-Link offline neu laden“ (Task 6).
2. **`localStorage` nicht verfügbar** (Safari privat, gesperrt): Das Theme fällt auf Dark zurück, die App startet trotzdem. → Unit-Test „storage wirft“ (Task 2).
3. **CSP blockiert etwas nur im Build** (Font, SW, Manifest, Styles): Das fällt im Dev-Server nicht auf. → E2E sammelt CSP-Verstöße auf dem `preview`-Build (Task 6).
4. **Update kommt während einer Eingabe:** Kein Auto-Reload; neu geladen wird nur nach einem Klick auf „Aktualisieren“. → Unit-Test UpdateToast (Task 5).
5. **iPhone-Home-Indicator verdeckt die Bottom-Nav:** `viewport-fit=cover` + `env(safe-area-inset-bottom)`. → E2E prüft, dass das Padding der Bottom-Nav den Safe-Area-Ausdruck nutzt und alle 5 Einträge im iPhone-Viewport sichtbar sind (Task 6).

---

### Task 1: Tooling-Gerüst

**Files:**

- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.nvmrc`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/styles/globals.css`, `src/test/setup.ts`, `src/vite-env.d.ts`
- Test: `src/app/__tests__/App.test.tsx`

**Interfaces:**

- Produces: npm-Skripte `dev`, `build` (`tsc -b && vite build`), `preview`, `lint`, `typecheck`, `test` (`vitest run`), `test:watch`, `coverage`, `format`, `e2e`; Alias `@/` → `src/`.

- [ ] Step 1: Write the failing test `App.test.tsx` → `render(<App />)`; `expect(screen.getByRole('heading', { name: 'Strom & Gas Tracker' }))`.
- [ ] Step 2: `npx vitest run` → FAIL (App fehlt).
- [ ] Step 3: Minimal-App und alle Konfigurationen anlegen. `tsconfig.app.json`: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. ESLint: `@eslint/js` recommended, `typescript-eslint` `strictTypeChecked`, react-hooks, react-refresh, `@typescript-eslint/no-explicit-any: error`, `eslint-config-prettier` als Letztes.
- [ ] Step 4: `npm run lint && npm run typecheck && npm test && npm run build` → alles grün.
- [ ] Step 5: Commit `chore: scaffold vite react typescript project`.

### Task 2: Design-Tokens und Theme

**Files:**

- Create: `src/app/theme/theme.ts`, `src/app/theme/ThemeProvider.tsx`, `src/app/theme/useTheme.ts`, `public/theme-init.js`
- Modify: `src/styles/globals.css` (Tokens), `index.html` (`<script src="theme-init.js">` vor dem Bundle)
- Test: `src/app/theme/__tests__/theme.test.ts`, `src/app/theme/__tests__/ThemeProvider.test.tsx`

**Interfaces:**

- Produces:
  - `type ThemePreference = 'system' | 'dark' | 'light'`; `type ResolvedTheme = 'dark' | 'light'`
  - `THEME_STORAGE_KEY = 'sgt-theme'`
  - `readThemePreference(storage: Pick<Storage,'getItem'> | null): ThemePreference`: Default `'dark'`; ein ungültiger Wert oder eine werfende Storage ergibt `'dark'`.
  - `writeThemePreference(storage, pref): void`: wirft nie.
  - `resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme`
  - `applyTheme(resolved: ResolvedTheme, root: HTMLElement): void`: setzt die Klasse `dark`, `style.colorScheme` und `<meta name="theme-color">`.
  - `<ThemeProvider>` + `useTheme(): { preference; resolved; setPreference(p) }`, reagiert auf `matchMedia('(prefers-color-scheme: dark)')`.
- Tokens (CSS-Variablen, `@theme inline`): `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--ring`, `--primary`, `--electricity` (Amber), `--gas` (Cyan/Blau), `--savings` (Grün), `--warning` (Orange), `--danger` (Rot), plus die shadcn-Standardnamen. Dark ist der Default in `:root`; Light liegt unter `:root:not(.dark)`.

- [ ] Step 1: Tests schreiben: `readThemePreference(null) === 'dark'`; `{getItem: () => 'light'}` → `'light'`; `'banana'` → `'dark'`; `getItem` wirft → `'dark'`; `resolveTheme('system', false) === 'light'`; `resolveTheme('dark', false) === 'dark'`; `applyTheme('light', el)` entfernt `dark`; Provider: `setPreference('light')` → `document.documentElement` ohne `dark`, gespeichert unter `sgt-theme`.
- [ ] Step 2: `npx vitest run src/app/theme` → FAIL.
- [ ] Step 3: Implementieren. `theme-init.js` dupliziert die Lese- und Auflösungslogik als IIFE (läuft vor dem Paint, CSP-konform, weil gleiche Origin).
- [ ] Step 4: Tests → PASS; dazu lint, typecheck.
- [ ] Step 5: Commit `feat: add design tokens and theme switching`.

### Task 3: UI-Basiskomponenten (shadcn/ui-Stil)

**Files:**

- Create: `components.json`, `src/lib/utils.ts` (`cn`), `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `toggle-group.tsx`, `sonner.tsx`, `src/components/common/EmptyState.tsx`, `src/components/common/PageHeader.tsx`
- Test: `src/components/common/__tests__/EmptyState.test.tsx`

**Interfaces:**

- Produces: `cn(...inputs: ClassValue[]): string`; `Button` (Varianten `default|secondary|outline|ghost|destructive`, Größen `default|sm|lg|icon`, `asChild`); `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`; `Badge`; `ToggleGroup`/`ToggleGroupItem`; `Toaster`; `EmptyState({ icon: LucideIcon; title: string; description: string; action?: ReactNode })`; `PageHeader({ title: string; description?: string })` als `h1`.

- [ ] Step 1: Test: `EmptyState` rendert den Titel als Überschrift, die Beschreibung und die Action.
- [ ] Step 2: FAIL.
- [ ] Step 3: Komponenten anlegen (Radix über `radix-ui`).
- [ ] Step 4: PASS; lint, typecheck.
- [ ] Step 5: Commit `feat: add base ui components`.

### Task 4: App-Shell und Routing

**Files:**

- Create: `src/app/router.tsx`, `src/app/navigation.ts`, `src/app/launch.ts`, `src/app/layout/AppLayout.tsx`, `src/app/layout/BottomNav.tsx`, `src/app/layout/Sidebar.tsx`, `src/app/ErrorBoundary.tsx`, `src/app/RouteError.tsx`, `src/features/*/…Page.tsx` (overview, history, capture, contracts, more, analytics, switch, offers, settings), `src/features/settings/ThemeSetting.tsx`
- Modify: `src/app/App.tsx`, `src/main.tsx`
- Test: `src/app/__tests__/launch.test.ts`, `src/app/__tests__/AppLayout.test.tsx`, `src/app/__tests__/ErrorBoundary.test.tsx`

**Interfaces:**

- Produces:
  - `NAV_ITEMS: { to: string; label: string; icon: LucideIcon; primary?: boolean }[]` in dieser Reihenfolge: `/` Übersicht, `/verlauf` Verlauf, `/erfassen` Erfassen (primary), `/vertraege` Verträge, `/mehr` Mehr. Die Sidebar zeigt zusätzlich `SECONDARY_NAV_ITEMS`: `/auswertung` Auswertung, `/wechsel` Wechsel-Cockpit, `/angebote` Angebote, `/einstellungen` Einstellungen.
  - `parseLaunchAction(search: string): string | null`: `?ablesen=strom` → `/erfassen/strom`, `?ablesen=gas` → `/erfassen/gas`, sonst `null`.
  - `applyLaunchAction(win: Window): void`: ersetzt die URL per `history.replaceState` durch `base + '#' + route`.
  - Routen: `/`, `/verlauf`, `/erfassen`, `/erfassen/:energy`, `/vertraege`, `/mehr`, `/auswertung`, `/wechsel`, `/angebote`, `/einstellungen`, `*` (Nicht gefunden).
  - `createAppRouter(): Router` (Hash) und `createAppMemoryRouter(initialEntries)` für Tests.

- [ ] Step 1: Tests: `parseLaunchAction('?ablesen=strom') === '/erfassen/strom'`, `'?ablesen=wasser' → null`, `'' → null`. Layout im Memory-Router: Navigation „Hauptnavigation“ enthält 5 Links in der Spec-Reihenfolge; Klick auf „Verlauf“ zeigt die Überschrift „Verlauf“; `aria-current="page"` am aktiven Link; auf `/mehr` setzt der Theme-Schalter „Hell“ die Klasse `dark` zurück. ErrorBoundary: ein werfendes Kind zeigt „Etwas ist schiefgelaufen“ und einen Button „Neu laden“.
- [ ] Step 2: FAIL.
- [ ] Step 3: Implementieren. Die Bottom-Nav ist `fixed`, nur `< md` sichtbar, `padding-bottom: env(safe-area-inset-bottom)`, und hat einen großen runden (＋)-Button. Die Sidebar ist ab `md` sichtbar. Jeder Platzhalter-Screen zeigt `PageHeader` und `EmptyState` mit dem Hinweis, in welcher Phase der Screen kommt. `motion` mit `MotionConfig reducedMotion="user"`.
- [ ] Step 4: PASS; lint, typecheck, build.
- [ ] Step 5: Commit `feat: add app shell with bottom nav, sidebar and routing`.

### Task 5: PWA – Manifest, Icons, Update-Toast, CSP

**Files:**

- Create: `public/icon.svg` (Blitz + Flamme, eigenes Motiv), `pwa-assets.config.ts`, `src/app/pwa/UpdatePrompt.tsx`, `src/app/pwa/manifest.ts`, `src/app/csp.ts`
- Modify: `vite.config.ts`, `index.html`, `src/app/App.tsx`
- Test: `src/app/pwa/__tests__/UpdatePrompt.test.tsx`, `src/app/pwa/__tests__/manifest.test.ts`, `src/app/__tests__/csp.test.ts`

**Interfaces:**

- Produces:
  - `BASE = '/Strom_Gas_Tracker/'`; `createManifest(base: string): Partial<ManifestOptions>` mit `name`, `short_name`, `lang: 'de'`, `start_url: base`, `scope: base`, `display: 'standalone'`, `theme_color`/`background_color` = Dark-Hintergrund, `shortcuts: [{ name: 'Strom ablesen', url: base + '?ablesen=strom' }, { name: 'Gas ablesen', url: base + '?ablesen=gas' }]`.
  - `CSP_DIRECTIVES` und `buildCsp(): string` mit `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.open-meteo.com https://archive-api.open-meteo.com https://geocoding-api.open-meteo.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`.
  - Vite-Plugin `cspPlugin()` (nur `apply: 'build'`) fügt `<meta http-equiv="Content-Security-Policy">` ein.
  - `UpdatePrompt` nutzt `useRegisterSW` aus `virtual:pwa-register/react`; bei `needRefresh` erscheint ein Toast „Neue Version verfügbar“ mit dem Button „Aktualisieren“ (→ `updateServiceWorker(true)`), bei `offlineReady` ein Toast „Bereit für die Offline-Nutzung“.

- [ ] Step 1: Tests: `createManifest(BASE).shortcuts` hat 2 Einträge mit den Namen aus der Spec und URLs unter der Base; `scope === start_url === BASE`. `buildCsp()` enthält `script-src 'self'`, keine `unsafe-eval` und `connect-src` nur mit `'self'` und `*.open-meteo.com`-Hosts. UpdatePrompt (Virtual-Modul gemockt): bei `needRefresh=true` ist der Button „Aktualisieren“ sichtbar, `updateServiceWorker` wird erst nach dem Klick mit `true` aufgerufen.
- [ ] Step 2: FAIL.
- [ ] Step 3: Implementieren. `VitePWA({ registerType: 'prompt', injectRegister: false, pwaAssets: { config: true }, manifest: createManifest(BASE), workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'], navigateFallback: 'index.html' } })`. In `pwa-assets.config.ts` ist das Preset `minimal2023Preset` mit `public/icon.svg`. `index.html` bekommt `viewport-fit=cover`, `apple-mobile-web-app-capable` und den Titel.
- [ ] Step 4: PASS; `npm run build` erzeugt `dist/manifest.webmanifest`, `dist/sw.js` und die PNG-Icons.
- [ ] Step 5: Commit `feat: make app an installable offline pwa`.

### Task 6: E2E-Smoke (Playwright, iPhone-Viewport)

**Files:**

- Create: `playwright.config.ts`, `tests/e2e/shell.spec.ts`
- Modify: `package.json` (Skript `e2e`), `eslint.config.js` (E2E-Dateien)

**Interfaces:**

- Consumes: Build aus Task 5, `vite preview` auf Port 4173 mit Base.

- [ ] Step 1: Tests schreiben (Projekt `iPhone 15`, `webServer: npm run build && npm run preview`):
  - lädt `/Strom_Gas_Tracker/`, Überschrift „Übersicht“ sichtbar, keine CSP-Verstöße in der Konsole;
  - alle 5 Bottom-Nav-Einträge sichtbar, Navigation zu „Verträge“ klappt; `padding-bottom` der Nav nutzt `safe-area-inset-bottom` (Inline-Style bzw. Klasse prüfen);
  - Manifest erreichbar, `short_name === 'Energie'`, Icons 192/512 ladbar;
  - nach dem ersten Laden steuert der Service Worker die Seite; `context.setOffline(true)` und dann `goto('#/vertraege')` + Reload → „Verträge“ sichtbar;
  - `?ablesen=gas` landet auf `#/erfassen/gas`;
  - axe-Scan der Übersicht in Dark und Light ohne `serious`/`critical`-Verstöße.
- [ ] Step 2: `npm run e2e` → mindestens die Offline- und Shortcut-Tests laufen grün, sonst Fehler beheben.
- [ ] Step 3: Commit `test: add playwright smoke tests for shell and offline start`.

### Task 7: CI/CD und Doku

**Files:**

- Create: `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`, `docs/DOMAIN.md`, `docs/DECISIONS.md`

**Interfaces:**

- `ci.yml`: Trigger `push` (alle Branches), `pull_request`, `workflow_dispatch`. Job `verify`: checkout@v7, setup-node@v7 (`node-version-file: .nvmrc`, Cache npm), `npm ci`, lint, typecheck, test, build, `npx playwright install --with-deps chromium`, e2e, `upload-pages-artifact@v5` (`dist`). Job `deploy` nur bei `refs/heads/main` und nicht bei PRs: `needs: verify`, Permissions `pages: write`, `id-token: write`, Environment `github-pages`, `deploy-pages@v5`. `concurrency: pages`.

- [ ] Step 1: Workflow und Doku schreiben. `CLAUDE.md` hat höchstens 80 Zeilen (Regeln aus 3, 11, 12). `ROADMAP.md` enthält alle Phasen als Checklisten plus „Später“. `DOMAIN.md` enthält Fachwissen und Formeln aus 4 und 6. `DECISIONS.md` sammelt die Entscheidungen dieser Phase.
- [ ] Step 2: Workflow-YAML mit `npx --yes yaml-lint` oder einem Node-YAML-Parse prüfen; die Gesamtprüfung lint/typecheck/test/build/e2e lokal grün.
- [ ] Step 3: Commit `ci: add verify and github pages deploy workflow` und `docs: add project docs`.
