# Phase 4 – Analyse, Vergleich, Datensicherheit: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Angebote mit dem eigenen Prognoseverbrauch vergleichen (Testfall J), Daten sichern und auf einem zweiten Gerät wiederherstellen, Fotos komprimieren, Wechsel-Bilanz und Jahresbericht zeigen und – nach Opt-in – Gas witterungsbereinigt auswerten (Diagramm 8).

**Architecture:** Reine Module `src/domain/offers.ts`, `savings.ts`, `weather.ts`, `report.ts`; Backup in `src/data/backup/` (zod-Schema, Export/Import, Merge/Replace); Wetter-Cache als Dexie-Version 2 (`weather`-Tabelle) mit Fetch nur nach Opt-in. Screens: `features/offers`, `features/settings` (Backup, Referenztarife, Standort), `features/report`.

**Tech Stack:** wie bisher; keine neuen Laufzeit-Abhängigkeiten (Bildkompression per Canvas, Druck per Print-CSS).

**Spec:** `docs/MASTER_PROMPT.md` 4.7, 5 (Offer, Settings), 6.2 (Wetter), 6.4, 6.8, 7.3 (7, 8), 7.4 (8), 8 (Phase 4), 9 (J), 11.

## Global Constraints

- `Jahr 1 = kWh × AP ÷ 100 + GP − Σ Boni` · `Folgejahr = kWh × AP ÷ 100 + GP`; Basis Prognose-Jahresverbrauch (Gas: Normaljahr), überschreibbar.
- Warnungen: Anbieter/Konzern in den letzten 12 Monaten genutzt; Laufzeit > 12 Monate; eingeschränkte Preisgarantie; Boni > 20 % der Jahreskosten („Lockangebot – Folgejahr prüfen“).
- Einzige externe Anfrage: Open-Meteo (Geocoding + Archive), **nur nach Opt-in**; `connect-src` unverändert.
- Gradtagzahl G20/15: Tagesmittel < 15 °C → 20 − Tagesmittel, sonst 0; Normaljahr = Mittel der letzten 10 Jahre; lokal cachen.
- Backup-Import nur nach zod-Validierung; versioniert; Fotos optional; Zusammenführen oder Ersetzen.
- Fotos max. ~1600 px (längste Kante). Keine echten Nutzerdaten in Tests.

## Review Focus

1. **Backup aus älterer/fremder Datei** (falsches Format, Version zu neu, kaputtes JSON) → deutsche Fehlermeldung, nichts geändert → Test.
2. **Zusammenführen mit vorhandenen Daten** → gleiche ID: neuere `updatedAt` gewinnt; Soft-Deletes bleiben erhalten → Test.
3. **Break-even ohne Schnittpunkt** (gleicher Arbeitspreis) → kein Wert statt Division durch 0 → Test.
4. **Wetter offline/Fehler** → Auswertung fällt auf Gradtag-Promille zurück, Hinweis statt Absturz → Test.
5. **Riesiges Foto** (12 MP) → komprimiert auf ≤ 1600 px; ohne Canvas-Unterstützung Original speichern → Test.

---

### Task 1: Domain – Angebotsvergleich (Testfall J)

**Files:** `src/domain/offers.ts`, Test `src/domain/__tests__/offers.test.ts`

**Produces:** `offerCosts(offer, kwh) → { year1Eur, followYearEur, twoYearEur, bonusEur, effectiveYear1Ct, effectiveFollowCt }`; `breakEvenKwh(a, b): number | null` (Folgejahr-Kosten gleich; `null` bei gleichem AP); `offerWarnings(offer, { contracts, today, kwh }) → { code, text }[]`; `rankOffers(offers, kwh, { current?, reference? })`.

- [ ] Test J: X 30 ct / 120 € / 100 € Bonus bei 3.500 kWh → Jahr 1 1.070 €, Folgejahr 1.170 €; Y 27 ct / 200 € → 1.145 € / 1.145 €; Break-even 2.666,67 kWh; gleicher AP → `null`.
- [ ] Tests Warnungen (Konzern innerhalb 12 Monaten, Laufzeit 24, eingeschränkte Garantie, Bonus > 20 %), Ranking nach Jahr 1 und 2-Jahres-Summe, Ersparnis ggü. aktuellem Vertrag (heutiger Preis) und Referenztarif. Commit.

### Task 2: Angebote – Daten und UI

