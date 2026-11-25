import { THEME_COLORS, THEME_STORAGE_KEY } from '@/app/theme/theme';
import source from '../../../../public/theme-init.js?raw';

const runInitScript = () => {
  // Das Skript ist bewusst ein klassisches Skript ohne Module (läuft vor dem Bundle, CSP: 'self').
  // Im Test wird genau dieser Quelltext ausgeführt – eval ist hier der Zweck des Tests.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const script = new Function(source) as () => void;
  script();
};

describe('public/theme-init.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = 'dark';
    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lässt Dark als Standard stehen', () => {
    runInitScript();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      THEME_COLORS.dark,
    );
  });

  it('schaltet vor dem ersten Paint auf Hell, wenn gespeichert', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    runInitScript();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      THEME_COLORS.light,
    );
  });

  it('folgt bei System der Systemeinstellung', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    runInitScript();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('wirft nicht, wenn localStorage gesperrt ist', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(runInitScript).not.toThrow();
    expect(document.documentElement).toHaveClass('dark');
    vi.restoreAllMocks();
  });
});
