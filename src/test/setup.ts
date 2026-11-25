import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach } from 'vitest';

// jsdom kennt keine Pointer-Capture-API (sonner nutzt sie für Wischgesten).
Object.assign(Element.prototype, {
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  hasPointerCapture: () => false,
});

afterEach(() => {
  // sonner hält Toasts in einem globalen Store – sonst „überleben“ sie den Test.
  toast.dismiss();
  cleanup();
});
