import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ErrorFallback } from '@/app/ErrorFallback';
import { NotFoundPage } from '@/features/more/NotFoundPage';

export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return <ErrorFallback error={error instanceof Error ? error : new Error(String(error))} />;
}
