import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/routes';
import { ThemeProvider } from '@/app/theme/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

/** Rendert die echte Routen-Konfiguration in einem Memory-Router (ohne Hash/URL). */
export function renderRoute(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    ...render(
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>,
    ),
  };
}
