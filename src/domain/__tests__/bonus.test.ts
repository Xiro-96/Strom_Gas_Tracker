import {
  bonusExpectedDate,
  bonusSafety,
  deliveredDuration,
  effectiveBonusStatus,
  formatDuration,
  requiredDeliveryEnd,
} from '@/domain/bonus';

describe('Bonus-Sicherheitscheck – Testfall H', () => {
  it('Fall 1: Lieferbeginn 15.12.2025, Ende 30.11.2026 → Warnung „11 Monate und 16 Tage“, nötig ≥ 14.12.2026', () => {
    const result = bonusSafety('2025-12-15', '2026-11-30', 12);
    expect(result.ok).toBe(false);
    expect(result.requiredEnd).toBe('2026-12-14');
    expect(result.delivered && formatDuration(result.delivered)).toBe('11 Monate und 16 Tage');
  });

  it('Fall 2: Lieferbeginn 01.12.2025 → OK (genau 12 Monate)', () => {
    const result = bonusSafety('2025-12-01', '2026-11-30', 12);
    expect(result.ok).toBe(true);
    expect(result.requiredEnd).toBe('2026-11-30');
    expect(result.delivered && formatDuration(result.delivered)).toBe('12 Monate');
  });

  it('ohne geplantes Lieferende ist der Check offen', () => {
    expect(bonusSafety('2026-01-01', undefined, 12)).toMatchObject({
      ok: null,
      requiredEnd: '2026-12-31',
    });
  });
});

describe('Monatsenden (§ 188 BGB)', () => {
  it('31.01. + 1 Monat endet am letzten Februartag, sonst am Vortag des Monatstags', () => {
    expect(requiredDeliveryEnd('2026-01-31', 1)).toBe('2026-02-28');
    expect(requiredDeliveryEnd('2028-01-31', 1)).toBe('2028-02-29');
    expect(requiredDeliveryEnd('2026-01-15', 1)).toBe('2026-02-14');
    expect(requiredDeliveryEnd('2026-01-01', 12)).toBe('2026-12-31');
  });

  it('zählt gelieferte Monate und Resttage', () => {
    expect(deliveredDuration('2026-01-31', '2026-02-28')).toEqual({ months: 1, days: 0 });
    expect(deliveredDuration('2026-01-01', '2026-01-01')).toEqual({ months: 0, days: 1 });
    expect(formatDuration({ months: 1, days: 1 })).toBe('1 Monat und 1 Tag');
  });
});

describe('Bonus-Fälligkeit und Status', () => {
  it('Sofortbonus spätestens 3 Monate nach Lieferbeginn, Neukundenbonus nach 12 Monaten Belieferung', () => {
    expect(bonusExpectedDate({ kind: 'instant' }, '2026-01-01')).toBe('2026-04-01');
    expect(
      bonusExpectedDate({ kind: 'new_customer', requiresDeliveryMonths: 12 }, '2026-01-01'),
    ).toBe('2027-01-01');
    expect(
      bonusExpectedDate({ kind: 'new_customer', expectedDate: '2027-02-01' }, '2026-01-01'),
    ).toBe('2027-02-01');
  });

  it('ein zugesagter Bonus wird ab dem Fälligkeitstag „fällig“', () => {
    const bonus = { kind: 'instant' as const, status: 'promised' as const };
    expect(effectiveBonusStatus(bonus, '2026-01-01', '2026-03-31')).toBe('promised');
    expect(effectiveBonusStatus(bonus, '2026-01-01', '2026-04-01')).toBe('due');
    expect(
      effectiveBonusStatus({ ...bonus, status: 'received' as const }, '2026-01-01', '2027-01-01'),
    ).toBe('received');
  });
});

describe('Bonus – Randfälle', () => {
  it('formatiert Einzahl und leere Dauer', () => {
    expect(formatDuration({ months: 1, days: 1 })).toBe('1 Monat und 1 Tag');
    expect(formatDuration({ months: 0, days: 0 })).toBe('0 Tage');
  });

  it('nimmt ein vereinbartes Fälligkeitsdatum und rechnet Mindestbelieferung ohne Angabe mit 12 Monaten', () => {
    expect(bonusExpectedDate({ kind: 'loyalty', expectedDate: '2026-05-01' }, '2026-01-01')).toBe(
      '2026-05-01',
    );
    expect(bonusExpectedDate({ kind: 'new_customer' }, '2026-01-01')).toBe('2027-01-01');
  });
});
