import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { bills, createContract, getContract } from '@/data/repositories/contracts';
import { createMeter } from '@/data/repositories/meters';
import { addReading } from '@/data/repositories/readings';
import { getSettings } from '@/data/repositories/settings';
import { addDays, todayISO } from '@/domain/dates';
import { formatDate } from '@/lib/format';
import { renderRoute } from '@/test/renderRoute';

const today = todayISO();
// Geplantes Lieferende in 19 Tagen, 14 Tage Frist → Kündigungs-Deadline in 5 Tagen
const end = addDays(today, 19);

async function setup() {
  const meter = await createMeter({
    energyType: 'electricity',
    name: 'Stromzähler',
    unit: 'kWh',
    decimals: 1,
    activeFrom: addDays(today, -60),
    meterNumber: '1ABC0012345',
  });
  await addReading({ meterId: meter.id, date: addDays(today, -60), value: 1000, kind: 'regular' });
  await addReading({ meterId: meter.id, date: addDays(today, -3), value: 1500, kind: 'regular' });
  const contract = await createContract({
    contract: {
      energyType: 'electricity',
      meterId: meter.id,
      provider: 'Blitzwerk',
      tariffName: 'Öko 12',
      customerNumber: 'K-1000-7',
      deliveryStart: addDays(today, -60),
      deliveryEnd: end,
      minTermMonths: 12,
      termStartsAt: 'delivery',
      noticePeriod: { value: 14, unit: 'days' },
      renewal: { type: 'monthly' },
      installmentPlan: [{ validFrom: addDays(today, -60), amountEur: 80, dayOfMonth: 15 }],
      status: 'active',
    },
    price: { validFrom: addDays(today, -60), energyPriceCt: 30, basePriceEurPerYear: 150 },
    bonuses: [],
  });
  return { meter, contract };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
});

describe('Fristen in der Übersicht', () => {
  it('zeigt die nächste Frist mit Countdown als Link ins Cockpit', async () => {
    await setup();
    renderRoute('/');
    const bar = await screen.findByRole('link', { name: /Blitzwerk kündigen · noch 5 Tage/ });
    expect(bar).toHaveAttribute('href', '/wechsel');
  });

  it('weist beim Start auf dringende Fristen hin – höchstens einmal pro Tag', async () => {
    await setup();
    renderRoute('/');
    expect(await screen.findByText('Blitzwerk kündigen – noch 5 Tage')).toBeInTheDocument();
    expect(localStorage.getItem('sgt-hints-shown')).toBe(today);
  });

  it('zeigt keinen zweiten Hinweis am selben Tag', async () => {
    await setup();
    localStorage.setItem('sgt-hints-shown', today);
    renderRoute('/');
    await screen.findByRole('link', { name: /Blitzwerk kündigen/ });
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByText('Blitzwerk kündigen – noch 5 Tage')).not.toBeInTheDocument();
  });
});

describe('Wechsel-Cockpit', () => {
  it('ohne Vertrag ein Leerzustand', async () => {
    renderRoute('/wechsel');
    expect(await screen.findByText('Kein laufender Vertrag')).toBeInTheDocument();
  });

  it('zeigt Frist, Checkliste und Kündigungstext; Haken wird gespeichert', async () => {
    const user = userEvent.setup();
    const { contract } = await setup();
    renderRoute('/wechsel');
    const card = await screen.findByRole('region', { name: 'Strom: Blitzwerk' });
    expect(within(card).getByText('Kündigen bis').parentElement).toHaveTextContent(
      `${formatDate(addDays(end, -14))} · noch 5 Tage`,
    );
    expect(within(card).getByRole('listitem', { current: 'step' })).toHaveTextContent('Aktiv');

    await user.click(within(card).getByRole('checkbox', { name: /an beide Anbieter gemeldet/ }));
    await waitFor(async () => {
      expect((await getContract(contract.id))?.switchChecklist).toEqual({ reported: today });
    });

    await user.click(within(card).getByText('Kündigungsschreiben', { selector: 'summary' }));
    const letter = within(card).getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Kündigungsschreiben',
    });
    expect(letter.value).toContain(`zum ${formatDate(end)}, hilfsweise`);
    expect(letter.value).toContain('Kundennummer: K-1000-7');
    const [copy] = within(card).getAllByRole('button', { name: 'Kopieren' });
    if (!copy) throw new Error('Kopieren fehlt');
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toContain('Zählernummer: 1ABC0012345');
  });

  it('erkennt die Kündigung automatisch und zeigt das Lieferende', async () => {
    const { contract } = await setup();
    await db.contracts.update(contract.id, {
      cancellation: { sentAt: today, channel: 'E-Mail' },
      status: 'cancelled',
    });
    renderRoute('/wechsel');
    const card = await screen.findByRole('region', { name: 'Strom: Blitzwerk' });
    expect(within(card).getByRole('listitem', { current: 'step' })).toHaveTextContent('Gekündigt');
    expect(within(card).getByRole('checkbox', { name: /^Gekündigt/ })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: /^Gekündigt/ })).toBeDisabled();
    expect(
      within(card).getByText(`Lieferende ${formatDate(end)} · noch 19 Tage`),
    ).toBeInTheDocument();
  });
});

describe('Einstellungen und Kalender', () => {
  it('speichert den Kündigungspuffer', async () => {
    const user = userEvent.setup();
    renderRoute('/mehr');
    await user.selectOptions(await screen.findByLabelText('Kündigungspuffer'), '14');
    await waitFor(async () => {
      expect((await getSettings()).cancellationBufferDays).toBe(14);
    });
  });

  it('exportiert eine Kalenderdatei mit Fristen und Ablese-Erinnerung', async () => {
    const user = userEvent.setup();
    await setup();
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:test';
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderRoute('/mehr');
    await user.click(await screen.findByRole('button', { name: 'Kalender exportieren (.ics)' }));
    expect(click).toHaveBeenCalled();
    const [blob] = created;
    expect(blob?.type).toBe('text/calendar;charset=utf-8');
    const text = (await blob?.text()) ?? '';
    expect(text.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(text).toContain('SUMMARY:Blitzwerk kündigen');
    expect(text).toContain('RRULE:FREQ=DAILY;INTERVAL=14');
    click.mockRestore();
  });

  it('markiert ein Guthaben aus der Rechnung als erhalten', async () => {
    const user = userEvent.setup();
    const { contract } = await setup();
    const bill = await bills.add({
      contractId: contract.id,
      kind: 'annual',
      periodFrom: addDays(today, -60),
      periodTo: addDays(today, -1),
      issuedAt: today,
      balanceEur: -42,
    });
    renderRoute(`/vertraege/${contract.id}`);
    await user.click(await screen.findByRole('button', { name: 'Guthaben erhalten' }));
    await waitFor(async () => {
      expect((await bills.list()).find((b) => b.id === bill.id)?.balanceSettledAt).toBe(today);
    });
  });
});
