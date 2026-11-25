# CLAUDE.md – Projektregeln Strom & Gas Tracker

Vollständige Spezifikation: `docs/MASTER_PROMPT.md` (verbindlich). Fachwissen und Formeln:
`docs/DOMAIN.md`. Stand der Phasen: `docs/ROADMAP.md`. Entscheidungen: `docs/DECISIONS.md`.

## Was das ist

Offline-first PWA ohne Backend (bis Phase 5) für Strom- und Gaszähler eines Privathaushalts:
Ablesungen, Verbrauch, Kosten, Verträge, Boni, Abschläge, Fristen und Angebotsvergleich.
Deployed auf GitHub Pages: `https://xiro-96.github.io/Strom_Gas_Tracker/`.

## Stack (verbindlich)

React + TypeScript (strict) + Vite · Tailwind CSS 4 + shadcn/ui-Stil (`src/components/ui`) +
lucide-react · `motion` nur sparsam (LazyMotion) · Recharts über shadcn-Chart-Komponenten ·
Dexie + `useLiveQuery` · react-hook-form + zod · date-fns (`de`) · React Router mit
`createHashRouter` · vite-plugin-pwa (`registerType: 'prompt'`) · Vitest + Testing Library +
fake-indexeddb · Playwright (iPhone-Viewport) · ESLint flat + Prettier · npm.

## Harte Regeln

- **Öffentliches Repo:** keine persönlichen Daten (Zähler-/Kundennummern, MaLo-IDs, Adressen,
  echte Verbräuche/Preise) in Code, Tests, Fixtures, Screenshots, Commits. Demo-Daten und
  Anbieternamen sind erfunden.
- Kein Tracking, keine Analytics, keine CDNs zur Laufzeit. Schrift lokal gebündelt.
  Einzige externe Anfrage: Open-Meteo, nur nach Opt-in.
- Datenzugriff **nur** über Repository-Funktionen in `src/data` – nie Dexie direkt in Komponenten.
- Rechenlogik als reine Funktionen in `src/domain` (ohne React/Dexie), vollständig getestet.
- Datumswerte als `'YYYY-MM-DD'`-Strings (lokales Datum), nie `Date` speichern. Tagesdifferenzen
  nur mit `differenceInCalendarDays`. Keine Zwischenrundung – gerundet wird nur in der Anzeige.
- Alle Entitäten: `id` (UUID), `createdAt`, `updatedAt`, Soft-Delete `deletedAt`, Demo `isDemo`.
- UI durchgehend Deutsch, Formate `de-DE` (1.234,56 € · 27,89 ct/kWh · 12.345,678 m³).
- Farben über Tokens: Strom = `electricity` (Amber, `Zap`), Gas = `gas` (Cyan/Blau, `Flame`),
  Ersparnis = `savings`, Warnung = `warning`, Gefahr = `danger`. Dark ist Standard.
- Jeder Screen hat Lade-, Leer- und Fehlerzustand. Jedes Diagramm auch als Tabelle abrufbar.
- Rechtliche Hinweise nur als „Info, ohne Gewähr“ mit Quelle.

## Qualität & Sicherheit

- TypeScript strict, `noUncheckedIndexedAccess`, **kein `any`**; `src/domain` ≥ 90 % Abdeckung.
- **Vor jedem Commit grün:** `npm run lint && npm run typecheck && npm test && npm run build`
  (Kurzform: `npm run verify`). E2E: `npm run e2e`.
- Kein `dangerouslySetInnerHTML` (ESLint-Regel). Error Boundary statt weißer Seite.
- CSP per `<meta>` (nur im Build, `src/app/security/csp.ts`): `script-src 'self'`,
  `connect-src` nur `'self'` + Open-Meteo. Neue externe Hosts nur mit Spec-Grundlage.
- Backup-Import nur nach zod-Validierung.
- Performance: Tagesreihen memoisieren/cachen – 5 Jahre Daten müssen flüssig bleiben.
- Lighthouse mobil ≥ 90 (Performance, Accessibility, Best Practices); installierbar.

## Arbeitsweise

- Innerhalb der Spezifikation selbst entscheiden, Entscheidungen kurz in `docs/DECISIONS.md`.
  Fragen nur, wenn sich der Funktionsumfang ändert oder etwas blockiert.
- Erst Fachlogik als getestete Funktion (TDD), dann UI.
- Nichts aus späteren Phasen vorziehen; neue Ideen in `docs/ROADMAP.md` unter „Später“.
- Kleine Commits, Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).
- Am Ende jeder Phase: Kurzbericht (fertig · am Handy testen · offen) und auf „weiter“ warten.

## Struktur

```
src/app         Router, Layout, Provider, Theme, PWA, CSP
src/domain      reine Logik + __tests__ (Pflicht-Testfälle A–J aus Spec §9)
src/data        db.ts (Dexie) · repositories/ · backup/ · demo/
src/features    overview · capture · history · analytics · contracts · switch · offers · settings
src/components  ui/ (shadcn) · charts/ · common/
src/lib         format.ts (Intl de-DE) · utils.ts
tests/e2e       Playwright
```

## Lokal

`npm run dev` · Tests `npm test` · E2E lokal mit vorinstalliertem Chromium:
`PW_CHROMIUM_EXECUTABLE=/pfad/zu/chrome npm run e2e`.
