# Phase 3 – Wechsel-Cockpit und Erinnerungen: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Fristen rund um Vertrag und Wechsel automatisch berechnen, in der App sichtbar machen (Fristen-Leiste, Hinweise beim Start, Wechsel-Cockpit mit Checkliste und Texten) und als `.ics` in den Kalender exportieren; dazu der Anbieter-Zeitstrahl (Diagramm 6).

**Architecture:** Reine Module `src/domain/deadlines.ts` (Fristen-Engine), `src/domain/ics.ts` (RFC 5545) und `src/domain/switch.ts` (Checkliste, Texte, Lieferende-Vorschlag). Ein Hook `useDeadlines` führt Verträge, Ablesungen und Einstellungen zusammen. UI in `src/features/switch` (Cockpit), Fristen-Leiste in `src/features/overview`, Zeitstrahl in `src/features/contracts`.

**Tech Stack:** wie Phase 2; neu nur `ical.js` als devDependency (Parser für den ICS-Rundlauftest).

**Spec:** `docs/MASTER_PROMPT.md` Abschnitte 4.5, 4.6, 6.6, 7.2, 7.3 (1, 6, 8), 7.4 (6), 8 (Phase 3), 9 (E).

## Global Constraints

- Daten nur `'YYYY-MM-DD'`; Tagesrechnung mit date-fns (`addMonths`, `addDays`, `differenceInCalendarDays`), Monatsenden nach BGB § 188.
- Deadline = (Laufzeitende + 1 Tag − Kündigungsfrist) − 1 Tag; Empfehlung = Deadline − `cancellationBufferDays` (Default 7).
- Schlussrechnung fällig = Lieferende + 6 Wochen; Guthaben fällig = Rechnungsdatum + 2 Wochen (§ 40c EnWG); Sofortbonus prüfen = Lieferbeginn + 3 Monate.
- Rechtliche Hinweise nur als „Info, ohne Gewähr“ mit Quelle.
- Kündigungstext: Kunden- und Zählernummer, konkretes Lieferende (Frist **und** Bonus gesichert), hilfsweise „zum nächstmöglichen Termin“, Bitte um schriftliche Bestätigung des Lieferendes. Name/Anschrift nur als Platzhalter – nie gespeichert.
- ICS: `VERSION:2.0`, CRLF, Zeilen ≤ 75 Oktette (UTF-8) gefaltet, Text escaped, ganztägige Termine (`VALUE=DATE`), `VALARM` je Frist, Ablese-Erinnerung mit `RRULE:FREQ=DAILY;INTERVAL=<readingIntervalDays>`.
- Keine echten Daten des Nutzers in Tests/Fixtures.

## Review Focus

1. **Laufzeitende am Monatsende** (31.01. + 1 Monat Frist) → Deadline nach BGB § 188 → Test in `deadlines`.
2. **Bereits gekündigter Vertrag** erzeugt keine Kündigungs-Deadline mehr, aber Wechseltag-Ablesung und Schlussrechnung → Test.
3. **Monatliche Verlängerung nach Erstlaufzeit**: frühestmögliches Lieferende bei Kündigung heute → Test.
4. **Umlaute und lange Texte in ICS** (Faltung nach Oktetten, nicht Zeichen) → Test mit „Schlussrechnung prüfen – Überschreitung“.
5. **Vertrag ohne Erstlaufzeit/Frist-Angaben** → keine Kündigungs-Deadline, keine Fehler → Test.

---

### Task 1: Domain – Fristen-Engine (Testfall E)

**Files:** Create `src/domain/deadlines.ts`, Test `src/domain/__tests__/deadlines.test.ts`

**Interfaces – Produces:**
- `termEnd(contract): ISODate | undefined` – Start je `termStartsAt` + `minTermMonths` − 1 Tag.
- `cancellationDeadline(end: ISODate, notice: Contract['noticePeriod']): ISODate`
- `earliestDeliveryEnd(contract, today): ISODate | undefined` – erstes Laufzeitende, dessen Deadline ≥ heute (Erstlaufzeit; danach monatlich: heute + Frist; feste Verlängerung: Folgeperioden).
- `type DeadlineKind = 'cancellation' | 'price_guarantee_end' | 'special_cancellation' | 'instant_bonus_check' | 'new_customer_bonus_check' | 'final_bill_due' | 'credit_due' | 'switch_reading' | 'next_reading'`
- `interface Deadline { id: string; kind: DeadlineKind; date: ISODate; recommendedDate?: ISODate; title: string; detail: string; energyType: EnergyType; contractId?: string; done: boolean }`
- `collectDeadlines(input: { contracts; pricePeriods; bonuses; bills; readings; meters; settings; today }): Deadline[]` (sortiert nach Datum, `done` = erledigt, z. B. Bonus erhalten, Rechnung vorhanden, Ablesung am Wechseltag existiert).
- `deadlineState(d, today): 'overdue' | 'soon' | 'later' | 'done'` (soon = ≤ 14 Tage).

