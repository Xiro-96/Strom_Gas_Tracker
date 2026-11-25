# ⚡🔥 Master-Prompt: Strom_Gas_Tracker

> **Für:** Claude Code · **Repo:** `Xiro-96/Strom_Gas_Tracker` (öffentlich) · **Stand:** 25.11.2026
> Dieses Dokument ist die vollständige, freigegebene Spezifikation. Füge es komplett in Claude Code ein.

---

## 0. Kick-off – so startest du

1. Lies dieses Dokument vollständig, bevor du Code schreibst.
2. Speichere es unverändert als `docs/MASTER_PROMPT.md`.
3. Lege `CLAUDE.md` an (kompakte Projektregeln aus Abschnitt 3, 11 und 12, max. ~80 Zeilen) und `docs/ROADMAP.md` (alle Phasen aus Abschnitt 8 als Checklisten).
4. Setze **Phase 0** und danach **Phase 1** um. Nach jeder Phase: anhalten, kurz berichten (*was ist fertig · wie teste ich es am Handy · was ist offen*) und auf mein „weiter" warten.
5. Falls Superpowers-Skills verfügbar sind: Dieses Dokument ist das freigegebene Design, Brainstorming entfällt. Lege es zusätzlich unter `docs/superpowers/specs/2026-11-25-strom-gas-tracker-design.md` ab und arbeite je Phase mit `writing-plans` → `test-driven-development` → `verification-before-completion`. Falls `frontend-design` oder `dataviz` verfügbar sind, nutze sie für UI und Diagramme.
6. Falls GitHub Pages im Repo noch nicht aktiv ist, sag mir genau, was ich klicken muss (Settings → Pages → Source: „GitHub Actions").

---

## 1. Deine Rollen

Du arbeitest gleichzeitig als:

- **Senior-Webentwickler** – React, TypeScript, PWA, Mobile-first, modernes UI.
- **Experte für Strom- und Gas-Tracking** – Zählerstände, Verbrauchsanalyse, Heizgradtage, Prognosen.
- **Programmierexperte** – saubere Architektur, Typsicherheit, Tests, Performance.
- **Insider aus Sicht der Strom- und Gasanbieter** – du kennst Abrechnung, Abschläge, Boni, Preisgarantien, Fristen und die Tricks der Branche und baust die App so, dass sie den Nutzer davor schützt.

---

## 2. Ausgangslage, Ziel, Erfolg

**Nutzer:** Privathaushalt mit eigenem Strom- und Gaszähler.

- Wechselt den Anbieter **jährlich** (Bonus-Optimierung).
- Liest die Zähler **alle 2–3 Wochen** ab → unregelmäßige Intervalle sind der Normalfall.
- Will eingeben, was er **pro kWh bzw. pro m³** zahlt, und die **Boni** der Anbieter tracken.
- Aktuelles Beispiel: Vertrag bei **eprimo**, der zum **01.12.2026** gekündigt werden muss. Genau dieser Fall muss vollständig abbildbar sein (Frist, Kündigung, Bestätigung, Bonus, Schlussrechnung, Guthaben).

**Ziel:** Eine moderne, mobile-first **Progressive Web App** „Strom & Gas Tracker" – Webseite und installierbare App (iOS, Android, Desktop) in einem –, die:

1. Zählerstände in unter 10 Sekunden erfassen lässt,
2. Verbrauch und Kosten in schönen, interaktiven Graphen zeigt,
3. Verträge, Preise, Boni, Abschläge und Fristen über die jährlichen Wechsel hinweg verwaltet,
4. Jahres- bzw. Schlussrechnung prognostiziert (Nachzahlung oder Guthaben),
5. neue Angebote mit dem **echten eigenen Verbrauch** vergleicht.

**Erfolg heißt:**

- Am Zähler: App öffnen → Zähler wählen → Wert tippen → Speichern in < 10 s.
- Jede Zahl ist nachvollziehbar („So wurde gerechnet"-Popover).
- Keine Frist (Kündigung, Bonus, Schlussrechnung, Guthaben) geht mehr verloren.
- Die App sieht aus wie eine hochwertige Fintech-App, nicht wie ein Formular.

---

## 3. Technik-Entscheidungen (verbindlich)

| Bereich | Entscheidung | Grund |
|---|---|---|
| App-Typ | PWA, offline-first, **ohne Backend** (bis Phase 5) | eine Codebasis für Web + Handy, kostenlos, Daten bleiben privat |
| Basis | React + TypeScript (strict) + Vite | Standard, schnell |
| UI | Tailwind CSS + shadcn/ui + lucide-react, Animationen sparsam mit `motion` | modern und konsistent |
| Diagramme | Recharts über die shadcn/ui-Chart-Komponenten | passt zum Design-System |
| Daten | IndexedDB mit Dexie + `useLiveQuery` (`dexie-react-hooks`) | offline, reaktiv, versionierte Migrationen |
| Formulare | react-hook-form + zod | Validierung, deutsche Fehlermeldungen |
| Datum | date-fns (Locale `de`) | keine Zeitzonen-/Sommerzeitfehler |
| Routing | React Router mit `createHashRouter` | läuft auf GitHub Pages ohne Rewrites |
| PWA | vite-plugin-pwa (`registerType: 'prompt'` mit Update-Toast, Manifest, Icons, Shortcuts) | installierbar, offline |
| Tests | Vitest + Testing Library + fake-indexeddb; Playwright (iPhone-Viewport) | Rechenlogik muss nachweislich stimmen |
| Qualität | ESLint (flat config), Prettier, `noUncheckedIndexedAccess` | |
| Hosting | GitHub Pages via GitHub Actions, Vite `base: '/Strom_Gas_Tracker/'` → `https://xiro-96.github.io/Strom_Gas_Tracker/` | Repo ist öffentlich → kostenlos |
| Tooling | npm, aktuelle Node-LTS, jeweils aktuelle stabile Paketversionen | |

**Harte Regeln**

- Das Repo ist **öffentlich**: keine persönlichen Daten (Zählernummern, Kundennummern, MaLo-IDs, Adressen, echte Verbräuche oder Preise) in Code, Tests, Fixtures, Screenshots oder Commits. Persönliche Daten leben nur in der lokalen App-Datenbank. Demo- und Testdaten sind erfunden, auch die Anbieternamen.
- Kein Tracking, keine Analytics, keine CDNs zur Laufzeit; Schrift lokal gebündelt (z. B. `@fontsource-variable/inter`). Einzige externe Anfrage: Wetter- und Ortsdaten von Open-Meteo, nur nach Opt-in.
- Datenzugriff ausschließlich über Repository-Funktionen in `src/data`, nie Dexie direkt in Komponenten – damit später ein Sync-Adapter ohne UI-Umbau möglich ist.

---

## 4. Fachwissen aus Anbietersicht (muss sich in Logik und UI widerspiegeln)

### 4.1 Strom

- Der Zähler zählt kWh. Datenmodell für Zweitarif (HT/NT) vorbereiten, UI später.
- Preise brutto: **Arbeitspreis** (ct/kWh) + **Grundpreis** (Eingabe €/Monat oder €/Jahr; intern €/Jahr, tagesgenau umgelegt).

### 4.2 Gas

- Der Zähler misst **m³**, abgerechnet wird in **kWh**: `kWh = m³ × Zustandszahl × Brennwert`.
- Zustandszahl (typ. 0,90–0,99) und Brennwert (typ. ca. 9,5–11,5 kWh/m³) stehen auf der Gasrechnung. Sie hängen von Netz und Zählerort ab, **nicht vom Lieferanten** → am Zähler speichern, mit „gültig ab" (der Brennwert schwankt leicht). Platzhalter für neue Zähler: z = 0,9500, Hs = 11,000 mit Hinweis „Werte aus deiner Gasrechnung übernehmen".
- Gaspreise stehen im Vertrag in **ct/kWh**. Der Nutzer will alternativ **€/m³** eingeben können: `ct/kWh = (€/m³ × 100) ÷ (z × Hs)`. Immer beide Einheiten anzeigen.
- Gas ist stark saisonal → lineare Hochrechnung ist falsch (siehe 6.4).

### 4.3 Boni – Tricks der Anbieter und wie die App gegenhält

- **Sofortbonus:** kommt einige Wochen nach Lieferbeginn (spätestens ~3 Monate), meist per Überweisung → Erinnerung „Sofortbonus eingegangen?".
- **Neukundenbonus:** fällig nach **12 Monaten Belieferung**, meist mit der Jahres- oder Schlussrechnung **verrechnet**.
- **Falle 1 – Vertragsbeginn ≠ Lieferbeginn:** Die Laufzeit startet oft mit Vertragsschluss, die Belieferung später. Wer „zum Ende der Erstlaufzeit" kündigt, kommt eventuell nur auf 11 Monate Belieferung → Bonus weg. → Die App speichert Vertragsschluss **und** Lieferbeginn, berechnet „12 Monate Belieferung erreicht am …" und **warnt rot**, wenn das geplante Lieferende davor liegt.
- **Falle 2 – verbrauchsabhängiger Bonus:** Die Höhe kann vom tatsächlichen Verbrauch abhängen; ein Sofortbonus kann später wieder verrechnet werden → Flag + Hinweis.
- **Falle 3 – Neukunden-Definition:** Oft gibt es den Bonus nur, wenn man zuletzt (z. B. 6 Monate) nicht bei diesem Anbieter oder einer Marke desselben Konzerns war → Anbieter-Historie mit Konzern-Feld; Warnung im Angebotsvergleich, wenn Anbieter oder Konzern in den letzten 12 Monaten genutzt wurden.
- **Falle 4 – Bonus „vergessen":** Er fehlt in der Schlussrechnung → Bonus-Status (zugesagt → fällig → erhalten/verrechnet → strittig/verfallen) + Erinnerung „Schlussrechnung auf Bonus prüfen".
- Info-Hinweis: Eine Klausel, nach der der Bonus bei **berechtigter** Kündigung (z. B. wegen Preiserhöhung) entfällt, halten die Verbraucherzentralen für unwirksam.

### 4.4 Preise und Preisänderungen

- **Preisgarantie:** Umfang erfassen (voll / eingeschränkt = ohne Steuern und Abgaben / nur Energiepreis) + Enddatum → Erinnerung.
- **Preisänderung:** Haushaltskunden müssen mindestens **1 Monat vorher** informiert werden; dann gilt ein **Sonderkündigungsrecht** ohne Frist zum Wirksamwerden der Änderung (§ 41 Abs. 5 EnWG). Sonderkündigungen selbst erklären, nicht über den neuen Anbieter. → Eine Preisänderung ist eine neue Preisperiode; die App zeigt Banner + Deadline (Tag vor Wirksamwerden).

### 4.5 Laufzeit, Kündigung, Wechsel

- Erstlaufzeit (meist 12 Monate) + Kündigungsfrist; Verträge ab 01.03.2022 sind nach der Erstlaufzeit in der Regel monatlich kündbar.
- Kündigung in Textform (E-Mail oder Kundenportal reicht) → erfassen: gesendet am, Kanal, Bestätigung erhalten am, bestätigtes Lieferende.
- **Strom:** Der technische Lieferantenwechsel läuft seit 06.06.2025 werktags binnen 24 h – Kündigungsfristen gelten trotzdem. Die Gas-Wechseldauer nicht hart codieren.
- **Wechseltag:** Ohne gemeldeten Zählerstand schätzt der Netzbetreiber – oft zum Nachteil des Kunden → am Wechseltag ablesen, Foto machen, an alten **und** neuen Anbieter melden.
- MaLo-ID (11-stellig) je Zähler speichern – sie wird beim Wechsel gebraucht.

### 4.6 Abschläge und Rechnungen

- Abschläge sind die Kalkulation des Anbieters, nicht die Wahrheit: zu niedrig → Nachzahlung (das Angebot wirkte billig), zu hoch → zinsloser Kredit an den Anbieter → Abschlags-Check mit Empfehlung.
- Fristen nach § 40c EnWG: Rechnung spätestens **6 Wochen** nach Ende des Abrechnungszeitraums, **Schlussrechnung spätestens 6 Wochen nach Lieferende**; Guthaben aus der Schlussrechnung **binnen 2 Wochen** auszahlen; Guthaben aus laufender Abrechnung mit dem nächsten Abschlag verrechnen oder binnen 2 Wochen auszahlen. → Die App erzeugt diese Termine automatisch und markiert Überschreitungen.

### 4.7 Vergleichsportale

- Portale rechnen mit einem geschätzten Verbrauch und ranken nach Kosten im 1. Jahr inkl. Bonus; ab dem 2. Jahr wird es oft teuer. → Die App rechnet Angebote mit dem **eigenen Prognoseverbrauch** und zeigt **Jahr 1 (mit Bonus)** und **Folgejahr (ohne Bonus)** nebeneinander.

Rechtliche Hinweise erscheinen in der App als „Info, ohne Gewähr" mit Quelle (Verbraucherzentrale, Bundesnetzagentur, Gesetzestext).

---

## 5. Datenmodell (TypeScript + Dexie)

Alle Entitäten haben `id` (UUID), `createdAt`, `updatedAt`; Löschen als Soft-Delete (`deletedAt`) → später sync-fähig. Demo-Datensätze tragen `isDemo: true` und lassen sich mit einem Klick entfernen. Datumswerte sind `'YYYY-MM-DD'`-Strings (lokales Datum) – niemals `Date`-Objekte speichern.

```ts
type EnergyType = 'electricity' | 'gas';          // erweiterbar: 'water' | 'heat'
type ISODate = string;                            // 'YYYY-MM-DD'

interface Meter {
  energyType: EnergyType; name: string; unit: 'kWh' | 'm3';
  decimals: number;                               // Nachkommastellen des Zählwerks (Gas meist 3)
  rolloverModulus?: number;                       // z. B. 100000 bei 5 Vorkommastellen
  meterNumber?: string; maloId?: string;
  activeFrom: ISODate; activeTo?: ISODate; predecessorId?: string; // Zählerwechsel-Kette
  gasFactors?: { validFrom: ISODate; zFactor: number; calorificValue: number }[];
}

interface Reading {
  meterId: string; date: ISODate; time?: string;  // 'HH:mm', im MVP nur Anzeige
  value: number;
  kind: 'regular' | 'switch' | 'meter_install' | 'meter_removal' | 'from_bill' | 'estimated';
  photoId?: string; note?: string;
}

interface Contract {
  energyType: EnergyType; meterId: string;
  provider: string; providerGroup?: string;       // Konzern/Marke (Neukunden-Regeln)
  tariffName: string; customerNumber?: string; contractNumber?: string;
  contractDate?: ISODate;                         // Vertragsschluss
  deliveryStart: ISODate;                         // Lieferbeginn – maßgeblich für Boni
  deliveryEnd?: ISODate;                          // letzter Liefertag (geplant/bestätigt)
  minTermMonths?: number; termStartsAt: 'delivery' | 'contract';
  noticePeriod: { value: number; unit: 'days' | 'weeks' | 'months' };
  renewal: { type: 'monthly' } | { type: 'fixed'; months: number };
  priceGuarantee?: { until: ISODate; scope: 'full' | 'limited' | 'energy_only' };
  installmentPlan: { validFrom: ISODate; amountEur: number; dayOfMonth: number }[];
  cancellation?: { sentAt?: ISODate; channel?: string; confirmedAt?: ISODate;
                   confirmedEnd?: ISODate; reason?: 'regular' | 'price_change' | 'move' };
  status: 'planned' | 'active' | 'cancelled' | 'ended';
  notes?: string;
}

interface PricePeriod {
  contractId: string; validFrom: ISODate;
  energyPriceCt: number;                          // ct/kWh brutto (intern immer so)
  basePriceEurPerYear: number;                    // brutto
  enteredAs?: 'ct_per_kwh' | 'eur_per_m3';        // wie eingegeben (Gas)
  changeNoticeReceivedAt?: ISODate;               // bei Preisänderung
}

interface Bonus {
  contractId: string;
  kind: 'instant' | 'new_customer' | 'loyalty' | 'referral' | 'other';
  amountEur: number; condition: string;           // Bedingung im Wortlaut der AGB
  requiresDeliveryMonths?: number;                // z. B. 12
  consumptionDependent?: boolean;
  settlement: 'payout' | 'offset_in_bill';
  expectedDate?: ISODate;                         // berechnet, überschreibbar
  status: 'promised' | 'due' | 'received' | 'offset' | 'disputed' | 'forfeited';
  receivedAt?: ISODate; receivedAmountEur?: number;
}

interface Bill {
  contractId: string; kind: 'annual' | 'final';
  periodFrom: ISODate; periodTo: ISODate; issuedAt?: ISODate;
  consumptionKwh?: number; totalEur?: number;
  balanceEur?: number;                            // + Nachzahlung, − Guthaben
  bonusIncluded?: boolean; balanceSettledAt?: ISODate;
}

interface Transaction {                           // Abweichungen vom Abschlagsplan, Sonderzahlungen
  contractId: string; date: ISODate;
  amountEur: number;                              // + an den Anbieter, − vom Anbieter
  kind: 'installment' | 'bill_balance' | 'bonus_payout' | 'refund' | 'other'; note?: string;
}

interface Offer {
  energyType: EnergyType; provider: string; providerGroup?: string; tariffName: string;
  energyPriceCt: number; basePriceEurPerYear: number;
  bonuses: { kind: Bonus['kind']; amountEur: number; requiresDeliveryMonths?: number }[];
  minTermMonths?: number; priceGuaranteeMonths?: number;
  priceGuaranteeScope?: 'full' | 'limited' | 'energy_only';
  source?: string; url?: string; capturedAt: ISODate;
}

interface Photo { blob: Blob; takenAt: string }

interface Settings {                              // Singleton
  location?: { name: string; lat: number; lon: number }; // im Onboarding abfragen, nichts hart codieren
  weatherOptIn: boolean;
  readingIntervalDays: number;                    // Default 14, „überfällig" ab 21
  gasBaseLoadShare: number;                       // Anteil Warmwasser/Kochen, Default 0,15
  cancellationBufferDays: number;                 // Default 7
  referenceTariffs: { energyType: EnergyType; label: string;
                      energyPriceCt: number; basePriceEurPerYear: number }[];
  theme: 'system' | 'dark' | 'light'; lastBackupAt?: string;
}
```

Regeln: Verträge desselben Zählers dürfen sich zeitlich nicht überlappen. Dexie-Indizes u. a. `[meterId+date]` für Ablesungen; Migrationen über `version(n).upgrade()` von Anfang an.

---

## 6. Rechenlogik (reine Funktionen in `src/domain`, vollständig getestet)

### 6.1 Konventionen

- Ein Zählerstand mit Datum D gilt als Stand **zu Beginn von Tag D**. Ein Intervall A → B umfasst die Kalendertage **[A, B)**.
- Tagesdifferenzen nur mit `differenceInCalendarDays` – nie Millisekunden ÷ 86.400.000 (Sommerzeit-Fehler).
- Keine Zwischenrundung; gerundet wird nur in der Anzeige (`Intl.NumberFormat('de-DE')`): Geld 2 Stellen, ct/kWh 2–4, kWh 0–1, m³ 3.
- Zahleneingabe deutsch und robust: „12.345,678", „12345,678", „5.100,5" … Bei Mehrdeutigkeit (nur Punkte) gewinnt die Lesart, die zur Nachkommastellenzahl des Zählers und zum letzten Stand passt.

### 6.2 Intervalle und Tageswerte

1. Ablesungen je Zählerkette sortieren; aufeinanderfolgende Ablesungen bilden Intervalle.
2. Δ = B − A. Ist Δ < 0 → Fehler, außer bei Überlauf (`rolloverModulus`, Nutzer bestätigt): Δ = B + Modulus − A.
3. Zählerwechsel: Das Intervall endet mit `meter_removal` am alten und beginnt mit `meter_install` am neuen Zähler; die Auswertung läuft ohne Sprung weiter.
4. Gas: Δ_kWh = Δ_m³ × z × Hs (Faktoren des Zählers, gültig im Intervall).
5. Tagesrate = Δ_kWh ÷ Tage.
6. Verteilung auf Kalendertage (für Monatswerte und Preiswechsel mitten im Intervall): `kWh(d) = Δ_kWh × anteil(d) ÷ Σ anteil(Intervall)`
   - Strom: `anteil(d) = 1` (jeder Tag gleich).
   - Gas: `anteil(d) = b ÷ Tage_im_Jahr + (1 − b) × Heizanteil(d)` mit Grundlast b = `gasBaseLoadShare`.
     - Fallback (offline): Gradtagzahlen-Promille je Monat – Jan 170, Feb 150, Mär 130, Apr 80, Mai 40, Jun–Aug zusammen 40 (gleichmäßig auf 92 Tage), Sep 30, Okt 80, Nov 120, Dez 160 (Σ 1000) → `Heizanteil(d) = Promille_Monat ÷ (1000 × Tage_im_Monat)`.
     - Mit Wetter (Opt-in): Gradtagzahl G20/15 je Tag (Tagesmittel < 15 °C → 20 − Tagesmittel, sonst 0), normiert auf ein Normaljahr (Mittel der letzten 10 Jahre). Daten: Open-Meteo Archive API (`daily=temperature_2m_mean`, kein API-Key), lokal cachen.

### 6.3 Kosten

Für jeden Kalendertag d eines Vertrags:

`Kosten(d) = kWh(d) × Arbeitspreis(d) ÷ 100 + Grundpreis_Jahr(d) ÷ Tage_im_Kalenderjahr(d)`

- Preise aus der am Tag d gültigen Preisperiode.
- Tage ohne Vertrag klar als Lücke markieren (optional mit Referenztarif bewerten) – nie stillschweigend 0 €.
- Boni immer separat ausweisen, nie in den Arbeitspreis einrechnen.
- **Effektivpreis** je Vertragsjahr = (Arbeitskosten + Grundkosten − Boni) ÷ kWh × 100 → ct/kWh.

### 6.4 Prognose

- **Strom:** mit ≥ 365 Tagen Daten der Verbrauch der letzten 365 Tage; sonst Ø der letzten 90 Tage × 365 (als „unsicher" kennzeichnen).
- **Gas (Normaljahr):** `Jahresverbrauch = beobachteter Verbrauch ÷ Σ anteil(beobachtete Tage)`; Restjahr = Jahresverbrauch × Σ anteil(verbleibende Tage). Mit Wetterdaten zusätzlich **witterungsbereinigt**: „Hast du mehr geheizt oder war es nur kälter?"
- Bei wenig Daten (< 3 Intervalle) Prognose mit Spanne und Unsicherheitshinweis.

### 6.5 Abschlags-Check und Rechnungsprognose

- Abschläge gelten laut Abschlagsplan bis heute als gezahlt; Abweichungen werden als Transaktion erfasst.
- `Saldo = Prognosekosten bis Lieferende − verrechnete Boni − Abschläge bis Lieferende` → > 0 Nachzahlung, < 0 Guthaben.
- Empfohlener Abschlag = (Prognosekosten − verrechnete Boni − bereits gezahlt) ÷ verbleibende Abschläge.
- Beispieltext: „Voraussichtlich 160 € Guthaben – du könntest den Abschlag senken."

### 6.6 Fristen

- Ende Erstlaufzeit = Start (Lieferbeginn oder Vertragsschluss, je `termStartsAt`) + Erstlaufzeit − 1 Tag.
- **Kündigungs-Deadline** (Zugang beim Anbieter) = (Laufzeitende + 1 Tag − Kündigungsfrist) − 1 Tag. Empfehlung: Deadline − `cancellationBufferDays`.
- Bei monatlicher Verlängerung: „frühestmögliches Lieferende bei Kündigung heute" anzeigen.
- **Bonus-Sicherheitscheck:** erfüllt, wenn letzter Liefertag ≥ Lieferbeginn + `requiresDeliveryMonths` Monate − 1 Tag. Sonst rote Warnung mit Dauer („nur 11 Monate und 16 Tage") und dem nötigen Lieferende.
- Automatische Termine: Kündigungs-Deadline, Preisgarantie-Ende, Sonderkündigung (Tag vor Wirksamwerden einer Preisänderung), Sofortbonus prüfen (Lieferbeginn + 3 Monate), Neukundenbonus prüfen (mit Schlussrechnung), Schlussrechnung fällig (Lieferende + 6 Wochen), Guthaben fällig (Rechnungsdatum + 2 Wochen), Wechseltag-Ablesung, nächste Ablesung (letzte + Intervall).

### 6.7 Plausibilität

- Neuer Stand < letzter Stand → Fehler (außer Zählerwechsel oder Überlauf).
- Datum in der Zukunft → Fehler; gleiches Datum wie eine vorhandene Ablesung → Rückfrage „ersetzen?".
- Tagesrate weicht > 50 % vom Median der letzten 5 Intervalle ab (Gas: auf `anteil` normiert) → Warnung „Tippfehler?" mit Vorschau; Speichern bleibt möglich.
- Mehr Nachkommastellen als das Zählwerk hat → Hinweis.

### 6.8 Angebotsvergleich

- Basis: Prognose-Jahresverbrauch (Gas: Normaljahr).
- `Jahr 1 = kWh × AP ÷ 100 + GP − Σ Boni` · `Folgejahr = kWh × AP ÷ 100 + GP` (Hinweis: Preis nach der Garantie unbekannt).
- Ranking nach Jahr 1 und nach 2-Jahres-Summe; Ersparnis gegenüber aktuellem Vertrag und Referenztarif (z. B. Grundversorgung).
- Warnungen: Anbieter oder Konzern in den letzten 12 Monaten genutzt; Laufzeit > 12 Monate; eingeschränkte Preisgarantie; Boni > 20 % der Jahreskosten („Lockangebot – Folgejahr prüfen").
- Break-even-Verbrauch zwischen zwei Angeboten (Grundpreis- vs. Arbeitspreis-Mix).

---

## 7. UI/UX und Design

### 7.1 Look & Feel

- Modern, ruhig, hochwertig – Stil „Fintech-Dashboard". Dark Mode als Standard, Light und System umschaltbar.
- Farben über Design-Tokens: **Strom = Amber/Gelb** (Icon `Zap`), **Gas = Blau/Cyan** (Icon `Flame`), Ersparnis = Grün, Warnung = Orange/Rot.
- Große Kennzahlen mit `tabular-nums`, Karten mit weichen Schatten und runden Ecken, dezente Verläufe in Diagrammflächen, sanfte Übergänge (respektiert `prefers-reduced-motion`).
- Durchgehend Deutsch und deutsche Formate (1.234,56 € · 27,89 ct/kWh · 12.345,678 m³).
- Mobil: Bottom-Navigation **Übersicht · Verlauf · (＋) · Verträge · Mehr** mit großem zentralem Erfassen-Button; Desktop: Sidebar.
- Barrierefreiheit WCAG AA: sichtbarer Fokus, ausreichende Kontraste, jedes Diagramm auch als Tabelle abrufbar.
- Jeder Screen hat Lade-, Leer- und Fehlerzustand.

### 7.2 Skizzen

Übersicht (mobil):

```
┌──────────────────────────────┐
│ ⏰ eprimo kündigen · noch 6 T │  ← Fristen-Leiste
├──────────────────────────────┤
│ ⚡ Strom          9,4 kWh/Tag │
│ ▁▂▃▂▃▄▃   −6 % ggü. Vorjahr  │
│ Prognose 3.430 kWh · 1.110 € │
├──────────────────────────────┤
│ 🔥 Gas           46,3 kWh/Tag │
│ ▁▁▂▄▆▇█  +4 % · bereinigt −2 %│
│ Saldo: ≈ 160 € Guthaben ✓     │
├──────────────────────────────┤
│ 📍 Gas ablesen – vor 16 Tagen │
└──────────────────────────────┘
 Übersicht  Verlauf  (＋)  Verträge  Mehr
```

Schnellerfassung (Bottom-Sheet):

```
┌──────────────────────────────┐
│   [ ⚡ Strom ]   [ 🔥 Gas ]    │
│                              │
│        12.486  kWh           │  ← vorausgefüllt, komplett markiert
│   Datum: heute, 25.11.2026 ▾ │
│   📷 Foto hinzufügen          │
│ ──────────────────────────── │
│   +132 kWh in 14 Tagen        │
│   9,4 kWh/Tag · ≈ 43 €        │
│         [ Speichern ]         │
└──────────────────────────────┘
```

### 7.3 Screens

1. **Übersicht:** Fristen-Leiste mit Countdown; je Energieart eine Karte (Ø kWh/Tag der letzten 30 Tage + Trend vs. Vorjahr, Kosten laufender Monat, Jahresprognose in kWh und €, Abschlags-Saldo, Ablesestatus) mit Sparkline.
2. **Schnellerfassung:** Zähler-Umschalter, großes Zahlenfeld (`inputmode="decimal"`, mit letztem Stand vorausgefüllt und komplett markiert – Tippen ersetzt), Datum = heute, Foto (`capture="environment"`), Live-Vorschau mit Plausibilität, Speichern mit einem Tap, Rückgängig-Toast.
3. **Verlauf:** Ablesungen je Zähler mit Δ, kWh/Tag und Kosten; bearbeiten, löschen, Foto ansehen; Zählerwechsel anlegen.
4. **Auswertung:** Diagramme aus 7.4 mit Zeitraum-Umschalter (3 M · 12 M · Jahr · Vertrag · Alles) und Energieart-Filter.
5. **Verträge:** Liste + Zeitstrahl; Detail mit Preisperioden, Boni (Status), Abschlägen, Rechnungen, Kündigung, Notizen; Assistent „Neuer Vertrag" in 4 Schritten (Anbieter & Tarif → Preise → Boni → Laufzeit, Fristen, Abschlag).
6. **Wechsel-Cockpit:** Countdown, Bonus-Sicherheitscheck, Checkliste (Angebot gewählt → gekündigt → Bestätigung erhalten → neuer Vertrag inkl. Lieferbeginn bestätigt → Zählerstand am Wechseltag + Foto → an beide Anbieter gemeldet → Schlussrechnung erhalten → Bonus geprüft → Guthaben erhalten). Dazu zwei Text-Generatoren zum Kopieren, Teilen oder Mailen:
   - **Kündigungsschreiben** in Textform: Kunden- und Zählernummer, ein konkretes Lieferende, das Frist **und** Bonus sichert, hilfsweise „zum nächstmöglichen Termin", Bitte um schriftliche Bestätigung des Lieferendes.
   - **Zählerstandsmeldung:** Datum, Stand, Zählernummer, MaLo-ID.
7. **Angebote:** Angebote manuell erfassen (z. B. aus Check24 oder Verivox), Ranking-Karten, Balken Jahr 1 vs. Folgejahr, Warnungen, Break-even.
8. **Mehr / Einstellungen:** Zähler und Gasfaktoren, Standort und Wetter-Opt-in, Ableseintervall, Kündigungspuffer, Gas-Grundlast, Referenztarife, Design, Backup/Export/Import, Kalender-Export, Demo-Daten, Anleitung „App installieren" (iOS/Android), Datenschutz-Info.

### 7.4 Diagramme (Recharts)

1. **Tagesverbrauch als Stufen:** Ø kWh/Tag je Ableseintervall als Stufenfläche (`type="stepAfter"`) auf einer echten Zeitachse – unregelmäßige Intervalle bekommen ihre richtige Breite; Vorjahr gestrichelt.
2. **Monatsverbrauch:** Balken je Monat aus der Tagesverteilung, Vorjahr als blasser „Geister-Balken" daneben; Gas optional witterungsbereinigt.
3. **Kumuliert im Jahr:** eine Linie je Jahr (x = Tag im Jahr) – sofort sichtbar, ob man über oder unter dem Vorjahr liegt.
4. **Kosten je Monat:** gestapelt Arbeitspreis + Grundpreis, Boni als negative Balken (`stackOffset="sign"`), Linie für den Abschlag.
5. **Abschläge vs. Kosten (kumuliert):** zwei Linien + gestrichelte Prognose bis Lieferende, Saldo-Badge.
6. **Anbieter-Zeitstrahl:** ein Band je Vertrag (Farbe je Anbieter) mit Arbeitspreis-Label; Marker für Kündigung, Bonus, Rechnung.
7. **Effektivpreis-Historie:** ct/kWh je Vertragsjahr mit und ohne Bonus – zeigt, was das jährliche Wechseln bringt.
8. **Gas vs. Temperatur** (Phase 4): Streudiagramm kWh/Tag gegen Ø-Außentemperatur je Intervall mit Regressionslinie.

Alle Diagramme: deutsche Tooltips mit Einheit, responsive, Tap auf einen Datenpunkt zeigt Details, leere Zustände mit kurzer Erklärung.

---

## 8. Phasenplan (jede Phase endet lauffähig und deployed)

**Phase 0 – Fundament**

- Projekt-Setup laut Abschnitt 3, App-Shell (Bottom-Nav/Sidebar), Theme-Umschalter, Routing.
- PWA: Manifest (Name „Strom & Gas Tracker", Kurzname „Energie", `scope`/`start_url` passend zur `base`), Shortcuts „Strom ablesen" und „Gas ablesen", Update-Toast. Eigenes App-Icon als SVG (Blitz + Flamme), PNGs per `@vite-pwa/assets-generator`.
- GitHub Actions: Lint, Typecheck, Test, Build bei jedem Push/PR; Deploy auf GitHub Pages bei `main`.
- `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`, `docs/DOMAIN.md` (Fachwissen und Formeln aus Abschnitt 4 und 6), `docs/DECISIONS.md`.
- ✅ Fertig, wenn die Seite unter der Pages-URL lädt, installierbar ist und offline startet.

**Phase 1 – Zähler und Verbrauch (MVP)**

- Dexie-Schema für alle Tabellen aus Abschnitt 5, Repositories, Migrations-Gerüst.
- Onboarding: Zähler anlegen (Strom/Gas, Einheit, Nachkommastellen, Startstand; Zählernummer und MaLo optional) oder „Demo-Daten laden".
- Schnellerfassung mit Plausibilität und Live-Vorschau, Verlauf (anlegen, bearbeiten, löschen), Zählerwechsel.
- Domain: Parsing, Intervalle, Gas-Umrechnung, Tagesverteilung, Plausibilität.
- Übersicht (Verbrauchsteil) und Diagramme 1–3.
- Demo-Daten: 2 Jahre, Ablesungen alle 14–21 Tage, realistische Saisonalität, zwei Anbieterwechsel, erfundene Anbieter.
- ✅ Fertig, wenn die Erfassung am Handy < 10 s dauert, die Testfälle G, I und der Umrechnungsteil von B grün sind und die Diagramme mit Demo-Daten stimmen.

**Phase 2 – Verträge, Preise, Boni, Kosten**

- Vertrags-Assistent und Detailseite, Preisperioden, Preiseingabe in ct/kWh oder €/m³, Grundpreis in €/Monat oder €/Jahr, Gasfaktoren am Zähler.
- Boni mit Status-Workflow und Bonus-Sicherheitscheck; Abschlagsplan, Transaktionen, Rechnungen.
- Kosten-Engine, Effektivpreis, Prognose (Promille-Methode), Abschlags-Check; Diagramme 4, 5 und 7; Kostenkarten in der Übersicht; „So gerechnet"-Popover.
- ✅ Fertig, wenn die Testfälle A, B, C, D, F und H grün sind.

**Phase 3 – Wechsel-Cockpit und Erinnerungen**

- Fristen-Engine (6.6) inkl. Sonderkündigung, Schlussrechnung und Guthaben.
- Wechsel-Cockpit mit Checkliste, Status-Flow (aktiv → gekündigt → beendet) und Text-Generatoren; Fristen-Leiste in der Übersicht; Hinweise beim App-Start.
- **Kalender-Export (.ics):** alle Fristen mit Erinnerung (`VALARM`) plus wiederkehrende Ablese-Erinnerung (`RRULE`, Intervall aus den Einstellungen). Ohne Backend sind Push-Nachrichten unzuverlässig – ICS ist der robuste Weg.
- Anbieter-Zeitstrahl (Diagramm 6).
- ✅ Fertig, wenn Testfall E grün ist und die .ics-Datei sauber in den iOS- und den Google-Kalender importiert.

**Phase 4 – Analyse, Vergleich, Datensicherheit**

- Angebotsvergleich (6.8) mit Warnungen und Break-even.
- Wetter-Opt-in (Open-Meteo, Standort per Ortssuche), witterungsbereinigte Gas-Auswertung, Diagramm 8.
- Wechsel-Bilanz: „Durch Wechseln gespart seit …" gegenüber dem Referenztarif.
- Backup: JSON-Export und -Import (versioniert, mit zod validiert, Fotos optional, Zusammenführen oder Ersetzen); CSV-Export und -Import der Ablesungen im Excel-DE-Format (`;` und Dezimalkomma) für Altdaten; Backup-Erinnerung alle 30 Tage; `navigator.storage.persist()`. Hinweis in der App: Safari kann Website-Daten bei längerer Nichtnutzung löschen – die App auf den Home-Bildschirm legen und regelmäßig sichern.
- Fotos clientseitig komprimieren (max. ~1600 px), Galerie je Ablesung.
- Jahresbericht als Druckansicht (Print-CSS → „Als PDF sichern").
- ✅ Fertig, wenn Testfall J grün ist und ein Backup auf einem zweiten Gerät alles wiederherstellt.

**Phase 5 – Optional, nur nach Rücksprache**

- Geräte-Sync (z. B. self-hosted PocketBase) über einen `SyncAdapter`.
- OCR für Zählerfotos (experimentell), HT/NT-Tarife, weitere Zähler (Wasser, Wärmepumpe, Wallbox), Smart-Meter-CSV-Import, CO₂-Bilanz mit einstellbaren Faktoren, Budget-Ziele.

---

## 9. Pflicht-Testfälle (Vitest, `src/domain/__tests__`)

| # | Eingabe | Erwartung |
|---|---|---|
| A | Strom: 01.01.2026 = 10.000 kWh, 22.01.2026 = 10.210 kWh; AP 30,00 ct bis 14.01., ab 15.01. 25,00 ct; GP 120 €/Jahr | 21 Tage, 10,0 kWh/Tag; Arbeit 14 × 10 × 0,30 + 7 × 10 × 0,25 = 59,50 €; GP 120 × 21 ÷ 365 = 6,90 €; gesamt **66,40 €** |
| B | Gas: 01.10.2026 = 5.000,000 m³, 22.10.2026 = 5.100,000 m³; z 0,9500, Hs 11,000; AP 10,00 ct; GP 150 €/Jahr | **1.045 kWh**; Arbeit 104,50 €; GP 8,63 €; gesamt **113,13 €**; 1,045 €/m³ ⇔ 10,00 ct/kWh |
| C | Gas-Prognose: Verbrauch 01.–31.10.2026 = 1.000 kWh | b = 0: Anteil 80 ‰ → **12.500 kWh/Jahr**; b = 0,15: Anteil 0,08074 → **≈ 12.385 kWh/Jahr**; Teilzeitraum 01.–15.11. (b = 0) = 60 ‰ |
| D | 3.500 kWh × 28,00 ct + GP 150 €; Boni 150 € + 50 € | 1.130,00 € ohne Bonus; Jahr 1 **930,00 €** → **26,57 ct/kWh**; Folgejahr **32,29 ct/kWh** |
| E | Laufzeitende 31.12.2026 | Frist 1 Monat → Deadline **30.11.2026**; 6 Wochen → **19.11.2026**; 2 Wochen → **17.12.2026** |
| F | 12 Abschläge à 95 € (1.140 €), Prognosekosten 1.130 €, 150 € Bonus wird verrechnet | Saldo **−160 € (Guthaben)**; nach 6 gezahlten Abschlägen empfohlen (1.130 − 150 − 570) ÷ 6 = **68,33 €** |
| G | Alter Zähler 01.03. = 12.300, 10.03. = 12.345 (Ausbau); neuer Zähler 10.03. = 0 (Einbau), 31.03. = 150; Überlauf mit Modulus 100.000: 99.950 → 30 | 5,0 kWh/Tag (9 Tage), ≈ 7,14 kWh/Tag (21 Tage), März gesamt 195 kWh ohne Sprung; Überlauf Δ = **80** |
| H | Lieferbeginn 15.12.2025, Lieferende 30.11.2026, Bonus erfordert 12 Monate · zweiter Fall: Lieferbeginn 01.12.2025 | Fall 1: **Warnung** „11 Monate und 16 Tage", nötiges Lieferende ≥ **14.12.2026**; Fall 2: **OK** (genau 12 Monate) |
| I | Eingaben „12.345,678" · „12345,678" · „5.100,5" · „1.234" (Strom, 0 Nachkommastellen) · Stand kleiner als vorher · Tagesrate 3× Median | 12345,678 · 12345,678 · 5100,5 · 1234 · **Fehler** · **Warnung** |
| J | 3.500 kWh; Angebot X: 30,00 ct, 120 €/Jahr, 100 € Bonus; Angebot Y: 27,00 ct, 200 €/Jahr, kein Bonus | X: Jahr 1 **1.070 €**, Folgejahr **1.170 €**; Y: **1.145 €** / **1.145 €**; Break-even Folgejahr **2.666,67 kWh** (darüber ist Y günstiger) |

---

## 10. Projektstruktur

```
src/
  app/          Router, Layout, Provider, Theme
  domain/       reine TS-Logik ohne React/Dexie + __tests__/
                parse · intervals · gas · distribution · costs · forecast
                deadlines · bonus · installments · offers · plausibility · ics · csv
  data/         db.ts (Dexie) · repositories/ · backup/ · demo/
  features/     overview · capture · history · analytics · contracts · switch · offers · settings · onboarding
  components/   ui/ (shadcn) · charts/ · common/
  lib/          format.ts (Intl de-DE) · utils.ts
tests/e2e/      Playwright
docs/           MASTER_PROMPT.md · ROADMAP.md · DOMAIN.md · DECISIONS.md
```

---

## 11. Qualität und Sicherheit

- TypeScript strict, kein `any`; `src/domain` mit ≥ 90 % Testabdeckung.
- Vor jedem Commit grün: `npm run lint && npm run typecheck && npm test && npm run build`.
- E2E-Smoke-Test (Playwright, iPhone-Viewport): Onboarding → Ablesung erfassen → Übersicht zeigt den Wert.
- Lighthouse mobil: Performance, Accessibility, Best Practices ≥ 90; installierbar.
- Performance: Tagesreihen memoisieren und cachen – auch 5 Jahre Daten bleiben flüssig.
- Error Boundary statt weißer Seite; Backup-Import nur nach zod-Validierung; kein `dangerouslySetInnerHTML`.
- Restriktive Content-Security-Policy per `<meta>` (`connect-src` nur `'self'` und Open-Meteo); prüfen, dass die Diagramme damit funktionieren.

---

## 12. Arbeitsweise

- Entscheide innerhalb dieser Spezifikation selbst und halte Entscheidungen kurz in `docs/DECISIONS.md` fest. Frag nur, wenn etwas den Funktionsumfang ändert oder dich blockiert.
- Erst die Fachlogik als getestete Funktion, dann die UI.
- Nichts aus späteren Phasen vorziehen; neue Ideen in `docs/ROADMAP.md` unter „Später" notieren.
- Kleine Commits mit Conventional Commits (`feat:`, `fix:`, `test:` …).
- Am Ende jeder Phase: Kurzbericht und auf mein „weiter" warten.

---

## 13. Nicht-Ziele (vorerst)

- Kein Login, kein eigenes Backend, keine Cloud (bis Phase 5).
- Kein Scraping von Vergleichsportalen (AGB-widrig, fragil) – Angebote werden manuell erfasst.
- Keine Store-Apps; die PWA ist die App.
- Keine Rechtsberatung – rechtliche Hinweise nur als Info mit Quelle.

---

**Jetzt los: Lies alles, lege die Dateien aus Abschnitt 0 an und starte mit Phase 0.**
