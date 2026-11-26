# ⚡🔥 Strom & Gas Tracker

Eine moderne, mobile-first **Progressive Web App** für Strom- und Gaszähler im Privathaushalt:
Zählerstände in Sekunden erfassen, Verbrauch und Kosten verstehen, Verträge, Boni, Abschläge und
Fristen über jährliche Anbieterwechsel hinweg im Griff behalten und neue Angebote mit dem
**echten eigenen Verbrauch** vergleichen.

**Live:** <https://xiro-96.github.io/Strom_Gas_Tracker/>

- 📱 Webseite und installierbare App (iOS, Android, Desktop) in einem, startet auch offline
- 🔒 Kein Konto, keine Cloud, kein Tracking: alle Daten bleiben lokal auf dem Gerät
- 🧮 Jede Zahl ist nachvollziehbar („So wurde gerechnet“)

> Status: **Phase 4 – Analyse, Vergleich, Datensicherheit** ist fertig: Angebotsvergleich mit
> eigenem Verbrauch, Sicherung und Wiederherstellung, Fotokompression, Wechsel-Bilanz,
> Jahresbericht und optional Wetter (Open-Meteo) für die Gas-Auswertung – auf Phase 1–3.
> Phase 5 (Sync, OCR …) nur nach Rücksprache, siehe [`docs/ROADMAP.md`](docs/ROADMAP.md).

## App installieren

- **iPhone/iPad:** Seite in Safari öffnen → „Teilen“ → „Zum Home-Bildschirm“.
- **Android:** Seite in Chrome öffnen → Menü ⋮ → „App installieren“.
- **Desktop (Chrome/Edge):** Installieren-Symbol in der Adressleiste.

## Entwicklung

Voraussetzung: aktuelle Node-LTS (siehe `.nvmrc`) und npm.

```bash
npm ci            # Abhängigkeiten
npm run dev       # Dev-Server → http://localhost:5173/Strom_Gas_Tracker/
npm run verify    # lint + typecheck + test + build (vor jedem Commit)
npm run e2e       # Playwright-Smoke-Tests (iPhone-Viewport, baut und startet preview)
npm run coverage  # Testabdeckung
```

| Skript      | Zweck                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| `lint`      | ESLint (flat config, typgeprüft, 0 Warnungen)                                  |
| `typecheck` | TypeScript strict (`tsc -b`)                                                   |
| `test`      | Vitest + Testing Library                                                       |
| `build`     | Typecheck + Vite-Build inkl. Service Worker, Manifest, Icons, CSP              |
| `preview`   | Build lokal unter der Pages-Base ausliefern (Port 4173)                        |
| `e2e`       | Playwright gegen den Build (`PW_CHROMIUM_EXECUTABLE` für ein lokales Chromium) |
| `format`    | Prettier                                                                       |

## Deployment

GitHub Actions (`.github/workflows/ci.yml`) prüft jeden Push und PR (Lint, Typecheck, Test,
Build, E2E). Pushes auf `main` werden anschließend auf GitHub Pages veröffentlicht.

Einmalig im Repo einstellen: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.

## Technik

React · TypeScript (strict) · Vite · Tailwind CSS · shadcn/ui · lucide-react · Recharts ·
Dexie (IndexedDB) · react-hook-form + zod · date-fns · React Router (Hash) · vite-plugin-pwa ·
Vitest · Playwright. Begründungen stehen in [`docs/DECISIONS.md`](docs/DECISIONS.md), Fachwissen
und Formeln in [`docs/DOMAIN.md`](docs/DOMAIN.md).

```
src/app         Router, Layout, Provider, Theme, PWA, CSP
src/domain      reine Rechenlogik + Tests
src/data        IndexedDB, Repositories, Backup, Demo-Daten
src/features    Screens (Übersicht, Erfassen, Verlauf, Verträge, …)
src/components  UI-Bausteine, Diagramme
tests/e2e       Playwright
docs/           Spezifikation, Roadmap, Fachwissen, Entscheidungen
```

## Datenschutz

Die App hat kein Backend. Alle Eingaben liegen in der IndexedDB des Browsers auf deinem Gerät.
Die einzige mögliche externe Anfrage sind Wetter- und Ortsdaten von
[Open-Meteo](https://open-meteo.com/), und das erst nach ausdrücklichem Opt-in (ab Phase 4).
Eine Content-Security-Policy erzwingt das technisch.

> Rechtliche Hinweise in der App sind Informationen ohne Gewähr, keine Rechtsberatung.
