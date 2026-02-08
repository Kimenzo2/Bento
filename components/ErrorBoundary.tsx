// ==============================================================================
// ERROR BOUNDARY COMPONENT
// ==============================================================================
// Catches JavaScript errors anywhere in the child component tree
// and displays a fallback UI instead of crashing the whole app
// Platform-grade error handling with recovery and reporting
// ==============================================================================

import { AlertTriangle, Bug, Check, Copy, Home, RefreshCw } from 'lucide-react';
import type React from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

// Dynamic import to avoid circular dependencies
const reportError = async (
  error: Error,
  errorInfo: ErrorInfo,
  context: Record<string, unknown>
) => {
  try {
    const { errorReporter } = await import('../services/errorReporting');
    errorReporter.captureException(error, {
      component: 'ErrorBoundary',
      metadata: {
        componentStack: errorInfo.componentStack,
        ...context,
      },
    });
  } catch {
    // Fallback to console if error reporter fails
    console.error('[ErrorBoundary] Failed to report error:', error);
  }
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Component name for error context */
  componentName?: string;
  /** Retry limit before showing persistent error */
  maxRetries?: number;
  /** Show detailed error info even in production */
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string | null;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    errorId: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId =
      `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
    return { hasError: true, error, errorId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    const { componentName, maxRetries = 3 } = this.props;

    // Report to error tracking service
    reportError(error, errorInfo, {
      errorId: this.state.errorId,
      componentName,
      retryCount: this.state.retryCount,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);

    // Log for debugging
    console.error('[ErrorBoundary] Caught error:', {
      errorId: this.state.errorId,
      error,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      maxRetries,
    });
  }

  private handleRetry = (): void => {
    const { maxRetries = 3 } = this.props;
    const newRetryCount = this.state.retryCount + 1;

    if (newRetryCount >= maxRetries) {
      // Max retries reached, show persistent error
      console.warn(`[ErrorBoundary] Max retries (${maxRetries}) reached`);
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: newRetryCount,
      copied: false,
    });
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private handleRefresh = (): void => {
    window.location.reload();
  };

  private handleCopyError = (): void => {
    const errorText = this.getErrorReport();
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  private getErrorReport = (): string => {
    const { error, errorInfo, errorId } = this.state;
    return [
      `Error ID: ${errorId}`,
      `Time: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      '',
      `Error: ${error?.name}: ${error?.message}`,
      '',
      'Stack Trace:',
      error?.stack || 'No stack trace',
      '',
      'Component Stack:',
      errorInfo?.componentStack || 'No component stack',
    ].join('\n');
  };

  private canRetry = (): boolean => {
    const { maxRetries = 3 } = this.props;
    return this.state.retryCount < maxRetries;
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { showDetails } = this.props;
      const { errorId, error, errorInfo, retryCount, copied } = this.state;
      const canRetry = this.canRetry();
      const showErrorDetails = import.meta.env.DEV || showDetails;

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-base to-peach-soft p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h1 className="font-heading font-bold text-2xl text-charcoal-soft mb-3">
              Oops! Something went wrong
            </h1>

            <p className="text-cocoa-light mb-4">
              We're sorry, but something unexpected happened. Don't worry, your work is safe!
            </p>

            {/* Error ID for support */}
            <div className="mb-6 px-4 py-2 bg-gray-50 rounded-lg inline-block">
              <span className="text-xs text-gray-500">Error ID: </span>
              <code className="text-xs font-mono text-gray-700">{errorId}</code>
            </div>

            {/* Error details */}
            {showErrorDetails && error && (
              <details className="mb-6 text-left bg-gray-50 rounded-xl p-4">
                <summary className="cursor-pointer text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Error Details {import.meta.env.DEV && '(Dev Mode)'}
                </summary>
                <pre className="text-xs text-red-600 overflow-auto max-h-40 whitespace-pre-wrap">
                  {error.toString()}
                  {errorInfo?.componentStack}
                </pre>
                <button
                  onClick={this.handleCopyError}
                  className="mt-3 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy error report'}
                </button>
              </details>
            )}

            {/* Retry count indicator */}
            {retryCount > 0 && (
              <p className="text-xs text-amber-600 mb-4">
                Retry attempt {retryCount}/{this.props.maxRetries || 3}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {canRetry ? (
                <button
                  onClick={this.handleRetry}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              ) : (
                <button
                  onClick={this.handleRefresh}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </button>
              )}

              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-charcoal-soft font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for function components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
