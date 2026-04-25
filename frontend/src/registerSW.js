/**
 * Service Worker Registration Utility
 * Handles registration, update detection, and automatic page reload.
 */

export function registerServiceWorker() {
  // Only run in production and if supported by the browser
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    // The path to the service worker file
    // Note: VitePWA generates this file in the root of the dist directory
    const swUrl = '/sw.js';

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('PWA: Service Worker registered successfully:', registration.scope);

        // Check for updates on registration
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // At this point, the updated precached content has been fetched,
                // and the new service worker is ready to take control.
                console.log('PWA: New version detected, updating...');
                
                // Since we use skipWaiting() in sw.js, the new worker will
                // immediately become active and trigger 'controllerchange'.
              } else {
                // Content is cached for offline use.
                console.log('PWA: Content is cached for offline use.');
              }
            }
          };
        };
      })
      .catch((error) => {
        console.error('PWA: Error during service worker registration:', error);
      });
  });

  // Automatically reload the page when a new service worker takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('PWA: Controller changed. Reloading page to apply updates...');
    window.location.reload();
  });
}
