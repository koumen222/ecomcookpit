// ─────────────────────────────────────────────────────────────────────────────
//  autoEditService — MONTAGE VIDÉO AUTOMATIQUE (outil « Montage Auto »).
//
//  Entrée : une vidéo brute (face caméra, démo produit…).
//  Sortie : vidéo(s) montée(s) 9:16 et/ou 16:9, prêtes à publier.
//
//  Pipeline :
//    1. Extraction audio + transcription Whisper (mot à mot)
//    2. Détection des silences → jump cuts dynamiques (ffmpeg silencedetect)
//    3. Plan de montage par IA (hook, b-rolls, callouts, ambiance musicale)
//    4. B-rolls générés par Grok Imagine via KIE : image + Ken Burns, ou clip animé
//    5. Sous-titres animés word-level (.ass, style CapCut) + motion design texte
//    6. Musique de fond (ducking sidechain) + effets sonores aux transitions
//    7. Rendu ffmpeg par format + upload R2
//
//  Providers : textes/plan de montage → DeepSeek (fallback KIE chat) ;
//  images & vidéos b-roll → Grok Imagine via KIE (generateNanoBananaImage,
//  grokImageToVideo). Réutilise aussi : runFfmpeg/probeDuration/
//  downloadWithRetry/FONTS_DIR (videoMontageService) et
//  extractAudio/transcribeSegments (videoTranslationService).
// ─────────────────────────────────────────────────────────────────────────────
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  runFfmpeg, runFfmpegCapture, probeDuration, downloadWithRetry, FONTS_DIR,
} from './videoMontageService.js';
import { extractAudio, transcribeSegments } from './videoTranslationService.js';
import { callDeepseekChat } from './deepseekChatService.js';
import { callKieChatCompletion, isKieConfigured } from './kieChatService.js';
import { generateNanoBananaImage } from './nanoBananaService.js';
import { grokImageToVideo } from './falVideoService.js';
import cloudflareImagesService from './cloudflareImagesService.js';

const AUDIO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'montage-audio');

const FORMATS = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
};

export const CAPTION_STYLES = {
  bold: { label: 'Impact (jaune)', primary: '&H0032D9FF', outline: '&H00000000', fontSize: 84 },
  clean: { label: 'Clean (blanc)', primary: '&H00FFFFFF', outline: '&H00000000', fontSize: 76 },
  neon: { label: 'Néon (vert)', primary: '&H0064F87A', outline: '&H00102010', fontSize: 80 },
};

const MAX_SOURCE_DURATION = 12 * 60;   // 12 min de rush max
const MAX_BROLLS = 5;
const MIN_SILENCE = 0.5;               // silence détecté à partir de 0,5 s
const CUT_PADDING = 0.12;              // marge conservée autour de la parole

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID().slice(0, 8);

function assTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${rest}`;
}

function srtTime(sec) {
  const s = Math.max(0, sec);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  const ms = String(Math.round((s % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${ss},${ms}`;
}

const escAss = (t) => String(t || '').replace(/\\/g, '').replace(/[{}]/g, '').replace(/\n/g, '\\N');

// Chemin sûr pour le filtre subtitles (échappement ffmpeg filtergraph).
const escFilterPath = (p) => String(p).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

// ─── 1. Silences → plages de parole (jump cuts) ─────────────────────────────

async function detectSpeechRanges(videoPath, totalDuration) {
  // Seuil ADAPTATIF : -32 dB fixe ne détecte jamais rien sur une vidéo
  // filmée au téléphone (bruit de fond constant). On mesure le niveau moyen
  // réel et on place le seuil juste au-dessus.
  let noiseDb = -32;
  try {
    const vol = await runFfmpegCapture(['-i', videoPath, '-af', 'volumedetect', '-f', 'null', '-']);
    const mean = vol.match(/mean_volume:\s*(-?[\d.]+) dB/);
    if (mean) noiseDb = Math.min(-18, Math.round(parseFloat(mean[1]) + 5));
  } catch { /* seuil par défaut */ }

  const stderr = await runFfmpegCapture([
    '-i', videoPath, '-af', `silencedetect=noise=${noiseDb}dB:d=${MIN_SILENCE}`, '-f', 'null', '-',
  ]);
  const silences = [];
  const re = /silence_start:\s*([\d.]+)[\s\S]*?silence_end:\s*([\d.]+)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    silences.push({ start: parseFloat(m[1]), end: parseFloat(m[2]) });
  }

  // Complément des silences = plages de parole, avec marge de respiration.
  const ranges = [];
  let cursor = 0;
  for (const s of silences) {
    const keepEnd = Math.min(totalDuration, s.start + CUT_PADDING);
    if (keepEnd - cursor > 0.25) ranges.push({ start: cursor, end: keepEnd });
    cursor = Math.max(cursor, s.end - CUT_PADDING);
  }
  if (totalDuration - cursor > 0.25) ranges.push({ start: cursor, end: totalDuration });

  // Fusionner les plages trop proches (< 0,15 s) pour éviter les micro-cuts.
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end < 0.15) last.end = r.end;
    else merged.push({ ...r });
  }
  return merged.length ? merged : [{ start: 0, end: totalDuration }];
}

// Si le transcript n'a pas de word-level (certains providers/langues n'en
// renvoient pas), on SYNTHÉTISE des mots depuis les segments : le texte de
// chaque segment est réparti uniformément sur sa durée. Moins précis que le
// vrai word-level mais suffisant pour des sous-titres et des cuts visibles.
function synthesizeWordsFromSegments(segments) {
  const out = [];
  for (const seg of segments || []) {
    const tokens = String(seg.text || '').split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const dur = Math.max(0.2, seg.end - seg.start);
    const step = dur / tokens.length;
    tokens.forEach((tok, i) => {
      out.push({
        word: tok,
        start: seg.start + i * step,
        end: seg.start + (i + 1) * step,
      });
    });
  }
  return out;
}

// Redécoupe les segments Whisper (souvent 10-15 s, trop gros pour décider) en
// PASSAGES FINS : fin de phrase (. ! ? …), gap de parole > 0.35 s, ou durée
// max 8 s. C'est le grain de décision du monteur IA — sans ça, DeepSeek ne
// peut rien élaguer (un segment long mélange le bon et le superflu).
function refineSegmentsForAi(segments, words) {
  if (!Array.isArray(words) || words.length < 3) return segments;
  const MAX_LEN = 8;
  const GAP = 0.35;
  const out = [];
  let cur = null;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (!cur) cur = { start: w.start, end: w.end, text: w.word };
    else { cur.end = w.end; cur.text += ` ${w.word}`; }
    const next = words[i + 1];
    const sentenceEnd = /[.!?…]["»']?$/.test(w.word);
    const bigGap = next && next.start - w.end > GAP;
    const tooLong = cur.end - cur.start >= MAX_LEN;
    if (!next || sentenceEnd || bigGap || tooLong) {
      if (cur.text.trim()) out.push({ ...cur, text: cur.text.trim() });
      cur = null;
    }
  }
  // Trop peu d'unités = retomber sur les segments d'origine.
  return out.length >= Math.max(3, segments.length) ? out : segments;
}

// BEAT CUTS : le style Reels/TikTok coupe toutes les ~4-5 s même sans temps
// mort. On redécoupe chaque plage gardée en sous-plans aux frontières de mots
// (jamais au milieu d'un mot) — AUCUN contenu retiré, mais chaque frontière
// devient un cut visible avec punch-in alterné.
function beatCutRanges(ranges, words, { target = 4.5, maxLen = 6.5 } = {}) {
  const boundaries = (Array.isArray(words) ? words : []).map((w) => w.end).sort((a, b) => a - b);
  const snap = (t, lo, hi) => {
    let best = null;
    for (const b of boundaries) {
      if (b <= lo + 0.8 || b >= hi - 0.8) continue;
      if (best === null || Math.abs(b - t) < Math.abs(best - t)) best = b;
    }
    return best !== null && Math.abs(best - t) <= 1.2 ? best : t;
  };
  const out = [];
  for (const r of ranges) {
    const dur = r.end - r.start;
    if (dur <= maxLen) { out.push({ ...r }); continue; }
    const n = Math.ceil(dur / target);
    let prev = r.start;
    for (let k = 1; k < n; k += 1) {
      const ideal = r.start + (dur * k) / n;
      const cut = snap(ideal, prev, r.end);
      if (cut - prev > 1.2) { out.push({ start: prev, end: cut }); prev = cut; }
    }
    out.push({ start: prev, end: r.end });
  }
  return out;
}

