// ─────────────────────────────────────────────────────────────────────────────
//  videoTranslationService — Traduction + doublage de vidéos (upload marchand).
//
//  Pipeline (une vidéo uploadée → une vidéo doublée + sous-titres traduits) :
//    1. ffmpeg extrait la piste audio (mono 16 kHz, mp3 léger) ;
//    2. Whisper (Groq large-v3-turbo, fallback OpenAI whisper-1) transcrit en
//       verbose_json → segments [{start, end, text}] + langue source détectée ;
//    3. un LLM traduit chaque segment vers la langue cible (aligné 1:1, registre
//       parlé, concis pour tenir dans la fenêtre temporelle) ;
//    4. génération d'un .srt traduit calé sur les timings d'origine ;
//    5. OpenAI TTS synthétise chaque segment ; chaque clip est recalé (atempo)
//       sur la durée de son slot d'origine pour rester synchrone à l'image ;
//    6. ffmpeg assemble la piste doublée (adelay + amix sur un silence de base)
//       puis la muxe dans la vidéo (audio original ducké ou remplacé ; sous-
//       titres incrustés en option) ;
//    7. upload R2 → { videoUrl, srtUrl }.
//
//  Aucune dépendance ffprobe : les durées audio sont lues en parsant le
//  "Duration:" de la sortie ffmpeg (ffmpeg-static ne fournit pas ffprobe).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, execFileSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { uploadToR2 } from './cloudflareImagesService.js';

// ─── Résolution ffmpeg robuste (même logique que videoMontageService) ────────
let _ffmpegBin = null;
function resolveFfmpeg() {
  if (_ffmpegBin) return _ffmpegBin;
  const candidates = [process.env.FFMPEG_PATH, ffmpegStatic, 'ffmpeg', '/usr/bin/ffmpeg'].filter(Boolean);
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore', timeout: 8000 });
      _ffmpegBin = bin;
      return bin;
    } catch { /* candidat suivant */ }
  }
  throw new Error('Aucun binaire ffmpeg fonctionnel (ffmpeg-static, PATH, /usr/bin/ffmpeg).');
}

function runFfmpeg(args) {
  const bin = resolveFfmpeg();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split('\n').slice(-3).join(' | ') || `ffmpeg exited ${code}`));
    });
  });
}

/**
 * Lit la durée (secondes) d'un fichier média en parsant "Duration:" de ffmpeg.
 * ffmpeg sort en erreur quand aucun output n'est demandé mais imprime quand
 * même la Duration → on capture stderr quel que soit le code de sortie.
 */
function probeDurationSec(filePath) {
  const bin = resolveFfmpeg();
  return new Promise((resolve) => {
    const child = spawn(bin, ['-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', () => resolve(0));
    child.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) resolve((+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]));
      else resolve(0);
    });
  });
}

// ─── Langues : code ISO → nom anglais (pour le prompt de traduction) ─────────
const LANG_NAMES = {
  fr: 'French', en: 'English', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  de: 'German', it: 'Italian', nl: 'Dutch', ru: 'Russian', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', hi: 'Hindi', tr: 'Turkish', pl: 'Polish',
  sw: 'Swahili', ha: 'Hausa', yo: 'Yoruba', wo: 'Wolof', lin: 'Lingala',
};
function langName(code) {
  const c = String(code || '').trim().toLowerCase().slice(0, 5);
  return LANG_NAMES[c] || LANG_NAMES[c.slice(0, 2)] || code || 'the target language';
}

// Voix OpenAI TTS valides (multilingues). Fallback sur 'alloy' si inconnue.
const TTS_VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse']);

