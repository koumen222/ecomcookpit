// ─────────────────────────────────────────────────────────────────────────────
// Avatar parlant — pipeline lip sync (Creative Center).
//
// Entrées possibles :
//   · IMAGE + texte/voix → 1) TTS Fish Audio (si texte), 2) clip i2v 6 s
//     (Grok/kie : mouvements de tête et de mains, bouche neutre), 3) MuseTalk
//     (endpoint RunPod serverless) synchronise les lèvres sur la voix.
//   · VIDÉO + texte/voix → étapes 1 et 3 seulement (la vidéo bouge déjà).
//
// MuseTalk boucle les frames de la vidéo si la voix est plus longue (frame
// cycling du repo officiel) : un clip de base de 6 s couvre une voix de 30 s.
// Le worker RunPod publie lui-même le mp4 final sur R2 et renvoie l'URL.
//
// Env requis : RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID (+ FISH_API_KEY pour le TTS).
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

const RUNPOD_BASE = 'https://api.runpod.ai/v2';
const rpKey = () => String(process.env.RUNPOD_API_KEY || '').trim();
const rpEndpoint = () => String(process.env.RUNPOD_ENDPOINT_ID || '').trim();

export const isLipSyncConfigured = () => Boolean(rpKey() && rpEndpoint());

async function runpodRequest(path, { method = 'GET', data } = {}) {
  const res = await axios({
    method,
    url: `${RUNPOD_BASE}/${rpEndpoint()}${path}`,
    data,
    headers: { Authorization: `Bearer ${rpKey()}`, 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return res.data;
}

/** Soumet un job MuseTalk → { id }. quality 'pro' (fp32 + fusion large) et
 *  enhance (restauration de visage GFPGAN) par défaut : le « rendu HeyGen ». */
export async function submitLipSync({ videoUrl, audioUrl, quality = 'pro', enhance = true }) {
  const r = await runpodRequest('/run', {
    method: 'POST',
    data: {
      input: {
        video_url: String(videoUrl),
        audio_url: String(audioUrl),
        quality: quality === 'fast' ? 'fast' : 'pro',
        enhance: enhance !== false,
      },
    },
  });
  if (!r?.id) throw new Error('Soumission RunPod refusée (pas de jobId)');
  return r.id;
}

/** Statut normalisé : les erreurs métier du handler (output.error) → FAILED. */
export async function lipSyncStatus(jobId) {
  const r = await runpodRequest(`/status/${jobId}`);
  if (r?.status === 'COMPLETED' && r?.output?.error) {
    return { ...r, status: 'FAILED', error: r.output.error };
  }
  return r;
}

// ── Préréglages de mouvement pour le clip de base (image → vidéo).
//    Le clip est joué par MuseTalk en BOUCLE MIROIR (avant→arrière→avant…,
//    frame_list_cycle du repo) pour couvrir toute la durée de la voix, et la
//    bouche est redessinée sur chaque frame. Conséquences dures sur le prompt :
//    1. Mouvements OSCILLANTS de faible amplitude (balancement, hochements) —
//       un geste directionnel ample paraît « rembobiné » au retour de boucle.
//    2. Bouche FERMÉE et immobile (MuseTalk réécrit la zone bouche ; une
//       bouche qui parle déjà crée des doubles lèvres).
//    3. Les mains ne passent JAMAIS près du visage (elles écraseraient la
//       zone bouche pendant la synchronisation).
//    4. Identité et cadre verrouillés : même personne, mêmes vêtements, même
//       fond, caméra strictement fixe — zéro morphing, zéro apparition. ──
const IDENTITY_LOCK = 'It is EXACTLY the same person for the entire shot: same face, same hairstyle, same clothes, same background, same lighting. The person keeps facing the camera and looking into the lens the whole time — never turns away, never walks, never leaves the frame.';
// Expression NEUTRE STRICTE : MuseTalk dessine la bouche en cohérence avec les
// joues et les plis du visage — la moindre base souriante donne un avatar qui
// « sourit en parlant ». Interdire le sourire partout, pas seulement la bouche.
const MOUTH_LOCK = 'STRICT NEUTRAL EXPRESSION for the entire shot: the mouth stays CLOSED and completely still — lips together, mouth corners RELAXED and LEVEL (never curved upward). ABSOLUTELY NO smiling, no grin, no smirk, no laughing, no talking, no lip movement, no chewing. Cheeks relaxed and low (no raised cheekbones), eyes natural and open (not squinted by a smile), eyebrows neutral. The look of a composed news anchor between sentences. Hands and objects NEVER come near or in front of the face — the whole face stays fully visible at all times.';
const CAMERA_LOCK = 'Locked-off static camera: no zoom, no pan, no dolly, no cut, no transition, one single continuous take.';
const ANTI_ARTIFACTS = 'Realistic human anatomy and physics: hands keep five natural fingers, arms stay attached and natural, no morphing, no warping, no distortion, no extra limbs, no objects or people appearing or disappearing, clothes and background stay identical. Photorealistic, natural lighting, no on-screen text, no captions, no logos.';
const LOOP_HINT = 'All movements are GENTLE, SLOW and OSCILLATING (small pendulum-like motions that sway back and forth around the resting pose), with no abrupt change and no large one-way gesture — the clip must feel seamless when played back and forth in a loop.';

const MOTION_PRESETS = {
  presenter: `Medium close-up of the person addressing the camera like a COMPOSED, SERIOUS news anchor (neutral face, no smile). Motion: soft alternating head nods and slight head tilts, shoulders relaxed with a barely visible sway, one hand making small calm explanatory gestures at LOWER CHEST level (small circles and open palm, low amplitude, far below the chin). ${LOOP_HINT} ${MOUTH_LOCK} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`,
  hands: `Medium shot of the person addressing the camera with expressive HANDS, keeping a COMPOSED, SERIOUS neutral face (no smile). Motion: both hands visible at CHEST level making soft symmetric gestures — open palms turning slightly, gentle small up-and-down movements, fingers relaxed — always BELOW shoulder line and far from the face. Light head nods in rhythm. ${LOOP_HINT} ${MOUTH_LOCK} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`,
  calm: `Medium close-up of the person facing the camera calmly with a COMPOSED neutral face (no smile). Motion: natural breathing visible in the shoulders, very slight head tilts and micro-nods, eyes blinking naturally, hands still or resting out of frame. ${LOOP_HINT} ${MOUTH_LOCK} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`,
};

// ── Jobs du studio Avatar (pipeline complet, en mémoire, TTL 30 min) ──
const avatarJobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, j] of avatarJobs) { if (now - j.createdAt > JOB_TTL_MS) avatarJobs.delete(id); }
}, 5 * 60 * 1000).unref?.();

