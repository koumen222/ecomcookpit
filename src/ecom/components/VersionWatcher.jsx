/**
 * VersionWatcher (silent mode)
 *
 * Le banner "Nouvelle version disponible" a été retiré (trop intrusif).
 * Le composant ne fait plus que installer le handler global ChunkLoadError
 * qui force un reload UNIQUEMENT quand le navigateur ne peut pas charger un
 * chunk JS (typiquement après un deploy qui a supprimé les anciens fichiers).
 *
 * Pas de polling, pas de banner, aucun rendu.
 */

import { useEffect } from 'react';

const CHUNK_RELOAD_FLAG = 'scalor_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000; // empêche les reload-loops

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

// ─── Main component — silent ──
// Aucun rendu. Installe seulement le handler global ChunkLoadError.
// Si demain on veut afficher un banner discret, ré-importer useState/useRef et
// remettre la logique de polling (voir historique git).
export default function VersionWatcher() {
  useEffect(() => {
    installChunkLoadErrorHandler();
  }, []);
  return null;
}
