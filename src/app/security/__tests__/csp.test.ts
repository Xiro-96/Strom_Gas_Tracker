import { buildCsp, injectCsp, OPEN_METEO_HOSTS } from '@/app/security/csp';

const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

describe('buildCsp', () => {
  const csp = buildCsp();

  it('erlaubt Skripte nur von der eigenen Origin', () => {
    expect(directive(csp, 'script-src')).toBe("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
  });

  it('erlaubt Netzwerkzugriffe nur auf die eigene Origin und Open-Meteo', () => {
    expect(directive(csp, 'connect-src')).toBe(`connect-src 'self' ${OPEN_METEO_HOSTS.join(' ')}`);
    for (const host of OPEN_METEO_HOSTS)
      expect(host).toMatch(/^https:\/\/[a-z-]+\.open-meteo\.com$/);
  });

  it('verbietet Plugins und fremde Basis-URLs', () => {
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
  });

  it('erlaubt Fotos als blob:/data: (Kamera-Vorschau)', () => {
    expect(directive(csp, 'img-src')).toBe("img-src 'self' data: blob:");
  });
});

describe('injectCsp', () => {
  const html =
    '<!doctype html><html><head><meta charset="UTF-8" /><title>x</title><script src="/a.js"></script></head></html>';

  it('setzt das CSP-Meta-Tag direkt nach charset und vor jedes Skript', () => {
    const out = injectCsp(html, "default-src 'self'");
    const meta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'" />`;
    expect(out).toContain(meta);
    expect(out.indexOf(meta)).toBeGreaterThan(out.indexOf('charset'));
    expect(out.indexOf(meta)).toBeLessThan(out.indexOf('<script'));
  });

  it('wirft, wenn kein charset-Meta vorhanden ist (CSP würde sonst still fehlen)', () => {
    expect(() => injectCsp('<html><head></head></html>', 'x')).toThrow(/charset/);
  });
});