// Méthode PRIMAIRE de découpe : les gaps entre MOTS du transcript Whisper.
// Beaucoup plus fiable que silencedetect (indépendant du bruit de fond des
// vidéos filmées au téléphone) : tout trou de parole > MAX_WORD_GAP est coupé,
// y compris l'intro avant le premier mot et l'outro après le dernier.
function speechRangesFromWords(words, totalDuration) {
  if (!Array.isArray(words) || words.length < 3) return null;
  const MAX_WORD_GAP = 0.45;
  const ranges = [];
  let cur = {
    start: Math.max(0, words[0].start - CUT_PADDING),
    end: words[0].end + CUT_PADDING,
  };
  for (let i = 1; i < words.length; i += 1) {
    const w = words[i];
    if (w.start - cur.end > MAX_WORD_GAP) {
      ranges.push(cur);
      cur = { start: Math.max(0, w.start - CUT_PADDING), end: w.end + CUT_PADDING };
    } else {
      cur.end = Math.max(cur.end, w.end + CUT_PADDING);
    }
  }
  ranges.push(cur);
  const cleaned = ranges
    .map((r) => ({ start: Math.max(0, r.start), end: Math.min(totalDuration, r.end) }))
    .filter((r) => r.end - r.start > 0.2);
  return cleaned.length ? cleaned : null;
}

// Dimensions de la source (parse « 1920x1080 » dans la sortie ffmpeg), en
// tenant compte de la ROTATION des vidéos smartphone (portrait stocké en
// paysage + displaymatrix) : ffmpeg auto-rotate les frames dans le graphe,
// donc les dimensions utiles sont celles APRÈS rotation.
async function probeDimensions(videoPath) {
  const stderr = await runFfmpegCapture(['-i', videoPath]);
  const m = stderr.match(/Video:.*?\b(\d{2,5})x(\d{2,5})\b/);
  if (!m) return null;
  let w = parseInt(m[1], 10);
  let h = parseInt(m[2], 10);
  const rot = stderr.match(/rotation of (-?\d+(?:\.\d+)?) degrees/) || stderr.match(/rotate\s*:\s*(-?\d+)/);
  if (rot) {
    const angle = ((Math.abs(parseFloat(rot[1])) % 360) + 360) % 360;
    if (angle === 90 || angle === 270) { const t = w; w = h; h = t; }
  }
  return { w, h };
}

// SFX synthétisés par ffmpeg — utilisés quand la banque est vide, pour que
// chaque effet visuel ait TOUJOURS une présence sonore digne d'un montage pro.

// Whoosh : couche « air » (bruit filtré) + chirp descendant 900→180 Hz.
async function synthWhoosh(tmpDir) {
  const p = path.join(tmpDir, 'whoosh-synth.wav');
  await runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', 'anoisesrc=d=0.5:color=pink:amplitude=0.5',
    '-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*(900-720*min(t/0.45\\,1))*t)':d=0.5",
    '-filter_complex',
    '[0:a]highpass=f=500,lowpass=f=6000,afade=t=in:d=0.16,afade=t=out:st=0.22:d=0.26[air];'
    + '[1:a]lowpass=f=1200,afade=t=in:d=0.05,afade=t=out:st=0.25:d=0.22[chirp];'
    + '[air][chirp]amix=inputs=2:normalize=0,volume=1.4[a]',
    '-map', '[a]', '-ar', '44100', '-ac', '2', p,
  ]);
  return p;
}

// Boom d'impact (sub 55 Hz + attaque bruitée) — frappe les transitions flash.
async function synthBoom(tmpDir) {
  const p = path.join(tmpDir, 'boom-synth.wav');
  await runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', "aevalsrc='0.95*sin(2*PI*55*t)*exp(-5*t)':d=0.9",
    '-f', 'lavfi', '-i', 'anoisesrc=d=0.12:color=white:amplitude=0.4',
    '-filter_complex',
    '[1:a]lowpass=f=2500,afade=t=out:st=0.02:d=0.10[click];'
    + '[0:a][click]amix=inputs=2:normalize=0,volume=1.5[a]',
    '-map', '[a]', '-ar', '44100', '-ac', '2', p,
  ]);
  return p;
}

// « Pop » percutant — ponctue l'apparition des callouts.
async function synthPop(tmpDir) {
  const p = path.join(tmpDir, 'pop-synth.wav');
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', "aevalsrc='0.8*sin(2*PI*(600+500*exp(-22*t))*t)*exp(-14*t)':d=0.22",
    '-af', 'volume=1.2',
    '-ar', '44100', '-ac', '2', p,
  ]);
  return p;
}

// Remappe un instant source → instant sur la timeline montée. Supporte une
// timeline NON CHRONOLOGIQUE (cold-open déplacé en tête) : recherche du
// morceau contenant t, sans hypothèse d'ordre. Hors montage → -1 (filtré).
function buildTimeMapper(ranges) {
  let acc = 0;
  const table = ranges.map((r) => {
    const entry = { start: r.start, end: r.end, offset: acc };
    acc += r.end - r.start;
    return entry;
  });
  const editedDuration = acc;
  const map = (t) => {
    for (const e of table) {
      if (t >= e.start && t <= e.end) return e.offset + (t - e.start);
    }
    return -1;
  };
  return { map, editedDuration };
}

// a − b : retire de chaque plage de `a` les portions couvertes par `b`.
function subtractRanges(a, b) {
  let cur = a.map((r) => ({ ...r }));
  for (const cut of b) {
    const next = [];
    for (const r of cur) {
      if (cut.end <= r.start || cut.start >= r.end) { next.push(r); continue; }
      if (cut.start > r.start + 0.2) next.push({ start: r.start, end: cut.start });
      if (cut.end < r.end - 0.2) next.push({ start: cut.end, end: r.end });
    }
    cur = next;
  }
  return cur.filter((r) => r.end - r.start > 0.25);
}

// ─── 2. Coupe réelle (une seule passe trim/concat) ───────────────────────────

async function hasAudioStream(videoPath) {
  const stderr = await runFfmpegCapture(['-i', videoPath]);
  return /Stream #\d+:\d+.*Audio:/.test(stderr);
}

// Résolution de travail : orientation de la source, bornée à 1920 px, paire.
function workResolution(dims) {
  if (!dims?.w || !dims?.h) return { W: 1280, H: 720 };
  const scale = Math.min(1, 1920 / Math.max(dims.w, dims.h));
  return {
    W: Math.round((dims.w * scale) / 2) * 2,
    H: Math.round((dims.h * scale) / 2) * 2,
  };
}

async function renderCutVideo(videoPath, ranges, outPath, withAudio = true, dims = null) {
  const { W, H } = workResolution(dims);
  // Normalisation systématique de CHAQUE frame avant tout assemblage :
  // dimensions fixes (pad), 30 fps constants (les vidéos smartphone sont à
  // framerate VARIABLE + rotation en métadonnées — cause des erreurs « Error
  // reinitializing filters / Failed to inject frame »). IMPORTANT : setsar=1
  // est appliqué en TOUTE FIN de chaîne — un scale placé après re-casserait le
  // SAR et ferait échouer le concat (mismatch reproduit en test).
  const normalize = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`;
  // ZOOMS PROGRESSIFS alternés (style CapCut) : chaque segment respire —
  // zoom-in (1 → 1.12) sur les segments pairs, zoom-out (1.12 → 1) sur les
  // impairs. Le crop est recalculé À CHAQUE FRAME (expression en t) puis
  // rescalé à W×H constants : chaque cut a un mouvement net, jamais figé.
  const zoomExpr = (durSec, out) => {
    const D = Math.max(0.3, durSec).toFixed(3);
    const prog = out ? `(1-min(t/${D}\\,1))` : `min(t/${D}\\,1)`;
    const z = `(1+0.12*${prog})`;
    return `crop=w='trunc(iw/${z}/2)*2':h='trunc(ih/${z}/2)*2':x='(iw-ow)/2':y='(ih-oh)/2',scale=${W}:${H}`;
  };

  if (ranges.length === 1 && ranges[0].start === 0) {
    // Rien à couper : normalisation seule (+ piste silencieuse si la source
    // est muette, pour garder un graphe audio homogène ensuite).
    if (withAudio) {
      await runFfmpeg(['-y', '-i', videoPath, '-vf', `${normalize},setsar=1`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', outPath]);
    } else {
      await runFfmpeg(['-y', '-i', videoPath, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-map', '0:v', '-map', '1:a', '-shortest', '-vf', `${normalize},setsar=1`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-c:a', 'aac', '-b:a', '192k', outPath]);
    }
    return;
  }

  const parts = [];
  const labels = [];
  ranges.forEach((r, i) => {
    const fx = `${normalize},${zoomExpr(r.end - r.start, i % 2 === 1)}`;
    parts.push(`[0:v]trim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},setpts=PTS-STARTPTS,${fx},setsar=1[v${i}]`);
    parts.push(`[0:a]atrim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
    labels.push(`[v${i}][a${i}]`);
  });
  parts.push(`${labels.join('')}concat=n=${ranges.length}:v=1:a=1[vout][aout]`);
  await runFfmpeg([
    '-y', '-i', videoPath,
    '-filter_complex', parts.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
    outPath,
  ]);
}

