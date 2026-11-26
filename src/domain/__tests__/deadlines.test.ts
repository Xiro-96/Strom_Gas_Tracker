import {
  cancellationDeadline,
  collectDeadlines,
  deadlineState,
  earliestDeliveryEnd,
  nextTermEnd,
  termEnd,
  type DeadlineInput,
} from '@/domain/deadlines';
import type { Bill, Bonus, Contract, Meter, PricePeriod, Reading } from '@/domain/types';

const base = { createdAt: '', updatedAt: '' };

const contract = (overrides: Partial<Contract> = {}): Contract => ({
  ...base,
  id: 'c1',
  energyType: 'electricity',
  meterId: 'm1',
  provider: 'Blitzwerk',
  tariffName: 'Öko 12',
  deliveryStart: '2026-01-01',
  minTermMonths: 12,
  termStartsAt: 'delivery',
  noticePeriod: { value: 1, unit: 'months' },
  renewal: { type: 'monthly' },
  installmentPlan: [{ validFrom: '2026-01-01', amountEur: 80, dayOfMonth: 15 }],
  status: 'active',
  ...overrides,
});

describe('Kündigungs-Deadline – Testfall E', () => {
  it('rechnet (Laufzeitende + 1 Tag − Frist) − 1 Tag', () => {
    expect(cancellationDeadline('2026-12-31', { value: 1, unit: 'months' })).toBe('2026-11-30');
    expect(cancellationDeadline('2026-12-31', { value: 6, unit: 'weeks' })).toBe('2026-11-19');
    expect(cancellationDeadline('2026-12-31', { value: 2, unit: 'weeks' })).toBe('2026-12-17');
    expect(cancellationDeadline('2026-12-31', { value: 14, unit: 'days' })).toBe('2026-12-17');
  });

  it('bleibt an Monatsenden korrekt', () => {
    expect(cancellationDeadline('2027-02-28', { value: 1, unit: 'months' })).toBe('2027-01-31');
    expect(cancellationDeadline('2027-04-30', { value: 1, unit: 'months' })).toBe('2027-03-31');
  });
});

describe('Laufzeit', () => {
  it('Ende Erstlaufzeit ab Lieferbeginn oder Vertragsschluss', () => {
    expect(termEnd(contract())).toBe('2026-12-31');
    expect(termEnd(contract({ termStartsAt: 'contract', contractDate: '2025-10-14' }))).toBe(
      '2026-10-13',
    );
    expect(termEnd(contract({ minTermMonths: undefined }))).toBeUndefined();
  });

  it('nächstes festes Laufzeitende, dessen Frist noch nicht verstrichen ist', () => {
    expect(nextTermEnd(contract(), '2026-11-26')).toBe('2026-12-31');
    // monatlich kündbar nach der Erstlaufzeit: kein festes Ende mehr
    expect(nextTermEnd(contract(), '2026-12-05')).toBeUndefined();
    const fixed = contract({ renewal: { type: 'fixed', months: 12 } });
    expect(nextTermEnd(fixed, '2026-12-05')).toBe('2027-12-31');
  });

  it('frühestmögliches Lieferende bei Kündigung heute', () => {
    expect(earliestDeliveryEnd(contract(), '2026-11-26')).toBe('2026-12-31');
    const older = contract({ deliveryStart: '2025-01-01' });
    expect(earliestDeliveryEnd(older, '2026-11-26')).toBe('2026-12-26');
    // Monatsende: Kündigung am 30.01. mit 1 Monat Frist
    expect(earliestDeliveryEnd(older, '2027-01-30')).toBe('2027-02-28');
    expect(cancellationDeadline('2027-02-28', { value: 1, unit: 'months' }) >= '2027-01-30').toBe(
      true,
    );
    expect(
      earliestDeliveryEnd(
        contract({ minTermMonths: undefined, noticePeriod: { value: 2, unit: 'weeks' } }),
        '2026-11-26',
      ),
    ).toBe('2026-12-10');
    expect(
      earliestDeliveryEnd(
        contract({ minTermMonths: undefined, renewal: { type: 'fixed', months: 12 } }),
        '2026-11-26',
      ),
    ).toBeUndefined();
  });
});

