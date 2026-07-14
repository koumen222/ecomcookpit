// ─────────────────────────────────────────────────────────────────────────────
//  musicPresetsService — fonds sonores prédéfinis pour le Creative Center.
//
//  Deux sources, dans l'ordre :
//   1. VRAIES musiques libres de droits (Mixkit — licence commerciale, sans
//      attribution) : téléchargées UNE fois, validées (vrai MP3), puis
//      hébergées sur R2 sous une clé stable. Remplaçables sans code via
//      MUSIC_PRESET_URLS='{"spot_dynamique":"https://…mp3"}'.
//   2. Repli : synthèse ffmpeg locale (jamais en échec, même hors ligne).
//
//  Clé R2 stable ⇒ une seule génération pour toute la vie du produit, toutes
//  instances confondues (retrouvée par HEAD).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, execFileSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

// Racine Backend (pour les pistes embarquées dans le repo : assets/music/…).
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let _bin = null;
function ffbin() {
  if (_bin) return _bin;
  for (const b of [process.env.FFMPEG_PATH, ffmpegStatic, 'ffmpeg', '/usr/bin/ffmpeg'].filter(Boolean)) {
    try { execFileSync(b, ['-version'], { stdio: 'ignore', timeout: 8000 }); _bin = b; return b; } catch { /* suivant */ }
  }
  throw new Error('ffmpeg indisponible pour la génération des musiques.');
}
function run(args) {
  const b = ffbin();
  return new Promise((res, rej) => {
    const c = spawn(b, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let e = '';
    c.stderr.on('data', (d) => { e += d.toString(); });
    c.on('error', rej);
    c.on('close', (code) => (code === 0 ? res() : rej(new Error(e.trim().split('\n').slice(-2).join(' | ') || `ffmpeg ${code}`))));
  });
}

const DURATION = 22;

// ── Synthés de repli (et presets 100 % locaux). bass = note grave. ──────────
const SYNTHS = {
  vente: { freqs: [329.63, 415.30, 493.88], bass: 82.41, trem: 'tremolo=f=4:d=0.4', extra: '' },
  hype: { freqs: [440.00, 554.37, 659.25], bass: 110.00, trem: 'tremolo=f=6:d=0.45', extra: ',vibrato=f=5:d=0.15' },
  groove: { freqs: [293.66, 349.23, 440.00], bass: 73.42, trem: 'tremolo=f=3.5:d=0.4', extra: '' },
  punch: { freqs: [392.00, 493.88, 587.33], bass: 98.00, trem: 'tremolo=f=5:d=0.5', extra: '' },
  urgent: { freqs: [369.99, 440.00, 554.37], bass: 92.50, trem: 'tremolo=f=7:d=0.4', extra: '' },
  energique: { freqs: [329.63, 415.30, 493.88], bass: null, trem: 'tremolo=f=6:d=0.35', extra: ',vibrato=f=5:d=0.2' },
  corporate: { freqs: [293.66, 369.99, 440.00, 587.33], bass: 146.83, trem: 'tremolo=f=2.5:d=0.22', extra: '' },
  inspirante: { freqs: [329.63, 392.00, 493.88, 659.25], bass: null, trem: 'tremolo=f=2.2:d=0.2', extra: '' },
  douce: { freqs: [261.63, 329.63, 392.00], bass: null, trem: 'tremolo=f=3:d=0.25', extra: '' },
  lofi: { freqs: [196.00, 246.94, 293.66], bass: 98.00, trem: 'tremolo=f=2.5:d=0.3', extra: '' },
  // Suspense : battement dissonant grave (55/58,3 Hz) + pulsation lente.
  suspense: { freqs: [55.00, 58.27, 220.00], bass: null, trem: 'tremolo=f=1.6:d=0.55', extra: ',vibrato=f=0.7:d=0.25' },
  // Tension montante : mineur serré, pulsation rapide.
  tension: { freqs: [220.00, 233.08, 329.63], bass: 55.00, trem: 'tremolo=f=5.5:d=0.5', extra: '' },
};

// ── Catalogue exposé. src = pistes réelles candidates (essayées dans l'ordre,
//    validées comme vrai MP3) ; synth = repli local garanti. ────────────────
const PRESETS = [
  // Pistes perso embarquées dans le repo (Backend/assets/music/…)
  { id: 'son_0713', label: 'Son 0713', file: 'assets/music/preset-son-0713.mp3', synth: 'groove' },
  // Dynamiques (spots publicitaires)
  { id: 'spot_dynamique', label: 'Spot dynamique', src: ['https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3'], synth: 'hype' },
  { id: 'urbain_beat', label: 'Beat urbain', src: ['https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3'], synth: 'groove' },
  { id: 'sport_energie', label: 'Énergie sport', src: ['https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3'], synth: 'energique' },
  // Suspense / tension
  { id: 'suspense', label: 'Suspense', src: ['https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3'], synth: 'suspense' },
  { id: 'tension', label: 'Tension montante', src: [], synth: 'tension' },
  // Propres / élégantes
  { id: 'corporate_propre', label: 'Propre / corporate', src: ['https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3'], synth: 'corporate' },
  { id: 'calme_elegant', label: 'Calme élégant', src: ['https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3'], synth: 'douce' },
  { id: 'cinematique', label: 'Cinématique', src: ['https://assets.mixkit.co/music/preview/mixkit-sun-and-his-daughter-580.mp3'], synth: 'inspirante' },
  { id: 'chill', label: 'Chill', src: ['https://assets.mixkit.co/music/preview/mixkit-hazy-after-hours-132.mp3'], synth: 'lofi' },
  // Synthés historiques (100 % locaux)
  { id: 'vente', label: 'Vente dynamique', src: [], synth: 'vente' },
  { id: 'punch', label: 'Punchy', src: [], synth: 'punch' },
  { id: 'urgent', label: 'Urgence', src: [], synth: 'urgent' },
];

// Remplacement des pistes sans redéploiement : MUSIC_PRESET_URLS='{"id":"url"}'
function envOverride(id) {
  try {
    const map = JSON.parse(process.env.MUSIC_PRESET_URLS || '{}');
    return typeof map[id] === 'string' && /^https?:\/\//.test(map[id]) ? [map[id]] : [];
  } catch { return []; }
}

const _cache = new Map(); // id -> url R2

export function listPresets() {
  return PRESETS.map((p) => ({ id: p.id, label: p.label }));
}

// Un vrai MP3 fait au moins ~150 kB et commence par ID3 ou une trame MPEG —
// une page d'erreur HTML/XML (404 CDN) échoue aux deux tests.
function looksLikeMp3(buf) {
  if (!buf || buf.length < 150 * 1024) return false;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') return true;
  return buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0;
}

async function fetchRealTrack(preset) {
  // 0. Piste embarquée dans le repo : lecture locale, aucune dépendance réseau.
  if (preset.file) {
    try {
      const buf = await fs.readFile(path.join(BACKEND_ROOT, preset.file));
      if (looksLikeMp3(buf)) return buf;
      console.warn(`[MusicPreset] ${preset.id}: fichier local invalide (${preset.file})`);
    } catch (e) {
      console.warn(`[MusicPreset] ${preset.id}: fichier local illisible (${e.message})`);
    }
  }
  const candidates = [...envOverride(preset.id), ...(preset.src || [])];
  for (const url of candidates) {
    try {
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxRedirects: 5 });
      const buf = Buffer.from(resp.data);
      if (looksLikeMp3(buf)) return buf;
      console.warn(`[MusicPreset] ${preset.id}: réponse invalide (pas un MP3) depuis ${url}`);
    } catch (e) {
      console.warn(`[MusicPreset] ${preset.id}: téléchargement raté (${e.message}) depuis ${url}`);
    }
  }
  return null;
}

