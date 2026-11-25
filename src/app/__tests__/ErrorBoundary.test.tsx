import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/app/ErrorBoundary';

function Boom(): never {
  throw new Error('kaputt');
}

describe('ErrorBoundary', () => {
  it('zeigt statt einer weißen Seite eine Fehlermeldung mit Neu-laden-Button', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Etwas ist schiefgelaufen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
    expect(screen.getByText('kaputt')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('rendert Kinder ohne Fehler unverändert', () => {
    render(
      <ErrorBoundary>
        <p>alles gut</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('alles gut')).toBeInTheDocument();
  });
});
