import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdatePrompt } from '@/app/pwa/UpdatePrompt';
import { ThemeProvider } from '@/app/theme/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { pwaMock } from '@/test/mocks/pwa-register-react';

function renderPrompt() {
  return render(
    <ThemeProvider>
      <Toaster />
      <UpdatePrompt />
    </ThemeProvider>,
  );
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    pwaMock.reset();
  });

  it('fragt bei neuer Version nach und lädt erst nach Klick neu', async () => {
    pwaMock.needRefresh = true;
    renderPrompt();
    const button = await screen.findByRole('button', { name: 'Aktualisieren' });
    expect(screen.getByText('Neue Version verfügbar')).toBeInTheDocument();
    expect(pwaMock.updateServiceWorker).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(pwaMock.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('meldet einmalig, dass die App offline bereit ist', async () => {
    pwaMock.offlineReady = true;
    renderPrompt();
    expect(await screen.findByText('Bereit für die Offline-Nutzung')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aktualisieren' })).not.toBeInTheDocument();
  });

  it('zeigt ohne Ereignis nichts an', () => {
    renderPrompt();
    expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
  });
});
