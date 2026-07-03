'use client';

import React, { ReactNode, ErrorInfo } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches React component errors and prevents full app crashes
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    console.error('Error caught by boundary:', error, errorInfo);

    // Update state to show error UI
    this.setState({
      error,
      errorInfo,
    });

    // In production, you would send this to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      try {
        // Send error to monitoring service
        fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
          }),
        }).catch(err => console.error('Failed to report error:', err));
      } catch (err) {
        console.error('Error reporting failed:', err);
      }
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 to-black">
          <div className="w-full max-w-md mx-auto px-4">
            {/* Error Card */}
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-2xl p-8">
              {/* Error Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </div>

              {/* Error Message */}
              <h1 className="text-2xl font-bold text-white text-center mb-3">
                Oops! Something went wrong
              </h1>
              <p className="text-slate-400 text-center mb-6">
                We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg max-h-40 overflow-y-auto">
                  <p className="text-xs font-mono text-red-400 mb-2">Error Details:</p>
                  <p className="text-xs text-red-300 mb-3">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-red-400 hover:text-red-300 mb-2">
                        Component Stack
                      </summary>
                      <pre className="text-red-300 whitespace-pre-wrap break-words font-mono text-[10px]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold rounded-lg hover:shadow-lg hover:shadow-neon-cyan/50 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Refresh Page
                </button>
                <button
                  onClick={this.handleReset}
                  className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                >
                  Try Again
                </button>
                <Link
                  href="/"
                  className="w-full px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white font-medium rounded-lg transition-colors text-center"
                >
                  Go Home
                </Link>
              </div>

              {/* Support Message */}
              <p className="text-xs text-slate-500 text-center mt-6">
                If this problem persists, please contact{' '}
                <a
                  href="mailto:support@pitchinpublic.com"
                  className="text-neon-cyan hover:underline"
                >
                  support
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
