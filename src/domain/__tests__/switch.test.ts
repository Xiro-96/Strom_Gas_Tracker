import {
  cancellationLetter,
  meterReadingMessage,
  SWITCH_STEPS,
  suggestedDeliveryEnd,
  switchProgress,
} from '@/domain/switch';
import type { Bill, Bonus, Contract, Meter } from '@/domain/types';

const base = { createdAt: '2025-10-14T10:00:00.000Z', updatedAt: '' };

const contract = (overrides: Partial<Contract> = {}): Contract => ({
  ...base,
  id: 'c1',
  energyType: 'electricity',
  meterId: 'm1',
  provider: 'Blitzwerk',
  tariffName: 'Öko 12',
  customerNumber: 'K-1000-7',
  deliveryStart: '2026-01-01',
  minTermMonths: 12,
  termStartsAt: 'delivery',
  noticePeriod: { value: 1, unit: 'months' },
  renewal: { type: 'monthly' },
  installmentPlan: [{ validFrom: '2026-01-01', amountEur: 80, dayOfMonth: 15 }],
  status: 'active',
  ...overrides,
});

const meter: Meter = {
  ...base,
  id: 'm1',
  energyType: 'electricity',
  name: 'Strom',
  unit: 'kWh',
  decimals: 1,
  meterNumber: '1ABC0012345',
  maloId: '50000000001',
  activeFrom: '2025-01-01',
};

const newCustomer = (overrides: Partial<Bonus> = {}): Bonus => ({
  ...base,
  id: 'b1',
  contractId: 'c1',
  kind: 'new_customer',
  amountEur: 100,
  condition: '',
  settlement: 'offset_in_bill',
  requiresDeliveryMonths: 12,
  status: 'promised',
  ...overrides,
});

describe('Lieferende-Vorschlag – Frist und Bonus gesichert', () => {
  it('nimmt das spätere Datum aus frühestem Lieferende und Bonus-Mindestbelieferung', () => {
    // Laufzeit ab Vertragsschluss 01.12.2025 → Ende 30.11.2026; Lieferung ab 15.12.2025
    const c = contract({
      termStartsAt: 'contract',
      contractDate: '2025-12-01',
      deliveryStart: '2025-12-15',
    });
    expect(suggestedDeliveryEnd(c, [newCustomer()], '2026-10-01')).toEqual({
      date: '2026-12-14',
      reason: 'bonus',
    });
    expect(suggestedDeliveryEnd(c, [], '2026-10-01')).toEqual({
      date: '2026-11-30',
      reason: 'term',
    });
  });

  it('ignoriert verfallene Boni', () => {
    expect(
      suggestedDeliveryEnd(
        contract(),
        [newCustomer({ status: 'forfeited', requiresDeliveryMonths: 24 })],
        '2026-11-01',
      ),
    ).toEqual({ date: '2026-12-31', reason: 'term' });
  });
});

describe('Kündigungsschreiben (Textform)', () => {
  it('enthält Kunden- und Zählernummer, konkretes Lieferende, hilfsweise und Bitte um Bestätigung', () => {
    const { subject, body } = cancellationLetter({
      contract: contract(),
      meter,
      endDate: '2026-12-31',
    });
    expect(subject).toBe('Kündigung Stromliefervertrag – Kundennummer K-1000-7');
    expect(body).toContain('Blitzwerk');
    expect(body).toContain('Kundennummer: K-1000-7');
    expect(body).toContain('Zählernummer: 1ABC0012345');
    expect(body).toContain('zum 31.12.2026, hilfsweise zum nächstmöglichen Termin');
    expect(body).toMatch(/Lieferende schriftlich/);
    expect(body).toContain('[Vor- und Nachname]');
  });

  it('setzt Platzhalter statt leerer Angaben', () => {
    const { subject, body } = cancellationLetter({
      contract: contract({ customerNumber: undefined, energyType: 'gas' }),
      meter: { ...meter, meterNumber: undefined },
      endDate: '2026-12-31',
    });
    expect(subject).toBe('Kündigung Gasliefervertrag – Kundennummer [Kundennummer]');
    expect(body).toContain('Zählernummer: [Zählernummer]');
    expect(body).not.toContain('undefined');
  });
});

describe('Zählerstandsmeldung', () => {
  it('enthält Datum, Stand im de-DE-Format, Zählernummer und MaLo-ID', () => {
    const { subject, body } = meterReadingMessage({
      meter,
      reading: { date: '2027-01-01', value: 12345.6 },
      customerNumber: 'K-1000-7',
    });
    expect(subject).toBe('Zählerstand Strom zum 01.01.2027');
    expect(body).toContain('Datum: 01.01.2027');
    expect(body).toMatch(/Zählerstand: 12\.345,6\skWh/);
    expect(body).toContain('Zählernummer: 1ABC0012345');
    expect(body).toContain('MaLo-ID: 50000000001');
    expect(body).toContain('Kundennummer: K-1000-7');
  });
});

describe('Wechsel-Checkliste', () => {
  it('hat die 9 Schritte aus der Spec in fester Reihenfolge', () => {
    expect(SWITCH_STEPS.map((s) => s.step)).toEqual([
      'offer_chosen',
      'cancelled',
      'confirmed',
      'new_contract',
      'switch_reading',
      'reported',
      'final_bill',
      'bonus_checked',
      'credit_received',
    ]);
  });

  it('erkennt Schritte aus den Daten und übernimmt manuelle Haken', () => {
    const old = contract({
      deliveryEnd: '2026-12-31',
      cancellation: { sentAt: '2026-11-25' },
      switchChecklist: { reported: '2027-01-02' },
    });
    const successor = contract({
      id: 'c2',
      provider: 'Neuwerk',
      deliveryStart: '2027-01-01',
      deliveryEnd: undefined,
    });
    const finalBill: Bill = {
      ...base,
      id: 'bill1',
      contractId: 'c1',
      kind: 'final',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      issuedAt: '2027-01-20',
      balanceEur: -50,
    };
    const progress = switchProgress({
      contract: old,
      successor,
      bonuses: [newCustomer({ status: 'offset' })],
      bills: [finalBill],
      readingDates: ['2026-12-31'],
    });
    const done = Object.fromEntries(progress.map((p) => [p.step, p.done]));
    expect(done).toEqual({
      offer_chosen: true,
      cancelled: true,
      confirmed: false,
      new_contract: true,
      switch_reading: true,
      reported: true,
      final_bill: true,
      bonus_checked: true,
      credit_received: false,
    });
    expect(progress.find((p) => p.step === 'reported')).toMatchObject({
      auto: false,
      date: '2027-01-02',
    });
    expect(progress.find((p) => p.step === 'cancelled')).toMatchObject({
      auto: true,
      date: '2026-11-25',
    });
  });

  it('Guthaben-Schritt ist erledigt bei Nachzahlung oder ausgezahltem Guthaben', () => {
    const old = contract({ deliveryEnd: '2026-12-31' });
    const bill = (balanceEur: number, balanceSettledAt?: string): Bill => ({
      ...base,
      id: 'bill1',
      contractId: 'c1',
      kind: 'final',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      balanceEur,
      ...(balanceSettledAt ? { balanceSettledAt } : {}),
    });
    const credit = (b: Bill) =>
      switchProgress({ contract: old, bonuses: [], bills: [b], readingDates: [] }).find(
        (p) => p.step === 'credit_received',
      )?.done;
    expect(credit(bill(30))).toBe(true);
    expect(credit(bill(-30))).toBe(false);
    expect(credit(bill(-30, '2027-02-01'))).toBe(true);
  });
});
