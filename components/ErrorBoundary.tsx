// ==============================================================================
// ERROR BOUNDARY COMPONENT
// ==============================================================================
// Catches JavaScript errors anywhere in the child component tree
// and displays a fallback UI instead of crashing the whole app
// ==============================================================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });
        
        // Log to error reporting service in production
        if (import.meta.env.PROD) {
            // TODO: Send to error tracking service like Sentry
            console.error('Production Error:', error, errorInfo);
        }

        // Call optional onError callback
        this.props.onError?.(error, errorInfo);
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    private handleGoHome = (): void => {
        window.location.href = '/';
    };

    private handleRefresh = (): void => {
        window.location.reload();
    };

    public render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

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
                        
                        <p className="text-cocoa-light mb-6">
                            We're sorry, but something unexpected happened. 
                            Don't worry, your work is safe!
                        </p>

                        {/* Error details in development */}
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mb-6 text-left bg-gray-50 rounded-xl p-4">
                                <summary className="cursor-pointer text-sm font-bold text-gray-600 mb-2">
                                    Error Details (Dev Only)
                                </summary>
                                <pre className="text-xs text-red-600 overflow-auto max-h-40">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-md"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            
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
