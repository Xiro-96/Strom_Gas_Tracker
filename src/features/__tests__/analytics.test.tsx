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
});
