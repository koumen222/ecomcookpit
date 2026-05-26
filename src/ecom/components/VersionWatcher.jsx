/**
 * VersionWatcher
 *
 * Évite les erreurs de rechargement après deploy en synchronisant le frontend
 * avec le backend.
 *
 * Comment ça marche :
 *   1. Au mount, on appelle GET /api/version et on mémorise la version courante.
 *   2. Toutes les 60 secondes (et au changement d'onglet), on re-fetch.
 *   3. Si la version a changé → on affiche un banner non-bloquant en bas qui
 *      propose à l'utilisateur de recharger pour récupérer la nouvelle version.
 *   4. En parallèle, un handler global intercepte les `ChunkLoadError` (qui
 *      arrivent quand le navigateur essaie de charger un chunk JS supprimé par
 *      un nouveau deploy) et force un reload — une seule fois grâce à un flag
 *      sessionStorage anti-boucle.
 */

import React, { useEffect, useState, useRef } from 'react';

const VERSION_ENDPOINT = '/api/version';
const POLL_INTERVAL_MS = 60_000; // 1 min
const CHUNK_RELOAD_FLAG = 'scalor_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000; // empêche les reload-loops

// ─── API base (même logique que ecomApi) ──
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'scalor.net' || host === 'www.scalor.net') return 'https://api.scalor.net';
  // Sous-domaines stores → API publique
  if (host.endsWith('.scalor.net')) return 'https://api.scalor.net';
  // Dev — vite proxy '/api'
  return '';
})();

async function fetchVersion() {
  try {
    const res = await fetch(`${API_BASE}${VERSION_ENDPOINT}`, {
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.version || null;
  } catch {
    return null;
  }
}

// ─── Global ChunkLoadError handler (set once at module load) ──
let chunkHandlerInstalled = false;
function installChunkLoadErrorHandler() {
  if (chunkHandlerInstalled || typeof window === 'undefined') return;
  chunkHandlerInstalled = true;

  const isChunkError = (err) => {
    if (!err) return false;
    const msg = (err.message || err.reason?.message || String(err)) || '';
    return (
      /ChunkLoadError/i.test(msg) ||
      /Loading chunk/i.test(msg) ||
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg)
    );
  };

  const tryReload = (err) => {
    if (!isChunkError(err)) return;
    try {
      const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_FLAG) || '0', 10);
      if (Date.now() - last < CHUNK_RELOAD_COOLDOWN_MS) {
        // On a déjà reload récemment — on ne refait pas la boucle, on log.
        console.warn('[VersionWatcher] Chunk error after reload — possible build mismatch, not reloading again', err);
        return;
      }
      sessionStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()));
      console.warn('[VersionWatcher] Chunk load error — reloading to fetch latest assets', err);
      // Petit délai pour laisser le navigateur écrire le sessionStorage
      setTimeout(() => window.location.reload(), 50);
    } catch (e) {
      console.error('[VersionWatcher] Failed to handle chunk error:', e);
    }
  };

  window.addEventListener('error', (e) => tryReload(e.error || e));
  window.addEventListener('unhandledrejection', (e) => tryReload(e.reason || e));
}

// ─── Banner UI — non bloquant, en bas ──
function ReloadBanner({ onReload, onDismiss }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[60]"
      style={{ animation: 'vw-slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      <style>{`
        @keyframes vw-slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div className="bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-9-9c2.5 0 4.78 1 6.45 2.55" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Nouvelle version disponible</p>
          <p className="text-xs text-gray-300 mt-0.5">Rechargez pour récupérer les dernières fonctionnalités.</p>
        </div>
        <button
          onClick={onReload}
          className="shrink-0 px-3.5 h-9 rounded-full bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-all duration-200 ease-out"
        >
          Recharger
        </button>
        <button
          onClick={onDismiss}
          aria-label="Plus tard"
          className="shrink-0 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200 ease-out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──
export default function VersionWatcher() {
  const [needsReload, setNeedsReload] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const initialVersion = useRef(null);
  const pollTimer = useRef(null);

  useEffect(() => {
    installChunkLoadErrorHandler();
    let cancelled = false;

    // 1. Bootstrap : récupère la version courante (avec retry si backend pas prêt)
    const init = async () => {
      let attempts = 0;
      const maxAttempts = 5;
      while (attempts < maxAttempts && !cancelled) {
        const v = await fetchVersion();
        if (cancelled) return;
        if (v) {
          initialVersion.current = v;
          return;
        }
        attempts++;
        await new Promise(r => setTimeout(r, 2000 * attempts));
      }
    };

    // 2. Check : compare à la version mémorisée
    const check = async () => {
      if (!initialVersion.current) {
        const v = await fetchVersion();
        if (cancelled) return;
        if (v) initialVersion.current = v;
        return;
      }
      const latest = await fetchVersion();
      if (cancelled || !latest) return;
      if (latest !== initialVersion.current) {
        setNeedsReload(true);
      }
    };

    init();

    // Polling
    pollTimer.current = setInterval(check, POLL_INTERVAL_MS);

    // Quand l'utilisateur revient sur l'onglet → check immédiat
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (pollTimer.current) clearInterval(pollTimer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!needsReload || dismissed) return null;

  return (
    <ReloadBanner
      onReload={() => {
        // Force un reload "hard" — Cache-Control: no-cache sur le HTML garantit
        // que le navigateur récupère bien le nouveau document
        window.location.reload();
      }}
      onDismiss={() => setDismissed(true)}
    />
  );
}
