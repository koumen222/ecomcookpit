import CreativeAsset from '../models/CreativeAsset.js';

const GIF_URL_RE = /\.gif(?:$|[?#])/i;

/**
 * Enregistre durablement une vidéo finale avec son auteur.
 *
 * Les jobs techniques (montage, traduction, avatar) ont un TTL court. Cette
 * copie dans CreativeAsset permet au super-admin de conserver l'historique
 * complet sans mélanger les scènes intermédiaires et les GIF.
 */
export async function recordFinalCreativeVideo({
  workspaceId,
  userId,
  videoUrl,
  label = 'Vidéo finale',
  productName = '',
  kind = 'final-video',
  format = '',
  durationSec = 0,
  meta = {},
}) {
  try {
    const cleanUrl = String(videoUrl || '').trim();
    if (!workspaceId || !userId || !/^https?:\/\//i.test(cleanUrl) || GIF_URL_RE.test(cleanUrl)) {
      return null;
    }

    const cleanMeta = {
      ...(meta && typeof meta === 'object' ? meta : {}),
      kind: String(kind || 'final-video'),
      final: true,
      ...(format ? { format: String(format) } : {}),
      ...(Number(durationSec) > 0 ? { durationSec: Number(durationSec) } : {}),
    };

    return await CreativeAsset.findOneAndUpdate(
      { workspaceId, type: 'video', videoUrl: cleanUrl },
      {
        $setOnInsert: {
          workspaceId,
          userId,
          type: 'video',
          videoUrl: cleanUrl,
        },
        $set: {
          label: String(label || 'Vidéo finale').slice(0, 200),
          productName: String(productName || '').slice(0, 200),
          meta: cleanMeta,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (err) {
    // L'historisation admin ne doit jamais faire échouer une génération vidéo.
    console.warn('[CreativeFinalVideo] record failed:', err.message);
    return null;
  }
}

export default recordFinalCreativeVideo;
