import { z } from 'zod';

/**
 * zod ohne JIT: Sonst prüft zod per `new Function`, ob `eval` erlaubt ist – unsere CSP
 * (`script-src 'self'`) blockt das, und der Browser meldet einen CSP-Verstoß. Alle Module
 * importieren zod deshalb von hier (ESLint erzwingt das).
 */
z.config({ jitless: true });

export { z };
