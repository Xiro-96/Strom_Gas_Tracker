import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { loadDemoData } from '@/data/repositories/demo';
import { renderRoute } from '@/test/renderRoute';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Auswertung', () => {
  it('zeigt ohne Daten einen Leerzustand', async () => {
    renderRoute('/auswertung');
    expect(await screen.findByRole('heading', { name: /Noch keine Daten/ })).toBeInTheDocument();
  });

  it('zeigt die Diagramme 1–3 und jedes auch als Tabelle', async () => {
    const user = userEvent.setup();
    await loadDemoData();
    renderRoute('/auswertung');
    for (const name of ['Tagesverbrauch', 'Monatsverbrauch', 'Kumuliert im Jahr']) {
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Monatsverbrauch als Tabelle' }));
    const table = await screen.findByRole('table', { name: /Monatsverbrauch/ });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
    expect(within(table).getByRole('columnheader', { name: 'Vorjahr' })).toBeInTheDocument();
  });

  it('filtert nach Energieart und Zeitraum', async () => {
    const user = userEvent.setup();
    await loadDemoData();
    renderRoute('/auswertung');
    await user.click(await screen.findByRole('radio', { name: 'Gas' }));
    await user.click(screen.getByRole('radio', { name: '3 Monate' }));
    await user.click(screen.getByRole('button', { name: 'Tagesverbrauch als Tabelle' }));
    const table = await screen.findByRole('table', { name: /Tagesverbrauch Gas/ });
    expect(within(table).getAllByRole('row').length).toBeLessThan(10);
  });

  it('zeigt die Kostendiagramme 4, 5 und 7 mit Tabellen (Demo-Verträge)', async () => {
    const user = userEvent.setup();
    await loadDemoData();
    renderRoute('/auswertung');
    for (const name of [
      'Kosten je Monat',
      'Abschläge vs. Kosten',
      'Effektivpreis je Vertragsjahr',
    ]) {
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/^Saldo: /)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kosten je Monat als Tabelle' }));
    const costs = await screen.findByRole('table', { name: /Kosten je Monat Strom/ });
    expect(within(costs).getByRole('columnheader', { name: 'Grundpreis' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Effektivpreis je Vertragsjahr als Tabelle' }),
    );
    const effective = await screen.findByRole('table', { name: /Effektivpreis je Vertragsjahr/ });
    expect(within(effective).getAllByRole('row').length).toBeGreaterThan(2);
  });

  it('bietet den Zeitraum „Vertrag“ an', async () => {
    const user = userEvent.setup();
    await loadDemoData();
    renderRoute('/auswertung');
    await user.click(await screen.findByRole('radio', { name: 'Laufender Vertrag' }));
    expect(screen.getByRole('radio', { name: 'Laufender Vertrag' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
