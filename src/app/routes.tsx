import type { RouteObject } from 'react-router';
import { AppLayout } from '@/app/layout/AppLayout';
import { RouteError } from '@/app/RouteError';
import { CapturePage } from '@/features/capture/CapturePage';
import { NotFoundPage } from '@/features/more/NotFoundPage';
import { OverviewPage } from '@/features/overview/OverviewPage';

/** Nur Übersicht und Erfassung laden sofort; alle anderen Bereiche bei Bedarf (Performance). */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <OverviewPage /> },
      {
        path: 'verlauf',
        lazy: async () => ({
          Component: (await import('@/features/history/HistoryPage')).HistoryPage,
        }),
      },
      { path: 'erfassen', element: <CapturePage /> },
      { path: 'erfassen/:energy', element: <CapturePage /> },
      {
        path: 'vertraege',
        lazy: async () => ({
          Component: (await import('@/features/contracts/ContractsPage')).ContractsPage,
        }),
      },
      {
        // Diagramme (Recharts) erst bei Bedarf laden – hält die Übersicht schlank.
        path: 'auswertung',
        lazy: async () => ({
          Component: (await import('@/features/analytics/AnalyticsPage')).AnalyticsPage,
        }),
      },
      {
        path: 'wechsel',
        lazy: async () => ({
          Component: (await import('@/features/switch/SwitchPage')).SwitchPage,
        }),
      },
      {
        path: 'angebote',
        lazy: async () => ({
          Component: (await import('@/features/offers/OffersPage')).OffersPage,
        }),
      },
      {
        path: 'mehr',
        lazy: async () => ({ Component: (await import('@/features/more/MorePage')).MorePage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
