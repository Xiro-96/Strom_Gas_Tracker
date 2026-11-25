export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'sgt-theme';
export const DEFAULT_THEME: ThemePreference = 'dark';

/** Farben für `<meta name="theme-color">` – identisch mit `--background` je Theme. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#0b0f17',
  light: '#f7f8fa',
};

const PREFERENCES: readonly ThemePreference[] = ['system', 'dark', 'light'];

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value);
}

/** Liest `localStorage` defensiv – in Safari (privat) oder bei gesperrten Website-Daten kann schon der Zugriff werfen. */
export function getSafeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readThemePreference(storage: Pick<Storage, 'getItem'> | null): ThemePreference {
  if (!storage) return DEFAULT_THEME;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeThemePreference(
  storage: Pick<Storage, 'setItem'> | null,
  preference: ThemePreference,
): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Speichern ist eine Komfortfunktion; ohne Storage gilt die Wahl nur für diese Sitzung.
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function applyTheme(resolved: ResolvedTheme, root: HTMLElement): void {
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  const meta = root.ownerDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[resolved];
}
