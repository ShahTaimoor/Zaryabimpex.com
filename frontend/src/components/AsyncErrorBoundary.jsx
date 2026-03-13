import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

class AsyncErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isRetrying: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Error handled by error boundary UI
  }

  handleRetry = async () => {
    this.setState({ isRetrying: true });
    
    try {
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.setState(prevState => ({
        hasError: false,
        error: null,
        isRetrying: false,
        retryCount: prevState.retryCount + 1
      }));
    } catch (error) {
      this.setState({ isRetrying: false });
    }
  };

  isNetworkError = () => {
    return this.state.error && (
      this.state.error.message?.includes('Network Error') ||
      this.state.error.message?.includes('Failed to fetch') ||
      this.state.error.message?.includes('timeout') ||
      this.state.error.code === 'NETWORK_ERROR'
    );
  };

  render() {
    if (this.state.hasError) {
      const isNetworkError = this.isNetworkError();
      const maxRetries = 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <div className="card">
          <div className="card-content">
            <div className="text-center py-6">
              {isNetworkError ? (
                <WifiOff className="mx-auto h-8 w-8 text-red-500 mb-4" />
              ) : (
                <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-4" />
              )}
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isNetworkError ? 'Connection Error' : 'Loading Error'}
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                {isNetworkError 
                  ? 'Unable to connect to the backend server. Please ensure the server is running on localhost:5000.'
                  : 'There was an error loading the data. Please try again.'
                }
              </p>

              {this.state.retryCount > 0 && (
                <p className="text-xs text-gray-500 mb-4">
                  Retry attempt: {this.state.retryCount}/{maxRetries}
                </p>
              )}

              <div className="space-y-2">
                {canRetry && (
                  <button
                    onClick={this.handleRetry}
                    disabled={this.state.isRetrying}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {this.state.isRetrying ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </>
                    )}
                  </button>
                )}

                {!canRetry && (
                  <div className="text-sm text-gray-500">
                    Maximum retry attempts reached. Please refresh the page.
                  </div>
                )}

                <button
                  onClick={() => window.location.reload()}
                  className="block mx-auto mt-2 text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Refresh Page
                </button>
              </div>

              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Error Details
                  </summary>
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800 font-mono">
                      {this.state.error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AsyncErrorBoundary;

