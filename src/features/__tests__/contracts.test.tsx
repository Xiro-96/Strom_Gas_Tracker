import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import {
  bonuses,
  createContract,
  listContracts,
  pricePeriods,
} from '@/data/repositories/contracts';
import { createMeter } from '@/data/repositories/meters';
import { addReading } from '@/data/repositories/readings';
import { addDays, todayISO } from '@/domain/dates';
import { renderRoute } from '@/test/renderRoute';

const today = todayISO();
const start = addDays(today, -40);

async function stromzaehler() {
  const meter = await createMeter({
    energyType: 'electricity',
    name: 'Stromzähler',
    unit: 'kWh',
    decimals: 1,
    activeFrom: start,
  });
  await addReading({ meterId: meter.id, date: start, value: 1000, kind: 'regular' });
  await addReading({ meterId: meter.id, date: addDays(today, -26), value: 1140, kind: 'regular' });
  await addReading({ meterId: meter.id, date: addDays(today, -12), value: 1270, kind: 'regular' });
  return meter;
}

async function vertrag(meterId: string, overrides: { deliveryEnd?: string } = {}) {
  return createContract({
    contract: {
      energyType: 'electricity',
      meterId,
      provider: 'Blitzwerk',
      tariffName: 'Öko 12',
      deliveryStart: start,
      ...overrides,
      termStartsAt: 'delivery',
      noticePeriod: { value: 1, unit: 'months' },
      renewal: { type: 'monthly' },
      installmentPlan: [{ validFrom: start, amountEur: 80, dayOfMonth: 15 }],
      status: 'active',
    },
    price: { validFrom: start, energyPriceCt: 30, basePriceEurPerYear: 150 },
    bonuses: [
      {
        kind: 'new_customer',
        amountEur: 100,
        condition: '',
        settlement: 'offset_in_bill',
        requiresDeliveryMonths: 12,
        status: 'promised',
      },
    ],
  });
}

async function openWizard(user: ReturnType<typeof userEvent.setup>) {
  const [button] = await screen.findAllByRole('button', { name: /Vertrag anlegen/ });
  if (!button) throw new Error('Button fehlt');
  await user.click(button);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Verträge – Liste', () => {
  it('verlangt zuerst einen Zähler', async () => {
    renderRoute('/vertraege');
    expect(await screen.findByText('Erst einen Zähler anlegen')).toBeInTheDocument();
  });

  it('zeigt Verträge je Energieart mit Saldo', async () => {
    const meter = await stromzaehler();
    await vertrag(meter.id);
    renderRoute('/vertraege');
    const link = await screen.findByRole('link', { name: /Blitzwerk/ });
    expect(link).toHaveTextContent('Öko 12');
    expect(link).toHaveTextContent(/Guthaben|Nachzahlung|Ausgeglichen/);
  });
});

