# Fachwissen und Formeln

Destillat aus `docs/MASTER_PROMPT.md`, Abschnitte 4 (Fachwissen aus Anbietersicht) und 6
(Rechenlogik). Rechtliche Aussagen erscheinen in der App nur als **„Info, ohne Gewähr“** mit
Quelle (Verbraucherzentrale, Bundesnetzagentur, Gesetzestext). Keine Rechtsberatung.

---

## 1. Strom

- Der Zähler zählt **kWh**. Das Datenmodell ist für Zweitarif (HT/NT) vorbereitet, die UI kommt später.
- Preise brutto: **Arbeitspreis** (ct/kWh) + **Grundpreis** (Eingabe €/Monat oder €/Jahr;
  intern €/Jahr, tagesgenau umgelegt).

## 2. Gas

- Der Zähler misst **m³**, abgerechnet wird in **kWh**:

  ```
  kWh = m³ × Zustandszahl (z) × Brennwert (Hs)
  ```

- z (typ. 0,90–0,99) und Hs (typ. ca. 9,5–11,5 kWh/m³) stehen auf der Gasrechnung. Sie hängen von
  Netz und Zählerort ab, **nicht vom Lieferanten** → am **Zähler** gespeichert, mit „gültig ab“.
  Platzhalter für neue Zähler: z = 0,9500, Hs = 11,000 mit dem Hinweis „Werte aus deiner
  Gasrechnung übernehmen“.
- Gaspreise stehen in **ct/kWh**. Eingabe alternativ in **€/m³**; es werden immer beide Einheiten angezeigt:

  ```
  ct/kWh = (€/m³ × 100) ÷ (z × Hs)
  ```

- Gas ist stark saisonal → lineare Hochrechnung ist falsch (siehe 8.4).

## 3. Boni und die Tricks der Anbieter

| Bonus / Falle                              | Was passiert                                                                                                                                        | Was die App tut                                                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sofortbonus**                            | kommt einige Wochen nach Lieferbeginn (spätestens ~3 Monate), meist per Überweisung                                                                 | Erinnerung „Sofortbonus eingegangen?“                                                                                                                       |
| **Neukundenbonus**                         | fällig nach **12 Monaten Belieferung**, meist mit der Jahres-/Schlussrechnung verrechnet                                                            | Status-Workflow, Prüf-Erinnerung                                                                                                                            |
| **Falle 1: Vertragsbeginn ≠ Lieferbeginn** | Laufzeit startet mit Vertragsschluss, Belieferung später → Kündigung „zum Ende der Erstlaufzeit“ ergibt evtl. nur 11 Monate Belieferung → Bonus weg | speichert Vertragsschluss **und** Lieferbeginn, berechnet „12 Monate Belieferung erreicht am …“, **rote Warnung**, wenn das geplante Lieferende davor liegt |
| **Falle 2: verbrauchsabhängiger Bonus**    | Höhe hängt vom tatsächlichen Verbrauch ab; Sofortbonus kann später verrechnet werden                                                                | Flag + Hinweis                                                                                                                                              |
| **Falle 3: Neukunden-Definition**          | Bonus nur, wenn man zuletzt (z. B. 6 Monate) nicht beim Anbieter oder einer Marke desselben Konzerns war                                            | Anbieter-Historie mit Konzern-Feld; Warnung im Angebotsvergleich bei Nutzung in den letzten 12 Monaten                                                      |
| **Falle 4: Bonus „vergessen“**             | fehlt in der Schlussrechnung                                                                                                                        | Status zugesagt → fällig → erhalten/verrechnet → strittig/verfallen + Erinnerung „Schlussrechnung auf Bonus prüfen“                                         |

Info: Eine Klausel, nach der der Bonus bei **berechtigter** Kündigung (z. B. wegen Preiserhöhung)
entfällt, halten die Verbraucherzentralen für unwirksam.

## 4. Preise und Preisänderungen

- **Preisgarantie:** Umfang (voll / eingeschränkt = ohne Steuern und Abgaben / nur Energiepreis)
  - Enddatum → Erinnerung.
