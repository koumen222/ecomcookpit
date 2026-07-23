import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

/**
 * falVideoService — génération vidéo (image-to-video) via fal.ai, puis
 * conversion mp4 → GIF optimisé (ffmpeg palettegen/paletteuse).
 *
 * Pourquoi fal.ai : agrégateur (Kling, Wan, Veo, Seedance…) derrière UNE clé
 * et UNE API queue ; on change de modèle en changeant une variable d'env,
 * sans réécrire le code.
 *
 * Env :
 *  - FAL_KEY        : clé API (https://fal.ai/dashboard/keys)
 *  - FAL_I2V_MODEL  : endpoint image-to-video. Défaut : LTX-2 Fast
 *                     (~0,04 $/s, 1080p — le moins cher du marché).
 *                     Alternatives qualité :
 *                       fal-ai/wan-25-preview/image-to-video   (~0,05 $/s, 480p)
 *                       fal-ai/kling-video/v2.5-turbo/pro/image-to-video (~0,07 $/s)
 */

const DEFAULT_I2V_MODEL = 'fal-ai/ltx-2/image-to-video/fast';

// Chaque famille de modèles a son propre schéma d'entrée — un payload
// générique provoquerait des 422. Règle produit : une scène générée ne dépasse
// JAMAIS 6 s → LTX (paliers 6/8/10) = 6 ; Wan/Seedance/Kling (paliers 5/10) = 5.
// La sortie est de toute façon tronquée à la durée demandée par ffmpeg en aval.
function buildI2vPayload(endpoint, prompt, imageUrl, _durationSec) {
  const e = endpoint.toLowerCase();
  const p = String(prompt || '').slice(0, 2400);
  if (e.includes('ltx')) {
    return { prompt: p, image_url: imageUrl, duration: 6, resolution: '1080p', fps: 25, generate_audio: true };
  }
  if (e.includes('wan') || e.includes('seedance')) {
    return { prompt: p, image_url: imageUrl, duration: '5', resolution: '480p' };
  }
  // Kling et assimilés
  return {
    prompt: p,
    image_url: imageUrl,
    duration: '5',
    negative_prompt: 'blur, distort, low quality, watermark, text overlay, captions, subtitles, on-screen text, logo, morphing artifacts',
    cfg_scale: 0.5,
  };
}

const falKey = () => String(process.env.FAL_KEY || '').trim();
export const isFalConfigured = () => Boolean(falKey());

