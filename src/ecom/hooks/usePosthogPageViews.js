import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Lazy import — keeps posthog-js out of the critical bundle
const _track = (...args) => import('../services/posthog.js').then(m => m.track(...args)).catch(() => {});

/**
 * Hook that automatically tracks:
 *  1) `$pageview` on every route change (SPA-aware)
 *  2) `page_duration` when the user leaves a page (route change or tab close)
 *
 * Usage: render <PosthogPageTracker /> once inside your router (App.jsx).
 */
export function usePosthogPageViews() {
  const location = useLocation();
  const entryTime = useRef(Date.now());
  const prevPath = useRef(location.pathname);

  // ── Send page_duration for the previous page ──────────────────────────────
  const flushDuration = (path) => {
    const durationMs = Date.now() - entryTime.current;
    // Only send if > 500ms (ignore instant redirects)
    if (durationMs > 500) {
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      _track('page_duration', {
        path,
        durationMs,
        durationSec: Math.round(durationMs / 1000),
        workspaceId: workspace?._id || workspace?.id || null,
      });
    }
  };

  // ── On route change ───────────────────────────────────────────────────────
  useEffect(() => {
    // Flush duration for the page we are *leaving*
    if (prevPath.current !== location.pathname) {
      flushDuration(prevPath.current);
    }

    // Track pageview for the new page
    _track('$pageview', {
      $current_url: window.location.href,
      path: location.pathname,
    });

    // Reset timer for the new page
    entryTime.current = Date.now();
    prevPath.current = location.pathname;
  }, [location.pathname]);

  // ── On tab close / refresh ────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushDuration(location.pathname);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [location.pathname]);
}

export default usePosthogPageViews;
