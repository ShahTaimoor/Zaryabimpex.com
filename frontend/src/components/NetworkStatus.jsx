import React, { useState, useEffect, useRef } from 'react';
import { WifiOff } from 'lucide-react';
import { showWarningToast, showSuccessToast } from '../utils/errorHandler';
import { useHealthQuery } from '../store/api';

const NetworkStatus = () => {
  const [wasOffline, setWasOffline] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const failureCountRef = useRef(0);
  const lastSuccessTimeRef = useRef(Date.now());
  
  // Use RTK Query health check with polling every 30 seconds
  const { data, error, isLoading, isError, isSuccess } = useHealthQuery(undefined, {
    pollingInterval: 30000, // Poll every 30 seconds
    refetchOnMountOrArgChange: true,
    skip: false,
    // Don't show error toasts for health check failures
    errorPolicy: 'all',
  });

  // Determine if backend is online - consider it online if we have data or if it's still loading (initial load)
  const isBackendOnline = (isSuccess && data) || (isLoading && !wasOffline);

  useEffect(() => {
    // Track consecutive failures
    if (isError && !isLoading) {
      failureCountRef.current += 1;
      // Only show offline after 2 consecutive failures to avoid false positives
      if (failureCountRef.current >= 2 && !wasOffline) {
        setWasOffline(true);
        setShowOfflineBanner(true);
        showWarningToast('Backend server is not reachable. Please ensure the server is running.');
      }
    } else if (isSuccess && data) {
      // Reset failure count on success
      failureCountRef.current = 0;
      lastSuccessTimeRef.current = Date.now();
      
      // Show restored message only if we were previously offline
      if (wasOffline) {
        setWasOffline(false);
        setShowOfflineBanner(false);
        showSuccessToast('Backend server connection restored!');
      }
    }
  }, [isError, isSuccess, isLoading, data, wasOffline]);

  // Don't show banner during initial load or when backend is online
  if (!showOfflineBanner || isBackendOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 text-center text-sm">
      <div className="flex items-center justify-center space-x-2">
        <WifiOff className="h-4 w-4" />
        <span>Backend server is not running. Please start the server at localhost:5000</span>
      </div>
    </div>
  );
};

export default NetworkStatus;
