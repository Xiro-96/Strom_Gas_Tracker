import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeThemePreference,
} from '@/app/theme/theme';

const storageWith = (value: string | null) => ({ getItem: () => value });

describe('readThemePreference', () => {
  it('nutzt Dark als Standard ohne Storage', () => {
    expect(readThemePreference(null)).toBe('dark');
  });

  it('nutzt Dark als Standard ohne gespeicherten Wert', () => {
    expect(readThemePreference(storageWith(null))).toBe('dark');
  });

  it('liest gültige Werte', () => {
    expect(readThemePreference(storageWith('light'))).toBe('light');
    expect(readThemePreference(storageWith('system'))).toBe('system');
    expect(readThemePreference(storageWith('dark'))).toBe('dark');
  });

  it('verwirft ungültige Werte', () => {
    expect(readThemePreference(storageWith('banana'))).toBe('dark');
  });

  it('fällt auf Dark zurück, wenn der Storage wirft (z. B. Safari privat)', () => {
    const throwing = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    expect(readThemePreference(throwing)).toBe('dark');
  });
});

describe('writeThemePreference', () => {
  it('speichert unter dem festen Schlüssel', () => {
    const setItem = vi.fn();
    writeThemePreference({ setItem }, 'light');
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
  });

  it('wirft nie, auch wenn der Storage wirft', () => {
    const setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    expect(() => {
      writeThemePreference({ setItem }, 'light');
    }).not.toThrow();
    expect(() => {
      writeThemePreference(null, 'light');
    }).not.toThrow();
  });
});

describe('resolveTheme', () => {
  it('folgt bei system der Systemeinstellung', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignoriert die Systemeinstellung bei fester Wahl', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('applyTheme', () => {
  it('setzt die Klasse dark und das Farbschema', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
  });

  it('entfernt die Klasse dark bei Light', () => {
    const root = document.createElement('html');
    root.classList.add('dark');
    applyTheme('light', root);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });

  it('aktualisiert das theme-color-Meta-Tag', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    applyTheme('light', document.documentElement);
    const light = meta.content;
    applyTheme('dark', document.documentElement);
    expect(meta.content).not.toBe(light);
    expect(meta.content).toMatch(/^#[0-9a-f]{6}$/i);
    meta.remove();
  });
});