- **Preisänderung:** Haushaltskunden müssen mindestens **1 Monat vorher** informiert werden; dann
  gilt ein **Sonderkündigungsrecht** ohne Frist zum Wirksamwerden der Änderung
  (§ 41 Abs. 5 EnWG). Sonderkündigungen selbst erklären, nicht über den neuen Anbieter.
  → Eine Preisänderung ist eine neue Preisperiode; die App zeigt ein Banner und die Deadline
  (Tag vor Wirksamwerden).

## 5. Laufzeit, Kündigung, Wechsel

- Erstlaufzeit (meist 12 Monate) + Kündigungsfrist. Verträge ab 01.03.2022 sind nach der
  Erstlaufzeit in der Regel monatlich kündbar.
- Kündigung in Textform (E-Mail oder Kundenportal reicht) → erfassen: gesendet am, Kanal,
  Bestätigung erhalten am, bestätigtes Lieferende.
- **Strom:** Der technische Lieferantenwechsel läuft seit 06.06.2025 werktags binnen 24 h –
  Kündigungsfristen gelten trotzdem. Die Gas-Wechseldauer wird **nicht** hart codiert.
- **Wechseltag:** Ohne gemeldeten Zählerstand schätzt der Netzbetreiber – oft zum Nachteil des
  Kunden → am Wechseltag ablesen, Foto machen, an alten **und** neuen Anbieter melden.
- **MaLo-ID** (11-stellig) je Zähler speichern – sie wird beim Wechsel gebraucht.

## 6. Abschläge und Rechnungen

- Abschläge sind die Kalkulation des Anbieters, nicht die Wahrheit: zu niedrig → Nachzahlung
  (das Angebot wirkte billig), zu hoch → zinsloser Kredit an den Anbieter → Abschlags-Check mit
  Empfehlung.
- Fristen nach **§ 40c EnWG**:
  - Rechnung spätestens **6 Wochen** nach Ende des Abrechnungszeitraums,
  - **Schlussrechnung** spätestens **6 Wochen nach Lieferende**,
  - Guthaben aus der Schlussrechnung **binnen 2 Wochen** auszahlen,
  - Guthaben aus laufender Abrechnung mit dem nächsten Abschlag verrechnen oder binnen 2 Wochen auszahlen.
    → Die App erzeugt diese Termine automatisch und markiert Überschreitungen.

## 7. Vergleichsportale

Portale rechnen mit geschätztem Verbrauch und ranken nach Kosten im 1. Jahr inkl. Bonus; ab dem 2. Jahr wird es oft teuer. → Die App rechnet mit dem **eigenen Prognoseverbrauch** und zeigt
**Jahr 1 (mit Bonus)** und **Folgejahr (ohne Bonus)** nebeneinander.

---

## 8. Rechenlogik (`src/domain`, reine Funktionen)

### 8.1 Konventionen

- Ein Zählerstand mit Datum D gilt als Stand **zu Beginn von Tag D**. Ein Intervall A → B umfasst
  die Kalendertage **[A, B)**.
- Tagesdifferenzen nur mit `differenceInCalendarDays` – nie Millisekunden ÷ 86.400.000
  (Sommerzeit-Fehler).
- Keine Zwischenrundung; gerundet wird nur in der Anzeige (`Intl.NumberFormat('de-DE')`):
  Geld 2 Stellen, ct/kWh 2–4, kWh 0–1, m³ 3.
- Zahleneingabe deutsch und robust: „12.345,678“, „12345,678“, „5.100,5“ … Bei Mehrdeutigkeit
  (nur Punkte) gewinnt die Lesart, die zur Nachkommastellenzahl des Zählers und zum letzten
  Stand passt.

### 8.2 Intervalle und Tageswerte

1. Ablesungen je Zählerkette sortieren; aufeinanderfolgende Ablesungen bilden Intervalle.
2. `Δ = B − A`. Ist Δ < 0 → Fehler, außer bei Überlauf (`rolloverModulus`, vom Nutzer
   bestätigt): `Δ = B + Modulus − A`.
3. Zählerwechsel: Das Intervall endet mit `meter_removal` am alten und beginnt mit
   `meter_install` am neuen Zähler; die Auswertung läuft ohne Sprung weiter.
