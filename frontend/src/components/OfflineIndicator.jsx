import React, { useState } from 'react';
import { WifiOff, X, RefreshCw } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';

export const OfflineIndicator = () => {
  const isOffline = useOffline();
  const [isDismissed, setIsDismissed] = useState(false);

  const handleRefresh = () => {
    // Force a page reload to refresh connection status
    window.location.reload();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (!isOffline || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-pulse max-w-sm">
      <WifiOff className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium flex-grow">You're offline</span>
      <button
        onClick={handleRefresh}
        className="p-1 hover:bg-yellow-600 rounded transition-colors"
        title="Refresh connection"
        aria-label="Refresh connection"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-yellow-600 rounded transition-colors"
        title="Dismiss"
        aria-label="Dismiss offline indicator"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default OfflineIndicator;

