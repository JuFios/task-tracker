import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Global render-error fallback: an unexpected exception in any component
 * replaces the screen with a recovery UI instead of a blank page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <div className="rounded-full bg-rose-100 p-3">
          <AlertTriangle className="h-6 w-6 text-rose-600" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="max-w-sm text-sm text-slate-500">
          An unexpected error occurred while rendering this page. Your data is safe — try reloading.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={this.reset}>
            Try again
          </Button>
          <Button onClick={this.reload}>Reload page</Button>
        </div>
      </div>
    );
  }
}