async function ttsToUrl(text, referenceId) {
  const FISH_API_KEY = process.env.FISH_API_KEY || process.env.FISHAUDIO_API_KEY || '';
  if (!FISH_API_KEY) throw new Error('Voix-off non configurée (FISH_API_KEY)');
  const body = { text: String(text).trim().slice(0, 5000), format: 'mp3', mp3_bitrate: 128, normalize: true, latency: 'normal' };
  if (referenceId) body.reference_id = String(referenceId);
  const fishRes = await axios.post('https://api.fish.audio/v1/tts', body, {
    headers: { Authorization: `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json', model: process.env.FISH_MODEL || 's2.1-pro-free' },
    responseType: 'arraybuffer',
    timeout: 120000,
  });
  const audioBuffer = Buffer.from(fishRes.data);
  if (!audioBuffer?.length) throw new Error('Réponse audio vide');
  const { uploadToR2 } = await import('./cloudflareImagesService.js');
  const up = await uploadToR2(audioBuffer, `avatar-voice-${Date.now()}.mp3`, 'audio/mpeg');
  if (!up?.success || !up.url) throw new Error(up?.error || 'Publication audio impossible');
  return up.url;
}

async function baseVideoFromImage(imageUrl, motionPrompt) {
  // Même chaîne de providers que les clips du montage : kie (Grok) → xAI → fal.
  // 720p : le visage occupe plus de pixels → le crop 256px de MuseTalk est
  // beaucoup plus net (dents, lèvres) — prérequis du « rendu HeyGen ».
  const { isKieVideoConfigured, isXaiConfigured, isFalConfigured, grokImageToVideo, xaiImageToVideo, falImageToVideo } = await import('./falVideoService.js');
  const providers = [
    ['grok', isKieVideoConfigured(), () => grokImageToVideo(motionPrompt, imageUrl, { durationSec: 6, resolution: '720p' })],
    ['xai', isXaiConfigured(), () => xaiImageToVideo(motionPrompt, imageUrl, { durationSec: 6, resolution: '720p' })],
    ['fal', isFalConfigured(), () => falImageToVideo(motionPrompt, imageUrl, { durationSec: 6 })],
  ].filter(([, ok]) => ok);
  if (!providers.length) throw new Error('Aucun provider vidéo configuré (KIE_API_KEY / XAI_API_KEY / FAL_KEY)');
  const failures = [];
  for (const [name, , run] of providers) {
    try { return await run(); } catch (e) { failures.push(`${name} : ${e.message}`); }
  }
  throw new Error(`Clip de mouvement impossible — ${failures.join(' ; ')}`);
}

async function runAvatarPipeline(job) {
  try {
    // 1. Voix (texte → mp3 R2) si aucune voix fournie.
    if (!job.audioUrl) {
      job.step = 'voice'; job.progress = 8;
      job.audioUrl = await ttsToUrl(job.text, job.voiceRefId);
    }
    // 2. Clip de base si la source est une image : mouvements, bouche neutre.
    //    Un prompt personnalisé reçoit QUAND MÊME tous les verrous (boucle,
    //    bouche fermée, identité, caméra fixe, anti-artefacts) — non négociable.
    if (!job.videoUrl) {
      job.step = 'motion'; job.progress = 25;
      const prompt = job.motionPrompt
        ? `${String(job.motionPrompt).slice(0, 400)}. ${LOOP_HINT} ${MOUTH_LOCK} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`
        : (MOTION_PRESETS[job.motion] || MOTION_PRESETS.presenter);
      job.videoUrl = await baseVideoFromImage(job.imageUrl, prompt);
    }
    // 3. Lip sync MuseTalk (RunPod) — poll jusqu'à 15 min.
    job.step = 'lipsync'; job.progress = 55;
    const rpJobId = await submitLipSync({ videoUrl: job.videoUrl, audioUrl: job.audioUrl });
    job.runpodId = rpJobId;
    const deadline = Date.now() + 15 * 60 * 1000;
    for (;;) {
      if (Date.now() > deadline) throw new Error('Lip sync trop long (timeout 15 min)');
      await new Promise((r) => setTimeout(r, 5000));
      const st = await lipSyncStatus(rpJobId).catch(() => null);
      if (!st) continue;
      if (st.status === 'COMPLETED') {
        job.url = st.output?.video_url || '';
        job.durationSec = st.output?.duration_s || null;
        if (!job.url) throw new Error('Réponse lip sync sans URL vidéo');
        break;
      }
      if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(st.status)) {
        throw new Error(st.error || st.output?.error || `Lip sync ${st.status}`);
      }
      // IN_QUEUE / IN_PROGRESS : progression douce 55 → 95
      job.progress = Math.min(95, (job.progress || 55) + 2);
    }
    job.step = 'done'; job.progress = 100; job.status = 'done';
  } catch (e) {
    job.status = 'error';
    job.error = e.message || 'Génération impossible';
  }
}

/** Crée un job avatar et lance le pipeline en tâche de fond → jobId. */
export function createAvatarJob({ imageUrl = '', videoUrl = '', audioUrl = '', text = '', voiceRefId = '', motion = 'presenter', motionPrompt = '' }) {
  const id = `lip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id, createdAt: Date.now(), status: 'running', step: 'start', progress: 2,
    imageUrl, videoUrl, audioUrl, text, voiceRefId, motion, motionPrompt,
    url: '', durationSec: null, error: '',
  };
  avatarJobs.set(id, job);
  setImmediate(() => runAvatarPipeline(job));
  return id;
}

export function getAvatarJob(id) {
  const j = avatarJobs.get(String(id || ''));
  if (!j) return null;
  return { id: j.id, status: j.status, step: j.step, progress: j.progress, url: j.url, durationSec: j.durationSec, error: j.error };
}
