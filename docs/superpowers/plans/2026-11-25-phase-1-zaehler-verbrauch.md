# Phase 1 – Zähler und Verbrauch (MVP): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Zähler anlegen, Ablesungen in < 10 s erfassen, Verlauf pflegen (inkl. Zählerwechsel), Verbrauch korrekt auswerten (Intervalle, Gas-Umrechnung, Tagesverteilung) und in Übersicht und Diagrammen 1–3 zeigen. Zusätzlich gibt es einen CSV-Import für Ablesungen (aus Phase 4 vorgezogen, damit echte Altdaten privat in die App kommen und nicht ins Repo).

**Architecture:** Reine Fachlogik in `src/domain` (date-fns, keine React/Dexie-Abhängigkeit) → Repositories und Live-Hooks in `src/data` (Dexie 4, `useLiveQuery`) → Screens in `src/features`. Diagramme laufen über Recharts in einem eigenen `ChartContainer` ohne `dangerouslySetInnerHTML` und werden per Route lazy geladen.

**Spec:** `docs/superpowers/specs/2026-11-25-strom-gas-tracker-design.md`, Abschnitte 5, 6.1, 6.2, 6.7, 7, 8 (Phase 1), 9 (Testfälle G, I, B-Umrechnung, C für die Verteilung).

## Global Constraints

Wie Phase 0, zusätzlich:

- Datumswerte nur als `'YYYY-MM-DD'`. Tagesdifferenzen nur mit `differenceInCalendarDays`. Intervalle umfassen die Tage [A, B).
- Keine Zwischenrundung; gerundet wird nur in `src/lib/format.ts` (`de-DE`).
- Entitäten: `id` (UUID), `createdAt`, `updatedAt`, `deletedAt?`, `isDemo?`.
- Echte Zählerstände des Nutzers niemals ins Repo; der Import läuft über eine Datei bzw. eingefügten Text.

## Review Focus

1. **Zahleneingabe mit Punkt** („5.100“ am Gaszähler mit 3 Nachkommastellen): Die Lesart wird anhand des letzten Stands gewählt → Test in `parse`.
2. **Nachgetragene Ablesung zwischen zwei vorhandenen**: Ist der Wert größer als der Folgestand, ist das ein Fehler → Test in `plausibility`.
3. **Gleiches Datum doppelt**: Rückfrage „ersetzen?“, der Import überspringt identische Werte → Tests in `plausibility` und Import.
4. **Sommerzeit-Wechsel** (29.03.2026, 25.10.2026): Tageszählung bleibt korrekt → Test in `dates`.
5. **Leere Datenbank oder nur 1 Ablesung**: Übersicht und Diagramme zeigen einen Leerzustand und keinen Fehler → Komponententests.

---

### Task 1: Domain-Basis – `dates`, `parse`, `gas`

- Create `src/domain/types.ts` (Entitäten aus Spec §5 + `BaseEntity`), `src/domain/dates.ts`, `src/domain/parse.ts`, `src/domain/gas.ts` + Tests.
- `parseMeterInput(input, { decimals, lastValue? }) → { ok: true; value; fractionDigits } | { ok: false; error }` (Testfall I).
- `m3ToKwh`, `eurPerM3ToCtPerKwh`, `ctPerKwhToEurPerM3`, `gasFactorsAt(meter, date)` (Testfall B, Umrechnungsteil).
- `daysBetween`, `addDays`, `eachDay`, `daysInYear`, `daysInMonth`, `todayISO`, `isISODate` (Sommerzeit-Test).

### Task 2: Domain – `intervals`, `distribution`, `consumption`

- `buildIntervals(readings, meters) → Interval[]` mit Zählerwechsel und Überlauf (Testfall G).
- `dayWeight(date, energy, baseLoad)`, `sumWeights(from, to, …)`, `distribute(intervals, …) → DailyPoint[]`, `monthlyTotals`, `cumulativeByYear` (Testfall C als Verteilungs-Check).
- `averagePerDay(daily, from, to)`, `trendVsPreviousYear`, `readingStatus(lastDate, today, intervalDays)`.

### Task 3: Domain – `plausibility`, `csv`

- `checkReading(ctx) → Issue[]` (Fehler: Zukunft, kleiner als vorher, größer als Folgestand; Rückfrage: gleiches Datum; Warnung: Tagesrate > 50 % vom Median der letzten 5 Intervalle, bei Gas auf die Gewichte normiert; Hinweis: zu viele Nachkommastellen; Überlauf-Rückfrage) (Testfall I).
- `parseReadingsCsv(text) → { rows, errors }` (Excel-DE: `;` oder Tab, Dezimalkomma, Datum `TT.MM.JJJJ` oder ISO).

### Task 4: Daten – Dexie, Repositories, Hooks, Demo, Import

- `src/data/db.ts` (alle Tabellen aus §5, `version(1)` und Migrationsgerüst), `repositories/{meters,readings,settings,demo,importReadings}.ts`, `hooks.ts`.
- Tests mit `fake-indexeddb`: CRUD, Soft-Delete, Undo, Demo laden/entfernen, Import (legt fehlende Zähler an, überspringt Duplikate, meldet Konflikte).
- Demo-Daten: 2 Jahre, alle 14–21 Tage, saisonal, zwei Anbieterwechsel (erfundene Anbieter), deterministisch (seeded PRNG).

### Task 5: UI – Format, Onboarding, Schnellerfassung

- `src/lib/format.ts` + Tests.
- Onboarding (Zähler anlegen | Ablesungen importieren | Demo-Daten laden) mit react-hook-form + zod.
- Schnellerfassung als Bottom-Sheet: Zähler-Umschalter, großes Feld (vorbefüllt, komplett markiert), Datum, Foto, Live-Vorschau mit Plausibilität, Speichern, Rückgängig-Toast.

### Task 6: UI – Verlauf, Zählerwechsel, Mehr/Zähler, Import-Dialog

- Verlauf je Zähler mit Δ, Tagen, kWh/Tag; Bearbeiten, Löschen (mit Rückgängig), Foto ansehen, Nachtragen, Zählerwechsel.
- Mehr: Zähler bearbeiten (inkl. Gasfaktoren), Ableseintervall, Gas-Grundlast, Demo-Daten, Import.

### Task 7: UI – Übersicht und Diagramme 1–3

- Übersicht je Energieart: Ø kWh/Tag (30 Tage), Trend gegenüber dem Vorjahr, Sparkline (SVG), Ablesestatus.
- Auswertung (lazy): Stufen-Tagesverbrauch mit Vorjahr gestrichelt, Monatsbalken mit Geister-Balken, Kumulierte Kurve je Jahr; Zeitraum- und Energie-Filter; jede Grafik auch als Tabelle.

### Task 8: E2E, Doku, Abnahme

- E2E: Onboarding → Ablesung erfassen → Übersicht zeigt den Wert; Demo-Daten → Diagramme sichtbar; CSV-Import.
- ROADMAP/DECISIONS aktualisieren; verify + e2e grün; Lighthouse prüfen.