describe('Vertrags-Assistent', () => {
  it('legt einen Vertrag in 4 Schritten an und öffnet die Detailseite', async () => {
    const user = userEvent.setup();
    await stromzaehler();
    renderRoute('/vertraege');
    await openWizard(user);
    const dialog = await screen.findByRole('dialog', { name: 'Neuer Vertrag' });

    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    expect(await within(dialog).findByText('Bitte den Anbieter angeben.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Anbieter'), 'Blitzwerk');
    await user.type(within(dialog).getByLabelText('Tarif'), 'Öko 12');
    fireEvent.change(within(dialog).getByLabelText('Lieferbeginn'), { target: { value: start } });
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));

    await user.type(await within(dialog).findByLabelText('Arbeitspreis (brutto)'), '30,5');
    await user.type(within(dialog).getByLabelText('Grundpreis (brutto)'), '12,5');
    await user.selectOptions(within(dialog).getByLabelText('pro'), 'month');
    expect(within(dialog).getByText('= 150,00 € pro Jahr')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));

    await user.click(await within(dialog).findByRole('button', { name: /Bonus hinzufügen/ }));
    await user.type(within(dialog).getByLabelText('Betrag (€)'), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));

    await user.type(await within(dialog).findByLabelText('Abschlag (€/Monat)'), '80');
    await user.click(within(dialog).getByRole('button', { name: 'Vertrag anlegen' }));

    expect(await screen.findByRole('heading', { name: 'Blitzwerk', level: 1 })).toBeInTheDocument();
    const [contract] = await listContracts();
    expect(contract).toMatchObject({
      tariffName: 'Öko 12',
      deliveryStart: start,
      status: 'active',
    });
    expect(contract?.installmentPlan[0]?.amountEur).toBe(80);
    const [period] = await pricePeriods.list();
    expect(period).toMatchObject({ energyPriceCt: 30.5, basePriceEurPerYear: 150 });
    expect((await bonuses.list())[0]).toMatchObject({ amountEur: 100, status: 'promised' });
  });

  it('warnt rot, wenn das Lieferende den Neukundenbonus kostet', async () => {
    const user = userEvent.setup();
    await stromzaehler();
    renderRoute('/vertraege');
    await openWizard(user);
    const dialog = await screen.findByRole('dialog', { name: 'Neuer Vertrag' });
    await user.type(within(dialog).getByLabelText('Anbieter'), 'Blitzwerk');
    await user.type(within(dialog).getByLabelText('Tarif'), 'Öko 12');
    fireEvent.change(within(dialog).getByLabelText('Lieferbeginn'), {
      target: { value: '2026-01-01' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    await user.type(await within(dialog).findByLabelText('Arbeitspreis (brutto)'), '30');
    await user.type(within(dialog).getByLabelText('Grundpreis (brutto)'), '150');
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    await user.click(await within(dialog).findByRole('button', { name: /Bonus hinzufügen/ }));
    await user.type(within(dialog).getByLabelText('Betrag (€)'), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    fireEvent.change(await within(dialog).findByLabelText('Geplantes Lieferende'), {
      target: { value: '2026-12-15' },
    });
    expect(await within(dialog).findByText(/nur 11 Monate und 15 Tage/)).toBeInTheDocument();
    expect(within(dialog).getByText(/31\.12\.2026/)).toBeInTheDocument();
  });

  it('rechnet einen Gaspreis in €/m³ mit den Zählerfaktoren in ct/kWh um', async () => {
    const user = userEvent.setup();
    await createMeter({
      energyType: 'gas',
      name: 'Gaszähler',
      unit: 'm3',
      decimals: 3,
      activeFrom: start,
      gasFactors: [{ validFrom: start, zFactor: 0.95, calorificValue: 11 }],
    });
    renderRoute('/vertraege');
    await openWizard(user);
    const dialog = await screen.findByRole('dialog', { name: 'Neuer Vertrag' });
    await user.type(within(dialog).getByLabelText('Anbieter'), 'Flammhaus');
    await user.type(within(dialog).getByLabelText('Tarif'), 'Gas 24');
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    await user.selectOptions(await within(dialog).findByLabelText('Einheit'), 'eur_per_m3');
    await user.type(within(dialog).getByLabelText('Arbeitspreis (brutto)'), '1,045');
    expect(within(dialog).getByText(/= 10,00 ct\/kWh/)).toBeInTheDocument();
  });

  it('lehnt einen überlappenden Vertrag derselben Energieart ab', async () => {
    const user = userEvent.setup();
    const meter = await stromzaehler();
    await vertrag(meter.id);
    renderRoute('/vertraege');
    await user.click(await screen.findByRole('button', { name: /Vertrag anlegen/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Neuer Vertrag' });
    await user.type(within(dialog).getByLabelText('Anbieter'), 'Zweitwerk');
    await user.type(within(dialog).getByLabelText('Tarif'), 'Basis');
    fireEvent.change(within(dialog).getByLabelText('Lieferbeginn'), { target: { value: today } });
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    await user.type(await within(dialog).findByLabelText('Arbeitspreis (brutto)'), '30');
    await user.type(within(dialog).getByLabelText('Grundpreis (brutto)'), '150');
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    await user.click(within(dialog).getByRole('button', { name: 'Weiter' }));
    await user.type(await within(dialog).findByLabelText('Abschlag (€/Monat)'), '80');
    await user.click(within(dialog).getByRole('button', { name: 'Vertrag anlegen' }));
    expect(await screen.findByText(/überschneidet sich mit Blitzwerk/)).toBeInTheDocument();
    expect(await listContracts()).toHaveLength(1);
  });
});

describe('Vertrags-Detail', () => {
  it('zeigt Kosten, Saldo und „So gerechnet“', async () => {
    const user = userEvent.setup();
    const meter = await stromzaehler();
    const contract = await vertrag(meter.id);
    renderRoute(`/vertraege/${contract.id}`);
    expect(await screen.findByRole('heading', { name: 'Blitzwerk', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Empfohlener Abschlag')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /So gerechnet/ }));
    expect(await screen.findByText(/Kosten je Tag = kWh × Arbeitspreis/)).toBeInTheDocument();
  });

  it('führt den Bonus-Status von zugesagt zu erhalten', async () => {
    const user = userEvent.setup();
    const meter = await stromzaehler();
    const contract = await vertrag(meter.id);
    renderRoute(`/vertraege/${contract.id}`);
    await user.selectOptions(await screen.findByLabelText(/Status Neukundenbonus/), 'received');
    await waitFor(async () => {
      expect((await bonuses.list())[0]).toMatchObject({ status: 'received', receivedAt: today });
    });
  });

  it('erfasst eine Preisänderung mit Hinweis auf das Sonderkündigungsrecht', async () => {
    const user = userEvent.setup();
    const meter = await stromzaehler();
    const contract = await vertrag(meter.id);
    renderRoute(`/vertraege/${contract.id}`);
    await user.click(await screen.findByRole('button', { name: 'Preisänderung erfassen' }));
    const form = await screen.findByRole('form', { name: 'Preisänderung' });
    fireEvent.change(within(form).getByLabelText('Gültig ab'), {
      target: { value: addDays(today, 40) },
    });
    await user.type(within(form).getByLabelText('Arbeitspreis (ct/kWh)'), '34');
    await user.type(within(form).getByLabelText('Grundpreis (€/Jahr)'), '160');
    await user.click(within(form).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => {
      expect(await pricePeriods.list()).toHaveLength(2);
    });
    expect(await screen.findByText(/Sonderkündigungsrecht/)).toBeInTheDocument();
  });

  it('erfasst die Kündigung und übernimmt das bestätigte Lieferende', async () => {
    const user = userEvent.setup();
    const meter = await stromzaehler();
    const contract = await vertrag(meter.id);
    renderRoute(`/vertraege/${contract.id}`);
    const form = await screen.findByRole('form', { name: 'Kündigung' });
    fireEvent.change(within(form).getByLabelText('Gesendet am'), { target: { value: today } });
    fireEvent.change(within(form).getByLabelText('Bestätigtes Lieferende'), {
      target: { value: addDays(start, 364) },
    });
    await user.click(within(form).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => {
      expect((await listContracts())[0]).toMatchObject({
        status: 'cancelled',
        deliveryEnd: addDays(start, 364),
        cancellation: { sentAt: today, confirmedEnd: addDays(start, 364) },
      });
    });
  });

  it('löscht einen Vertrag nach Rückfrage', async () => {
    const user = userEvent.setup();
    const meter = await stromzaehler();
    const contract = await vertrag(meter.id);
    renderRoute(`/vertraege/${contract.id}`);
    await user.click(await screen.findByRole('button', { name: 'Vertrag löschen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Vertrag löschen?' });
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    expect(await screen.findByText('Noch keine Verträge')).toBeInTheDocument();
    expect(await listContracts()).toHaveLength(0);
  });

  it('meldet einen unbekannten Vertrag', async () => {
    renderRoute('/vertraege/gibt-es-nicht');
    expect(await screen.findByText('Vertrag nicht gefunden')).toBeInTheDocument();
  });
});

describe('Übersicht – Kosten', () => {
  it('zeigt Kosten des Monats, Jahreskosten und den Abschlags-Saldo', async () => {
    const meter = await stromzaehler();
    await vertrag(meter.id);
    renderRoute('/');
    const link = await screen.findByRole('link', { name: /^Vertrag Blitzwerk:/ });
    expect(link).toHaveTextContent('Kosten diesen Monat');
    expect(link).toHaveTextContent(/Guthaben|Nachzahlung|Ausgeglichen/);
    expect(screen.getByText(/Jahresprognose/).parentElement).toHaveTextContent(/≈ [\d.]+,\d\d €/);
  });

  it('weist ohne Vertrag auf den Vertrag hin', async () => {
    await stromzaehler();
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Vertrag anlegen' })).toHaveAttribute(
      'href',
      '/vertraege',
    );
  });
});
