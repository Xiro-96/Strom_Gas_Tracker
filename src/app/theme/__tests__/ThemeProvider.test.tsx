import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THEME_STORAGE_KEY } from '@/app/theme/theme';
import { ThemeProvider } from '@/app/theme/ThemeProvider';
import { useTheme } from '@/app/theme/useTheme';

type Listener = (event: { matches: boolean }) => void;

function mockSystemDark(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return {
    set(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((l) => {
        l({ matches });
      });
    },
  };
}

function Probe() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button
        type="button"
        onClick={() => {
          setPreference('light');
        }}
      >
        hell
      </button>
      <button
        type="button"
        onClick={() => {
          setPreference('system');
        }}
      >
        system
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('startet in Dark und setzt die Klasse am html-Element', () => {
    mockSystemDark(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('pref')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('wechselt auf Hell und speichert die Wahl', async () => {
    mockSystemDark(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'hell' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('folgt bei System der Änderung der Systemeinstellung', async () => {
    const system = mockSystemDark(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'system' }));
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    act(() => {
      system.set(true);
    });
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});