const meter: Meter = {
  ...base,
  id: 'm1',
  energyType: 'electricity',
  name: 'Strom',
  unit: 'kWh',
  decimals: 1,
  activeFrom: '2025-01-01',
};
const reading = (date: string, value: number): Reading => ({
  ...base,
  id: `r-${date}`,
  meterId: 'm1',
  date,
  value,
  kind: 'regular',
});
const bonus = (overrides: Partial<Bonus>): Bonus => ({
  ...base,
  id: 'b1',
  contractId: 'c1',
  kind: 'instant',
  amountEur: 50,
  condition: '',
  settlement: 'payout',
  status: 'promised',
  ...overrides,
});

const input = (overrides: Partial<DeadlineInput> = {}): DeadlineInput => ({
  contracts: [contract()],
  pricePeriods: [] as PricePeriod[],
  bonuses: [] as Bonus[],
  bills: [] as Bill[],
  readings: [reading('2026-11-12', 1000)],
  meters: [meter],
  settings: { cancellationBufferDays: 7, readingIntervalDays: 14 },
  today: '2026-11-26',
  ...overrides,
});

const byKind = (list: ReturnType<typeof collectDeadlines>, kind: string) =>
  list.filter((d) => d.kind === kind);

describe('collectDeadlines – Spec 6.6', () => {
  it('Kündigungsfrist mit Empfehlung (Deadline − Puffer) und nächste Ablesung', () => {
    const list = collectDeadlines(input());
    expect(byKind(list, 'cancellation')).toEqual([
      expect.objectContaining({
        date: '2026-11-30',
        recommendedDate: '2026-11-23',
        energyType: 'electricity',
        contractId: 'c1',
        done: false,
      }),
    ]);
    expect(byKind(list, 'next_reading')[0]?.date).toBe('2026-11-26');
    expect(list.map((d) => d.date)).toEqual([...list.map((d) => d.date)].sort());
  });

  it('nach der Kündigung: keine Frist mehr, aber Wechseltag-Ablesung und Schlussrechnung', () => {
    const cancelled = contract({
      deliveryEnd: '2026-12-31',
      cancellation: { sentAt: '2026-11-25' },
      status: 'cancelled',
    });
    const list = collectDeadlines(input({ contracts: [cancelled] }));
    expect(byKind(list, 'cancellation')).toEqual([]);
    expect(byKind(list, 'switch_reading')[0]).toMatchObject({ date: '2027-01-01', done: false });
    expect(byKind(list, 'final_bill_due')[0]).toMatchObject({ date: '2027-02-11', done: false });
  });

  it('geplantes Lieferende ohne Kündigung: Frist für genau dieses Ende', () => {
    const planned = contract({ deliveryEnd: '2026-12-31' });
    expect(byKind(collectDeadlines(input({ contracts: [planned] })), 'cancellation')[0]?.date).toBe(
      '2026-11-30',
    );
  });

  it('monatlich kündbar nach der Erstlaufzeit: keine wandernde Frist', () => {
    const old = contract({ deliveryStart: '2025-01-01' });
    expect(byKind(collectDeadlines(input({ contracts: [old] })), 'cancellation')).toEqual([]);
  });

  it('ohne Laufzeitangaben keine Kündigungsfrist und kein Fehler', () => {
    const loose = contract({ minTermMonths: undefined, renewal: { type: 'fixed', months: 12 } });
    expect(byKind(collectDeadlines(input({ contracts: [loose] })), 'cancellation')).toEqual([]);
  });

  it('Boni: Sofortbonus nach 3 Monaten prüfen, erhalten = erledigt; Neukundenbonus mit der Schlussrechnung', () => {
    const ended = contract({ deliveryEnd: '2026-12-31', cancellation: { sentAt: '2026-11-25' } });
    const list = collectDeadlines(
      input({
        contracts: [ended],
        bonuses: [
          bonus({ id: 'b1', kind: 'instant', status: 'received', receivedAt: '2026-02-03' }),
          bonus({
            id: 'b2',
            kind: 'new_customer',
            settlement: 'offset_in_bill',
            requiresDeliveryMonths: 12,
          }),
        ],
      }),
    );
    expect(byKind(list, 'instant_bonus_check')[0]).toMatchObject({
      date: '2026-04-01',
      done: true,
    });
    expect(byKind(list, 'new_customer_bonus_check')[0]).toMatchObject({
      date: '2027-02-11',
      done: false,
    });
  });

  it('Guthaben aus der Rechnung binnen 2 Wochen; Schlussrechnung erhalten = erledigt', () => {
    const ended = contract({ deliveryEnd: '2026-12-31', cancellation: { sentAt: '2026-11-25' } });
    const bill: Bill = {
      ...base,
      id: 'bill1',
      contractId: 'c1',
      kind: 'final',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      issuedAt: '2027-01-20',
      balanceEur: -120,
    };
    const list = collectDeadlines(
      input({ contracts: [ended], bills: [bill], today: '2027-01-25' }),
    );
    expect(byKind(list, 'final_bill_due')[0]?.done).toBe(true);
    expect(byKind(list, 'credit_due')[0]).toMatchObject({ date: '2027-02-03', done: false });
    const settled = collectDeadlines(
      input({ contracts: [ended], bills: [{ ...bill, balanceSettledAt: '2027-02-01' }] }),
    );
    expect(byKind(settled, 'credit_due')[0]?.done).toBe(true);
  });

  it('Sonderkündigung am Tag vor einer Preisänderung, Preisgarantie-Ende', () => {
    const periods: PricePeriod[] = [
      {
        ...base,
        id: 'p1',
        contractId: 'c1',
        validFrom: '2026-01-01',
        energyPriceCt: 30,
        basePriceEurPerYear: 150,
      },
      {
        ...base,
        id: 'p2',
        contractId: 'c1',
        validFrom: '2027-01-01',
        energyPriceCt: 34,
        basePriceEurPerYear: 160,
      },
    ];
    const list = collectDeadlines(
      input({
        contracts: [contract({ priceGuarantee: { until: '2026-12-31', scope: 'limited' } })],
        pricePeriods: periods,
      }),
    );
    expect(byKind(list, 'special_cancellation')).toEqual([
      expect.objectContaining({ date: '2026-12-31' }),
    ]);
    expect(byKind(list, 'price_guarantee_end')[0]?.date).toBe('2026-12-31');
  });

  it('Wechseltag-Ablesung ist erledigt, wenn am Wechseltag (±1 Tag) abgelesen wurde', () => {
    const ended = contract({ deliveryEnd: '2026-12-31', cancellation: { sentAt: '2026-11-25' } });
    const list = collectDeadlines(
      input({ contracts: [ended], readings: [reading('2026-12-31', 1500)], today: '2027-01-02' }),
    );
    expect(byKind(list, 'switch_reading')[0]?.done).toBe(true);
  });
});

describe('deadlineState', () => {
  const d = (kind: 'cancellation' | 'final_bill_due', date: string, done = false) => ({
    id: 'x',
    kind,
    date,
    title: '',
    detail: '',
    energyType: 'electricity' as const,
    done,
  });

  it('unterscheidet erledigt, überfällig, abgelaufen, bald und später', () => {
    expect(deadlineState(d('final_bill_due', '2026-11-20', true), '2026-11-26')).toBe('done');
    expect(deadlineState(d('final_bill_due', '2026-11-20'), '2026-11-26')).toBe('overdue');
    expect(deadlineState(d('cancellation', '2026-11-20'), '2026-11-26')).toBe('expired');
    expect(deadlineState(d('cancellation', '2026-12-10'), '2026-11-26')).toBe('soon');
    expect(deadlineState(d('cancellation', '2026-12-11'), '2026-11-26')).toBe('later');
  });
});
