import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect online/offline status
 * Improved to avoid false positives when internet is actually working
 */
export const useOffline = () => {
  const [isOffline, setIsOffline] = useState(false);
  const debounceTimeoutRef = useRef(null);
  const lastOnlineStateRef = useRef(navigator.onLine);

  // Quick connectivity test
  const testConnectivity = async () => {
    try {
      // Try a lightweight connectivity test
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      await fetch('https://www.google.com/favicon.ico?' + Date.now(), {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // Initialize - start optimistic (assume online if navigator says so)
    const initialCheck = async () => {
      if (!navigator.onLine) {
        // If navigator says offline, verify with actual test
        const actuallyOffline = !(await testConnectivity());
        setIsOffline(actuallyOffline);
        lastOnlineStateRef.current = !actuallyOffline;
      } else {
        setIsOffline(false);
        lastOnlineStateRef.current = true;
      }
    };
    
    initialCheck();

    const handleOnline = () => {
      // Clear any pending offline state
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      
      // Immediately set to online when browser confirms
      lastOnlineStateRef.current = true;
      setIsOffline(false);
    };

    const handleOffline = () => {
      // Debounce offline detection to avoid false positives
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(async () => {
        // Double-check with actual connectivity test
        if (!navigator.onLine) {
          const actuallyOffline = !(await testConnectivity());
          if (actuallyOffline) {
            lastOnlineStateRef.current = false;
            setIsOffline(true);
          } else {
            // Browser says offline but we have connectivity - trust connectivity test
            setIsOffline(false);
            lastOnlineStateRef.current = true;
          }
        }
      }, 1500); // Wait 1.5 seconds before showing offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return isOffline;
};