async function synth(synthId) {
  const preset = SYNTHS[synthId];
  if (!preset) throw new Error(`Synthé inconnu: ${synthId}`);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'music-preset-'));
  try {
    const out = path.join(dir, `${synthId}.mp3`);
    const inputs = [];
    const chain = [];
    const labels = [];
    let idx = 0;
    preset.freqs.forEach((f) => {
      inputs.push('-f', 'lavfi', '-i', `sine=frequency=${f}:duration=${DURATION}`);
      chain.push(`[${idx}:a]volume=1[s${idx}]`); labels.push(`[s${idx}]`); idx += 1;
    });
    if (preset.bass) {
      inputs.push('-f', 'lavfi', '-i', `sine=frequency=${preset.bass}:duration=${DURATION}`);
      chain.push(`[${idx}:a]volume=1.8[s${idx}]`); labels.push(`[s${idx}]`); idx += 1;
    }
    const fc = `${chain.join(';')};${labels.join('')}amix=inputs=${idx}:duration=longest,${preset.trem}${preset.extra},volume=0.55,afade=t=in:d=1.3,afade=t=out:st=${DURATION - 1.3}:d=1.3[a]`;
    await run(['-y', ...inputs, '-filter_complex', fc, '-map', '[a]', '-c:a', 'libmp3lame', '-q:a', '5', out]);
    return await fs.readFile(out);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getPresetUrl(id) {
  if (_cache.has(id)) return _cache.get(id);
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error('Preset musical inconnu');

  // Clé R2 STABLE : une génération pour toujours, retrouvée par HEAD (cluster
  // et redémarrages compris) — c'était la cause des presets intermittents.
  const fileName = `music-preset-${id}-v3.mp3`;
  const { getImageUrl, uploadToR2 } = await import('./cloudflareImagesService.js');
  const stableUrl = getImageUrl(`ecom/campaigns/media/${fileName}`);
  try {
    const head = await axios.head(stableUrl, { timeout: 8000 });
    if (head.status === 200) { _cache.set(id, stableUrl); return stableUrl; }
  } catch { /* absent → on le crée */ }

  // 1. Vraie musique si disponible, 2. sinon synthèse locale garantie.
  const buf = (await fetchRealTrack(preset)) || (await synth(preset.synth));
  const up = await uploadToR2(buf, fileName, 'audio/mpeg');
  if (!up?.success || !up.url) throw new Error(up?.error || 'Publication du fond sonore impossible');
  _cache.set(id, up.url);
  return up.url;
}

export default { listPresets, getPresetUrl };