**Files:** `src/data/repositories/offers.ts` (+ Test), `src/features/offers/*`, `src/features/settings/ReferenceTariffsSection.tsx`, Wizard-Vorbelegung `ContractWizard` (`initial?`)

- [ ] Offers-CRUD (Soft-Delete); Referenztarife in den Einstellungen (je Energieart, Label, AP, GP).
- [ ] Angebote-Seite: Energieart-Umschalter, Verbrauchsbasis (Prognose, änderbar), Formular (ct/kWh oder €/m³, GP €/Monat|Jahr, Boni, Laufzeit, Garantie, Quelle/URL), Ranking-Karten mit Warnungen, Balken Jahr 1 vs. Folgejahr (+ Tabelle), Break-even zum günstigsten Folgejahr, „Als neuen Vertrag anlegen“ (Assistent vorbelegt).
- [ ] UI-Tests; Commit.

### Task 3: Backup, CSV-Export, Speicher-Schutz

**Files:** `src/data/backup/schema.ts`, `backup.ts` (+ Test), `src/features/settings/BackupSection.tsx`, Hinweis-Banner in der Übersicht

- [ ] `exportBackup({ includePhotos }) → BackupFile` (`format:'strom-gas-tracker'`, `version:1`, `exportedAt`, alle Tabellen + Settings, Fotos als Data-URL); `parseBackup(text) → Result`; `importBackup(file, 'merge' | 'replace')`; setzt `lastBackupAt`.
- [ ] Tests: Rundlauf in eine zweite, leere DB stellt alles wieder her (Abnahme „zweites Gerät“); Merge-Regel `updatedAt`; Fehlertexte bei falschem Format/Version/JSON.
- [ ] UI: Sichern (Datei), Wiederherstellen (Datei wählen → Vorschau → Zusammenführen/Ersetzen), CSV-Export Ablesungen, `navigator.storage.persist()`, Safari-Hinweis; Erinnerung nach 30 Tagen ohne Backup. Commit.

### Task 4: Fotos komprimieren, Galerie

**Files:** `src/lib/image.ts` (+ Test), Modify Erfassung/Verlauf, Create `src/features/history/PhotoGallery.tsx`

- [ ] `targetSize(w, h, max=1600)` (Test), `compressImage(blob)` (Canvas → JPEG 0,82; Fallback Original).
- [ ] Galerie im Verlauf: alle Fotos je Zähler als Raster mit Datum/Stand, Antippen öffnet groß. Commit.

### Task 5: Wechsel-Bilanz und Jahresbericht

**Files:** `src/domain/savings.ts`, `src/domain/report.ts` (+ Tests), `src/features/report/ReportPage.tsx` (`/bericht/:jahr?`), Print-CSS

- [ ] `switchSavings({ bundles, daily, reference, until })` = Referenzkosten − (tatsächliche Kosten − erhaltene/verrechnete Boni) über alle Liefertage mit Verbrauch; Test mit festen Zahlen.
- [ ] `yearReport(...)`: je Energieart Verbrauch, Kosten, Effektivpreis, Monatstabelle, Verträge, Boni, Bilanz.
- [ ] Karte „Durch Wechseln gespart seit …“ (Übersicht, nur mit Referenztarif); Bericht mit „Drucken / Als PDF sichern“. Commit.

### Task 6: Wetter (Opt-in), bereinigte Gas-Auswertung, Diagramm 8

**Files:** `src/domain/weather.ts` (+ Test), `src/data/weather.ts` (Dexie v2 `weather`), `src/features/settings/WeatherSection.tsx`, Diagramm in der Auswertung

- [ ] `degreeDay(t)`, `normalYear(dailyTemps)`, `weatherWeights(...)` als Ersatz für die Promille-Gewichte, `adjustedTrend(...)`, `temperatureScatter(intervals, temps)` + lineare Regression; Tests mit festen Werten.
- [ ] Opt-in + Ortssuche (Geocoding), Archiv-Abruf in Jahresblöcken, Cache, Fallback ohne Netz. Diagramm 8 (Streudiagramm + Regressionslinie, Tabelle). Tests mit gemocktem `fetch`. Commit.

### Task 7: E2E, Doku, Abnahme

- [ ] E2E: Angebot erfassen → Ranking/Warnung; Backup exportieren → in neuem Kontext importieren → Daten da; Bericht druckbar; axe hell/dunkel. Open-Meteo per `page.route` gemockt.
- [ ] ROADMAP/DECISIONS/DOMAIN, verify, e2e, Lighthouse, Datenschutz-Abgleich, Push, CI, Bericht.