4. Gas: `Δ_kWh = Δ_m³ × z × Hs` (Faktoren des Zählers, gültig im Intervall).
5. `Tagesrate = Δ_kWh ÷ Tage`.
6. Verteilung auf Kalendertage (Monatswerte, Preiswechsel mitten im Intervall):

   ```
   kWh(d) = Δ_kWh × anteil(d) ÷ Σ anteil(Intervall)
   ```

   - Strom: `anteil(d) = 1`.
   - Gas: `anteil(d) = b ÷ Tage_im_Jahr + (1 − b) × Heizanteil(d)`, Grundlast
     `b = gasBaseLoadShare` (Default 0,15).
   - **Fallback (offline) – Gradtagzahlen-Promille je Monat:**

     | Jan | Feb | Mär | Apr | Mai | Jun–Aug                                | Sep | Okt | Nov | Dez | Σ    |
     | --- | --- | --- | --- | --- | -------------------------------------- | --- | --- | --- | --- | ---- |
     | 170 | 150 | 130 | 80  | 40  | 40 (zusammen, gleichmäßig auf 92 Tage) | 30  | 80  | 120 | 160 | 1000 |

     `Heizanteil(d) = Promille_Monat ÷ (1000 × Tage_im_Monat)` (Jun–Aug: 40 ÷ (1000 × 92) je Tag).

   - **Mit Wetter (Opt-in):** Gradtagzahl G20/15 je Tag (Tagesmittel < 15 °C → 20 − Tagesmittel,
     sonst 0), normiert auf ein Normaljahr (Mittel der letzten 10 Jahre). Daten: Open-Meteo
     Archive API (`daily=temperature_2m_mean`, kein API-Key), lokal gecacht.

### 8.3 Kosten

```
Kosten(d) = kWh(d) × Arbeitspreis(d) ÷ 100 + Grundpreis_Jahr(d) ÷ Tage_im_Kalenderjahr(d)
```

- Preise aus der am Tag d gültigen Preisperiode.
- Tage ohne Vertrag klar als **Lücke** markieren (optional mit Referenztarif bewerten) – nie
  stillschweigend 0 €.
- Boni immer separat ausweisen, nie in den Arbeitspreis einrechnen.
- **Effektivpreis** je Vertragsjahr = (Arbeitskosten + Grundkosten − Boni) ÷ kWh × 100 → ct/kWh.
- Umsetzung: `costs.ts` (`costBreakdown`, `effectivePriceCt`, `annualCostEur`),
  `costAnalysis.ts` (Monatskosten, kumulierte Kosten, Effektivpreis-Historie, Kosten laufender Monat).
- **Abrechnungszeitraum** (`contractPeriod`): bis zum Lieferende, sonst das laufende Vertragsjahr
  (12-Monats-Schritte ab Lieferbeginn, Monatsende nach BGB § 188).

### 8.4 Prognose

- **Strom:** mit ≥ 365 Tagen Daten der Verbrauch der letzten 365 Tage; sonst Ø der letzten
  90 Tage × 365 (als „unsicher“ gekennzeichnet).
- **Gas (Normaljahr):** `Jahresverbrauch = beobachteter Verbrauch ÷ Σ anteil(beobachtete Tage)`;
  `Restjahr = Jahresverbrauch × Σ anteil(verbleibende Tage)`. Mit Wetterdaten zusätzlich
  witterungsbereinigt („Hast du mehr geheizt oder war es nur kälter?“).
- Wenig Daten (< 3 Intervalle) → Prognose mit Spanne und Unsicherheitshinweis.

### 8.5 Abschlags-Check und Rechnungsprognose

- Abschläge gelten laut Abschlagsplan bis heute als gezahlt; Abweichungen sind Transaktionen.
- `Saldo = Prognosekosten bis Lieferende − verrechnete Boni − Abschläge bis Lieferende`
  → > 0 Nachzahlung, < 0 Guthaben.
- `Empfohlener Abschlag = (Prognosekosten − verrechnete Boni − bereits gezahlt) ÷ verbleibende Abschläge`.
- Beispieltext: „Voraussichtlich 160 € Guthaben – du könntest den Abschlag senken.“
- Als Abweichung zählen nur Transaktionen der Art „Abschlag“ und „Sonstiges“
  (`installmentTransactions`); Bonus-Auszahlung, Erstattung und Rechnungsausgleich nicht.
