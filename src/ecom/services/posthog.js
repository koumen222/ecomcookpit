import posthog from 'posthog-js';

// ─── Configuration ────────────────────────────────────────────────────────────
const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ||
  import.meta.env.VITE_PUBLIC_POSTHOG_KEY ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_POSTHOG_KEY) ||
  '';

const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ||
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_POSTHOG_HOST) ||
  'https://app.posthog.com';

// ─── Guards ───────────────────────────────────────────────────────────────────
let _initialized = false;

function isEnabled() {
  return _initialized && !!POSTHOG_KEY;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Call once at app startup (main.jsx). No-op if key is missing or already init.
export function initAnalytics() {
  // CRITICAL: Guard against multiple initializations (React StrictMode, hot reload, etc.)
  if (typeof window !== 'undefined' && window.posthogInitialized) {
    console.log('[PostHog] Already initialized, skipping...');
    return;
  }

  if (_initialized || !POSTHOG_KEY) {
    if (!POSTHOG_KEY) {
      console.warn('[PostHog] Missing POSTHOG key (VITE_POSTHOG_KEY or VITE_PUBLIC_POSTHOG_KEY) — analytics disabled.');
    }
    return;
  }

  // Check consent: if user explicitly refused, start in opted-out mode
  const consent = JSON.parse(localStorage.getItem('ecom_privacy_consent') || 'null');
  const hasRefused = consent && consent.accepted === false;

  // Detect dev environment
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // SPA: we capture pageviews manually via the hook
    capture_pageview: false,
    capture_pageleave: true,
    // Autocapture enabled for clicks / heatmaps
    autocapture: !isDev, // Disable in dev to reduce noise
    // Session recording (heatmaps, session replays)
    // CRITICAL: Disable in dev to prevent request spam and loops
    disable_session_recording: isDev,
    enable_recording_consent_check: true,
    // Privacy: mask sensitive inputs by default
    mask_all_text: false,
    mask_all_element_attributes: false,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
        color: false,
        date: false,
        'datetime-local': false,
        email: false,
        month: false,
        number: false,
        range: false,
        search: false,
        tel: false,
        text: false,
        time: false,
        url: false,
        week: false,
      },
      // CSS selector for elements to block from recording entirely
      blockSelector: '[data-ph-no-capture]',
    },
    // Privacy: properties to never send
    sanitize_properties: (properties) => {
      const forbidden = ['password', 'token', 'credit_card', 'card_number', 'cvv', 'secret'];
      for (const key of Object.keys(properties)) {
        if (forbidden.some((f) => key.toLowerCase().includes(f))) {
          delete properties[key];
        }
      }
      return properties;
    },
    // Respect Do Not Track
    respect_dnt: true,
    persistence: 'localStorage+cookie',
    loaded: (ph) => {
      // If user previously refused consent → opt out
      if (hasRefused) {
        ph.opt_out_capturing();
      }
    },
  });

  _initialized = true;
  
  // Mark as initialized globally to prevent re-init in React StrictMode
  if (typeof window !== 'undefined') {
    window.posthogInitialized = true;
  }
  
  console.log('[PostHog] Initialized successfully', { isDev });
}

// ─── Identify ─────────────────────────────────────────────────────────────────
// Call after login / register / profile load when user + workspace are available.
export function identifyUser(user, workspace) {
  if (!isEnabled() || !user) return;

  const userId = user._id || user.id;
  if (!userId) return;

  posthog.identify(userId, {
    email: user.email,
    name: user.name || user.fullName || undefined,
    role: user.role,
  });

  if (workspace) {
    const wsId = workspace._id || workspace.id;
    posthog.group('workspace', wsId, {
      name: workspace.name,
      plan: workspace.plan || workspace.subscription || undefined,
      workspaceId: wsId,
    });
  }
}

// ─── Track ────────────────────────────────────────────────────────────────────
export function track(event, props = {}) {
  if (!isEnabled()) return;
  posthog.capture(event, props);
}

// ─── Reset (logout) ──────────────────────────────────────────────────────────
// Clears the identified user so the next session is anonymous.
export function resetAnalytics() {
  if (!isEnabled()) return;
  posthog.reset();
}

// ─── Consent ──────────────────────────────────────────────────────────────────
// Tie to PrivacyBanner accept / decline.
export function setConsent(enabled) {
  if (!_initialized || !POSTHOG_KEY) return;

  if (enabled) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

// ─── Direct posthog instance (escape hatch) ──────────────────────────────────
export function getPosthog() {
  return isEnabled() ? posthog : null;
}
