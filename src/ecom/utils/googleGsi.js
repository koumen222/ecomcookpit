/**
 * Singleton GSI (Google Identity Services) loader.
 *
 * Guarantees that:
 *  1. The <script> tag is injected only once per page lifetime.
 *  2. google.accounts.id.initialize() is called only once, even if multiple
 *     components (Login, Register, AffiliateLogin…) mount at the same time or
 *     React StrictMode double-invokes effects.
 *
 * Usage:
 *   loadGsi(clientId, callback)   → loads script + initializes
 *   resetGsi()                    → call in component cleanup so the next mount
 *                                   re-registers its own callback (optional but safe)
 */

const FLAG = '__SCALOR_GSI_INIT__';

let _pending = [];   // callbacks waiting for script load
let _loading = false;

function runInit(clientId, callback) {
  if (!window.google?.accounts?.id) return;
  if (window[FLAG]) {
    // Already initialized — just re-register the button render via the existing instance.
    // Google GSI tolerates calling renderButton after init.
    return;
  }
  window[FLAG] = true;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback,
    cancel_on_tap_outside: false,
  });
}

export function loadGsi(clientId, callback) {
  if (!clientId) return;

  const cb = () => runInit(clientId, callback);

  // Script already loaded
  if (window.google?.accounts?.id) {
    cb();
    return;
  }

  // Script already in DOM — wait for it
  const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (existing) {
    existing.addEventListener('load', cb);
    return;
  }

  // Inject script once
  _pending.push(cb);
  if (_loading) return;
  _loading = true;

  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    _pending.forEach(fn => fn());
    _pending = [];
  };
  script.onerror = () => {
    console.error('[GSI] Failed to load Google Identity Services script');
    _pending = [];
    _loading = false;
  };
  document.head.appendChild(script);
}

export function renderGsiButton(containerId, options = {}) {
  if (!window.google?.accounts?.id) return;
  const container = document.getElementById(containerId);
  if (!container) return;
  const width = Math.min(container.offsetWidth || 400, 400);
  window.google.accounts.id.renderButton(container, {
    theme: 'filled_black',
    size: 'large',
    width,
    shape: 'pill',
    locale: 'fr',
    ...options,
  });
}

// Call this if you need to allow re-initialization (e.g. different client_id).
// Not normally needed — one client_id per app.
export function resetGsi() {
  delete window[FLAG];
}
