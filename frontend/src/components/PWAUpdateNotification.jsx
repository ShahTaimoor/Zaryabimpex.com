import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const PWAUpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Check for updates every hour
        setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        // Listen for service worker updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                setUpdateAvailable(true);
                toast(
                  (t) => (
                    <div className="flex items-center space-x-3">
                      <span>New version available!</span>
                      <button
                        onClick={() => {
                          updateServiceWorker(reg);
                          toast.dismiss(t.id);
                        }}
                        className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ),
                  {
                    duration: 10000,
                    icon: '🔄',
                  }
                );
              }
            });
          }
        });
      });
    }
  }, []);

  const updateServiceWorker = async (reg) => {
    if (!reg || !reg.waiting) {
      return;
    }

    // Tell the waiting service worker to skip waiting
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex items-start space-x-3">
        <RefreshCw className="h-5 w-5 text-primary-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Update Available</h3>
          <p className="text-sm text-gray-600 mt-1">
            A new version of the app is available. Update now to get the latest features.
          </p>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={() => registration && updateServiceWorker(registration)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={() => setUpdateAvailable(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PWAUpdateNotification;

