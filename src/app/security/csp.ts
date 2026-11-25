/**
 * Content-Security-Policy (Abschnitt 11): Skripte nur von der eigenen Origin, Netzwerk nur zur
 * eigenen Origin und zu Open-Meteo (Wetter/Ort, erst nach Opt-in genutzt).
 * Wird nur im Build als <meta> eingefügt – der Vite-Dev-Server braucht Inline-Styles/HMR.
 *
 * `style-src 'unsafe-inline'` ist bewusst erlaubt: sonner und Radix setzen zur Laufzeit
 * <style>-Elemente. Das ist für Styles vertretbar; für Skripte gilt strikt 'self'.
 */
export const OPEN_METEO_HOSTS = [
  'https://api.open-meteo.com',
  'https://archive-api.open-meteo.com',
  'https://geocoding-api.open-meteo.com',
] as const;

export const CSP_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", ...OPEN_METEO_HOSTS],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export function buildCsp(directives = CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

const CHARSET_META = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i;

export function injectCsp(html: string, csp: string): string {
  const match = CHARSET_META.exec(html);
  if (!match) throw new Error('injectCsp: <meta charset> nicht gefunden – CSP würde fehlen');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
  const insertAt = match.index + match[0].length;
  return `${html.slice(0, insertAt)}\n    ${meta}${html.slice(insertAt)}`;
}