// ─── 1. Extraction audio ─────────────────────────────────────────────────────
// Exporté : réutilisé par autoEditService (montage automatique IA).
export async function extractAudio(videoPath, outPath) {
  // mono 16 kHz mp3 : format attendu par Whisper, ~1 Mo/min → reste sous la
  // limite 25 Mo de l'API pour des vidéos de plusieurs minutes.
  await runFfmpeg(['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '96k', outPath]);
}

// ─── 2. Transcription horodatée (segments) ───────────────────────────────────
// Exporté : réutilisé par autoEditService (sous-titres word-level).
export async function transcribeSegments(audioPath) {
  const buffer = await fs.readFile(audioPath);
  // Groq whisper-large-v3-turbo : précis, rapide, verbose_json = segments+timings.
  if (process.env.GROQ_API_KEY) {
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json'); // langue AUTO-détectée (pas de param language)
    form.append('timestamp_granularities[]', 'segment');
    form.append('timestamp_granularities[]', 'word'); // horodatage au mot → recalage précis
    const res = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 300000, maxBodyLength: Infinity,
    });
    return normalizeTranscript(res.data);
  }
  // Fallback OpenAI whisper-1 (verbose_json renvoie aussi les segments).
  if (process.env.OPENAI_API_KEY) {
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    form.append('timestamp_granularities[]', 'word'); // horodatage au mot → recalage précis
    const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      timeout: 300000, maxBodyLength: Infinity,
    });
    return normalizeTranscript(res.data);
  }
  throw new Error('Aucune clé de transcription (GROQ_API_KEY ou OPENAI_API_KEY).');
}

function normalizeTranscript(data) {
  const lang = String(data?.language || '').toLowerCase().slice(0, 5) || 'auto';
  const segments = (Array.isArray(data?.segments) ? data.segments : [])
    .map((s) => ({
      start: Math.max(0, Number(s.start) || 0),
      end: Math.max(0, Number(s.end) || 0),
      text: String(s.text || '').trim(),
    }))
    .filter((s) => s.text && s.end > s.start);

  // Recalage précis : les bornes de segment Whisper englobent souvent un silence
  // avant/après la parole. On les resserre sur le 1er/dernier MOT du segment →
  // onset exact (pour le placement) et durée réelle de parole (pour le tempo).
  const words = (Array.isArray(data?.words) ? data.words : [])
    .map((w) => ({ word: String(w.word || '').trim(), start: Number(w.start) || 0, end: Number(w.end) || 0 }))
    .filter((w) => w.end > w.start);
  if (words.length) {
    for (const seg of segments) {
      const inside = words.filter((w) => w.end > seg.start - 0.2 && w.start < seg.end + 0.2);
      if (inside.length) {
        seg.start = inside[0].start;
        seg.end = Math.max(inside[inside.length - 1].end, seg.start + 0.2);
      }
    }
  }
  // `words` exposé pour les consommateurs word-level (sous-titres animés du
  // montage auto) — champ additif, ne change rien aux usages existants.
  return { language: lang, segments, words };
}

/**
 * Regroupe les segments Whisper (souvent des fragments coupés au milieu d'une
 * phrase) en PHRASES complètes. C'est la clé d'une traduction naturelle et non
 * hachée : on traduit et on double des unités de sens entières, pas des bouts.
 * On coupe sur : ponctuation de fin (. ! ? …), pause longue (≥0,8 s), ou limites
 * de sécurité (durée/longueur) pour ne pas faire des blocs ingérables.
 * @returns [{ start, end, text }]  (start/end = 1er/dernier segment de la phrase)
 */
function groupIntoSentences(segments) {
  const MAX_DUR = 14, MAX_CHARS = 240, GAP = 0.8;
  const out = [];
  let cur = null;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!cur) cur = { start: s.start, end: s.end, text: s.text.trim() };
    else { cur.text = `${cur.text} ${s.text.trim()}`.trim(); cur.end = s.end; }

    const next = segments[i + 1];
    const gapToNext = next ? next.start - cur.end : Infinity;
    const endsSentence = /[.!?…](["'”’)\]]?)$/.test(cur.text);
    const tooLong = (cur.end - cur.start) >= MAX_DUR || cur.text.length >= MAX_CHARS;
    if (!next || endsSentence || gapToNext >= GAP || tooLong) { out.push(cur); cur = null; }
  }
  return out.filter((p) => p.text && p.end > p.start);
}