const falHeaders = () => ({ Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Image → vidéo. Soumet à la queue fal, poll jusqu'au résultat.
 * @returns {Promise<string>} URL mp4 hébergée par fal
 */
export async function falImageToVideo(prompt, imageUrl, { durationSec = 5, model = '' } = {}) {
  if (!isFalConfigured()) throw new Error('FAL_KEY manquante — créez une clé sur fal.ai');
  const endpoint = String(model || process.env.FAL_I2V_MODEL || DEFAULT_I2V_MODEL).replace(/^\/+|\/+$/g, '');

  const submit = await axios.post(
    `https://queue.fal.run/${endpoint}`,
    buildI2vPayload(endpoint, prompt, imageUrl, durationSec),
    { headers: falHeaders(), timeout: 30000 },
  );

  const requestId = submit.data?.request_id;
  // fal renvoie status_url / response_url ; fallback : racine de l'app (2 premiers segments)
  const appRoot = endpoint.split('/').slice(0, 2).join('/');
  const statusUrl = submit.data?.status_url || `https://queue.fal.run/${appRoot}/requests/${requestId}/status`;
  const responseUrl = submit.data?.response_url || `https://queue.fal.run/${appRoot}/requests/${requestId}`;
  if (!requestId) throw new Error('Soumission fal.ai refusée (pas de request_id)');

  const deadline = Date.now() + 8 * 60 * 1000;
  let status = 'IN_QUEUE';
  while (Date.now() < deadline) {
    await sleep(4000);
    const st = await axios.get(statusUrl, { headers: falHeaders(), timeout: 20000 });
    status = st.data?.status || status;
    if (status === 'COMPLETED') break;
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(st.data?.error || 'Génération vidéo échouée côté fal.ai');
    }
  }
  if (status !== 'COMPLETED') throw new Error('Génération vidéo trop longue (timeout 8 min), réessayez');

  const result = await axios.get(responseUrl, { headers: falHeaders(), timeout: 30000 });
  const videoUrl = result.data?.video?.url || result.data?.video_url || result.data?.output?.video?.url;
  if (!videoUrl) throw new Error('Réponse fal.ai sans URL vidéo');
  return videoUrl;
}

/**
 * Grok Imagine Video 1.5 via kie.ai — LE moins cher (480p ≈ 10 crédits / 6 s,
 * soit ~0,05 $ la vidéo). Réutilise la clé KIE_API_KEY et la mécanique
 * submit/poll déjà en place pour NanoBanana.
 * @returns {Promise<string>} URL mp4
 */
export const isKieVideoConfigured = () => Boolean(process.env.NANOBANANA_PRO_API_KEY || process.env.KIE_API_KEY);

/**
 * xAI officiel (api.x.ai) — Grok Imagine vidéo. Soumission puis polling
 * GET /v1/videos/{request_id} jusqu'à status done/failed/expired.
 * Env : XAI_API_KEY (requis), XAI_VIDEO_MODEL (défaut grok-imagine-video-1.5),
 * XAI_VIDEO_RESOLUTION (défaut 480p ; mettre '' si l'API refuse le champ).
 * @returns {Promise<string>} URL mp4
 */
export const isXaiConfigured = () => Boolean(String(process.env.XAI_API_KEY || '').trim());

export async function xaiImageToVideo(prompt, imageUrl, { resolution = '', durationSec = 6 } = {}) {
  const key = String(process.env.XAI_API_KEY || '').trim();
  if (!key) throw new Error('XAI_API_KEY manquante');
  const model = String(process.env.XAI_VIDEO_MODEL || 'grok-imagine-video').trim();
  const res = String(resolution || (process.env.XAI_VIDEO_RESOLUTION ?? '480p')).trim();
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  // Spec officielle (docs.x.ai, image-to-video) : le champ est `image:{url}`,
  // `duration` 1-15 s, `resolution` 480p/720p/1080p. On n'envoie PAS
  // aspect_ratio : en image-to-video la sortie garde le ratio de l'image.
  const body = {
    model,
    prompt: String(prompt || '').slice(0, 4096),
    ...(imageUrl && /^https?:\/\//i.test(String(imageUrl)) ? { image: { url: String(imageUrl) } } : {}),
    duration: Math.max(1, Math.min(15, Math.round(Number(durationSec) || 6))),
    ...(res ? { resolution: res } : {}),
  };
  const submit = await axios.post('https://api.x.ai/v1/videos/generations', body, { headers, timeout: 30000 });
  const requestId = submit.data?.request_id || submit.data?.id;
  if (!requestId) throw new Error('Soumission xAI refusée (pas de request_id)');
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const st = await axios.get(`https://api.x.ai/v1/videos/${requestId}`, { headers, timeout: 20000 });
    const status = String(st.data?.status || '');
    if (status === 'done') {
      const url = st.data?.video?.url || st.data?.url;
      if (!url) throw new Error('Réponse xAI sans URL vidéo');
      return url;
    }
    if (status === 'failed' || status === 'expired') {
      const err = st.data?.error;
      throw new Error(err?.message ? `${err.code || 'xai'} : ${err.message}` : (typeof err === 'string' ? err : `Génération xAI ${status}`));
    }
  }
  throw new Error('Génération vidéo xAI trop longue (timeout 8 min), réessayez');
}

export async function grokImageToVideo(prompt, imageUrl, { durationSec = 8, resolution = '480p', aspectRatio = 'auto' } = {}) {
  if (!isKieVideoConfigured()) throw new Error('KIE_API_KEY manquante');
  const { submitKieTask, pollKieTask } = await import('./nanoBananaService.js');
  // API unifiée kie.ai — modèle « Grok Imagine Video 1.5 Preview » (text/image-to-video).
  // Grok Imagine génère nativement des clips de 6 s : on demande TOUJOURS 6
  // (valeur sûre côté API kie.ai) ; la découpe à la durée exacte du script
  // (2-6 s) est faite en aval par ffmpeg (GIF / voix off / montage).
  const duration = 6;
  void durationSec;
  const input = {
    prompt: String(prompt || '').slice(0, 4096),
    aspect_ratio: aspectRatio || 'auto',
    resolution: resolution === '720p' ? '720p' : '480p',
    duration,
    nsfw_checker: false,
  };
  // image_urls : 1 fichier max (image de départ pour l'image-to-video).
  if (imageUrl && /^https?:\/\//i.test(String(imageUrl))) input.image_urls = [String(imageUrl)];
  const body = { model: 'grok-imagine-video-1-5-preview', input };
  const taskId = await submitKieTask(body, 3);
  return pollKieTask(taskId, { mediaType: 'video', maxWaitMs: 8 * 60 * 1000, label: 'Grok Imagine 1.5' });
}

/**
 * Kling V3 Turbo (image → vidéo) via kie.ai — LE moteur des scènes UGC
 * PARLÉES : anime la personne de l'image en train de DIRE les mots exacts
 * (bouche synchronisée sur le phrasé), durée LIBRE 3-15 s (vs 8 s fixes Veo),
 * 720p/1080p. Endpoint générique kie jobs/createTask (mécanique submitKieTask
 * partagée avec Grok/OmniHuman). Env : KIE_TALK_MODEL (défaut
 * kling/v3-turbo-image-to-video), KIE_TALK_RESOLUTION (défaut 720p).
 * @returns {Promise<string>} URL mp4
 */
export async function klingImageToVideo(prompt, imageUrl, { durationSec = 10, resolution = '' } = {}) {
  if (!isKieVideoConfigured()) throw new Error('KIE_API_KEY manquante');
  const { submitKieTask, pollKieTask } = await import('./nanoBananaService.js');
  // Durées ACCEPTÉES par paliers : 10, 20, 30, 40 s. Jusqu'à ~13 s de texte
  // on reste sur 10 s (débit rapide, aucun silence) plutôt qu'un clip de 20 s
  // à moitié muet ; au-delà, palier supérieur.
  const want = Math.round(Number(durationSec) || 10);
  const duration = want <= 13 ? 10 : ([20, 30, 40].find((v) => v >= want) || 40);
  const input = {
    prompt: String(prompt || '').slice(0, 2500),
    image_urls: imageUrl && /^https?:\/\//i.test(String(imageUrl)) ? [String(imageUrl)] : [],
    duration,
    resolution: (resolution || process.env.KIE_TALK_RESOLUTION || '720p') === '1080p' ? '1080p' : '720p',
  };
  const model = String(process.env.KIE_TALK_MODEL || 'kling/v3-turbo-image-to-video').trim();
  const taskId = await submitKieTask({ model, input }, 3);
  return pollKieTask(taskId, { mediaType: 'video', maxWaitMs: 12 * 60 * 1000, label: 'Kling V3 Turbo' });
}

/**
 * Veo 3.1 (Google) via kie.ai — le réalisme de référence pour les UGC :
 * personnes crédibles, gestes naturels, vrai 9:16 natif. Image + prompt →
 * clip ~8 s, sortie 720p par défaut (l'upgrade 1080p est un endpoint séparé,
 * volontairement non appelé). API dédiée kie : POST /api/v1/veo/generate puis
 * poll GET /api/v1/veo/record-info (successFlag 0|1|2|3).
 * Env : KIE_API_KEY (partagée), KIE_VEO_MODEL (défaut veo3_fast — Veo 3.1
 * Fast, le meilleur rapport qualité/coût), KIE_VEO_GENERATION_TYPE.
 * @returns {Promise<string>} URL mp4
 */
export const isVeoConfigured = () => isKieVideoConfigured();

export async function veoImageToVideo(prompt, imageUrl, { aspectRatio = '9:16', speech = '' } = {}) {
  const key = String(process.env.NANOBANANA_PRO_API_KEY || process.env.KIE_API_KEY || '').trim();
  if (!key) throw new Error('KIE_API_KEY manquante');
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  // Deux régimes audio :
  //  · speech fourni (UGC sans lip sync) : le créateur DIT la phrase en
  //    FRANÇAIS — voix native Veo, lèvres synchrones, audio conservé.
  //  · sinon : clip muet de dialogue (la voix off Fish est posée après).
  const speechClean = String(speech || '').trim().slice(0, 400);
  const body = {
    prompt: speechClean
      ? `${String(prompt || '').slice(0, 3300)} The person looks into the camera and SPEAKS FLUENT NATIVE FRENCH, saying exactly, word for word: « ${speechClean} ». LANGUAGE: French ONLY — perfect natural French pronunciation, native francophone accent matching the person, never a single English word. Lips perfectly synced to the words, believable everyday delivery (not a professional announcer). TIMING: starts speaking at the VERY FIRST frame, no pause at the start. PACE: a NATURAL CONSTANT conversational tempo (~2.5 words per second), the SAME tempo in every clip — never stretched or slowed to fill the clip, never rushed to fit; if the sentence ends early, the person holds a warm confident look at the camera. No captions, no on-screen text.`
      : `${String(prompt || '').slice(0, 3800)} No spoken dialogue, no talking voice — natural ambient sound only.`,
    model: String(process.env.KIE_VEO_MODEL || 'veo3_fast').trim(),
    aspect_ratio: aspectRatio === '16:9' ? '16:9' : '9:16',
    // 1 image = frame de départ EXACTE (le personnage validé est préservé).
    generationType: String(process.env.KIE_VEO_GENERATION_TYPE || 'FIRST_AND_LAST_FRAMES_2_VIDEO').trim(),
    // Bascule kie automatique en cas de refus du modèle principal : sortie
    // 720p garantie — précisément la cible.
    enableFallback: true,
    enableTranslation: true,
  };
  if (imageUrl && /^https?:\/\//i.test(String(imageUrl))) body.imageUrls = [String(imageUrl)];
  const submit = await axios.post('https://api.kie.ai/api/v1/veo/generate', body, { headers, timeout: 30000 });
  const taskId = submit.data?.data?.taskId;
  if (!taskId) throw new Error(submit.data?.msg || 'Soumission Veo 3.1 refusée');
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(8000);
    let d;
    try {
      const st = await axios.get(`https://api.kie.ai/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`, { headers, timeout: 20000 });
      d = st.data?.data;
    } catch { continue; } // erreur réseau ponctuelle → on repolle
    if (!d) continue;
    if (d.successFlag === 1) {
      const url = d.response?.resultUrls?.[0];
      if (!url) throw new Error('Réponse Veo 3.1 sans URL vidéo');
      return url;
    }
    if (d.successFlag === 2 || d.successFlag === 3) {
      throw new Error(d.errorMessage || `Veo 3.1 : génération échouée (flag ${d.successFlag})`);
    }
  }
  throw new Error('Génération Veo 3.1 trop longue (timeout 10 min), réessayez');
}

function runFfmpeg(args) {
  if (!ffmpegPath) throw new Error('Binaire ffmpeg indisponible (npm rebuild ffmpeg-static)');
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split('\n').pop() || `ffmpeg exited ${code}`));
    });
  });
}

