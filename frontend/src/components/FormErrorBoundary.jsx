import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class FormErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Error handled by error boundary UI
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="card">
          <div className="card-content">
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Form Error
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                There was an error loading this form. Please try again.
              </p>
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default FormErrorBoundary;
