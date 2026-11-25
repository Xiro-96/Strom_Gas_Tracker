import { vi } from 'vitest';

/** Ersatz für `virtual:pwa-register/react` in Unit-Tests (Alias in vitest.config.ts). */
export const pwaMock = {
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve()),
  reset() {
    this.needRefresh = false;
    this.offlineReady = false;
    this.updateServiceWorker.mockClear();
  },
};

export function useRegisterSW() {
  return {
    needRefresh: [pwaMock.needRefresh, vi.fn()] as const,
    offlineReady: [pwaMock.offlineReady, vi.fn()] as const,
    updateServiceWorker: pwaMock.updateServiceWorker,
  };
}
