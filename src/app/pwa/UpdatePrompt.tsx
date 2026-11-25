import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Update-Toast (`registerType: 'prompt'`): Eine neue Version wird nie automatisch aktiviert –
 * sonst ginge eine gerade getippte Eingabe verloren. Neu geladen wird nur nach Klick.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('Neue Version verfügbar', {
      id: 'pwa-update',
      description: 'Aktualisieren lädt die App neu – deine Daten bleiben erhalten.',
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: 'Aktualisieren',
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
    });
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;
    toast.success('Bereit für die Offline-Nutzung', {
      id: 'pwa-offline',
      description: 'Die App startet jetzt auch ohne Internet.',
    });
  }, [offlineReady]);

  return null;
}
