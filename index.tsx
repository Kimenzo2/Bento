import { ErrorBoundary as RollbarErrorBoundary, Provider as RollbarProvider } from '@rollbar/react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { rollbarConfig } from './config/rollbar';
import { AuthProvider } from './contexts/AuthContext';
import { IntegrationsProvider } from './contexts/IntegrationsContext';
import { Button } from './components/ui/button';
import './index.css';

// Log app initialization for debugging (only in development)
if (import.meta.env.DEV) {
  console.warn('[Genesis] Application starting - Mode:', import.meta.env.MODE);
}

// Global error handler to catch unhandled errors
window.onerror = (_message, _source, _lineno, _colno, _error) => {
  if (import.meta.env.DEV) {
    console.error('[Genesis] Global error:', { message: _message, source: _source, lineno: _lineno, error: _error });
  }
  // Show safe error on page if root is empty (no user-controlled data in HTML)
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 20px; font-family: sans-serif; background: #FFF8E7; min-height: 100vh; display: flex; align-items: center; justify-content: center;';
    const inner = document.createElement('div');
    inner.style.cssText = 'max-width: 500px; text-align: center;';
    const h1 = document.createElement('h1');
    h1.style.color = '#FF9B71';
    h1.textContent = 'Error Loading Genesis';
    const p = document.createElement('p');
    p.style.color = '#5A5A5A';
    p.textContent = 'Something went wrong. Please reload the page.';
    const btn = document.createElement('button');
    btn.textContent = 'Reload';
    btn.style.cssText = 'margin-top: 20px; padding: 10px 20px; background: #FFD93D; border: none; border-radius: 20px; cursor: pointer;';
    btn.onclick = () => location.reload();
    inner.appendChild(h1);
    inner.appendChild(p);
    inner.appendChild(btn);
    container.appendChild(inner);
    root.appendChild(container);
  }
  return false;
};

// Handle unhandled promise rejections
window.onunhandledrejection = (event) => {
  if (import.meta.env.DEV) {
    console.error('[Genesis] Unhandled promise rejection:', event.reason);
  }
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary to catch runtime errors and prevent white screen
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#FFF8E7] text-[#5A5A5A] p-8 text-center font-sans">
          <div className="w-16 h-16 bg-[#FF9B71] rounded-full flex items-center justify-center text-white text-3xl mb-4">
            !
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="mb-4 opacity-80 max-w-md">
            We encountered an unexpected error while loading Genesis.
          </p>
          <div className="bg-white p-4 rounded-xl border border-[#FFE4CC] text-left overflow-auto max-w-lg max-h-40 mb-6 w-full text-sm font-mono text-red-500">
            {import.meta.env.DEV ? (this.state.error?.message || 'Unknown error') : 'An unexpected error occurred. Please reload the page.'}
          </div>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#FFD93D] text-[#5A5A5A] rounded-full hover:bg-[#FFE4CC]"
          >
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RollbarProvider config={rollbarConfig}>
      <RollbarErrorBoundary>
        <ErrorBoundary>
          <IntegrationsProvider
            onReady={(_result) => {
              if (import.meta.env.DEV) console.warn('[Genesis] Integrations ready:', _result.initialized);
            }}
            onError={(_error) => {
              if (import.meta.env.DEV) console.error('[Genesis] Integrations failed:', _error);
            }}
          >
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </IntegrationsProvider>
        </ErrorBoundary>
      </RollbarErrorBoundary>
    </RollbarProvider>
  </React.StrictMode>
);

// Service Worker is auto-registered by vite-plugin-pwa (registerType: 'autoUpdate')
// No manual registration needed — the plugin injects it at build time
