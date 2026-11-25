import { render, screen } from '@testing-library/react';
import { Gauge } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';

describe('EmptyState', () => {
  it('zeigt Titel als Überschrift, Beschreibung und Aktion', () => {
    render(
      <EmptyState
        icon={Gauge}
        title="Noch keine Ablesungen"
        description="Erfasse deinen ersten Zählerstand."
        action={<button type="button">Jetzt erfassen</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Noch keine Ablesungen' })).toBeInTheDocument();
    expect(screen.getByText('Erfasse deinen ersten Zählerstand.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jetzt erfassen' })).toBeInTheDocument();
  });

  it('versteckt das Icon vor Screenreadern', () => {
    const { container } = render(<EmptyState icon={Gauge} title="Leer" description="Nichts da." />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('PageHeader', () => {
  it('rendert den Titel als h1 mit optionaler Beschreibung', () => {
    render(<PageHeader title="Verlauf" description="Alle Ablesungen" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Verlauf' })).toBeInTheDocument();
    expect(screen.getByText('Alle Ablesungen')).toBeInTheDocument();
  });
});
