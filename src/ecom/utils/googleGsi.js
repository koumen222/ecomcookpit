/**
 * Singleton GSI (Google Identity Services) loader.
 *
 * Root cause of "initialize() called multiple times":
 *   Login, Register, AffiliateLogin, AffiliateRegister each called
 *   google.accounts.id.initialize() independently → GSI SDK logs the warning
 *   AND the COOP/postMessage error fires because multiple init calls confuse
 *   the internal popup-origin bookkeeping inside the GSI iframe.
 *
 * Fix strategy:
 *   - One global mutable callback ref — all pages share it.
 *   - initialize() is called exactly ONCE per page lifetime.
 *   - Each page registers its callback; the shared wrapper always delegates
 *     to the LATEST registered callback, so navigating Login→Register works.
 *   - renderButton() can be called multiple times safely (GSI supports it).
 */

// The single callback that GSI will ever see.
// All pages write their handler here; GSI always calls THIS function.
let _activeCallback = null;
function _masterCallback(response) {
  if (_activeCallback) _activeCallback(response);
}

let _initialized = false;
let _scriptLoaded = false;
let _onLoadQueue = [];

function _onScriptLoad() {
  _scriptLoaded = true;
  _onLoadQueue.forEach(fn => fn());
  _onLoadQueue = [];
}

function _doInit(clientId) {
  if (_initialized) return;
  if (!window.google?.accounts?.id) return;
  _initialized = true;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: _masterCallback,
    cancel_on_tap_outside: false,
  });
}

function _ensureScript(clientId, onReady) {
  // Script already loaded and GSI ready
  if (_scriptLoaded && window.google?.accounts?.id) {
    _doInit(clientId);
    onReady();
    return;
  }

  // Script tag already in DOM — queue onto its load event
  const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (existing) {
    if (_scriptLoaded) {
      _doInit(clientId);
      onReady();
    } else {
      _onLoadQueue.push(() => { _doInit(clientId); onReady(); });
    }
    return;
  }

  // First caller: inject the script
  _onLoadQueue.push(() => { _doInit(clientId); onReady(); });
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = _onScriptLoad;
  script.onerror = () => console.error('[GSI] Failed to load Google Identity Services');
  document.head.appendChild(script);
}

/**
 * Register this page's callback and ensure GSI is loaded + initialized.
 * Safe to call from multiple components — initialize() fires only once.
 *
 * @param {string} clientId   - VITE_GOOGLE_CLIENT_ID
 * @param {function} callback - Called with the credential response
 */
export function loadGsi(clientId, callback) {
  if (!clientId) return;
  // Always update the active callback — no re-init needed.
  _activeCallback = callback;
  _ensureScript(clientId, () => {
    // no-op: _doInit already called inside _ensureScript
  });
}

/**
 * Render a Google Sign-In button into a DOM element.
 * Safe to call multiple times; GSI handles re-render gracefully.
 *
 * @param {string} containerId  - id of the container element
 * @param {object} options      - GSI renderButton options overrides
 */
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