- [ ] Test E: `cancellationDeadline('2026-12-31', {value:1,unit:'months'})` = `'2026-11-30'`, 6 Wochen = `'2026-11-19'`, 2 Wochen = `'2026-12-17'`; Monatsende `'2027-02-28'` + 1 Monat = `'2027-01-31'`.
- [ ] Tests: `termEnd` (Lieferbeginn 01.01.2026, 12 Monate → 31.12.2026; `termStartsAt:'contract'` mit Vertragsschluss); `earliestDeliveryEnd` (vor Deadline → Erstlaufzeitende; danach monatlich: heute 26.11.2026 + 1 Monat → 26.12.2026; feste 12-Monats-Verlängerung → 31.12.2027).
- [ ] Tests `collectDeadlines`: aktiver Vertrag → cancellation mit `recommendedDate` = Deadline − 7; gekündigter Vertrag → keine cancellation, aber `switch_reading` (Lieferende + 1) und `final_bill_due` (Lieferende + 42); Sofortbonus offen → `instant_bonus_check` (Start + 3 Monate), erhalten → `done`; Rechnung mit Guthaben → `credit_due` (+14), `balanceSettledAt` → done; Preisänderung → `special_cancellation` (Tag davor); `next_reading` = letzte Ablesung + Intervall je Energieart; Vertrag ohne `minTermMonths` → keine cancellation.
- [ ] Implementieren, grün, Commit `feat(domain): add deadline engine (test case E)`.

### Task 2: Domain – ICS-Export

**Files:** Create `src/domain/ics.ts`, Test `src/domain/__tests__/ics.test.ts`; `npm i -D ical.js`

**Interfaces – Produces:** `buildIcs(input: { deadlines: Deadline[]; readingReminder?: { start: ISODate; intervalDays: number; energyLabel: string }; now: Date }): string`

