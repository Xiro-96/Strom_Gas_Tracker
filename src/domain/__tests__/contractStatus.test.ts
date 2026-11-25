import { contractStatus, priceChangeNotice } from '@/domain/contractStatus';

const base = { deliveryStart: '2026-01-01', status: 'active' as const };

describe('Vertragsstatus', () => {
  it('leitet den Status aus Lieferzeitraum und Kündigung ab', () => {
    expect(contractStatus(base, '2026-06-01')).toBe('active');
    expect(contractStatus(base, '2025-12-31')).toBe('planned');
    expect(contractStatus({ ...base, cancellation: { sentAt: '2026-11-25' } }, '2026-11-25')).toBe(
      'cancelled',
    );
    expect(contractStatus({ ...base, deliveryEnd: '2026-12-31' }, '2027-01-01')).toBe('ended');
    expect(contractStatus({ ...base, deliveryEnd: '2026-12-31' }, '2026-12-31')).toBe('active');
  });
});

describe('Preisänderung – Sonderkündigung (Spec 4.4)', () => {
  it('nennt die Deadline am Tag vor dem Wirksamwerden', () => {
    expect(priceChangeNotice({ validFrom: '2027-03-01' }, '2027-01-10')).toEqual({
      effectiveFrom: '2027-03-01',
      deadline: '2027-02-28',
      lateNotice: false,
      open: true,
    });
  });

  it('markiert eine Mitteilung, die weniger als 1 Monat vorher kam', () => {
    const notice = priceChangeNotice(
      { validFrom: '2027-03-01', changeNoticeReceivedAt: '2027-02-05' },
      '2027-02-05',
    );
    expect(notice.lateNotice).toBe(true);
    expect(
      priceChangeNotice(
        { validFrom: '2027-03-01', changeNoticeReceivedAt: '2027-02-01' },
        '2027-02-01',
      ).lateNotice,
    ).toBe(false);
  });

  it('ist nach dem Wirksamwerden nicht mehr offen', () => {
    expect(priceChangeNotice({ validFrom: '2027-03-01' }, '2027-03-01').open).toBe(false);
  });
});
