import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePresenceHeartbeatMutation } from '../store/services/presenceApi';
import usePageVisibility from '../hooks/usePageVisibility';
import { POLLING_INTERVALS } from '../config/polling';

/**
 * Sends periodic heartbeats so the server can track this session as online.
 */
export default function PresenceHeartbeat() {
  const { user, loading } = useAuth();
  const [heartbeat] = usePresenceHeartbeatMutation();
  const tabIdRef = useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);
  const isPageVisible = usePageVisibility();

  useEffect(() => {
    if (!user || loading) return undefined;

    const send = () => {
      if (!isPageVisible) return;
      heartbeat({ tabId: tabIdRef.current }).catch(() => {});
    };

    send();
    const intervalId = window.setInterval(send, POLLING_INTERVALS.PRESENCE_HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        send();
      }
    };
    const onFocus = () => send();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, loading, heartbeat, isPageVisible]);

  return null;
}
