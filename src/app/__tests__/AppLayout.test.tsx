import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '@/test/renderRoute';

describe('App-Shell', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = 'dark';
  });

  it('zeigt die Bottom-Navigation in der Reihenfolge der Spezifikation', async () => {
    renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label') ?? link.textContent.trim());
    expect(labels).toEqual(['Übersicht', 'Verlauf', 'Zählerstand erfassen', 'Verträge', 'Mehr']);
  });

  it('markiert den aktiven Eintrag mit aria-current', async () => {
    renderRoute('/vertraege');
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' });
    expect(within(nav).getByRole('link', { name: 'Verträge' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Übersicht' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('navigiert per Klick zum Verlauf', async () => {
    renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Verlauf' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Verlauf' })).toBeInTheDocument();
  });

  it('bietet eine Seitenleiste mit weiteren Bereichen', async () => {
    renderRoute('/');
    const sidebar = await screen.findByRole('navigation', { name: 'Seitenleiste' });
    for (const name of [
      'Übersicht',
      'Verlauf',
      'Verträge',
      'Auswertung',
      'Wechsel-Cockpit',
      'Angebote',
      'Mehr',
    ]) {
      expect(within(sidebar).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('öffnet die Erfassung für Gas über die Shortcut-Route', async () => {
    renderRoute('/erfassen/gas');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Gas ablesen' }),
    ).toBeInTheDocument();
  });

  it('zeigt bei unbekannter Route „Seite nicht gefunden“ mit Weg zurück', async () => {
    renderRoute('/gibt-es-nicht');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Seite nicht gefunden' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Übersicht' })).toBeInTheDocument();
  });

  it('schaltet im Bereich Mehr das Design auf Hell', async () => {
    renderRoute('/mehr');
    const group = await screen.findByRole('radiogroup', { name: 'Design' });
    await userEvent.click(within(group).getByRole('radio', { name: 'Hell' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(within(group).getByRole('radio', { name: 'Hell' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('bietet einen Link zum Überspringen der Navigation', async () => {
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Zum Inhalt springen' })).toHaveAttribute(
      'href',
      '#inhalt',
    );
  });
});
