# Phase 2 – Verträge, Preise, Boni, Kosten: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Verträge über die jährlichen Wechsel hinweg verwalten (Preisperioden, Boni mit Status, Abschläge, Transaktionen, Rechnungen) und daraus Kosten, Effektivpreis, Kostenprognose und Abschlags-Check berechnen und anzeigen (Übersicht, Detailseite, Diagramme 4, 5, 7, „So gerechnet“).

**Architecture:** Neue reine Module in `src/domain` (`costs`, `installments`, `bonus`, Erweiterung `forecast`), Repositories und Hooks in `src/data`, Screens in `src/features/contracts`. Die Kosten-Engine arbeitet auf der bestehenden Tagesreihe (`DailyPoint[]`) und der am Tag gültigen Preisperiode.

**Spec:** Abschnitte 4.3, 4.4, 4.6, 5, 6.3, 6.4, 6.5, 6.6 (nur Erstlaufzeit und Bonus-Check), 7.3 (5), 7.4 (4, 5, 7), 8 (Phase 2), 9 (A, B, C, D, F, H).

## Global Constraints

Wie Phase 0/1. Zusätzlich:
- Preise intern immer ct/kWh brutto und €/Jahr brutto; Eingabe alternativ €/m³ (Gas) bzw. €/Monat.
- Boni nie in den Arbeitspreis einrechnen – immer separat ausweisen.
- Tage ohne Vertrag sind Lücken, nie 0 €.
- Echte Vertragsdaten des Nutzers nie ins Repo.

## Review Focus

1. **Preiswechsel mitten im Intervall** (Testfall A) → `costs`-Test.
2. **Vertrag ohne Lieferende** (läuft monatlich weiter) → Prognose bis Ende Vertragsjahr → Test.
3. **Bonus-Sicherheitscheck bei Monatsenden** (31.01. + 1 Monat) → date-fns `addMonths` + Test H.
4. **Abschlag am 31. in kurzen Monaten** (dayOfMonth 31 → letzter Tag) → `installments`-Test.
5. **Überlappende Verträge desselben Zählers** werden beim Speichern abgelehnt → Repository-Test.

---

### Task 1: Domain – Kosten (A, B, D)
`pricePeriodAt`, `contractForDay`, `costBreakdown(daily, contract, periods, from, to)`, `effectivePriceCt`.

### Task 2: Domain – Bonus (H) und Abschläge (F)
`bonusSafety(deliveryStart, lastDeliveryDay, months)`, `bonusExpectedDate`, `installmentDueDates(plan, from, to)`, `balanceForecast`, `recommendedInstallment`.

### Task 3: Domain – Kostenprognose (C-Teilzeitraum)
`projectKwh(annual, from, to, energy, baseLoad)`, `contractForecast(...)`: Ist bis zum letzten Datentag plus Prognose bis Lieferende bzw. Ende des Vertragsjahres; Saldo und empfohlener Abschlag.

### Task 4: Daten
Repositories `contracts` (Überlappungsprüfung), `pricePeriods`, `bonuses`, `bills`, `transactions`; Hooks; Demo-Daten um Abschläge und Schlussrechnungen ergänzen.

### Task 5: UI – Vertrags-Assistent und Detailseite
4 Schritte; Detail mit Preisperioden, Boni (Status-Workflow, Sicherheitscheck), Abschlagsplan, Transaktionen, Rechnungen, Kündigung, Notizen; „So gerechnet“-Popover; Gasfaktoren-Historie am Zähler.

### Task 6: UI – Kosten in Übersicht und Auswertung
Kostenkarten (laufender Monat, Prognose, Saldo); Diagramme 4 (Kosten je Monat), 5 (Abschläge vs. Kosten kumuliert), 7 (Effektivpreis je Vertragsjahr); Zeitraum „Vertrag“.

### Task 7: E2E, Doku, Abnahme
Vertrag anlegen → Kosten und Saldo sichtbar; ROADMAP/DECISIONS; verify, e2e, Lighthouse.
