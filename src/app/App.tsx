import { useState } from 'react';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { UpdatePrompt } from '@/app/pwa/UpdatePrompt';
import { routes } from '@/app/routes';
import { ThemeProvider } from '@/app/theme/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

export function App() {
  // Hash-Router: läuft auf GitHub Pages ohne Server-Rewrites.
  const [router] = useState(() => createHashRouter(routes));
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
        <UpdatePrompt />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
