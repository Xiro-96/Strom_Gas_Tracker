import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from '@/app/ErrorFallback';

interface ErrorBoundaryState {
  error: Error | null;
}

/** Fängt Render-Fehler ab, damit nie eine weiße Seite bleibt. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unbehandelter Fehler in der App', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}
