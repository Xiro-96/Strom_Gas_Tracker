import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { createMeter } from '@/data/repositories/meters';
import { addReading, listReadings } from '@/data/repositories/readings';
import { addDays, todayISO } from '@/domain/dates';
import { renderRoute } from '@/test/renderRoute';

const today = todayISO();

async function stromMitHistorie() {
  const meter = await createMeter({
    energyType: 'electricity',
    name: 'Stromzähler',
    unit: 'kWh',
    decimals: 1,
    activeFrom: addDays(today, -40),
  });
  await addReading({ meterId: meter.id, date: addDays(today, -40), value: 1000, kind: 'regular' });
  await addReading({ meterId: meter.id, date: addDays(today, -26), value: 1140, kind: 'regular' });
  await addReading({ meterId: meter.id, date: addDays(today, -14), value: 1260, kind: 'regular' });
  return meter;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Onboarding', () => {
  it('legt einen Zähler mit Startstand an und zeigt ihn in der Übersicht', async () => {
    const user = userEvent.setup();
    renderRoute('/');
    await user.click(await screen.findByRole('button', { name: /Zähler anlegen/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Zähler anlegen' });
    await user.type(within(dialog).getByLabelText(/Aktueller Stand/), '14.321,6');
    await user.click(within(dialog).getByRole('button', { name: 'Zähler anlegen' }));
    expect(await screen.findByRole('heading', { name: 'Strom' })).toBeInTheDocument();
    expect(await screen.findByText(/14\.321,6\skWh/)).toBeInTheDocument();
    expect((await listReadings())[0]?.value).toBe(14321.6);
  });

  it('meldet eine ungültige MaLo-ID deutsch', async () => {
    const user = userEvent.setup();
    renderRoute('/');
    await user.click(await screen.findByRole('button', { name: /Zähler anlegen/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Zähler anlegen' });
    await user.type(within(dialog).getByLabelText(/Aktueller Stand/), '100');
    await user.type(within(dialog).getByLabelText(/MaLo-ID/), '123');
    await user.click(within(dialog).getByRole('button', { name: 'Zähler anlegen' }));
    expect(
      await within(dialog).findByText('Die MaLo-ID hat genau 11 Ziffern.'),
    ).toBeInTheDocument();
  });

  it('lädt Demo-Daten mit einem Klick', async () => {
    const user = userEvent.setup();
    renderRoute('/');
    await user.click(await screen.findByRole('button', { name: /Demo-Daten laden/ }));
    expect(await screen.findByRole('heading', { name: 'Gas' })).toBeInTheDocument();
    expect(await screen.findByText(/Demo-Daten aktiv/)).toBeInTheDocument();
  });
});

describe('Übersicht', () => {
  it('zeigt die Jahresprognose – bei wenig Daten als unsicher', async () => {
    await stromMitHistorie();
    renderRoute('/');
    const prognose = await screen.findByText(/Jahresprognose/);
    // 10 kWh/Tag × 365, nur 2 Intervalle → unsicher (Spec 6.4)
    expect(prognose.closest('p')).toHaveTextContent(/≈\s?3\.650\skWh/);
    expect(prognose.closest('p')).toHaveTextContent(/unsicher/);
  });
});

describe('Schnellerfassung', () => {
  it('belegt den letzten Stand vor, zeigt die Vorschau und speichert', async () => {
    const user = userEvent.setup();
    await stromMitHistorie();
    renderRoute('/erfassen/strom');
    const dialog = await screen.findByRole('dialog', { name: 'Strom ablesen' });
    const input = within(dialog).getByLabelText(/Zählerstand/);
    await waitFor(() => {
      expect(input).toHaveValue('1260,0');
    });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, '1400');
    expect(within(dialog).getByText(/10,0\skWh\/Tag/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => {
      expect((await listReadings()).map((r) => r.value)).toContain(1400);
    });
    expect(await screen.findByRole('button', { name: 'Rückgängig' })).toBeInTheDocument();
  });

  it('blockiert einen kleineren Stand mit Fehlermeldung', async () => {
    const user = userEvent.setup();
    await stromMitHistorie();
    renderRoute('/erfassen/strom');
    const dialog = await screen.findByRole('dialog', { name: 'Strom ablesen' });
    const input = within(dialog).getByLabelText(/Zählerstand/);
    await user.clear(input);
    await user.type(input, '1200');
    expect(within(dialog).getByText(/kleiner als der letzte/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });
});

describe('Verlauf', () => {
  it('zeigt Ablesungen mit Tagesverbrauch und löscht mit Rückgängig', async () => {
    const user = userEvent.setup();
    await stromMitHistorie();
    renderRoute('/verlauf');
    const list = await screen.findByRole('list', { name: 'Ablesungen Strom' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getAllByText(/10,0\skWh\/Tag/).length).toBeGreaterThan(0);
    const [firstDelete] = within(list).getAllByRole('button', { name: /löschen/ });
    if (!firstDelete) throw new Error('Kein Löschen-Button');
    await user.click(firstDelete);
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });
    await user.click(await screen.findByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    });
  });
});

describe('Import', () => {
  it('übernimmt eingefügte CSV-Zeilen und legt die Zähler an', async () => {
    const user = userEvent.setup();
    renderRoute('/mehr');
    await user.click(await screen.findByRole('button', { name: 'Ablesungen importieren' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ablesungen importieren' });
    const textarea = within(dialog).getByLabelText(/Text einfügen/);
    await user.click(textarea);
    await user.paste(
      'Datum;Energie;Stand\n03.11.2025;Strom;14321,6\n03.11.2025;Gas;21234,567\n10.11.2025;Strom;14387,6',
    );
    expect(within(dialog).getByText(/Erkannt:/)).toHaveTextContent(
      'Erkannt: 2 Strom- und 1 Gasstände',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Importieren' }));
    expect(await within(dialog).findByText(/3 neu · 0 schon vorhanden/)).toBeInTheDocument();
    expect(await listReadings()).toHaveLength(3);
  });
});

describe('Zähler – Gasfaktoren', () => {
  it('speichert neue Gasfaktoren mit „gültig ab“ als weiteren Abschnitt', async () => {
    const user = userEvent.setup();
    await createMeter({
      energyType: 'gas',
      name: 'Gaszähler',
      unit: 'm3',
      decimals: 3,
      activeFrom: '2025-01-01',
      gasFactors: [{ validFrom: '2025-01-01', zFactor: 0.95, calorificValue: 11 }],
    });
    renderRoute('/mehr');
    await user.click(await screen.findByRole('button', { name: 'Gaszähler bearbeiten' }));
    const dialog = await screen.findByRole('dialog', { name: 'Zähler bearbeiten' });
    expect(within(dialog).getByText(/ab 01\.01\.2025: z 0,9500 · Hs 11,000/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Faktoren gültig ab'), {
      target: { value: '2026-01-01' },
    });
    await user.clear(within(dialog).getByLabelText('Zustandszahl z'));
    await user.type(within(dialog).getByLabelText('Zustandszahl z'), '0,9412');
    await user.clear(within(dialog).getByLabelText('Brennwert Hs (kWh/m³)'));
    await user.type(within(dialog).getByLabelText('Brennwert Hs (kWh/m³)'), '10,274');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => {
      const [meter] = await db.meters.toArray();
      expect(meter?.gasFactors).toEqual([
        { validFrom: '2025-01-01', zFactor: 0.95, calorificValue: 11 },
        { validFrom: '2026-01-01', zFactor: 0.9412, calorificValue: 10.274 },
      ]);
    });
  });
});