- Gezählte Boni: zugesagt, fällig, erhalten, verrechnet (nicht: strittig, verfallen). Ein Bonus,
  dessen Mindestbelieferung das geplante Lieferende nicht erreicht, fällt aus Saldo und
  Effektivpreis heraus und wird rot gewarnt. Nur „mit Rechnung verrechnet“ mindert den Saldo;
  überwiesene Boni zählen im Effektivpreis, nicht im Saldo.
- Umsetzung: `installments.ts`, `contractForecast.ts` (Ist bis zur letzten Ablesung, danach
  Prognose bis Ende des Abrechnungszeitraums).

### 8.6 Fristen

Umsetzung: `deadlines.ts` (Engine), `ics.ts` (Kalender), `switch.ts` (Checkliste, Texte),
`timeline.ts` (Diagramm 6). Testfall E: Laufzeitende 31.12.2026 → 1 Monat 30.11.2026,
6 Wochen 19.11.2026, 2 Wochen 17.12.2026.

- **Ende Erstlaufzeit** = Start (Lieferbeginn oder Vertragsschluss, je `termStartsAt`) +
  Erstlaufzeit − 1 Tag.
- **Kündigungs-Deadline** (Zugang beim Anbieter) = (Laufzeitende + 1 Tag − Kündigungsfrist) − 1 Tag.
  Empfehlung: Deadline − `cancellationBufferDays` (Default 7).
- Monatliche Verlängerung: „frühestmögliches Lieferende bei Kündigung heute“ anzeigen.
- **Bonus-Sicherheitscheck:** erfüllt, wenn letzter Liefertag ≥ Lieferbeginn +
  `requiresDeliveryMonths` Monate − 1 Tag. Sonst rote Warnung mit Dauer („nur 11 Monate und
  16 Tage“) und dem nötigen Lieferende.
- **Automatische Termine:** Kündigungs-Deadline, Preisgarantie-Ende, Sonderkündigung (Tag vor
  Wirksamwerden einer Preisänderung), Sofortbonus prüfen (Lieferbeginn + 3 Monate),
  Neukundenbonus prüfen (mit Schlussrechnung), Schlussrechnung fällig (Lieferende + 6 Wochen),
  Guthaben fällig (Rechnungsdatum + 2 Wochen), Wechseltag-Ablesung, nächste Ablesung
  (letzte + Intervall).

### 8.7 Plausibilität

- Neuer Stand < letzter Stand → **Fehler** (außer Zählerwechsel oder Überlauf).
- Datum in der Zukunft → Fehler; gleiches Datum wie eine vorhandene Ablesung → Rückfrage „ersetzen?“.
- Tagesrate weicht > 50 % vom Median der letzten 5 Intervalle ab (Gas: auf `anteil` normiert)
  → **Warnung** „Tippfehler?“ mit Vorschau; Speichern bleibt möglich.
- Mehr Nachkommastellen als das Zählwerk hat → Hinweis.

### 8.8 Angebotsvergleich

- Basis: Prognose-Jahresverbrauch (Gas: Normaljahr).
- `Jahr 1 = kWh × AP ÷ 100 + GP − Σ Boni` · `Folgejahr = kWh × AP ÷ 100 + GP`
  (Hinweis: Preis nach der Garantie unbekannt).
- Ranking nach Jahr 1 und nach 2-Jahres-Summe; Ersparnis gegenüber aktuellem Vertrag und
  Referenztarif (z. B. Grundversorgung).
- Warnungen: Anbieter oder Konzern in den letzten 12 Monaten genutzt; Laufzeit > 12 Monate;
  eingeschränkte Preisgarantie; Boni > 20 % der Jahreskosten („Lockangebot – Folgejahr prüfen“).
- **Break-even-Verbrauch** zwischen zwei Angeboten:
  `kWh* = (GP_B − GP_A) ÷ ((AP_A − AP_B) ÷ 100)`.

---

## 9. Pflicht-Testfälle (`src/domain/__tests__`)