// ─── 3. Traduction segment par segment (aligné 1:1) ──────────────────────────
// LLM OpenAI-compatible : Groq (llama-3.3-70b) puis OpenAI (gpt-4o-mini).
async function callTranslatorLLM(messages) {
  // Qualité prioritaire : gpt-4o (nuance + multilingue solide). Repli Groq.
  // Modèle surchargeable via VIDEO_TRANSLATION_MODEL.
  if (process.env.OPENAI_API_KEY) {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: process.env.VIDEO_TRANSLATION_MODEL || 'gpt-4o', temperature: 0.3,
      response_format: { type: 'json_object' }, messages,
    }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 180000 });
    return res.data?.choices?.[0]?.message?.content || '';
  }
  if (process.env.GROQ_API_KEY) {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile', temperature: 0.3,
      response_format: { type: 'json_object' }, messages,
    }, { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, timeout: 120000 });
    return res.data?.choices?.[0]?.message?.content || '';
  }
  throw new Error('Aucune clé LLM pour la traduction (OPENAI_API_KEY ou GROQ_API_KEY).');
}


async function translateSegments(segments, targetLang, sourceLang) {
  const target = langName(targetLang);
  const source = sourceLang && sourceLang !== 'auto' ? langName(sourceLang) : 'the source language';
  const out = new Array(segments.length);
  const BATCH = 30; // lots plus courts → alignement des indices fiable

  // Contexte global : transcription complète (plafonnée) fournie à CHAQUE lot pour
  // que le modèle résolve pronoms, terminologie et ton de façon cohérente. Les
  // segments Whisper sont souvent des fragments — sans ce contexte, la traduction
  // devient hachée et littérale.
  const fullContext = segments.map((s) => s.text).join(' ').slice(0, 8000);

  for (let i = 0; i < segments.length; i += BATCH) {
    const chunk = segments.slice(i, i + BATCH);
    const numbered = chunk.map((s, k) => `${k + 1}. ${s.text}`).join('\n');
    const sys = `You are an expert ${target} translator and localizer for professional VIDEO subtitles and voice-over. `
      + `Translate each numbered line from ${source} into ${target}.\n`
      + `PRIORITIES (in order): 1) faithful, accurate meaning; 2) natural, idiomatic, fluent ${target} `
      + `exactly as a native speaker would actually say it — NOT a word-for-word/literal translation; `
      + `3) consistent terminology, names and tone across all lines; 4) keep the same register as the source `
      + `(casual, marketing, formal…).\n`
      + `The lines are consecutive fragments of ONE continuous video — use the full transcript context below to `
      + `disambiguate pronouns, idioms and terminology, and to keep the narration flowing coherently line to line. `
      + `Aim for a length that stays reasonably close to the original so it fits the video, but NEVER sacrifice `
      + `meaning, grammar or fluency for brevity.\n`
      + `RULES: output EXACTLY ${chunk.length} lines, same order, one translation per input line; never merge, split, `
      + `drop or renumber lines; if a line is just noise/filler keep an equivalent short interjection; no notes, no commentary.\n`
      + `Return strict JSON: {"t":["line 1", "line 2", ...]} with exactly ${chunk.length} items.\n\n`
      + `FULL TRANSCRIPT (context only, do not translate this block):\n"""${fullContext}"""`;
    let parsed;
    try {
      const raw = await callTranslatorLLM([
        { role: 'system', content: sys },
        { role: 'user', content: numbered },
      ]);
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const arr = Array.isArray(parsed?.t) ? parsed.t : (Array.isArray(parsed) ? parsed : []);
    for (let k = 0; k < chunk.length; k++) {
      const t = String(arr[k] ?? '').trim();
      out[i + k] = t || chunk[k].text; // sécurité : jamais de ligne vide → texte source
    }
  }
  return out;
}

/**
 * Réécrit UNE ligne de doublage pour qu'elle tienne mieux dans son slot.
 * mode 'shorten' : trop longue (débit forcé) → phrase plus concise.
 * mode 'expand'  : trop courte (voix expédiée, gros silence) → phrase un peu étoffée.
 * Retourne le texte réécrit, ou l'original si échec.
 */
async function rewriteToFit(text, targetLangCode, targetDurationSec, mode) {
  const target = langName(targetLangCode);
  const instr = mode === 'shorten'
    ? `The line is TOO LONG to be spoken naturally in the time. Rewrite it MORE CONCISELY `
      + `(fewer words, same meaning, keep the key message) so a voice actor speaks it comfortably in about ${targetDurationSec.toFixed(1)} seconds.`
    : `The line is TOO SHORT and leaves an awkward gap. Rewrite it slightly FULLER and more natural `
      + `(same meaning, no invented facts) so it comfortably fills about ${targetDurationSec.toFixed(1)} seconds when spoken.`;
  const sys = `You rewrite a single voice-over line in ${target}. ${instr} `
    + `Keep natural spoken ${target}, same meaning and tone, no commentary. Return strict JSON: {"t":"..."}.`;
  try {
    const raw = await callTranslatorLLM([
      { role: 'system', content: sys },
      { role: 'user', content: text },
    ]);
    const t = String(JSON.parse(raw)?.t || '').trim();
    return t || text;
  } catch {
    return text;
  }
}

// ─── 4. Génération SRT ───────────────────────────────────────────────────────
function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const t = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${t}`;
}
function buildSrt(segments, translations) {
  return segments.map((seg, i) =>
    `${i + 1}\n${srtTime(seg.start)} --> ${srtTime(seg.end)}\n${translations[i]}\n`,
  ).join('\n');
}

// ─── 5. TTS par segment (OpenAI) ─────────────────────────────────────────────
async function synthesizeSegment(text, voice, outPath) {
  const res = await axios.post('https://api.openai.com/v1/audio/speech', {
    model: 'gpt-4o-mini-tts', voice, input: text, response_format: 'mp3',
    // Directive de style → diction claire et naturelle (meilleure audibilité).
    instructions: 'Speak clearly and naturally with crisp articulation, steady pacing and a neutral, professional tone.',
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    responseType: 'arraybuffer', timeout: 120000,
  });
  await fs.writeFile(outPath, Buffer.from(res.data));
}

// ─── 6. Assemblage de la piste doublée + mux dans la vidéo ────────────────────
/**
 * Construit une piste audio de `totalDur` secondes : chaque clip TTS est placé
 * exactement à son onset (`start`) et joue à vitesse NATURELLE tant qu'il tient
 * dans sa fenêtre (`win` = jusqu'à l'onset suivant). Il n'est ACCÉLÉRÉ (jamais
 * ralenti) que s'il déborde → zéro chevauchement, voix jamais traînante. La
 * piste finale est normalisée en loudness (audibilité constante).
 * @param clips [{ path, start, win, rawDur }]  (ordonnés par start)
 */
async function buildDubbedTrack(clips, totalDur, outPath) {
  const inputs = ['-f', 'lavfi', '-t', totalDur.toFixed(3), '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`];
  const filters = [];
  const mixLabels = ['[0:a]']; // input 0 = silence de base (définit la longueur)

  clips.forEach((clip, idx) => {
    const inputIndex = idx + 1;
    inputs.push('-i', clip.path);
    // Accélération douce UNIQUEMENT si la voix déborde sa fenêtre (anti-chevauchement).
    // On ne ralentit jamais (un clip plus court = silence naturel après). Clamp [1.0, 1.5].
    let tempo = clip.win > 0 && clip.rawDur > clip.win ? clip.rawDur / clip.win : 1;
    tempo = Math.max(1.0, Math.min(1.5, tempo));
    const delayMs = Math.round(clip.start * 1000);
    const tempoPart = tempo > 1.02 ? `atempo=${tempo.toFixed(3)},` : '';
    filters.push(
      `[${inputIndex}:a]${tempoPart}aresample=44100,aformat=channel_layouts=stereo,adelay=${delayMs}|${delayMs}[a${idx}]`,
    );
    mixLabels.push(`[a${idx}]`);
  });

  // amix (clips non chevauchants + silence) puis loudnorm → niveau de voix constant.
  filters.push(
    `${mixLabels.join('')}amix=inputs=${mixLabels.length}:normalize=0:dropout_transition=0,`
    + `atrim=0:${totalDur.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[aout]`,
  );

  await runFfmpeg([
    '-y', ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[aout]', '-ac', '2', '-ar', '44100',
    outPath,
  ]);
}

