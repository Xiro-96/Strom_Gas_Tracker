import type { RouteObject } from 'react-router';
import { AppLayout } from '@/app/layout/AppLayout';
import { RouteError } from '@/app/RouteError';
import { CapturePage } from '@/features/capture/CapturePage';
import { ContractsPage } from '@/features/contracts/ContractsPage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { MorePage } from '@/features/more/MorePage';
import { NotFoundPage } from '@/features/more/NotFoundPage';
import { OffersPage } from '@/features/offers/OffersPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { SwitchPage } from '@/features/switch/SwitchPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'verlauf', element: <HistoryPage /> },
      { path: 'erfassen', element: <CapturePage /> },
      { path: 'erfassen/:energy', element: <CapturePage /> },
      { path: 'vertraege', element: <ContractsPage /> },
      {
        // Diagramme (Recharts) erst bei Bedarf laden – hält die Übersicht schlank.
        path: 'auswertung',
        lazy: async () => ({
          Component: (await import('@/features/analytics/AnalyticsPage')).AnalyticsPage,
        }),
      },
      { path: 'wechsel', element: <SwitchPage /> },
      { path: 'angebote', element: <OffersPage /> },
      { path: 'mehr', element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
