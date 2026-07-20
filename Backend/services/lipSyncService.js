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

// endpointId optionnel : MuseTalk par défaut, InfiniteTalk pour le Premium.
const itEndpoint = () => String(process.env.RUNPOD_INFINITETALK_ENDPOINT_ID || '').trim();
const itKey = () => String(process.env.RUNPOD_INFINITETALK_API_KEY || process.env.RUNPOD_API_KEY || '').trim();
const keyForEndpoint = (endpointId) => (endpointId && endpointId === itEndpoint() ? itKey() : rpKey());
export const isInfiniteTalkConfigured = () => Boolean(itKey() && itEndpoint());

// Erreur axios → message exploitable : SERVICE + code HTTP + extrait du corps.
// Sans ça, job.error affiche « Request failed with status code 403 » sans dire
// QUI a refusé (Fish ? RunPod ? kie ?). err.response est préservé pour les
// catch en aval qui testent le status (ex. submitInfiniteTalk).
function httpErr(service, err) {
  const st = err?.response?.status;
  if (!st) return new Error(`${service} : ${err.message}`);
  let body = '';
  try {
    const d = err.response.data;
    const txt = Buffer.isBuffer(d) ? d.toString('utf8') : typeof d === 'string' ? d : JSON.stringify(d);
    body = String(txt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch { /* body illisible */ }
  const e = new Error(`${service} a répondu HTTP ${st}${body ? ` — ${body}` : ''}`);
  e.response = err.response;
  return e;
}

async function runpodRequest(path, { method = 'GET', data, endpointId } = {}) {
  const key = keyForEndpoint(endpointId);
  try {
    const res = await axios({
      method,
      url: `${RUNPOD_BASE}/${endpointId || rpEndpoint()}${path}`,
      data,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    return res.data;
  } catch (err) {
    const which = endpointId && endpointId === itEndpoint() ? 'RunPod InfiniteTalk' : 'RunPod MuseTalk';
    throw httpErr(which, err);
  }
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
export async function lipSyncStatus(jobId, endpointId) {
  const r = await runpodRequest(`/status/${jobId}`, { endpointId });
  if (r?.status === 'COMPLETED' && r?.output?.error) {
    return { ...r, status: 'FAILED', error: r.output.error };
  }
  return r;
}

/** Soumet un job InfiniteTalk (Premium self-host) → { id }. */
export async function submitInfiniteTalk({ imageUrl, audioUrl, prompt = '' }) {
  if (!isInfiniteTalkConfigured()) {
    throw new Error('Premium non configuré — ajoute RUNPOD_INFINITETALK_ENDPOINT_ID et, si l’endpoint est dans un autre compte RunPod, RUNPOD_INFINITETALK_API_KEY dans le .env backend');
  }
  let r;
  try {
    r = await runpodRequest('/run', {
      method: 'POST',
      endpointId: itEndpoint(),
      data: {
        input: {
          image_url: String(imageUrl),
          audio_url: String(audioUrl),
          ...(prompt ? { prompt: String(prompt).slice(0, 800) } : {}),
          size: String(process.env.INFINITETALK_SIZE || '720'),
          sample_steps: Math.max(8, Math.min(50, Number(process.env.INFINITETALK_STEPS) || 40)),
        },
      },
    });
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      throw new Error('RunPod refuse l’accès à l’endpoint Premium — ajoute RUNPOD_INFINITETALK_API_KEY depuis le compte qui possède cet endpoint, ou recrée l’endpoint dans le même compte que MuseTalk');
    }
    throw err;
  }
  if (!r?.id) throw new Error('Soumission RunPod (InfiniteTalk) refusée');
  return r.id;
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
// LA PERSONNE PARLE dans le clip de base — retour d'expérience : MuseTalk
// repeint la bouche sur chaque frame, mais s'appuie sur la mâchoire et les
// joues environnantes. Une base bouche fermée et figée donne des lèvres
// timides (« il parle bouche fermée ») ; une base qui ARTICULE naturellement
// donne un lip sync ample et crédible — c'est l'usage nominal du modèle
// (toutes les démos du repo sont des talking heads). Le contenu prononcé dans
// la base n'a aucune importance : la bouche est entièrement réécrite.
// L'anti-sourire reste : coins de bouche horizontaux, joues détendues.
const TALKING_LOCK = 'The person is TALKING to the camera the WHOLE time: the mouth articulates words clearly and continuously at a calm, natural speaking pace — jaw visibly opening and closing, lips forming syllables — as if explaining something. SERIOUS COMPOSED expression while speaking: mouth corners stay LEVEL (never curved up), NO smiling, no grin, no laughing, cheeks relaxed (no raised cheekbones), eyes natural and open, eyebrows neutral — the delivery of a news anchor reading the news. Hands and objects NEVER come near or in front of the face — the whole face stays fully visible at all times.';
const CAMERA_LOCK = 'Locked-off static camera: no zoom, no pan, no dolly, no cut, no transition, one single continuous take.';
const ANTI_ARTIFACTS = 'Realistic human anatomy and physics: hands keep five natural fingers, arms stay attached and natural, no morphing, no warping, no distortion, no extra limbs, no objects or people appearing or disappearing, clothes and background stay identical. Photorealistic, natural lighting, no on-screen text, no captions, no logos.';
const LOOP_HINT = 'CRITICAL — ONE SINGLE REPEATING GESTURE CYCLE for the whole clip: the person repeats EXACTLY the same small rhythmic motion over and over at a steady tempo (like a speaker\'s natural "beat gesture" accompanying each sentence). Do NOT change gestures mid-clip, do NOT introduce a second different movement, no variety: one motif, repeated identically, gentle and low-amplitude, swaying around the resting pose. First and last frames nearly identical, so the clip loops invisibly and the person appears to be talking continuously.';

const MOTION_PRESETS = {
  presenter: `Medium close-up of the person SPEAKING to the camera like a composed, serious news presenter. THE ONE REPEATING MOTION: one hand at LOWER CHEST level marking the rhythm of the speech with the same small open-palm beat, over and over (down on each phrase, back to rest), while the head gives the same slight nod in tempo — this exact cycle repeats identically for the whole clip. Shoulders relaxed. ${TALKING_LOCK} ${LOOP_HINT} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`,
  hands: `Medium shot of the person SPEAKING to the camera. THE ONE REPEATING MOTION: both hands at CHEST level, palms open, making the same small symmetric outward-then-back beat in rhythm with the speech, repeated identically over and over — always BELOW the shoulder line and far from the face — with the same light head nod each cycle. ${TALKING_LOCK} ${LOOP_HINT} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`,
  calm: `Medium close-up of the person SPEAKING calmly to the camera. THE ONE REPEATING MOTION: the same gentle micro-nod repeated at a steady quiet tempo, natural breathing visible in the shoulders, eyes blinking naturally, hands still or resting out of frame. ${TALKING_LOCK} ${LOOP_HINT} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`,
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
  let fishRes;
  try {
    fishRes = await axios.post('https://api.fish.audio/v1/tts', body, {
      headers: { Authorization: `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json', model: process.env.FISH_MODEL || 's2.1-pro-free' },
      responseType: 'arraybuffer',
      timeout: 120000,
    });
  } catch (err) {
    throw httpErr('Fish Audio (voix off)', err);
  }
  const audioBuffer = Buffer.from(fishRes.data);
  if (!audioBuffer?.length) throw new Error('Réponse audio vide');
  const { uploadToR2 } = await import('./cloudflareImagesService.js');
  const up = await uploadToR2(audioBuffer, `avatar-voice-${Date.now()}.mp3`, 'audio/mpeg');
  if (!up?.success || !up.url) throw new Error(up?.error || 'Publication audio impossible');
  return up.url;
}

// ── PREMIUM : OmniHuman 1.5 (ByteDance) via kie.ai — UNE seule étape :
//    image + audio (+ prompt) → vidéo complète 1080p, lèvres, émotions et
//    GESTES pilotés par le sens de l'audio. Remplace base Grok + MuseTalk.
//    Contrainte modèle : audio < 60 s (≤ 15 s recommandé par kie).
const OMNI_PROMPT = 'The person speaks directly to the camera like a confident, composed seller presenting the product held in hand. Natural gestures and expressions follow the speech. Keep the exact same face, clothes, product and background as the image. No on-screen text.';

async function omniHumanTalkingVideo(imageUrl, audioUrl, motionPrompt = '', estimatedSec = 0) {
  const { submitKieTask, pollKieTask } = await import('./nanoBananaService.js');
  // Tarif kie constaté : 27 crédits/s (~0,135 $/s), IDENTIQUE en 720p et
  // 1080p. À prix égal → 1080p dès que l'audio ≤ 28 s (limite modèle : 30 s
  // en 1080p, 60 s en 720p) ; 720p seulement pour les scripts longs.
  // Surcharge manuelle : KIE_OMNIHUMAN_RESOLUTION=720|1080.
  const autoRes = estimatedSec > 0 && estimatedSec <= 28 ? '1080' : '720';
  const input = {
    image_url: String(imageUrl),
    audio_url: String(audioUrl),
    prompt: String(motionPrompt || OMNI_PROMPT).slice(0, 290),
    output_resolution: String(process.env.KIE_OMNIHUMAN_RESOLUTION || autoRes),
    // Mode rapide (qualité légèrement réduite) — souvent facturé moins cher.
    // Teste la consommation réelle avec KIE_OMNIHUMAN_FAST=true sur un clip
    // de 5 s et compare les crédits débités dans la console kie.
    ...(String(process.env.KIE_OMNIHUMAN_FAST || '') === 'true' ? { pe_fast_mode: true } : {}),
  };
  // Slug du modèle côté kie : surcharge par env, avec repli automatique sur
  // la variante préfixée vendeur si la première soumission est refusée.
  const primary = process.env.KIE_OMNIHUMAN_MODEL || 'omnihuman-1-5';
  let taskId;
  try {
    taskId = await submitKieTask({ model: primary, input }, 3);
  } catch (e) {
    const alt = primary.includes('/') ? primary.split('/').pop() : `bytedance/${primary}`;
    taskId = await submitKieTask({ model: alt, input }, 3);
  }
  return pollKieTask(taskId, { mediaType: 'video', maxWaitMs: 12 * 60 * 1000, label: 'OmniHuman 1.5' });
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

    // ── TIER PREMIUM : InfiniteTalk self-host (RunPod) — image + voix →
    //    vidéo complète, gestes pilotés par l'audio, coût GPU brut. ──
    if (job.tier === 'premium') {
      if (!job.imageUrl) throw new Error('Le mode Premium part d\'une image (pas d\'une vidéo)');
      job.step = 'infinitetalk'; job.progress = 25;
      const rpId = await submitInfiniteTalk({ imageUrl: job.imageUrl, audioUrl: job.audioUrl, prompt: job.motionPrompt });
      job.runpodId = rpId;
      const deadline = Date.now() + 45 * 60 * 1000; // 720p 40 steps : long
      for (;;) {
        if (Date.now() > deadline) throw new Error('Génération Premium trop longue (timeout 45 min)');
        await new Promise((r) => setTimeout(r, 8000));
        const st = await lipSyncStatus(rpId, itEndpoint()).catch(() => null);
        if (!st) continue;
        if (st.status === 'COMPLETED') {
          job.url = st.output?.video_url || '';
          job.durationSec = st.output?.duration_s || null;
          if (!job.url) throw new Error('Réponse InfiniteTalk sans URL vidéo');
          break;
        }
        if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(st.status)) {
          throw new Error(st.error || st.output?.error || `InfiniteTalk ${st.status}`);
        }
        job.progress = Math.min(95, (job.progress || 25) + 1);
      }
      job.step = 'done'; job.progress = 100; job.status = 'done';
      return;
    }

    // ── TIER CINÉMA : OmniHuman 1.5 via kie (1080p, lecture sémantique). ──
    if (job.tier === 'cinema') {
      if (!job.imageUrl) throw new Error('Le mode Cinéma part d\'une image (pas d\'une vidéo)');
      job.step = 'omni'; job.progress = 30;
      // Durée estimée depuis le texte (~145 mots/min) → choix auto 1080p/720p.
      const words = String(job.text || '').trim().split(/\s+/).filter(Boolean).length;
      const estimatedSec = words > 0 ? Math.round(words / 2.4) : 0;
      const kieUrl = await omniHumanTalkingVideo(job.imageUrl, job.audioUrl, job.motionPrompt, estimatedSec);
      // Republication R2 (l'URL kie est externe) — best-effort : en cas
      // d'échec d'upload, l'URL kie est livrée telle quelle.
      job.progress = 90;
      try {
        const resp = await axios.get(kieUrl, { responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5 });
        const { uploadToR2 } = await import('./cloudflareImagesService.js');
        const up = await uploadToR2(Buffer.from(resp.data), `avatar-premium-${Date.now()}.mp4`, 'video/mp4');
        job.url = up?.success && up.url ? up.url : kieUrl;
      } catch { job.url = kieUrl; }
      job.step = 'done'; job.progress = 100; job.status = 'done';
      return;
    }

    // 2. Clip de base si la source est une image : mouvements, bouche neutre.
    //    Un prompt personnalisé reçoit QUAND MÊME tous les verrous (boucle,
    //    bouche fermée, identité, caméra fixe, anti-artefacts) — non négociable.
    if (!job.videoUrl) {
      job.step = 'motion'; job.progress = 25;
      const prompt = job.motionPrompt
        ? `${String(job.motionPrompt).slice(0, 400)}. ${TALKING_LOCK} ${LOOP_HINT} ${IDENTITY_LOCK} ${CAMERA_LOCK} ${ANTI_ARTIFACTS}`
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

/** Crée un job avatar et lance le pipeline en tâche de fond → jobId.
 *  tier : 'standard' (Grok + MuseTalk, éco) | 'premium' (InfiniteTalk
 *  self-host — gestes pilotés par la voix, coût GPU brut) | 'cinema'
 *  (OmniHuman 1.5 via kie — 1080p, lecture sémantique, le plus cher). */
export function createAvatarJob({ imageUrl = '', videoUrl = '', audioUrl = '', text = '', voiceRefId = '', motion = 'presenter', motionPrompt = '', tier = 'standard', onDone = null }) {
  const id = `lip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id, createdAt: Date.now(), status: 'running', step: 'start', progress: 2,
    imageUrl, videoUrl, audioUrl, text, voiceRefId, motion, motionPrompt,
    tier: ['premium', 'cinema'].includes(tier) ? tier : 'standard',
    url: '', durationSec: null, error: '',
  };
  avatarJobs.set(id, job);
  // onDone(status, job) : hook de fin (done|error) — remboursement des crédits
  // Creative Center par la route si le pipeline échoue.
  setImmediate(() => runAvatarPipeline(job).finally(() => {
    try { onDone?.(job.status, job); } catch (e) { console.warn('[lipsync] onDone hook failed:', e.message); }
  }));
  return id;
}

export function getAvatarJob(id) {
  const j = avatarJobs.get(String(id || ''));
  if (!j) return null;
  return { id: j.id, status: j.status, step: j.step, progress: j.progress, url: j.url, durationSec: j.durationSec, tier: j.tier, error: j.error };
}