- [ ] Tests: beginnt mit `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID`, endet mit `END:VCALENDAR\r\n`; nur CRLF; jede Zeile ≤ 75 Oktette; `DTSTART;VALUE=DATE:20261130` / `DTEND` = Folgetag; `UID` stabil (`<deadline.id>@strom-gas-tracker`); Escaping von `,` `;` `\` und Zeilenumbruch; je Frist `BEGIN:VALARM` mit `ACTION:DISPLAY` (Vortag 9 Uhr: `TRIGGER:-PT15H`; bei Empfehlung zusätzlich am Empfehlungstag); Ablese-Erinnerung mit `RRULE:FREQ=DAILY;INTERVAL=14`; erledigte Fristen fehlen; Rundlauf mit `ical.js` (`ICAL.parse` + Anzahl `VEVENT`, Summary mit Umlauten unverändert).
- [ ] Implementieren, grün, Commit `feat(domain): add RFC 5545 calendar export`.

### Task 3: Domain – Wechsel: Checkliste, Lieferende-Vorschlag, Texte

**Files:** Create `src/domain/switch.ts`, Test `src/domain/__tests__/switch.test.ts`; Modify `src/domain/types.ts` (`Contract.switchChecklist?: Partial<Record<SwitchStep, ISODate>>`)

**Interfaces – Produces:**
- `SWITCH_STEPS` (9 Schritte in Spec-Reihenfolge: `offer_chosen, cancelled, confirmed, new_contract, switch_reading, reported, final_bill, bonus_checked, credit_received`) mit Label.
- `switchProgress({ contract, successor?, bonuses, bills, readings, today }): { step: SwitchStep; label: string; done: boolean; auto: boolean; date?: ISODate }[]` – automatisch erkannt: gekündigt (`cancellation.sentAt`), Bestätigung (`confirmedAt`), neuer Vertrag (Nachfolger mit Lieferbeginn = Lieferende + 1), Wechseltag-Ablesung (Ablesung ±1 Tag), Schlussrechnung (Bill `final`), Bonus geprüft (Neukundenbonus nicht mehr zugesagt/fällig), Guthaben (Schlussrechnung ohne Guthaben oder `balanceSettledAt`); sonst manuell aus `switchChecklist`.
- `suggestedDeliveryEnd(contract, bonuses, today): { date: ISODate; reason: 'term' | 'bonus' }` – max(frühestmögliches Lieferende, nötiges Bonus-Lieferende).
- `cancellationLetter({ contract, meter, endDate }): { subject: string; body: string }` und `meterReadingMessage({ meter, reading, energyLabel }): { subject: string; body: string }`.

- [ ] Tests: Vorschlag nimmt das spätere Datum (Bonus 14.12.2026 vs. Frist 30.11.2026); Brieftext enthält Kundennummer, Zählernummer, `zum 31.12.2026`, „hilfsweise zum nächstmöglichen Termin“, „schriftlich“, Platzhalter `[Vor- und Nachname]`; fehlende Kunden-/Zählernummer → Platzhalter statt `undefined`; Meldung enthält Datum, Stand im de-DE-Format mit Einheit, Zählernummer, MaLo-ID; Fortschritt erkennt automatische Schritte und manuelle Haken.
- [ ] Implementieren, grün, Commit `feat(domain): add switch checklist, suggested delivery end and letter templates`.

### Task 4: Daten und Hook

**Files:** Modify `src/data/repositories/contracts.ts` (`setSwitchStep(contractId, step, date | null)`), `src/data/hooks.ts`; Create `src/features/switch/useDeadlines.ts`; Modify `src/features/settings/PreferencesSection.tsx` (Kündigungspuffer)

- [ ] Repository-Test: `setSwitchStep` setzt/entfernt einen Haken, ohne andere Felder zu ändern.
- [ ] `useDeadlines()` → `{ status: 'loading' } | { status: 'ready'; deadlines: Deadline[]; today; ... }` (memoisiert, nutzt `useCostData`-Quellen).
- [ ] Einstellung „Kündigungspuffer (Tage)“ 0–30, Test im Settings-Flow. Commit.

### Task 5: UI – Fristen-Leiste, Hinweise beim Start, Kalender-Export

**Files:** Create `src/features/overview/DeadlineBar.tsx`, `src/features/switch/StartupHints.tsx` (in `AppLayout`), `src/features/switch/exportCalendar.ts` (Blob-Download `strom-gas-fristen.ics`); Modify `OverviewPage.tsx`, `MorePage.tsx`/`DataSection.tsx` (Button „Kalender exportieren“)

- [ ] Tests: Übersicht zeigt „eprimo kündigen · noch 4 Tage“-artige Leiste für die nächste offene Frist (Link ins Cockpit), überfällige Fristen rot; ohne Fristen keine Leiste. Start-Hinweis: Toast für Fristen ≤ 7 Tage/überfällig, höchstens einmal pro Tag (`localStorage` `sgt-hints-shown`, try/catch). Export erzeugt eine Datei mit `text/calendar`.
- [ ] Commit.

### Task 6: UI – Wechsel-Cockpit `/wechsel`

**Files:** Modify `src/features/switch/SwitchPage.tsx`; Create `src/features/switch/SwitchCard.tsx`, `ChecklistSection.tsx`, `TextGenerator.tsx`, `DeadlineList.tsx`

- [ ] Je Energieart mit laufendem/gekündigtem Vertrag: Status-Flow (aktiv → gekündigt → beendet), Countdown bis zur Deadline bzw. zum Lieferende, Bonus-Sicherheitscheck, Lieferende-Vorschlag, Checkliste (auto/manuell), Texte mit Kopieren (`navigator.clipboard`), Teilen (`navigator.share`, falls vorhanden) und Mailen (`mailto:` mit Betreff/Text), Liste aller Fristen, Kalender-Export. Leerzustand ohne Vertrag.
- [ ] Tests (Testing Library): Countdown-Text, Haken setzen speichert, Text enthält Lieferende-Vorschlag, Kopieren ruft Clipboard. Commit.

### Task 7: UI – Anbieter-Zeitstrahl (Diagramm 6)

**Files:** Create `src/domain/timeline.ts` (+ Test), `src/features/contracts/ProviderTimeline.tsx`; Modify `ContractsPage.tsx`

- [ ] `timelineRows(contracts, pricePeriods, bonuses, bills, today)` → je Energieart Bänder `{ contractId, provider, from, to, open, energyPriceCt }` + Marker `{ kind: 'cancellation' | 'bonus' | 'bill'; date }`; Farbe je Anbieter in fester Reihenfolge des ersten Auftretens (Palette mit dem dataviz-Validator prüfen, hell/dunkel).
- [ ] SVG mit gemessener Breite, Arbeitspreis-Label im Band (nur wenn es passt), Tap zeigt Details, Tabellenansicht. Test: Bänder und Tabelle. Commit.

### Task 8: E2E, Doku, Abnahme

- [ ] E2E: Vertrag mit Laufzeitende → Fristen-Leiste in der Übersicht → Cockpit → Haken setzen → Kündigungstext kopieren → Kalender-Download (Inhalt beginnt mit `BEGIN:VCALENDAR`); axe hell/dunkel für Cockpit und Verträge mit Zeitstrahl.
- [ ] ROADMAP/DECISIONS/DOMAIN, `npm run verify`, `npm run e2e`, Lighthouse, Push, CI, Phasenbericht (inkl. Bitte, die `.ics` in iOS- und Google-Kalender zu importieren).
