import React from 'react';
import { PACSError, PACSErrorCode } from '../../core/errors/PACSError';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary with PACS-specific error display.
 * Shows actionable messages for known error types.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error?.message ?? error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const error = this.state.error;
    const isPACSError = error instanceof PACSError;

    let title = 'Something went wrong';
    let message = error?.message ?? 'An unexpected error occurred.';
    let showRetry = false;

    if (isPACSError) {
      switch (error.code) {
        case PACSErrorCode.NETWORK_ERROR:
          title = 'Network Error';
          message = 'Unable to reach the server. Check your connection and try again.';
          showRetry = true;
          break;
        case PACSErrorCode.SESSION_EXPIRED:
          title = 'Session Expired';
          message = 'Your session has expired. Please log in again.';
          break;
        case PACSErrorCode.STUDY_NOT_FOUND:
          title = 'Study Not Found';
          message = error.message;
          break;
        case PACSErrorCode.IMAGE_LOAD_FAILED:
          title = 'Image Load Failed';
          message = error.message;
          showRetry = true;
          break;
        default:
          showRetry = error.retryable;
          break;
      }
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-900 text-white">
        <div className="text-red-400 text-4xl mb-4">⚠</div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-gray-400 mb-6 max-w-md">{message}</p>
        {showRetry && (
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }
}