/** Ajoute une voix MP3 à une vidéo et renvoie le MP4 final. */
export async function addVoiceoverToVideo(videoUrl, audioBuffer, { maxSeconds = 6 } = {}) {
  const resp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 });
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scalor-voiceover-'));
  try {
    const videoPath = path.join(workDir, 'video.mp4');
    const audioPath = path.join(workDir, 'voice.mp3');
    const outputPath = path.join(workDir, 'final.mp4');
    await Promise.all([
      fs.writeFile(videoPath, Buffer.from(resp.data)),
      fs.writeFile(audioPath, audioBuffer),
    ]);
    await runFfmpeg([
      '-y', '-i', videoPath, '-i', audioPath,
      '-t', String(Math.max(1, Math.min(6, maxSeconds))),
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
      '-shortest', '-movflags', '+faststart', outputPath,
    ]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Télécharge un mp4 et le convertit en GIF optimisé (boucle infinie).
 * width 480 / fps 12 : bon compromis netteté / poids (~2-4 Mo pour 5 s),
 * adapté aux connexions mobiles.
 * @returns {Promise<Buffer>} buffer GIF
 */
export async function mp4UrlToGifBuffer(videoUrl, { width = 480, fps = 12, maxSeconds = 6 } = {}) {
  const resp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 });
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scalor-i2v-'));
  try {
    const inPath = path.join(workDir, 'in.mp4');
    const outPath = path.join(workDir, 'out.gif');
    await fs.writeFile(inPath, Buffer.from(resp.data));
    await runFfmpeg([
      '-y',
      '-t', String(Math.max(1, Math.min(6, maxSeconds))),
      '-i', inPath,
      '-vf', `fps=${fps},scale=${width}:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      '-loop', '0',
      outPath,
    ]);
    return await fs.readFile(outPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