// ─── 3. Orchestration du montage par l'IA (DeepSeek) ─────────────────────────
//
// L'IA est le MONTEUR : elle reçoit le transcript SOURCE numéroté par phrase
// et décide quels passages GARDER (EDL par indices — pas de timestamps libres,
// donc pas d'hallucination de timings). Elle place aussi l'habillage (hook,
// b-rolls, callouts) par indice de segment ; le code remappe ensuite sur la
// timeline montée. Contrainte dure : durée finale < durée initiale, validée
// côté code avec garde-fous (l'IA ne peut ni tout garder ni tout couper).

function fusionRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 0.15) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

function intersectRanges(a, b) {
  // Intersection STRICTE, sans fusion : fusionner ici réinjecterait les
  // micro-trous (mots supprimés) entre morceaux proches → duplication de
  // durée quand le résultat est déplacé (cold-open).
  const out = [];
  for (const ra of a) {
    for (const rb of b) {
      const start = Math.max(ra.start, rb.start);
      const end = Math.min(ra.end, rb.end);
      if (end - start > 0.2) out.push({ start, end });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

const rangesDuration = (ranges) => ranges.reduce((s, r) => s + (r.end - r.start), 0);

// ─── Nettoyage DÉTERMINISTE des disfluences (avant l'IA) ────────────────────
// Fillers purs et bégaiements sont retirés automatiquement, au mot près —
// pas besoin d'IA pour ça, et c'est infaillible.
const FILLER_WORDS = new Set([
  // FR
  'euh', 'heu', 'euhh', 'heuu', 'hum', 'hem', 'bah', 'ben',
  // EN / universel
  'uh', 'um', 'uhm', 'erm', 'mmm', 'hmm', 'mm',
]);

const normWord = (w) => String(w || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9']/g, '');

// Retourne un Set d'indices de mots à supprimer : fillers + répétitions
// immédiates du même mot (« je je pense » → premier « je » retiré).
function detectDisfluencies(words) {
  const drop = new Set();
  for (let i = 0; i < words.length; i += 1) {
    const n = normWord(words[i].word);
    if (!n) continue;
    if (FILLER_WORDS.has(n)) { drop.add(i); continue; }
    const next = words[i + 1];
    if (next && n.length > 1 && n === normWord(next.word)
      && next.start - words[i].end < 0.4) {
      drop.add(i); // bégaiement : on garde la seconde occurrence
    }
  }
  return drop;
}

// DÉTECTION DES RETAKES (style Descript) : quand le locuteur recommence sa
// phrase (« Ton succès peut être… Ton succès peut être totalement… »), une
// séquence de ≥ 4 mots quasi identique réapparaît dans les ~20 s. La PREMIÈRE
// prise (le faux départ) est supprimée jusqu'au point de reprise.
function detectRetakes(words, alreadyDropped) {
  const N = words.length;
  const norm = words.map((w) => normWord(w.word));
  const drop = new Set();
  for (let i = 0; i < N - 3; i += 1) {
    if (drop.has(i) || alreadyDropped.has(i) || !norm[i]) continue;
    for (let j = i + 2; j < Math.min(N - 2, i + 40); j += 1) {
      // Un VRAI faux départ redémarre vite : la reprise commence au plus
      // 8 s après le début de la prise ratée. Au-delà, c'est du vocabulaire
      // répété naturellement — on ne touche pas.
      if (words[j].start - words[i].start > 8) break;
      if (norm[j] !== norm[i]) continue;
      // Alignement : tolère UNE variation seulement après 5 correspondances
      // (« ton ennemi » → « ton pire ennemi »).
      let k = 0; let matches = 0; let misses = 0;
      while (i + k < j && j + k < N) {
        if (norm[i + k] && norm[i + k] === norm[j + k]) matches += 1;
        else { misses += 1; if (misses > (matches >= 5 ? 1 : 0)) break; }
        k += 1;
      }
      // Conditions d'un vrai retake : ≥ 4 mots repris (3 si tout début de
      // rush), ET la zone supprimée colle à la reprise (pas un écho lointain).
      const minRun = words[i].start < 10 ? 3 : 4;
      const adjacent = (j - i) <= k + 3;
      if (matches >= minRun && adjacent) {
        for (let d = i; d < j; d += 1) drop.add(d); // le faux départ complet saute
        i = j - 1;
        break;
      }
    }
  }
  // Garde-fou global : au-delà de 25 % du discours, c'est un emballement.
  return drop.size <= Math.max(12, N * 0.25) ? drop : new Set();
}

// Reconstruit les plages temporelles à GARDER à partir des mots non supprimés.
// Une coupe est créée : (a) dès qu'un mot supprimé s'intercale, (b) sur tout
// silence > MAX_GAP entre deux mots gardés. Les bords tombent au MILIEU des
// gaps (cap 0.12 s) → coupes nettes, jamais au milieu d'un mot.
function rangesFromKeptWords(words, dropSet, totalDuration) {
  const MAX_GAP = 0.45;
  const EDGE = 0.12;
  const kept = words.map((w, i) => ({ ...w, i })).filter((w) => !dropSet.has(w.i));
  if (kept.length < 3) return null;

  // Bords précis : jamais mordre le mot SOURCE voisin (souvent un mot
  // supprimé) — la coupe tombe au milieu du gap réel, cap EDGE.
  const entryEdge = (w) => {
    const prev = w.i > 0 ? words[w.i - 1] : null;
    const floor = prev ? (prev.end + w.start) / 2 : w.start - EDGE;
    return Math.max(0, Math.max(floor, w.start - EDGE));
  };
  const exitEdge = (w) => {
    const next = w.i < words.length - 1 ? words[w.i + 1] : null;
    const ceil = next ? (w.end + next.start) / 2 : w.end + EDGE;
    return Math.min(totalDuration, Math.min(ceil, w.end + EDGE));
  };

  const ranges = [];
  let cur = null;       // { start, lastWord }
  let prevKept = null;
  for (const w of kept) {
    const droppedBetween = prevKept && (w.i - prevKept.i) > 1;
    if (!cur) {
      cur = { start: entryEdge(w), lastWord: w };
    } else if (droppedBetween || w.start - prevKept.end > MAX_GAP) {
      ranges.push({ start: cur.start, end: exitEdge(cur.lastWord) });
      cur = { start: entryEdge(w), lastWord: w };
    } else {
      cur.lastWord = w;
    }
    prevKept = w;
  }
  if (cur) ranges.push({ start: cur.start, end: exitEdge(cur.lastWord) });

  return fusionRanges(ranges.filter((r) => r.end - r.start > 0.25));
}

function fallbackPlan(segments, brollCount) {
  // Sans IA disponible : rien à supprimer éditorialement (les disfluences et
  // silences sont quand même coupés), hook = début de la 1re phrase,
  // b-rolls répartis sur les passages.
  const n = Math.min(brollCount, MAX_BROLLS);
  const brolls = [];
  const step = Math.max(1, Math.floor(segments.length / (n + 1)));
  for (let i = 1; i <= n && i * step < segments.length; i += 1) {
    brolls.push({
      segmentIndex: i * step,
      promptEn: 'cinematic b-roll shot, high quality product lifestyle footage, shallow depth of field',
      label: '',
    });
  }
  return {
    dropWordRanges: [],
    analysis: null,
    hookText: (segments[0]?.text || '').split(/[.!?]/)[0]?.trim().slice(0, 60) || '',
    brolls,
    callouts: [],
    transitions: [],
    openingSegment: 0,
    musicMood: 'energetic',
    _fallback: true,
  };
}

// Monteur IA WORD-LEVEL (style Descript) : DeepSeek analyse d'abord le
// CONTEXTE de la vidéo (champ "analysis" — sujet, intention, moments clés),
// puis supprime des PLAGES DE MOTS précises : hésitations restantes, faux
// départs, répétitions d'idées, digressions, remplissage. Précision au mot.
async function buildAiEditPlan({ segments, words, totalDuration, targetDuration, brollCount, language, autoDropped }) {
  if (!segments.length || !words.length) return fallbackPlan(segments, brollCount);

  // Transcript : mots numérotés, groupés par passage (P#) pour l'habillage.
  let cursor = 0;
  const blocks = segments.map((s, si) => {
    const parts = [];
    while (cursor < words.length && words[cursor].start < s.end - 0.05) {
      const w = words[cursor];
      parts.push(`${cursor}:${autoDropped.has(cursor) ? '~' : ''}${w.word}`);
      cursor += 1;
    }
    return `P${si} (${s.start.toFixed(1)}→${s.end.toFixed(1)}s) ${parts.join(' ')}`;
  }).join('\n').slice(0, 16000);

  const targetLine = targetDuration
    ? `environ ${Math.round(targetDuration)}s`
    : `entre 60 % et 85 % du rush`;

  const sys = `Tu es un monteur vidéo professionnel spécialisé en contenus courts e-commerce (Reels/TikTok).
Tu montes au MOT près, comme dans Descript. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.`;
  const user = `Rush de ${totalDuration.toFixed(1)}s (langue: ${language || 'auto'}). Transcript : chaque mot est numéroté « index:mot », groupé par passage P#. Les mots préfixés « ~ » sont des hésitations DÉJÀ supprimées automatiquement.
${blocks}

MONTE cette vidéo au mot près :
1. "analysis" : 2-3 phrases — de quoi parle la vidéo, quelle est son intention (vendre quoi, à qui), quels sont les moments forts. Tes décisions de coupe doivent découler de cette compréhension.
2. "dropWordRanges" : plages de MOTS à SUPPRIMER, format [[premierIndex, dernierIndex], ...] (bornes incluses). Supprime : idées répétées, phrases redondantes, digressions hors sujet, blabla d'intro/outro, longueurs, tout ce qui n'apporte rien à l'objectif identifié. Exemple : si les mots 42-58 redisent ce que 20-35 ont déjà dit, renvoie [[42,58]] ; si une digression va du mot 90 au mot 117, ajoute [[90,117]]. NE COUPE JAMAIS un mot dont la phrase restante a besoin grammaticalement — relis mentalement le texte restant. Un montage qui ne retire rien n'est pas un montage : liste dans "analysis" les répétitions/longueurs que tu as repérées, puis coupe-les.
3. La durée totale restante doit faire ${targetLine} — STRICTEMENT INFÉRIEURE à ${totalDuration.toFixed(0)}s.
4. "hookText" : accroche de 3 à 7 mots (langue du transcript), affichée en gros au début.
5. "brolls" : ${brollCount} maximum, format {"segmentIndex": numéro P d'un passage NON supprimé, "promptEn": "prompt IMAGE en anglais, précis, cinématographique, illustrant ce passage", "label": "2-4 mots optionnels (langue du transcript)"} — jamais sur P0.
6. "callouts" : 0 à 3 mots-clés forts {"segmentIndex": numéro P, "text": "max 5 mots"} — pas sur un passage qui a un b-roll.
7. "transitions" : 1 à 4 CHANGEMENTS DE SECTION (nouvelle idée, passage à l'argument suivant, arrivée du call-to-action), format {"segmentIndex": numéro P du passage qui OUVRE la nouvelle section} — un flash + effet sonore y sera placé. Jamais P0.
8. "openingSegment" : numéro P du passage LE PLUS PERCUTANT du rush, celui qui accroche en 2 secondes — il sera DÉPLACÉ en OUVERTURE de la vidéo (cold-open, technique de monteur senior). Si la meilleure accroche est déjà au tout début, mets 0.
9. "musicMood" : "energetic" | "chill" | "epic" | "emotional".

JSON : { "analysis": "...", "dropWordRanges": [[s,e],...], "hookText": "...", "brolls": [...], "callouts": [...], "transitions": [...], "openingSegment": 0, "musicMood": "..." }`;

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];

  let raw = null;
  try {
    const r = await callDeepseekChat({ messages, temperature: 0.3, maxTokens: 3200, responseFormat: { type: 'json_object' } });
    raw = r?.content || r?.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn('[AutoEdit] monteur IA primaire indisponible:', e.message);
    if (isKieConfigured()) {
      try {
        const r = await callKieChatCompletion({ messages, temperature: 0.3, maxTokens: 3200 });
        raw = r?.content || null;
      } catch (e2) {
        console.warn('[AutoEdit] monteur IA fallback indisponible:', e2.message);
      }
    }
  }

  if (!raw) return fallbackPlan(segments, brollCount);
  try {
    const jsonStr = raw.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(jsonStr.slice(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1));

    // Plages de mots valides : bornes entières dans [0, words.length).
    const parseDrops = (arr) => (Array.isArray(arr) ? arr : [])
      .map((r) => (Array.isArray(r) ? [parseInt(r[0], 10), parseInt(r[1], 10)] : null))
      .filter((r) => r && Number.isInteger(r[0]) && Number.isInteger(r[1])
        && r[0] >= 0 && r[1] >= r[0] && r[1] < words.length);
    let dropWordRanges = parseDrops(plan.dropWordRanges);

    // CRITIC PASS : si le monteur IA n'a rien coupé, on le relance UNE fois
    // avec une consigne resserrée — un rush parlé contient toujours du gras.
    if (!dropWordRanges.length) {
      console.warn('[AutoEdit] plan IA sans coupes — extrait réponse:', String(raw).slice(0, 400));
      try {
        const retryMessages = [
          { role: 'system', content: sys },
          { role: 'user', content: user },
          { role: 'assistant', content: String(raw).slice(0, 2000) },
          { role: 'user', content: `Tu n'as fourni AUCUNE coupe ("dropWordRanges" vide). Un rush parlé contient toujours des passages plus faibles : redites, formulations qui traînent, chevilles inutiles. Relis le transcript et renvoie UNIQUEMENT un JSON { "dropWordRanges": [[s,e],...] } avec AU MOINS les 2 passages les plus faibles (précision au mot, bornes incluses). La durée finale doit rester STRICTEMENT inférieure à ${totalDuration.toFixed(0)}s.` },
        ];
        let raw2 = null;
        try {
          const r2 = await callDeepseekChat({ messages: retryMessages, temperature: 0.4, maxTokens: 800, responseFormat: { type: 'json_object' } });
          raw2 = r2?.content || r2?.choices?.[0]?.message?.content || null;
        } catch {
          if (isKieConfigured()) {
            const r2 = await callKieChatCompletion({ messages: retryMessages, temperature: 0.4, maxTokens: 800 });
            raw2 = r2?.content || null;
          }
        }
        if (raw2) {
          const j2 = raw2.replace(/```json|```/g, '').trim();
          const p2 = JSON.parse(j2.slice(j2.indexOf('{'), j2.lastIndexOf('}') + 1));
          dropWordRanges = parseDrops(p2.dropWordRanges);
          if (dropWordRanges.length) console.log(`[AutoEdit] critic pass : ${dropWordRanges.length} coupes obtenues au 2e passage`);
        }
      } catch (e) {
        console.warn('[AutoEdit] critic pass indisponible:', e.message);
      }
    }

    const validSeg = (n) => {
      const i = parseInt(n, 10);
      return Number.isInteger(i) && i >= 0 && i < segments.length;
    };

    return {
      dropWordRanges,
      analysis: String(plan.analysis || '').slice(0, 400) || null,
      hookText: String(plan.hookText || '').slice(0, 70),
      brolls: (Array.isArray(plan.brolls) ? plan.brolls : [])
        .filter((b) => validSeg(b.segmentIndex))
        .slice(0, Math.min(brollCount, MAX_BROLLS))
        .map((b) => ({
          segmentIndex: parseInt(b.segmentIndex, 10),
          promptEn: String(b.promptEn || '').slice(0, 400) || 'cinematic product b-roll, high quality',
          label: String(b.label || '').slice(0, 60),
        })),
      callouts: (Array.isArray(plan.callouts) ? plan.callouts : [])
        .filter((c) => validSeg(c.segmentIndex) && c.text)
        .slice(0, 3)
        .map((c) => ({ segmentIndex: parseInt(c.segmentIndex, 10), text: String(c.text).slice(0, 40) })),
      transitions: (Array.isArray(plan.transitions) ? plan.transitions : [])
        .filter((t) => validSeg(t?.segmentIndex ?? t))
        .slice(0, 4)
        .map((t) => ({ segmentIndex: parseInt(t?.segmentIndex ?? t, 10) })),
      openingSegment: validSeg(plan.openingSegment) ? parseInt(plan.openingSegment, 10) : 0,
      musicMood: ['energetic', 'chill', 'epic', 'emotional'].includes(plan.musicMood) ? plan.musicMood : 'energetic',
    };
  } catch {
    return fallbackPlan(segments, brollCount);
  }
}

// ─── 4. B-rolls Grok Imagine (via KIE) ───────────────────────────────────────

async function generateBrollAssets({ brolls, mode, format, tmpDir, onStep, warnings }) {
  const { w, h } = FORMATS[format] || FORMATS['9:16'];
  const aspect = format === '16:9' ? '16:9' : '9:16';
  const assets = [];

  for (let i = 0; i < brolls.length; i += 1) {
    const b = brolls[i];
    onStep?.(i);
    try {
      // 1. Image via la cascade existante du backend (KIE / Grok Imagine).
      let imageUrl = await generateNanoBananaImage(`${b.promptEn}, no text, no watermark`, aspect, 1);
      if (Array.isArray(imageUrl)) imageUrl = imageUrl[0];
      if (imageUrl && typeof imageUrl === 'object') imageUrl = imageUrl.url || imageUrl.imageUrl || null;
      if (!imageUrl) throw new Error('aucune image générée');

      // 2. Clip animé (Grok Imagine vidéo via KIE) ou Ken Burns local.
      const clipPath = path.join(tmpDir, `broll-${i}-${uid()}.mp4`);
      let animated = false;
      if (mode === 'animated') {
        try {
          const videoUrl = await grokImageToVideo(b.promptEn, imageUrl, { durationSec: Math.min(6, Math.ceil(b.durationSec) + 1), aspectRatio: aspect });
          await downloadWithRetry(videoUrl, clipPath);
          animated = true;
        } catch (e) {
          console.warn('[AutoEdit] b-roll animé indisponible, Ken Burns:', e.message);
        }
      }
      if (!animated) {
        // Ken Burns : zoom lent sur l'image générée, cadré au format cible.
        const imgPath = path.join(tmpDir, `broll-${i}-${uid()}.jpg`);
        await downloadWithRetry(imageUrl, imgPath);
        const frames = Math.max(30, Math.round(b.durationSec * 30));
        await runFfmpeg([
          '-y', '-loop', '1', '-i', imgPath, '-t', b.durationSec.toFixed(2),
          '-vf', [
            `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
            `crop=${w * 2}:${h * 2}`,
            `zoompan=z='min(zoom+0.0016,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=30`,
          ].join(','),
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-an',
          clipPath,
        ]);
      }
      assets.push({ ...b, clipPath, animated });
    } catch (e) {
      console.warn(`[AutoEdit] b-roll ${i + 1} ignoré:`, e.message);
      warnings.push(`B-roll ${i + 1} ignoré (génération indisponible)`);
    }
  }
  return assets;
}

// ─── 5. Sous-titres .ass word-level + motion design texte ───────────────────

function groupWords(words, maxWords = 3, maxSpanSec = 1.6) {
  const groups = [];
  let current = [];
  for (const w of words) {
    if (!w.word) continue;
    if (
      current.length >= maxWords
      || (current.length && w.end - current[0].start > maxSpanSec)
      || (current.length && w.start - current[current.length - 1].end > 0.6)
    ) {
      groups.push(current);
      current = [];
    }
    current.push(w);
  }
  if (current.length) groups.push(current);
  return groups
    .map((g) => ({
      start: g[0].start,
      end: Math.max(g[g.length - 1].end, g[0].start + 0.35),
      text: g.map((w) => w.word).join(' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter((g) => g.text);
}

function buildAssFile({ words, hookText, callouts, brolls, style, format, editedDuration }) {
  const { w, h } = FORMATS[format] || FORMATS['9:16'];
  const st = CAPTION_STYLES[style] || CAPTION_STYLES.bold;
  const isVertical = format !== '16:9';
  const capSize = Math.round(st.fontSize * (isVertical ? 1 : 0.72));
  const marginV = Math.round(h * (isVertical ? 0.22 : 0.10));
  const hookSize = Math.round(capSize * 1.35);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,${capSize},${st.primary},&H000000FF,${st.outline},&H96000000,-1,0,0,0,100,100,0,0,1,${isVertical ? 7 : 5},0,2,60,60,${marginV},1
Style: Hook,DejaVu Sans,${hookSize},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,8,0,5,60,60,0,1
Style: Callout,DejaVu Sans,${Math.round(capSize * 0.9)},&H0032D9FF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,6,0,8,60,60,${Math.round(h * 0.08)},1
Style: BrollLabel,DejaVu Sans,${Math.round(capSize * 0.75)},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,5,0,8,60,60,${Math.round(h * 0.10)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = [];
  // Pop d'apparition (style CapCut) : scale-in marqué + micro-rotation
  // alternée par groupe de mots — les sous-titres « vivent ».
  const groups = groupWords(words);
  groups.forEach((g, gi) => {
    const rot = gi % 2 === 0 ? '2.5' : '-2.5';
    const pop = `{\\fad(60,40)\\frz${rot}\\t(0,110,\\fscx118\\fscy118)\\t(110,210,\\fscx100\\fscy100\\frz0)}`;
    lines.push(`Dialogue: 0,${assTime(g.start)},${assTime(g.end)},Caption,,0,0,0,,${pop}${escAss(g.text.toUpperCase())}`);
  });

  // Hook : gros titre centré au démarrage.
  if (hookText) {
    const end = Math.min(2.8, Math.max(1.8, editedDuration * 0.08));
    lines.push(`Dialogue: 1,${assTime(0.15)},${assTime(end)},Hook,,0,0,0,,{\\fad(120,160)\\t(0,180,\\fscx112\\fscy112)\\t(180,320,\\fscx100\\fscy100)}${escAss(hookText.toUpperCase())}`);
  }

  // Callouts : mots-clés flash en haut.
  for (const c of callouts) {
    lines.push(`Dialogue: 1,${assTime(c.atSec)},${assTime(c.atSec + 1.6)},Callout,,0,0,0,,{\\fad(90,120)\\t(0,140,\\fscx115\\fscy115)\\t(140,260,\\fscx100\\fscy100)}${escAss(c.text.toUpperCase())}`);
  }

  // Étiquettes des b-rolls (si le plan en fournit).
  for (const b of brolls) {
    if (b.label) {
      lines.push(`Dialogue: 1,${assTime(b.atSec + 0.2)},${assTime(b.atSec + b.durationSec - 0.1)},BrollLabel,,0,0,0,,{\\fad(120,120)}${escAss(b.label)}`);
    }
  }

  return header + lines.join('\n') + '\n';
}

function buildSrt(words) {
  const groups = groupWords(words, 7, 3.5);
  return groups.map((g, i) => `${i + 1}\n${srtTime(g.start)} --> ${srtTime(g.end)}\n${g.text}\n`).join('\n');
}

// ─── 6. Banque audio locale (musique + SFX) ──────────────────────────────────

async function loadAudioBank() {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(AUDIO_DIR, 'manifest.json'), 'utf8'));
    return {
      music: Array.isArray(manifest.music) ? manifest.music : [],
      sfx: Array.isArray(manifest.sfx) ? manifest.sfx : [],
    };
  } catch {
    return { music: [], sfx: [] };
  }
}

async function resolveMusic({ musicPath, musicMood, bank, warnings }) {
  if (musicPath) return musicPath; // fichier fourni par l'utilisateur
  // Priorité au mood choisi par l'IA, puis n'importe quelle musique déposée.
  const ordered = [
    ...bank.music.filter((m) => m.mood === musicMood),
    ...bank.music.filter((m) => m.mood !== musicMood),
  ];
  for (const pick of ordered) {
    const p = path.join(AUDIO_DIR, 'music', pick.file);
    try { await fs.access(p); return p; } catch { /* fichier pas encore déposé */ }
  }
  warnings.push(ordered.length
    ? 'Aucun fichier musique déposé dans la banque (Backend/assets/montage-audio/music)'
    : 'Aucune musique de fond (banque vide et aucun fichier fourni)');
  return null;
}

// ─── 7. Rendu final d'un format ──────────────────────────────────────────────

async function renderFormat({
  cutPath, cutDuration, format, brollAssets, assPath, musicPath, sfxEvents = [], transitions = [], tmpDir, warnings = [], flags = {},
}) {
  const { w, h } = FORMATS[format];
  const out = path.join(tmpDir, `final-${format.replace(':', 'x')}.mp4`);

  const inputs = ['-i', cutPath];
  brollAssets.forEach((b) => { inputs.push('-i', b.clipPath); });
  // Un input « plan blanc » par transition flash (≤ 4).
  const flashBaseIdx = 1 + brollAssets.length;
  transitions.forEach(() => {
    inputs.push('-f', 'lavfi', '-i', `color=white:s=${w}x${h}:d=0.4:r=30`);
  });

  const buildParts = (withSubtitles) => {
    const parts = [];
    // Base : recadrage vers le format cible avec fond flou (jamais destructif).
    parts.push(`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=24:6[bg]`);
    parts.push(`[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg]`);
    parts.push(`[bg][fg]overlay=(W-w)/2:(H-h)/2[base0]`);

    // B-rolls : plein écran par-dessus la base, audio original continu.
    let cur = 'base0';
    let step = 0;
    brollAssets.forEach((b, i) => {
      const idx = i + 1;
      const from = b.atSec.toFixed(2);
      const to = (b.atSec + b.durationSec).toFixed(2);
      parts.push(`[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},format=yuva420p,setpts=PTS-STARTPTS+${from}/TB,fade=t=in:st=${from}:d=0.18:alpha=1,fade=t=out:st=${(b.atSec + b.durationSec - 0.18).toFixed(2)}:d=0.18:alpha=1[br${idx}]`);
      step += 1;
      parts.push(`[${cur}][br${idx}]overlay=0:0:enable='between(t,${from},${to})'[s${step}]`);
      cur = `s${step}`;
    });

    // Transitions FLASH (changements de section décidés par l'IA) : éclair
    // blanc de ~0,25 s centré sur l'instant du cut de section.
    transitions.forEach((t, i) => {
      const idx = flashBaseIdx + i;
      const from = Math.max(0, t - 0.10);
      parts.push(`[${idx}:v]format=yuva420p,colorchannelmixer=aa=0.85,fade=t=in:st=0:d=0.08:alpha=1,fade=t=out:st=0.10:d=0.16:alpha=1,setpts=PTS-STARTPTS+${from.toFixed(2)}/TB[fl${i}]`);
      step += 1;
      parts.push(`[${cur}][fl${i}]overlay=0:0:enable='between(t,${from.toFixed(2)},${(from + 0.30).toFixed(2)})'[s${step}]`);
      cur = `s${step}`;
    });

    if (withSubtitles) {
      // Sous-titres + motion design texte (.ass embarqué avec les polices du repo).
      parts.push(`[${cur}]subtitles='${escFilterPath(assPath)}':fontsdir='${escFilterPath(FONTS_DIR)}',setsar=1[vout]`);
    } else {
      parts.push(`[${cur}]setsar=1[vout]`);
    }
    return parts;
  };

  const renderArgs = (parts) => ([
    '-y', ...inputs,
    '-filter_complex', parts.join(';'),
    '-map', '[vout]', '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
    '-c:a', 'aac', '-b:a', '192k',
    '-t', cutDuration.toFixed(2), '-pix_fmt', 'yuv420p',
    out,
  ]);

  try {
    await runFfmpeg(renderArgs(buildParts(Boolean(assPath))));
    if (assPath) flags.subtitlesBurned = true;
  } catch (e) {
    // ffmpeg compilé sans libass (filtre subtitles indisponible) : on rend
    // quand même la vidéo, sans sous-titres, avec un avertissement clair.
    if (assPath && /subtitles|libass|no such filter/i.test(e.message || '')) {
      console.warn('[AutoEdit] filtre subtitles indisponible, rendu sans sous-titres:', e.message);
      warnings.push('Sous-titres non incrustés (ffmpeg du serveur sans libass)');
      flags.subtitlesBurned = false;
      await runFfmpeg(renderArgs(buildParts(false)));
    } else {
      throw e;
    }
  }

  // SFX : whoosh aux b-rolls et transitions, pop aux callouts — chaque
  // événement est un fichier + un instant, mixé par-dessus la voix.
  let withSfx = out;
  const events = sfxEvents.filter((e) => e.file && e.at >= 0 && e.at < cutDuration - 0.2).slice(0, 16);
  if (events.length) {
    try {
      const sfxOut = path.join(tmpDir, `sfx-${format.replace(':', 'x')}.mp4`);
      const sfxInputs = ['-i', out];
      const mixParts = [];
      const mixLabels = [];
      events.forEach((e, i) => {
        sfxInputs.push('-i', e.file);
        const delayMs = Math.max(0, Math.round(e.at * 1000));
        mixParts.push(`[${i + 1}:a]volume=${(e.volume ?? 0.55).toFixed(2)},adelay=${delayMs}|${delayMs}[s${i}]`);
        mixLabels.push(`[s${i}]`);
      });
      mixParts.push('[0:a]anull[voice]');
      mixParts.push(`[voice]${mixLabels.join('')}amix=inputs=${mixLabels.length + 1}:normalize=0:duration=first:dropout_transition=0[aout]`);
      await runFfmpeg([
        '-y', ...sfxInputs,
        '-filter_complex', mixParts.join(';'),
        '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        sfxOut,
      ]);
      withSfx = sfxOut;
      flags.sfxApplied = true;
    } catch (e) {
      console.warn('[AutoEdit] SFX ignorés:', e.message);
      warnings.push('Effets sonores ignorés (mix impossible)');
    }
  }

  // Musique de fond : loudnorm + boucle + ducking sidechain (la musique
  // s'abaisse quand la voix parle) — pattern éprouvé du montage existant.
  let final = withSfx;
  if (musicPath) {
    try {
      const fadeStart = Math.max(0, cutDuration - 1.5).toFixed(2);
      const musPrepared = path.join(tmpDir, `music-${format.replace(':', 'x')}.wav`);
      await runFfmpeg([
        '-y', '-stream_loop', '-1', '-i', musicPath,
        '-t', cutDuration.toFixed(2),
        '-af', `loudnorm=I=-16:TP=-1.5:LRA=11,volume=0.45,afade=t=out:st=${fadeStart}:d=1.5`,
        '-ar', '44100', '-ac', '2', musPrepared,
      ]);
      const mixed = path.join(tmpDir, `mix-${format.replace(':', 'x')}.mp4`);
      await runFfmpeg([
        '-y', '-i', withSfx, '-i', musPrepared,
        '-filter_complex',
        '[0:a]asplit=2[vox][sc];[1:a][sc]sidechaincompress=threshold=0.03:ratio=6:attack=80:release=350[duck];[vox][duck]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[a]',
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        mixed,
      ]);
      final = mixed;
      flags.musicApplied = true;
    } catch (e) {
      console.warn('[AutoEdit] musique ignorée:', e.message);
      warnings.push('Musique de fond ignorée (fichier illisible ou mix impossible)');
    }
  }

  // Remux faststart pour lecture web progressive.
  const remuxed = path.join(tmpDir, `out-${format.replace(':', 'x')}.mp4`);
  await runFfmpeg(['-y', '-i', final, '-c', 'copy', '-movflags', '+faststart', remuxed]);
  return remuxed;
}

// ─── Pipeline principal ──────────────────────────────────────────────────────

/**
 * Monte automatiquement une vidéo brute.
 * @param {string} videoPath  Fichier local (upload multer disque)
 * @param {object} opts { formats, captionStyle, brollCount, brollMode, musicPath, removeSilences }
 * @param {function} onProgress (pct, stage) => void
 * @returns {{ outputs:[{format,url,durationSec}], srtUrl, language, warnings, cutsRemovedSec, brollCount }}
 */
export async function autoEditVideo(videoPath, opts = {}, onProgress = () => {}) {
  const {
    formats = ['9:16'],
    captionStyle = 'bold',
    brollCount = 3,
    brollMode = 'kenburns',      // 'kenburns' | 'animated'
    musicPath = null,
    removeSilences = true,
    targetDuration = null,       // durée finale visée (s) — l'IA s'en approche
  } = opts;

  const wanted = [...new Set(formats.filter((f) => FORMATS[f]))];
  if (!wanted.length) wanted.push('9:16');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scalor-autoedit-'));
  const warnings = [];

  try {
    onProgress(4, 'Analyse de la vidéo');
    const totalDuration = await probeDuration(videoPath);
    if (!totalDuration || totalDuration < 3) throw new Error('Vidéo illisible ou trop courte (3 s minimum).');
    if (totalDuration > MAX_SOURCE_DURATION) throw new Error(`Vidéo trop longue (${Math.round(MAX_SOURCE_DURATION / 60)} min maximum).`);

    // 1. Transcription (mot à mot) — tolérante aux vidéos muettes
    onProgress(8, 'Transcription de la voix');
    const sourceHasAudio = await hasAudioStream(videoPath);
    let transcript = { language: null, segments: [], words: [] };
    if (sourceHasAudio) {
      const audioPath = path.join(tmpDir, 'audio.mp3');
      await extractAudio(videoPath, audioPath);
      transcript = await transcribeSegments(audioPath);
    } else {
      warnings.push('Vidéo sans piste audio : pas de sous-titres ni de cuts vocaux');
    }
    const hasSpeech = transcript.segments.length > 0;
    if (sourceHasAudio && !hasSpeech) warnings.push('Aucune parole détectée : sous-titres et cuts limités');
    // Word-level manquant (selon provider/langue) → synthèse depuis les
    // segments pour garantir sous-titres et cuts.
    if (hasSpeech && (!Array.isArray(transcript.words) || transcript.words.length < 3)) {
      transcript.words = synthesizeWordsFromSegments(transcript.segments);
      warnings.push('Sous-titres calés sur les phrases (horodatage mot-à-mot indisponible)');
    }

    // 2. NETTOYAGE DÉTERMINISTE : fillers (« euh », « um »…), bégaiements ET
    // retakes (phrases recommencées) détectés au mot près, sans IA.
    const autoDropped = hasSpeech ? detectDisfluencies(transcript.words) : new Set();
    const retakes = hasSpeech ? detectRetakes(transcript.words, autoDropped) : new Set();
    for (const i of retakes) autoDropped.add(i);
    if (retakes.size) warnings.push(`${retakes.size} mots de faux départs/répétitions retirés automatiquement`);

    // 3. MONTAGE PAR L'IA (word-level) : DeepSeek comprend d'abord le CONTEXTE
    // de la vidéo (analysis) puis supprime des plages de mots précises.
    onProgress(16, 'Analyse du montage par l\'IA');
    const fineSegments = hasSpeech ? refineSegmentsForAi(transcript.segments, transcript.words) : [];
    const plan = hasSpeech
      ? await buildAiEditPlan({
        segments: fineSegments,
        words: transcript.words,
        totalDuration,
        targetDuration,
        brollCount,
        language: transcript.language,
        autoDropped,
      })
      : fallbackPlan([], brollCount);
    if (plan._fallback && hasSpeech) {
      warnings.push('Montage IA indisponible : nettoyage automatique seul (hésitations + silences)');
    }

    // 4. EDL mots → plages réelles. dropSet = disfluences auto ∪ décisions IA,
    // avec garde-fous : l'IA ne peut pas supprimer plus de 75 % des mots, et
    // la matière gardée ne descend jamais sous 25 % du rush.
    onProgress(22, 'Détection des temps morts');
    let ranges = [{ start: 0, end: totalDuration }];
    let aiCutApplied = false;
    let dropSet = new Set(autoDropped);
    if (removeSilences && hasSpeech) {
      const aiDrop = new Set();
      for (const [s, e] of (plan.dropWordRanges || [])) {
        for (let i = s; i <= e; i += 1) aiDrop.add(i);
      }
      if (aiDrop.size > 0 && aiDrop.size <= transcript.words.length * 0.75) {
        for (const i of aiDrop) dropSet.add(i);
        aiCutApplied = true;
      } else if (aiDrop.size > 0) {
        warnings.push('Découpage IA trop agressif — nettoyage automatique seul');
      }

      let kept = rangesFromKeptWords(transcript.words, dropSet, totalDuration);
      if (kept && rangesDuration(kept) < totalDuration * 0.25) {
        // Trop coupé : on retombe sur les disfluences seules.
        dropSet = new Set(autoDropped);
        aiCutApplied = false;
        kept = rangesFromKeptWords(transcript.words, dropSet, totalDuration);
        warnings.push('Découpage IA trop agressif — nettoyage automatique seul');
      }
      ranges = kept || speechRangesFromWords(transcript.words, totalDuration)
        || await detectSpeechRanges(videoPath, totalDuration);
    } else if (removeSilences && !hasSpeech) {
      warnings.push('Pas de parole détectée : cuts vocaux impossibles');
    }

    // COLD-OPEN : le passage le plus percutant (choisi par l'IA) est DÉPLACÉ
    // en ouverture de la vidéo — la timeline devient non chronologique.
    // INVARIANT : un déplacement ne change JAMAIS la durée totale ; si la
    // somme augmente (duplication), le déplacement est annulé.
    let openingMoved = false;
    if (hasSpeech && ranges.length > 1 && Number.isInteger(plan.openingSegment) && plan.openingSegment > 0) {
      const seg = fineSegments[plan.openingSegment];
      if (seg && seg.start > 4) {
        const durBefore = rangesDuration(ranges);
        const openWindow = [{
          start: Math.max(0, seg.start - CUT_PADDING),
          end: Math.min(totalDuration, seg.end + CUT_PADDING),
        }];
        const opening = intersectRanges(openWindow, ranges);
        const openDur = rangesDuration(opening);
        if (opening.length && openDur >= 1.2 && openDur <= 9) {
          const reordered = [...opening, ...subtractRanges(ranges, opening)];
          if (rangesDuration(reordered) <= durBefore + 0.05) {
            ranges = reordered;
            openingMoved = true;
          } else {
            console.warn('[AutoEdit] cold-open annulé (duplication détectée)',
              { durBefore, durAfter: rangesDuration(reordered) });
          }
        }
      }
    }

    const { map, editedDuration } = buildTimeMapper(ranges);
    const cutsRemovedSec = Math.max(0, totalDuration - editedDuration);
    // Contrainte : la durée finale doit être inférieure à la durée initiale.
    if (removeSilences && hasSpeech && editedDuration >= totalDuration - 0.1) {
      warnings.push('Aucun temps mort ni passage superflu : durée quasi inchangée');
    }

    // Transcript remappé sur la timeline montée. Les mots SUPPRIMÉS (fillers,
    // décisions IA) sont exclus des sous-titres, et les mots des plages
    // coupées tombent sur des bornes nulles → filtrés.
    const words = (transcript.words || [])
      .filter((_, i) => !dropSet.has(i))
      .map((w) => ({ ...w, start: map(w.start), end: map(w.end) }))
      .filter((w) => w.start >= 0 && w.end - w.start > 0.05);
    const segments = transcript.segments.map((s) => ({ ...s, start: map(s.start), end: map(s.end) }))
      .filter((s) => s.start >= 0 && s.end - s.start > 0.1);

    // 4. Coupe réelle. BEAT CUTS : chaque plage gardée est redécoupée toutes
    // les ~4,5 s aux frontières de mots (aucun contenu retiré) → cuts visibles
    // et punch-in alterné même quand le discours est continu (style Reels).
    onProgress(28, 'Cuts dynamiques');
    const visualRanges = (removeSilences && hasSpeech)
      ? beatCutRanges(ranges, transcript.words)
      : ranges;
    const dims = await probeDimensions(videoPath).catch(() => null);
    const cutPath = path.join(tmpDir, 'cut.mp4');
    await renderCutVideo(videoPath, visualRanges, cutPath, sourceHasAudio, dims);
    const cutDuration = (await probeDuration(cutPath)) || editedDuration;

    // 5. Habillage décidé par l'IA, remappé sur la timeline montée :
    // b-rolls et callouts sont attachés à des PASSAGES gardés → leur instant
    // final = position remappée du début du passage.
    const resolveAt = (segmentIndex, offset) => {
      const src = fineSegments[segmentIndex];
      if (!src) return null;
      const at = map(src.start) + offset;
      return (at > 3 && at < cutDuration - 3) ? Math.round(at * 10) / 10 : null;
    };
    let plannedBrolls = (plan.brolls || [])
      .map((b) => ({ ...b, atSec: resolveAt(b.segmentIndex, 0.4), durationSec: 2.6 }))
      .filter((b) => b.atSec != null);
    // Espacement minimal de 6 s entre b-rolls.
    plannedBrolls = plannedBrolls.filter((b, i, arr) => i === 0 || b.atSec - arr[i - 1].atSec >= 6);
    const plannedCallouts = (plan.callouts || [])
      .map((c) => ({ ...c, atSec: resolveAt(c.segmentIndex, 0.3) }))
      .filter((c) => c.atSec != null
        && !plannedBrolls.some((b) => c.atSec >= b.atSec - 1 && c.atSec <= b.atSec + b.durationSec + 1));
    plan.callouts = plannedCallouts;

    // Transitions FLASH aux changements de section. Base : décisions de l'IA,
    // COMPLÉTÉES automatiquement pour qu'aucun passage de plus de ~10 s ne
    // reste sans transition (rythme reels). Cap : 8.
    let transitionTimes = (plan.transitions || [])
      .map((t) => resolveAt(t.segmentIndex, 0))
      .filter((t) => t != null)
      .sort((a, b) => a - b)
      .filter((t, i, arr) => i === 0 || t - arr[i - 1] >= 5)
      .slice(0, 8);
    if (cutDuration > 14) {
      const anchors = [3, ...transitionTimes, cutDuration - 3].sort((a, b) => a - b);
      const fillers2 = [];
      for (let i = 0; i < anchors.length - 1 && transitionTimes.length + fillers2.length < 8; i += 1) {
        let from = anchors[i];
        while (anchors[i + 1] - from > 10 && transitionTimes.length + fillers2.length < 8) {
          const t = Math.round((from + 9) * 10) / 10;
          fillers2.push(t);
          from = t;
        }
      }
      transitionTimes = [...transitionTimes, ...fillers2].sort((a, b) => a - b);
    }
    // Pas de flash en plein b-roll (les deux effets se marcheraient dessus).
    transitionTimes = transitionTimes.filter(
      (t) => !plannedBrolls.some((b) => t >= b.atSec - 0.5 && t <= b.atSec + b.durationSec + 0.5),
    ).slice(0, 8);

    // 6. B-rolls Grok Imagine (générés une fois au format principal)
    const primaryFormat = wanted[0];
    let brollAssets = [];
    if (brollCount > 0 && plannedBrolls.length) {
      onProgress(42, 'Génération des b-rolls (Grok Imagine)');
      brollAssets = await generateBrollAssets({
        brolls: plannedBrolls,
        mode: brollMode,
        format: primaryFormat,
        tmpDir,
        warnings,
        onStep: (i) => onProgress(42 + Math.round((i / Math.max(1, plannedBrolls.length)) * 18), `B-roll ${i + 1}/${plannedBrolls.length}`),
      });
    }

    // 6. Audio bank — whoosh et pop SYNTHÉTISÉS en secours si la banque est
    // vide : chaque effet visuel a toujours sa présence sonore.
    const bank = await loadAudioBank();
    const music = await resolveMusic({ musicPath, musicMood: plan.musicMood, bank, warnings });
    let sfxWhoosh = null;
    const whoosh = bank.sfx.find((s) => s.type === 'whoosh') || bank.sfx[0];
    if (whoosh) {
      const p = path.join(AUDIO_DIR, 'sfx', whoosh.file);
      try { await fs.access(p); sfxWhoosh = p; } catch { /* banque incomplète */ }
    }
    if (!sfxWhoosh && (brollAssets.length || transitionTimes.length)) {
      try { sfxWhoosh = await synthWhoosh(tmpDir); } catch (e) {
        console.warn('[AutoEdit] whoosh synthétique indisponible:', e.message);
      }
    }
    let sfxPop = null;
    const popEntry = bank.sfx.find((s) => s.type === 'pop');
    if (popEntry) {
      const p = path.join(AUDIO_DIR, 'sfx', popEntry.file);
      try { await fs.access(p); sfxPop = p; } catch { /* banque incomplète */ }
    }
    if (!sfxPop && plannedCallouts.length) {
      try { sfxPop = await synthPop(tmpDir); } catch { /* optionnel */ }
    }
    let sfxBoom = null;
    const boomEntry = bank.sfx.find((s) => s.type === 'boom' || s.type === 'impact');
    if (boomEntry) {
      const p = path.join(AUDIO_DIR, 'sfx', boomEntry.file);
      try { await fs.access(p); sfxBoom = p; } catch { /* banque incomplète */ }
    }
    if (!sfxBoom && transitionTimes.length) {
      try { sfxBoom = await synthBoom(tmpDir); } catch { /* optionnel */ }
    }
    // Événements sonores : whoosh (b-rolls), boom (transitions flash),
    // pop (callouts) — mixés franchement, pas en arrière-plan timide.
    const sfxEvents = [
      ...brollAssets.map((b) => ({ file: sfxWhoosh, at: Math.max(0, b.atSec - 0.12), volume: 0.85 })),
      ...transitionTimes.map((t) => ({ file: sfxBoom || sfxWhoosh, at: Math.max(0, t - 0.10), volume: 0.9 })),
      ...plannedCallouts.map((c) => ({ file: sfxPop, at: c.atSec, volume: 0.8 })),
    ].filter((e) => e.file);

    // 7. Rendu par format
    const outputs = [];
    const flags = { subtitlesBurned: false, musicApplied: false, sfxApplied: false };
    for (let i = 0; i < wanted.length; i += 1) {
      const format = wanted[i];
      onProgress(62 + i * 16, `Rendu ${format}`);
      const hasAssContent = words.length > 0 || plan.hookText || plan.callouts.length > 0;
      const assPath = hasAssContent ? path.join(tmpDir, `subs-${format.replace(':', 'x')}.ass`) : null;
      if (assPath) {
        await fs.writeFile(assPath, buildAssFile({
          words, hookText: plan.hookText, callouts: plan.callouts,
          brolls: brollAssets, style: captionStyle, format, editedDuration: cutDuration,
        }), 'utf8');
      }

      const rendered = await renderFormat({
        cutPath, cutDuration, format, brollAssets, assPath, musicPath: music,
        sfxEvents, transitions: transitionTimes, tmpDir, warnings, flags,
      });

      const buffer = await fs.readFile(rendered);
      const up = await cloudflareImagesService.uploadToR2(buffer, `auto-montage-${uid()}-${format.replace(':', 'x')}.mp4`, 'video/mp4');
      if (!up?.success || !up?.url) throw new Error('Upload du rendu impossible.');
      outputs.push({ format, url: up.url, durationSec: Math.round(cutDuration) });
    }

    // Export .srt (réutilisable sur les plateformes)
    let srtUrl = null;
    if (words.length) {
      try {
        const srtUp = await cloudflareImagesService.uploadToR2(Buffer.from(buildSrt(words), 'utf8'), `auto-montage-${uid()}.srt`, 'text/plain');
        if (srtUp?.success) srtUrl = srtUp.url;
      } catch { /* optionnel */ }
    }

    onProgress(98, 'Finalisation');
    return {
      outputs,
      srtUrl,
      language: transcript.language,
      warnings: [...new Set(warnings)],
      cutsRemovedSec: Math.round(cutsRemovedSec * 10) / 10,
      brollCount: brollAssets.length,
      // Rapport par étape — affiché dans l'UI pour voir d'un coup d'œil ce qui
      // a réellement été appliqué (et diagnostiquer ce qui manque : clé API,
      // libass, banque audio…).
      report: {
        initialDurationSec: Math.round(totalDuration * 10) / 10,
        finalDurationSec: Math.round(cutDuration * 10) / 10,
        aiCutApplied,
        openingMoved,
        analysis: plan.analysis || null,
        wordsDropped: dropSet.size,
        retakesRemoved: retakes.size,
        fillersRemoved: Math.max(0, autoDropped.size - retakes.size),
        wordsTotal: (transcript.words || []).length,
        wordsCount: words.length,
        segmentsCount: segments.length,
        cutsCount: Math.max(0, visualRanges.length - 1),
        cutsRemovedSec: Math.round(cutsRemovedSec * 10) / 10,
        punchIn: visualRanges.length > 1,
        hookText: plan.hookText || null,
        calloutsCount: plan.callouts.length,
        transitionsCount: transitionTimes.length,
        brollsPlanned: plannedBrolls.length,
        brollsGenerated: brollAssets.length,
        brollMode,
        subtitlesBurned: flags.subtitlesBurned,
        musicApplied: flags.musicApplied,
        sfxApplied: flags.sfxApplied,
        planFallback: Boolean(plan._fallback),
      },
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export default { autoEditVideo, CAPTION_STYLES };
