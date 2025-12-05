import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { Provider as RollbarProvider, ErrorBoundary as RollbarErrorBoundary } from '@rollbar/react';
import rollbar, { rollbarConfig } from './config/rollbar';
import './index.css';

// Log app initialization for debugging (console.error survives production builds)
console.error('[Genesis] Application starting - Mode:', import.meta.env.MODE);

// Global error handler to catch unhandled errors
window.onerror = function (message, source, lineno, colno, error) {
  console.error('[Genesis] Global error:', { message, source, lineno, colno, error });
  // Show error on page if root is empty
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; background: #FFF8E7; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
        <div style="max-width: 500px; text-align: center;">
          <h1 style="color: #FF9B71;">Error Loading Genesis</h1>
          <p style="color: #5A5A5A;">${message}</p>
          <pre style="background: white; padding: 10px; border-radius: 8px; overflow: auto; text-align: left; font-size: 12px;">${error?.stack || 'No stack trace'}</pre>
          <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #FFD93D; border: none; border-radius: 20px; cursor: pointer;">Reload</button>
        </div>
      </div>
    `;
  }
  return false;
};

// Handle unhandled promise rejections
window.onunhandledrejection = function (event) {
  console.error('[Genesis] Unhandled promise rejection:', event.reason);
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
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#FFF8E7] text-[#5A5A5A] p-8 text-center font-sans">
          <div className="w-16 h-16 bg-[#FF9B71] rounded-full flex items-center justify-center text-white text-3xl mb-4 shadow-lg">
            !
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="mb-4 opacity-80 max-w-md">
            We encountered an unexpected error while loading Genesis.
          </p>
          <div className="bg-white p-4 rounded-xl border border-[#FFE4CC] text-left overflow-auto max-w-lg max-h-40 mb-6 w-full shadow-sm text-sm font-mono text-red-500">
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#FFD93D] text-[#5A5A5A] rounded-full font-bold shadow-md hover:bg-[#FFE4CC] transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RollbarProvider config={rollbarConfig}>
      <RollbarErrorBoundary>
        <ErrorBoundary>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ErrorBoundary>
      </RollbarErrorBoundary>
    </RollbarProvider>
  </React.StrictMode>
);