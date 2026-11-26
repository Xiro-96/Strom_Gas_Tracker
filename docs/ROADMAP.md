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

## Phase 2 – Verträge, Preise, Boni, Kosten ✅

- [x] Vertrags-Assistent (4 Schritte) und Detailseite, Preisperioden (mit Hinweis Sonderkündigungsrecht)
- [x] Preiseingabe in ct/kWh oder €/m³, Grundpreis in €/Monat oder €/Jahr, Gasfaktoren am Zähler (mit „gültig ab“-Historie)
- [x] Boni mit Status-Workflow und Bonus-Sicherheitscheck
- [x] Abschlagsplan, Transaktionen, Rechnungen, Kündigung, Vertragsdaten, Notizen
- [x] Kosten-Engine, Effektivpreis, Prognose in € (Verbrauchsprognose kWh seit Phase 1), Abschlags-Check
- [x] Diagramme 4, 5 und 7; Kostenkarten in der Übersicht; „So gerechnet“-Popover; Zeitraum „Vertrag“
- [x] **Abnahme:** Testfälle A, B, C, D, F und H grün; E2E „Vertrag anlegen → Kosten und Saldo sichtbar“

## Phase 3 – Wechsel-Cockpit und Erinnerungen ✅

- [x] Fristen-Engine (6.6) inkl. Sonderkündigung, Schlussrechnung und Guthaben
- [x] Wechsel-Cockpit mit Checkliste, Status-Flow (aktiv → gekündigt → beendet) und Text-Generatoren (Kündigung, Zählerstandsmeldung)
- [x] Fristen-Leiste in der Übersicht; Hinweise beim App-Start
- [x] Kalender-Export (.ics) mit `VALARM` und wiederkehrender Ablese-Erinnerung (`RRULE`)
- [x] Anbieter-Zeitstrahl (Diagramm 6)
- [x] Zusätzlich: Kündigungspuffer in den Einstellungen; „Guthaben erhalten“ an Rechnungen
- [ ] **Abnahme:** Testfall E grün ✅; .ics nach RFC 5545 gebaut und per ical.js-Rundlauf sowie E2E-Download geprüft – der Import in iOS- und Google-Kalender steht noch aus (am Gerät testen)

## Phase 4 – Analyse, Vergleich, Datensicherheit ✅

- [x] Angebotsvergleich (6.8) mit Warnungen und Break-even; Referenztarife; „Als neuen Vertrag anlegen“
- [x] Wetter-Opt-in (Open-Meteo, Ortssuche), witterungsbereinigte Gas-Auswertung, Diagramm 8
- [x] Wechsel-Bilanz „Durch Wechseln gespart seit …“
- [x] Backup: JSON-Export/-Import (versioniert, zod, Fotos optional, Zusammenführen/Ersetzen); CSV-Export der Ablesungen (Excel-DE; Import ist seit Phase 1 da); Backup-Erinnerung alle 30 Tage; `navigator.storage.persist()`; Safari-Hinweis
- [x] Fotos clientseitig komprimieren (max. ~1600 px), Fotogalerie im Verlauf
- [x] Jahresbericht als Druckansicht
- [x] **Abnahme:** Testfall J grün; Backup stellt auf einem zweiten Gerät alles wieder her (Unit-Test mit zweiter Datenbank, E2E mit frischem Browser-Kontext) – am echten Zweitgerät noch testen

## Phase 5 – Optional, nur nach Rücksprache

- [ ] Geräte-Sync (z. B. self-hosted PocketBase) über einen `SyncAdapter`
- [ ] OCR für Zählerfotos (experimentell)
- [ ] HT/NT-Tarife, weitere Zähler (Wasser, Wärmepumpe, Wallbox)
- [ ] Smart-Meter-CSV-Import, CO₂-Bilanz, Budget-Ziele

## Später (Ideen, nicht eingeplant)

- WebKit-Projekt in Playwright ergänzen (echtes Safari-Verhalten), sobald CI-Zeit es erlaubt.
- Icons für die Manifest-Shortcuts (Blitz/Flamme einzeln).
- Kosten „≈ … €“ in der Live-Vorschau der Schnellerfassung (Preise gibt es seit Phase 2).
- Verbrauchsabhängiger Bonus (Spec 4.3, Falle 2): Flag `consumptionDependent` im Formular + Hinweis.
- Lücken ohne Vertrag optional mit einem Referenztarif bewerten (Spec 6.3).
- Vertrags-Assistent auch zum Bearbeiten (heute: Inline-Formulare auf der Detailseite).
- Kalender-Abo statt Einmal-Export (bräuchte einen Server – widerspricht „kein Backend“ bis Phase 5).
- Kündigungsschreiben mit Hinweis auf den Neukundenbonus („bitte mit der Schlussrechnung verrechnen“).
- Checkliste im Cockpit einklappen, solange kein Wechsel ansteht.
- Mehrere Fotos je Ablesung (heute ein Foto je Ablesung, Galerie über alle Ablesungen).
- Angebote bearbeiten (heute: löschen und neu erfassen); Bonus-Varianten jenseits Neukunden-/Sofortbonus.
- Wetter: Gas-Gradtage auch für die Plausibilitätsprüfung (Ausreißer) nutzen.
