import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { createContract } from '@/data/repositories/contracts';
import { createMeter } from '@/data/repositories/meters';
import { addOffer, listOffers } from '@/data/repositories/offers';
import { getSettings, updateSettings } from '@/data/repositories/settings';
import { addDays, todayISO } from '@/domain/dates';
import { renderRoute } from '@/test/renderRoute';

const today = todayISO();

async function meter() {
  return createMeter({
    energyType: 'electricity',
    name: 'Stromzähler',
    unit: 'kWh',
    decimals: 1,
    activeFrom: addDays(today, -30),
  });
}

const offerX = {
  energyType: 'electricity' as const,
  provider: 'Angebot X',
  tariffName: 'Klar',
  energyPriceCt: 30,
  basePriceEurPerYear: 120,
  bonuses: [{ kind: 'new_customer' as const, amountEur: 100, requiresDeliveryMonths: 12 }],
  capturedAt: today,
};
const offerY = {
  ...offerX,
  provider: 'Angebot Y',
  energyPriceCt: 27,
  basePriceEurPerYear: 200,
  bonuses: [],
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Angebote', () => {
  it('zeigt einen Leerzustand je Energieart', async () => {
    await meter();
    renderRoute('/angebote');
    expect(await screen.findByText('Noch keine Stromangebote')).toBeInTheDocument();
  });

  it('erfasst ein Angebot über das Formular', async () => {
    const user = userEvent.setup();
    await meter();
    renderRoute('/angebote');
    const [open] = await screen.findAllByRole('button', { name: 'Angebot erfassen' });
    if (!open) throw new Error('Button fehlt');
    await user.click(open);
    const dialog = await screen.findByRole('dialog', { name: 'Angebot erfassen' });
    await user.type(within(dialog).getByLabelText('Anbieter'), 'Angebot X');
    await user.type(within(dialog).getByLabelText('Tarif'), 'Klar');
    await user.type(within(dialog).getByLabelText('Arbeitspreis'), '30');
    await user.type(within(dialog).getByLabelText('Grundpreis'), '10');
    await user.selectOptions(within(dialog).getByLabelText('pro'), 'month');
    await user.type(within(dialog).getByLabelText('Neukundenbonus (€)'), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Angebot speichern' }));
    await waitFor(async () => {
      expect(await listOffers()).toEqual([
        expect.objectContaining({
          provider: 'Angebot X',
          energyPriceCt: 30,
          basePriceEurPerYear: 120,
          bonuses: [{ kind: 'new_customer', amountEur: 100, requiresDeliveryMonths: 12 }],
          priceGuaranteeMonths: 12,
        }),
      ]);
    });
  });

  it('rechnet Testfall J: Ranking, Folgejahr und Break-even', async () => {
    const user = userEvent.setup();
    await meter();
    await addOffer(offerY);
    await addOffer(offerX);
    renderRoute('/angebote');
    const kwh = await screen.findByLabelText('Verbrauch pro Jahr (kWh)');
    await user.clear(kwh);
    await user.type(kwh, '3500');
    const list = screen.getByRole('list', { name: 'Stromangebote nach Jahr 1' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('1. Angebot X');
    expect(first).toHaveTextContent(/Jahr 1\s?1\.070,00\s€/);
    expect(first).toHaveTextContent(/Folgejahr\s?1\.170,00\s€/);
    expect(second).toHaveTextContent(/1\.145,00\s€/);
    expect(screen.getByText(/ab 2\.667\skWh pro Jahr ist/)).toHaveTextContent('Angebot Y');
  });

  it('warnt, wenn man beim Anbieter in den letzten 12 Monaten Kunde war, und vergleicht mit der Grundversorgung', async () => {
    const m = await meter();
    await createContract({
      contract: {
        energyType: 'electricity',
        meterId: m.id,
        provider: 'Angebot X',
        tariffName: 'Alt',
        deliveryStart: addDays(today, -30),
        termStartsAt: 'delivery',
        noticePeriod: { value: 1, unit: 'months' },
        renewal: { type: 'monthly' },
        installmentPlan: [],
        status: 'active',
      },
      price: { validFrom: addDays(today, -30), energyPriceCt: 35, basePriceEurPerYear: 150 },
      bonuses: [],
    });
    await updateSettings({
      referenceTariffs: [
        {
          energyType: 'electricity',
          label: 'Grundversorgung',
          energyPriceCt: 40,
          basePriceEurPerYear: 160,
        },
      ],
    });
    await addOffer(offerX);
    renderRoute('/angebote');
    const user = userEvent.setup();
    const kwh = await screen.findByLabelText('Verbrauch pro Jahr (kWh)');
    await user.clear(kwh);
    await user.type(kwh, '3500');
    const card = within(screen.getByRole('list', { name: 'Stromangebote nach Jahr 1' })).getByRole(
      'listitem',
    );
    expect(card).toHaveTextContent(/Neukundenbonus ist fraglich/);
    // aktuell 3.500 × 0,35 + 150 = 1.375 € → 305 € günstiger; Grundversorgung 1.560 € → 490 €
    expect(card).toHaveTextContent(/305,00\s€ günstiger als dein Vertrag/);
    expect(card).toHaveTextContent(/490,00\s€ günstiger als Grundversorgung/);
  });

  it('übernimmt ein Angebot in den Vertrags-Assistenten', async () => {
    const user = userEvent.setup();
    await meter();
    await addOffer(offerX);
    renderRoute('/angebote');
    await user.type(await screen.findByLabelText('Verbrauch pro Jahr (kWh)'), '3500');
    await user.click(await screen.findByRole('button', { name: 'Als neuen Vertrag anlegen' }));
    const wizard = await screen.findByRole('dialog', { name: 'Neuer Vertrag' });
    expect(within(wizard).getByLabelText('Anbieter')).toHaveValue('Angebot X');
    expect(within(wizard).getByLabelText('Tarif')).toHaveValue('Klar');
  });
});

describe('Referenztarife', () => {
  it('speichert die Grundversorgung je Energieart', async () => {
    const user = userEvent.setup();
    renderRoute('/mehr');
    const form = await screen.findByRole('form', { name: 'Referenztarife' });
    await user.type(within(form).getByLabelText('Arbeitspreis Strom (ct/kWh)'), '40,5');
    await user.type(within(form).getByLabelText('Grundpreis Strom (€/Jahr)'), '160');
    await user.click(within(form).getByRole('button', { name: 'Referenztarife speichern' }));
    await waitFor(async () => {
      expect((await getSettings()).referenceTariffs).toEqual([
        {
          energyType: 'electricity',
          label: 'Grundversorgung',
          energyPriceCt: 40.5,
          basePriceEurPerYear: 160,
        },
      ]);
    });
  });
});