| #   | Eingabe                                                                                                                                           | Erwartung                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Strom: 01.01.2026 = 10.000 kWh, 22.01.2026 = 10.210 kWh; AP 30,00 ct bis 14.01., ab 15.01. 25,00 ct; GP 120 €/Jahr                                | 21 Tage, 10,0 kWh/Tag; Arbeit 14 × 10 × 0,30 + 7 × 10 × 0,25 = 59,50 €; GP 120 × 21 ÷ 365 = 6,90 €; gesamt **66,40 €**                      |
| B   | Gas: 01.10.2026 = 5.000,000 m³, 22.10.2026 = 5.100,000 m³; z 0,9500, Hs 11,000; AP 10,00 ct; GP 150 €/Jahr                                        | **1.045 kWh**; Arbeit 104,50 €; GP 8,63 €; gesamt **113,13 €**; 1,045 €/m³ ⇔ 10,00 ct/kWh                                                   |
| C   | Gas-Prognose: Verbrauch 01.–31.10.2026 = 1.000 kWh                                                                                                | b = 0: Anteil 80 ‰ → **12.500 kWh/Jahr**; b = 0,15: Anteil 0,08074 → **≈ 12.385 kWh/Jahr**; Teilzeitraum 01.–15.11. (b = 0) = 60 ‰          |
| D   | 3.500 kWh × 28,00 ct + GP 150 €; Boni 150 € + 50 €                                                                                                | 1.130,00 € ohne Bonus; Jahr 1 **930,00 €** → **26,57 ct/kWh**; Folgejahr **32,29 ct/kWh**                                                   |
| E   | Laufzeitende 31.12.2026                                                                                                                           | Frist 1 Monat → Deadline **30.11.2026**; 6 Wochen → **19.11.2026**; 2 Wochen → **17.12.2026**                                               |
| F   | 12 Abschläge à 95 € (1.140 €), Prognosekosten 1.130 €, 150 € Bonus wird verrechnet                                                                | Saldo **−160 € (Guthaben)**; nach 6 gezahlten Abschlägen empfohlen (1.130 − 150 − 570) ÷ 6 = **68,33 €**                                    |
| G   | Alter Zähler 01.03. = 12.300, 10.03. = 12.345 (Ausbau); neuer Zähler 10.03. = 0 (Einbau), 31.03. = 150; Überlauf mit Modulus 100.000: 99.950 → 30 | 5,0 kWh/Tag (9 Tage), ≈ 7,14 kWh/Tag (21 Tage), März gesamt 195 kWh ohne Sprung; Überlauf Δ = **80**                                        |
| H   | Lieferbeginn 15.12.2025, Lieferende 30.11.2026, Bonus erfordert 12 Monate · zweiter Fall: Lieferbeginn 01.12.2025                                 | Fall 1: **Warnung** „11 Monate und 16 Tage“, nötiges Lieferende ≥ **14.12.2026**; Fall 2: **OK** (genau 12 Monate)                          |
| I   | Eingaben „12.345,678“ · „12345,678“ · „5.100,5“ · „1.234“ (Strom, 0 Nachkommastellen) · Stand kleiner als vorher · Tagesrate 3× Median            | 12345,678 · 12345,678 · 5100,5 · 1234 · **Fehler** · **Warnung**                                                                            |
| J   | 3.500 kWh; Angebot X: 30,00 ct, 120 €/Jahr, 100 € Bonus; Angebot Y: 27,00 ct, 200 €/Jahr, kein Bonus                                              | X: Jahr 1 **1.070 €**, Folgejahr **1.170 €**; Y: **1.145 €** / **1.145 €**; Break-even Folgejahr **2.666,67 kWh** (darüber ist Y günstiger) |

Nachgerechnet:

- C (b = 0,15): `0,15 × 31/365 + 0,85 × 0,080 = 0,01274 + 0,068 = 0,08074` → `1.000 ÷ 0,08074 ≈ 12.385`.
- E: (31.12.2026 + 1 Tag = 01.01.2027) − 1 Monat = 01.12.2026 → − 1 Tag = **30.11.2026**;
  − 42 Tage = 20.11.2026 → **19.11.2026**; − 14 Tage = 18.12.2026 → **17.12.2026**.
- H: 15.12.2025 + 12 Monate − 1 Tag = **14.12.2026**; 15.12.2025 → 30.11.2026 = 11 Monate (bis 14.11.) + 16 Tage.
- J: `(200 − 120) ÷ ((30 − 27) ÷ 100) = 80 ÷ 0,03 = 2.666,67 kWh`.
