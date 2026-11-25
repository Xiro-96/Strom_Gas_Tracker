# Roadmap

Jede Phase endet lauffähig und deployed. Details: `docs/MASTER_PROMPT.md`, Abschnitt 8.

## Phase 0 – Fundament ✅

- [x] Projekt-Setup laut Abschnitt 3 (Vite, React, TS strict, Tailwind, shadcn/ui-Stil, ESLint, Prettier, Vitest, Playwright)
- [x] App-Shell: Bottom-Navigation (mobil) und Sidebar (Desktop), Theme-Umschalter, Routing (`createHashRouter`)
- [x] PWA: Manifest (Name „Strom & Gas Tracker“, Kurzname „Energie“, `scope`/`start_url` = Base), Shortcuts „Strom ablesen“ und „Gas ablesen“, Update-Toast
- [x] Eigenes App-Icon als SVG (Blitz + Flamme), PNGs per `@vite-pwa/assets-generator`
- [x] GitHub Actions: Lint, Typecheck, Test, Build (+ E2E) bei jedem Push/PR; Deploy auf GitHub Pages bei `main`
- [x] `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`, `docs/DOMAIN.md`, `docs/DECISIONS.md`
- [ ] **Abnahme:** Seite lädt unter der Pages-URL, ist installierbar und startet offline → erst nach Merge auf `main` und aktiviertem Pages-Deploy prüfbar (lokal per E2E belegt)

## Phase 1 – Zähler und Verbrauch (MVP) ✅

- [x] Dexie-Schema für alle Tabellen aus Abschnitt 5, Repositories, Migrations-Gerüst
- [x] Onboarding: Zähler anlegen (Strom/Gas, Einheit, Nachkommastellen, Startstand; Zählernummer und MaLo optional) oder „Demo-Daten laden“
- [x] Schnellerfassung mit Plausibilität und Live-Vorschau
- [x] Verlauf (anlegen, bearbeiten, löschen), Zählerwechsel
- [x] Domain: Parsing, Intervalle, Gas-Umrechnung, Tagesverteilung, Plausibilität
- [x] Übersicht (Verbrauchsteil) und Diagramme 1–3
- [x] Demo-Daten: 2 Jahre, Ablesungen alle 14–21 Tage, realistische Saisonalität, zwei Anbieterwechsel, erfundene Anbieter
- [x] Zusätzlich (aus Phase 4 vorgezogen): CSV-Import der Ablesungen (Excel-DE)
- [x] Zusätzlich (aus Phase 2 vorgezogen, auf Wunsch): Jahresprognose in kWh je Energieart (6.4), Gas zusätzlich in m³
- [x] **Abnahme:** Erfassung < 10 s (E2E), Testfälle G, I und Umrechnungsteil von B grün, Diagramme mit Demo-Daten geprüft

## Phase 2 – Verträge, Preise, Boni, Kosten

- [ ] Vertrags-Assistent (4 Schritte) und Detailseite, Preisperioden
- [ ] Preiseingabe in ct/kWh oder €/m³, Grundpreis in €/Monat oder €/Jahr, Gasfaktoren am Zähler
- [ ] Boni mit Status-Workflow und Bonus-Sicherheitscheck
- [ ] Abschlagsplan, Transaktionen, Rechnungen
- [ ] Kosten-Engine, Effektivpreis, Prognose in € (Verbrauchsprognose kWh seit Phase 1), Abschlags-Check
- [ ] Diagramme 4, 5 und 7; Kostenkarten in der Übersicht; „So gerechnet“-Popover
- [ ] **Abnahme:** Testfälle A, B, C, D, F und H grün

## Phase 3 – Wechsel-Cockpit und Erinnerungen

- [ ] Fristen-Engine (6.6) inkl. Sonderkündigung, Schlussrechnung und Guthaben
- [ ] Wechsel-Cockpit mit Checkliste, Status-Flow (aktiv → gekündigt → beendet) und Text-Generatoren (Kündigung, Zählerstandsmeldung)
- [ ] Fristen-Leiste in der Übersicht; Hinweise beim App-Start
- [ ] Kalender-Export (.ics) mit `VALARM` und wiederkehrender Ablese-Erinnerung (`RRULE`)
- [ ] Anbieter-Zeitstrahl (Diagramm 6)
- [ ] **Abnahme:** Testfall E grün; .ics importiert sauber in iOS- und Google-Kalender

## Phase 4 – Analyse, Vergleich, Datensicherheit

- [ ] Angebotsvergleich (6.8) mit Warnungen und Break-even
- [ ] Wetter-Opt-in (Open-Meteo, Ortssuche), witterungsbereinigte Gas-Auswertung, Diagramm 8
- [ ] Wechsel-Bilanz „Durch Wechseln gespart seit …“
- [ ] Backup: JSON-Export/-Import (versioniert, zod, Fotos optional, Zusammenführen/Ersetzen); CSV-Export der Ablesungen (Excel-DE; Import ist seit Phase 1 da); Backup-Erinnerung alle 30 Tage; `navigator.storage.persist()`; Safari-Hinweis
- [ ] Fotos clientseitig komprimieren (max. ~1600 px), Galerie je Ablesung
- [ ] Jahresbericht als Druckansicht
- [ ] **Abnahme:** Testfall J grün; Backup stellt auf einem zweiten Gerät alles wieder her

## Phase 5 – Optional, nur nach Rücksprache

- [ ] Geräte-Sync (z. B. self-hosted PocketBase) über einen `SyncAdapter`
- [ ] OCR für Zählerfotos (experimentell)
- [ ] HT/NT-Tarife, weitere Zähler (Wasser, Wärmepumpe, Wallbox)
- [ ] Smart-Meter-CSV-Import, CO₂-Bilanz, Budget-Ziele

## Später (Ideen, nicht eingeplant)

- Routen per `lazy()` aufteilen, sobald Diagramme/Formulare das Bundle vergrößern.
- WebKit-Projekt in Playwright ergänzen (echtes Safari-Verhalten), sobald CI-Zeit es erlaubt.
- Icons für die Manifest-Shortcuts (Blitz/Flamme einzeln).
- Auswertung: Zeitraum „Vertrag“ (braucht Verträge aus Phase 2).
- Zeitabhängige Gasfaktoren-Historie im Zählerformular (Phase 2: „Gasfaktoren am Zähler“).
- Kosten „≈ … €“ in der Live-Vorschau der Schnellerfassung (braucht Preise aus Phase 2).