/**
 * Muxe la piste doublée dans la vidéo.
 * @param opts.keepOriginalAudio  garder l'audio d'origine ducké sous la voix
 * @param opts.srtPath            si fourni → incrustation des sous-titres (burn-in)
 */
async function muxFinal(videoPath, dubbedPath, outPath, opts = {}) {
  const { keepOriginalAudio = true, srtPath = null } = opts;
  const args = ['-y', '-i', videoPath, '-i', dubbedPath];

  // Audio : soit on mixe l'original ducké (12 %) sous le doublage, soit on remplace.
  let audioMap;
  const filters = [];
  if (keepOriginalAudio) {
    filters.push('[0:a]volume=0.12[orig];[orig][1:a]amix=inputs=2:normalize=0:dropout_transition=0[mixa]');
    audioMap = '[mixa]';
  }

  // Vidéo : copie si pas de sous-titres incrustés, sinon ré-encodage avec filtre.
  if (srtPath) {
    // Échappe le chemin pour le filtre subtitles (les ':' et '\' cassent la syntaxe).
    const esc = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
    filters.push(
      `[0:v]subtitles='${esc}':force_style='FontName=DejaVu Sans,FontSize=18,`
      + `PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=40'[v]`,
    );
  }

  if (filters.length) args.push('-filter_complex', filters.join(';'));

  // Mapping vidéo
  args.push('-map', srtPath ? '[v]' : '0:v:0');
  // Mapping audio
  args.push('-map', keepOriginalAudio ? audioMap : '1:a:0');

  args.push('-c:v', srtPath ? 'libx264' : 'copy');
  if (srtPath) args.push('-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p');
  args.push('-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outPath);

  await runFfmpeg(args);
}

// ─── Orchestrateur ───────────────────────────────────────────────────────────
/**
 * Traduit/double une vidéo de bout en bout.
 * @param {string} videoPath   chemin local du MP4 uploadé
 * @param {object} opts        { targetLang, voice, keepOriginalAudio, burnSubtitles }
 * @param {function} onProgress (progress:number, stage:string, extra?:object) => void
 * @returns {Promise<{ videoUrl, srtUrl, sourceLang, targetLang, segmentCount, durationSec }>}
 */
export async function translateVideo(videoPath, opts = {}, onProgress = () => {}) {
  const targetLang = String(opts.targetLang || 'en').trim().toLowerCase();
  const voice = TTS_VOICES.has(String(opts.voice)) ? opts.voice : 'alloy';
  const keepOriginalAudio = opts.keepOriginalAudio !== false;
  const burnSubtitles = !!opts.burnSubtitles;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY requis pour le doublage (TTS).');
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scalor-vtrans-'));
  try {
    const audioPath = path.join(workDir, 'audio.mp3');
    const dubbedPath = path.join(workDir, 'dubbed.m4a');
    const outPath = path.join(workDir, 'final.mp4');
    const srtPath = path.join(workDir, 'subs.srt');

    // 1. Extraction audio
    onProgress(8, 'Extraction de l’audio');
    await extractAudio(videoPath, audioPath);
    const totalDur = await probeDurationSec(videoPath);
    if (!(totalDur > 0)) throw new Error('Vidéo illisible ou durée nulle.');

    // 2. Transcription
    onProgress(22, 'Transcription (Whisper)');
    const { language: sourceLang, segments } = await transcribeSegments(audioPath);
    if (!segments.length) throw new Error('Aucune parole détectée dans la vidéo.');

    // 2b. Regroupement des fragments Whisper en PHRASES complètes → on traduit et
    //     on double des unités de sens entières (fin du rendu haché / mot-à-mot).
    const sentences = groupIntoSentences(segments);
    if (!sentences.length) throw new Error('Aucune parole exploitable dans la vidéo.');

    // 3. Traduction fidèle & naturelle (contexte complet de la vidéo)
    onProgress(42, 'Traduction des dialogues');
    const translations = await translateSegments(sentences, targetLang, sourceLang);

    // 4. Doublage précis. Principe : chaque phrase joue à sa vitesse NATURELLE,
    //    de son onset jusqu'à l'onset de la suivante (sa "fenêtre"). Tant que la
    //    voix tient dans la fenêtre → aucune déformation, aucun chevauchement, et
    //    un silence naturel comble le reste (respecte le rythme d'origine).
    //    On ne réécrit (plus court) QUE si la voix déborde nettement la fenêtre ;
    //    on ne "remplit" jamais un silence (source de voix traînante/artificielle).
    const clips = [];
    for (let i = 0; i < sentences.length; i++) {
      const seg = sentences[i];
      const nextStart = i < sentences.length - 1 ? sentences[i + 1].start : totalDur;
      const win = Math.max(0.4, nextStart - seg.start); // durée dispo sans chevaucher la suivante
      let text = translations[i];

      const pathA = path.join(workDir, `seg-${i}a.mp3`);
      await synthesizeSegment(text, voice, pathA);
      let rawDur = await probeDurationSec(pathA);
      let clipPath = pathA;

      // Ne réécrire que si la voix déborde la fenêtre de plus de 12 %.
      if (rawDur > win * 1.12) {
        const rewritten = await rewriteToFit(text, targetLang, win, 'shorten');
        if (rewritten && rewritten !== text) {
          const pathB = path.join(workDir, `seg-${i}b.mp3`);
          await synthesizeSegment(rewritten, voice, pathB);
          const rawB = await probeDurationSec(pathB);
          if (rawB > 0 && rawB < rawDur) { text = rewritten; rawDur = rawB; clipPath = pathB; }
        }
      }

      translations[i] = text; // le SRT reflètera le texte réellement prononcé
      clips.push({ path: clipPath, start: seg.start, win, rawDur });
      // 46 → 82 % réparti sur les phrases
      onProgress(46 + Math.round(((i + 1) / sentences.length) * 36), `Doublage précis (${i + 1}/${sentences.length})`);
    }

    // 5. SRT (après ajustement → sous-titres = texte doublé, timings recalés)
    onProgress(84, 'Génération des sous-titres');
    const srt = buildSrt(sentences, translations);
    await fs.writeFile(srtPath, srt, 'utf8');

    // 6. Assemblage piste doublée + mux
    onProgress(85, 'Assemblage de la piste doublée');
    await buildDubbedTrack(clips, totalDur, dubbedPath);

    onProgress(90, 'Montage final');
    await muxFinal(videoPath, dubbedPath, outPath, {
      keepOriginalAudio,
      srtPath: burnSubtitles ? srtPath : null,
    });

    // 7. Upload R2
    onProgress(95, 'Publication');
    const stamp = String(totalDur).replace('.', '') + '-' + targetLang;
    const [videoUp, srtUp] = await Promise.all([
      uploadToR2(await fs.readFile(outPath), `video-translation/${stamp}.mp4`, 'video/mp4'),
      uploadToR2(Buffer.from(srt, 'utf8'), `video-translation/${stamp}.srt`, 'application/x-subrip'),
    ]);
    if (!videoUp?.success || !videoUp.url) throw new Error(videoUp?.error || 'Publication vidéo impossible.');

    return {
      videoUrl: videoUp.url,
      srtUrl: srtUp?.url || null,
      sourceLang,
      targetLang,
      segmentCount: sentences.length,
      durationSec: Math.round(totalDur),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
