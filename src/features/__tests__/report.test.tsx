import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { createContract } from '@/data/repositories/contracts';
import { createMeter } from '@/data/repositories/meters';
import { addReading } from '@/data/repositories/readings';
import { updateSettings } from '@/data/repositories/settings';
import { renderRoute } from '@/test/renderRoute';

async function year2025() {
  const meter = await createMeter({
    energyType: 'electricity',
    name: 'Stromzähler',
    unit: 'kWh',
    decimals: 1,
    activeFrom: '2025-01-01',
  });
  await addReading({ meterId: meter.id, date: '2025-01-01', value: 1000, kind: 'regular' });
  await addReading({ meterId: meter.id, date: '2026-01-01', value: 4650, kind: 'regular' });
  await createContract({
    contract: {
      energyType: 'electricity',
      meterId: meter.id,
      provider: 'Blitzwerk',
      tariffName: 'Öko 12',
      deliveryStart: '2025-01-01',
      deliveryEnd: '2025-12-31',
      termStartsAt: 'delivery',
      noticePeriod: { value: 1, unit: 'months' },
      renewal: { type: 'monthly' },
      installmentPlan: [{ validFrom: '2025-01-01', amountEur: 120, dayOfMonth: 15 }],
      status: 'ended',
    },
    price: { validFrom: '2025-01-01', energyPriceCt: 30, basePriceEurPerYear: 365 },
    bonuses: [
      {
        kind: 'new_customer',
        amountEur: 100,
        condition: '',
        settlement: 'offset_in_bill',
        requiresDeliveryMonths: 12,
        status: 'offset',
        receivedAt: '2025-12-31',
      },
    ],
  });
  await updateSettings({
    referenceTariffs: [
      {
        energyType: 'electricity',
        label: 'Grundversorgung',
        energyPriceCt: 40,
        basePriceEurPerYear: 365,
      },
    ],
  });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Wechsel-Bilanz in der Übersicht', () => {
  it('zeigt die Ersparnis gegenüber der Grundversorgung', async () => {
    await year2025();
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Durch Wechseln gespart' });
    // 3.650 kWh: Referenz 1.460 + 365, tatsächlich 1.095 + 365 − 100 Bonus → 465 €
    expect(card).toHaveTextContent(/465,00\s€ gespart/);
    expect(card).toHaveTextContent('seit 01.01.2025');
  });
});

describe('Jahresbericht', () => {
  it('fasst ein Jahr zusammen und druckt im hellen Design', async () => {
    const user = userEvent.setup();
    await year2025();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    document.documentElement.classList.add('dark');
    renderRoute('/bericht');
    expect(
      await screen.findByRole('heading', { name: 'Jahresbericht 2025', level: 1 }),
    ).toBeInTheDocument();
    const strom = screen.getByRole('region', { name: 'Strom' });
    expect(strom).toHaveTextContent(/Verbrauch\s?3\.650\skWh/);
    expect(strom).toHaveTextContent(/Kosten gesamt\s?1\.360,00\s€/);
    expect(strom).toHaveTextContent(/465,00\s€ gespart/);
    expect(
      within(strom).getByRole('table', { name: 'Monatswerte Strom 2025' }),
    ).toBeInTheDocument();
    expect(within(strom).getByRole('list', { name: 'Verträge Strom 2025' })).toHaveTextContent(
      'Blitzwerk (Öko 12): 01.01.2025 – 31.12.2025',
    );
    await user.click(screen.getByRole('button', { name: 'Drucken / PDF' }));
    expect(print).toHaveBeenCalled();
    expect(document.documentElement).not.toHaveClass('dark');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.documentElement).toHaveClass('dark');
    print.mockRestore();
  });

  it('ohne Daten ein Leerzustand', async () => {
    renderRoute('/bericht');
    expect(await screen.findByText('Noch keine Verbrauchsdaten')).toBeInTheDocument();
  });
});
