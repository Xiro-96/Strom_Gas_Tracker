import {
  installmentTransactions,
  balance,
  installmentDueDates,
  paidUntil,
  recommendedInstallment,
} from '@/domain/installments';

const plan = [{ validFrom: '2026-01-15', amountEur: 95, dayOfMonth: 15 }];

describe('Abschläge – Testfall F', () => {
  const due = installmentDueDates(plan, '2026-01-01', '2026-12-31');

  it('12 Abschläge à 95 € = 1.140 €', () => {
    expect(due).toHaveLength(12);
    expect(due.reduce((s, d) => s + d.amountEur, 0)).toBe(1140);
  });

  it('Saldo −160 € (Guthaben) bei 1.130 € Prognose und 150 € verrechnetem Bonus', () => {
    expect(balance({ costEur: 1130, offsetBonusEur: 150, installmentsEur: 1140 })).toBeCloseTo(
      -160,
      9,
    );
  });

  it('nach 6 gezahlten Abschlägen: (1.130 − 150 − 570) ÷ 6 = 68,33 €', () => {
    const paid = paidUntil(plan, [], '2026-06-30');
    expect(paid).toBe(570);
    expect(
      recommendedInstallment({
        costEur: 1130,
        offsetBonusEur: 150,
        paidEur: paid,
        remaining: 6,
      }).toFixed(2),
    ).toBe('68.33');
  });
});

describe('Abschlagsplan', () => {
  it('nimmt Änderungen ab ihrem Datum und kürzt den 31. auf das Monatsende', () => {
    const due = installmentDueDates(
      [
        { validFrom: '2026-01-31', amountEur: 100, dayOfMonth: 31 },
        { validFrom: '2026-03-01', amountEur: 80, dayOfMonth: 31 },
      ],
      '2026-01-01',
      '2026-04-30',
    );
    expect(due).toEqual([
      { date: '2026-01-31', amountEur: 100 },
      { date: '2026-02-28', amountEur: 100 },
      { date: '2026-03-31', amountEur: 80 },
      { date: '2026-04-30', amountEur: 80 },
    ]);
  });

  it('rechnet Abweichungen als Transaktionen dazu (Sonderzahlung, Rückzahlung)', () => {
    const tx = [
      { date: '2026-02-01', amountEur: 50 },
      { date: '2026-03-01', amountEur: -20 },
      { date: '2026-12-01', amountEur: 999 },
    ];
    expect(paidUntil(plan, tx, '2026-03-31')).toBe(95 * 3 + 50 - 20);
  });

  it('ohne verbleibende Abschläge gibt es keine Empfehlung', () => {
    expect(
      recommendedInstallment({ costEur: 100, offsetBonusEur: 0, paidEur: 0, remaining: 0 }),
    ).toBeNaN();
  });
});

describe('Transaktionen im Abschlags-Check', () => {
  it('zählt nur Abweichungen der Abschläge, keine Bonus-Auszahlungen oder Erstattungen', () => {
    const tx = [
      { date: '2026-03-15', amountEur: -100, kind: 'installment' as const },
      { date: '2026-04-15', amountEur: 20, kind: 'other' as const },
      { date: '2026-04-20', amountEur: -160, kind: 'bonus_payout' as const },
      { date: '2027-02-01', amountEur: -80, kind: 'refund' as const },
      { date: '2027-02-01', amountEur: 30, kind: 'bill_balance' as const },
    ];
    expect(installmentTransactions(tx).map((t) => t.amountEur)).toEqual([-100, 20]);
  });
});
