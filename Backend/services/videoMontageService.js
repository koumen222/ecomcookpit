// ─────────────────────────────────────────────────────────────────────────────
//  videoMontageService — Montage vidéo créatif (timeline) via ffmpeg-static.
//  Assemble une suite de scènes { clip vidéo + voix off } en un seul MP4 :
//    1. chaque clip est normalisé au format cible (9:16 / 1:1 / 16:9),
//       bouclé/tronqué à la durée de la scène, et muxé avec sa voix off
//       (ou du silence) — un segment mp4 autonome par scène ;
//    2. tous les segments sont concaténés (mêmes paramètres → concat -c copy) ;
//    3. sous-titres optionnels incrustés (un par scène, sur sa plage) ;
//    4. musique de fond optionnelle mixée sous la voix (volume réduit) ;
//    5. remux faststart → buffer MP4 prêt à uploader.
//
//  Les durées de scène sont fournies par le front (lues sur l'<audio> de la
//  voix off, ou saisies manuellement) : aucune dépendance à ffprobe.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, execFileSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

// Police embarquée (DejaVu Sans Bold) → les sous-titres se rendent sur tout serveur,
// même headless sans fontconfig/police système (cause fréquente de sous-titres vides).
export const FONTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

// Résout un binaire ffmpeg RÉELLEMENT fonctionnel : selon l'hôte, ffmpeg-static
// peut être manquant/incompatible → on retombe sur le ffmpeg du PATH.
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

const DIMENSIONS = {
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};

const MAX_SCENES = 12;
const MAX_SCENE_SEC = 60;
const MAX_TOTAL_SEC = 240;
// Micro-finale après la fin de la phrase, avant la coupe (évite une coupe
// « sur la dernière syllabe »). Les PAROLES S'ENCHAÎNENT : la voix du plan
// suivant démarre pile à la coupe (J-cut), pendant le fondu visuel.
const VOICE_TAIL = 0.1;

// Accents « symbole » dessinés par drawtext avec la police embarquée (glyphes
// vérifiés dans DejaVu Sans Bold) — zéro asset à héberger, contour noir pour
// rester lisible sur n'importe quel fond. 'ring' reste dessiné via geq.
const SYMBOL_ACCENTS = {
  check: { ch: '✔', color: '0x22C55E' },
  cross: { ch: '✘', color: '0xEF4444' },
  star: { ch: '★', color: '0xFFC93C' },
  warning: { ch: '⚠', color: '0xFFA726' },
  heart: { ch: '♥', color: '0xFF4D79' },
  arrow: { ch: '→', color: '0xFFD84D' },
};

// Exporté : réutilisé par autoEditService (montage automatique IA).
export function runFfmpeg(args) {
  const bin = resolveFfmpeg();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split('\n').slice(-4).join(' | ') || `ffmpeg exited ${code}`));
    });
  });
}

// Variante exportée : capture la sortie stderr complète (parsing silencedetect…).
export function runFfmpegCapture(args) {
  const bin = resolveFfmpeg();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve(stderr));
  });
}

async function download(url, dest) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 });
  await fs.writeFile(dest, Buffer.from(resp.data));
}

// Téléchargement avec 2e chance : les URLs R2/CDN échouent parfois de façon
// transitoire — cause principale des « musiques qui ne s'appliquent pas ».
// Exporté : réutilisé par autoEditService.
export async function downloadWithRetry(url, dest, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try { await download(url, dest); return; } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

// Sonde la durée d'un média via ffmpeg (parse "Duration:") — pas besoin de ffprobe.
// Exporté : réutilisé par autoEditService.
export function probeDuration(file) {
  return new Promise((resolve) => {
    let bin;
    try { bin = resolveFfmpeg(); } catch { return resolve(null); }
    const child = spawn(bin, ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (c) => { err += c.toString(); });
    child.on('error', () => resolve(null));
    child.on('close', () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) return resolve(null);
      resolve((Number(m[1]) * 3600) + (Number(m[2]) * 60) + parseFloat(m[3]));
    });
  });
}

function srtTimecode(totalSeconds) {
  const clamp = Math.max(0, totalSeconds);
  const h = Math.floor(clamp / 3600);
  const m = Math.floor((clamp % 3600) / 60);
  const s = Math.floor(clamp % 60);
  const ms = Math.round((clamp - Math.floor(clamp)) * 1000);
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

// Découpe un texte long en 1-2 lignes courtes lisibles (sous-titres).
function wrapSubtitle(text, maxPerLine = 34) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxPerLine) return clean;
  const words = clean.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxPerLine) { if (line) lines.push(line); line = w; }
    else line = (line + ' ' + w).trim();
    if (lines.length === 2) break;
  }
  if (line && lines.length < 3) lines.push(line);
  return lines.slice(0, 3).join('\n');
}

function assTime(t) {
  const cs = Math.max(0, t);
  const h = Math.floor(cs / 3600);
  const m = Math.floor((cs % 3600) / 60);
  const s = Math.floor(cs % 60);
  const c = Math.round((cs - Math.floor(cs)) * 100);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${h}:${p(m)}:${p(s)}.${p(c)}`;
}

// Modèles de sous-titres (couleurs / design). Couleurs ASS au format &HAABBGGRR (BGR !).
// BorderStyle=1 : contour (texte lisible sur tout fond). BorderStyle=3 : boîte opaque
// (couleur = BackColour, padding = Outline). `ov` : override ASS injecté par réplique
// (ex. \blur pour un halo néon). `accent` : 1 groupe de mots sur 3 prend cette couleur
// (style « mots-clés surlignés » des pubs TikTok).
const CAPTION_STYLES = {
  classic: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 2 },
  yellow: { primary: '&H0000FFFF', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 2 },
  cyan: { primary: '&H00FFFF00', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 2 },
  pink: { primary: '&H00B469FF', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 2 },
  green: { primary: '&H0076E600', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 2 },
  boxed: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 3, outlineW: 6 },
  boxed_yellow: { primary: '&H0000FFFF', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 3, outlineW: 6 },
  // Blanc + mots-clés jaunes (style de l'exemple de référence).
  duo_yellow: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H80000000', bold: -1, border: 1, shadow: 2, accent: '&H0000FFFF' },
  // Néons : contour coloré épais + flou → halo lumineux.
  neon: { primary: '&H00FFFFFF', outline: '&H00FFFF00', back: '&H00000000', bold: -1, border: 1, shadow: 0, outlineW: 4, ov: '{\\blur5}' },
  neon_pink: { primary: '&H00FFFFFF', outline: '&H00FF00FF', back: '&H00000000', bold: -1, border: 1, shadow: 0, outlineW: 4, ov: '{\\blur5}' },
  neon_violet: { primary: '&H00FFFFFF', outline: '&H00FF3C8A', back: '&H00000000', bold: -1, border: 1, shadow: 0, outlineW: 4, ov: '{\\blur5}' },
  // Boîtes opaques (étiquettes pleines façon CapCut).
  box_black: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', bold: -1, border: 3, shadow: 0, outlineW: 7 },
  box_white: { primary: '&H00000000', outline: '&H00FFFFFF', back: '&H00FFFFFF', bold: -1, border: 3, shadow: 0, outlineW: 7 },
  box_red: { primary: '&H00FFFFFF', outline: '&H000000FF', back: '&H000000FF', bold: -1, border: 3, shadow: 0, outlineW: 7 },
};

// Positions verticales des sous-titres. Bas/haut via l'alignement numpad ASS
// (2/8, fiables) ; « centre » est géré par un override \an5\pos explicite car
// l'alignement 5 est rendu de façon incohérente selon les builds libass.
const CAPTION_POSITIONS = { bottom: 2, middle: 2, top: 8 };

// Polices EMBARQUÉES dans le repo (assets/fonts, chargées via fontsdir) :
// seul moyen d'avoir un rendu identique sur tout serveur headless.
const CAPTION_FONTS = {
  sans: 'DejaVu Sans',
  condensed: 'DejaVu Sans Condensed',
  serif: 'DejaVu Serif',
  serif2: 'Liberation Serif',
  mono: 'DejaVu Sans Mono',
};

// Animations de sous-titres (façon CapCut). words = nb de mots par groupe révélé ;
// ov = override ASS appliqué à chaque groupe (fondu/scale/alpha, en millisecondes).
const CAPTION_ANIMS = {
  pop: { words: 3, ov: '{\\fad(90,60)\\t(0,120,\\fscx116\\fscy116)\\t(120,240,\\fscx100\\fscy100)}' },
  fade: { words: 3, ov: '{\\fad(170,140)}' },
  zoom: { words: 3, ov: '{\\fad(70,60)\\fscx55\\fscy55\\t(0,220,\\fscx100\\fscy100)}' },
  bounce: { words: 2, ov: '{\\fad(60,50)\\t(0,110,\\fscx126\\fscy126)\\t(110,200,\\fscx92\\fscy92)\\t(200,280,\\fscx100\\fscy100)}' },
  typewriter: { words: 1, ov: '{\\fad(25,20)}' },
  reveal: { words: 3, ov: '{\\alpha&HFF&\\t(0,180,\\alpha&H00&)}' },
};

// Sous-titres "dynamiques" façon CapCut : petits groupes de mots révélés dans le
// temps, avec animation choisie. Style (couleur) + animation paramétrables. → .ass
function buildAssCaption(text, dur, w, h, format, mode = 'dynamic', styleId = 'classic', anim = 'pop', position = 'bottom', offsetPct = null, scale = 1, maxLines = 1, fontId = 'sans', textCase = 'none', startAt = 0) {
  let clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  // Casse : MAJUSCULES (style pub TikTok) sur demande.
  if (textCase === 'upper') clean = clean.toUpperCase();
  const fontName = CAPTION_FONTS[fontId] || CAPTION_FONTS.sans;
  const st = CAPTION_STYLES[styleId] || CAPTION_STYLES.classic;
  const alignment = CAPTION_POSITIONS[position] || CAPTION_POSITIONS.bottom;
  // Marge verticale : depuis le bas (align 2) ou le haut (align 8) ; ignorée au centre (5).
  const marginV = position === 'top'
    ? (format === '9:16' ? Math.round(h * 0.10) : Math.round(h * 0.08))
    : format === '9:16' ? Math.round(h * 0.17) : format === '1:1' ? Math.round(h * 0.10) : Math.round(h * 0.09);

  // ── Découpe AVANT le header : la taille de police dépend de la ligne la plus longue ──
  const sanitize = (s) => String(s).replace(/\\/g, '').replace(/[{}]/g, '').trim();
  const A = CAPTION_ANIMS[anim] || CAPTION_ANIMS.pop;
  // Nombre de lignes EXACT par réplique (1 = une ligne, 2 = deux lignes…),
  // appliqué dans les DEUX modes — la dernière réplique peut en avoir moins.
  const nLines = Math.max(1, Math.min(3, Math.round(Number(maxLines) || 1)));
  let chunks;
  if (mode === 'block') {
    // Mode bloc : découpe en lignes (~30 caractères), groupées par nLines
    // (\N = saut manuel), affichées en répliques successives.
    const words = clean.split(' ').filter(Boolean);
    const lines = [];
    let line = '';
    for (const wd of words) {
      if ((`${line} ${wd}`).trim().length > 30 && line) { lines.push(sanitize(line)); line = wd; }
      else line = (`${line} ${wd}`).trim();
    }
    if (line) lines.push(sanitize(line));
    if (!lines.length) lines.push(sanitize(clean));
    chunks = [];
    for (let i = 0; i < lines.length; i += nLines) chunks.push(lines.slice(i, i + nLines).join('\\N'));
  } else {
    // Mode dynamique : chaque ligne = un petit groupe de mots (animation),
    // chaque réplique = nLines lignes empilées.
    const words = clean.split(' ').filter(Boolean);
    const size = Math.max(1, A.words || 3);
    const lines = [];
    for (let i = 0; i < words.length; i += size) lines.push(sanitize(words.slice(i, i + size).join(' ')));
    if (!lines.length) lines.push(sanitize(clean));
    chunks = [];
    for (let i = 0; i < lines.length; i += nLines) chunks.push(lines.slice(i, i + nLines).join('\\N'));
  }

  // Taille : base selon le format × échelle utilisateur (50-200 %), puis
  // auto-ajustement si la LIGNE la plus longue déborderait (plancher 45 %) —
  // aucun retour à la ligne automatique possible (WrapStyle 2).
  const userScale = Math.max(0.5, Math.min(2, Number(scale) || 1));
  const baseFontSize = Math.round((Math.min(w, h) / (format === '16:9' ? 20 : 15)) * userScale);
  const maxChars = Math.max(...chunks.map((c) => Math.max(...c.split('\\N').map((l) => l.length), 1)), 1);
  const avail = w - 180; // marges gauche/droite 90
  const charW = fontId === 'mono' ? 0.64 : 0.58; // largeur moyenne d'un caractère
  const fontSize = Math.max(
    Math.round(baseFontSize * 0.45),
    Math.min(baseFontSize, Math.floor(avail / (charW * maxChars))),
  );
  const outline = Math.max(2, Math.round(fontSize / 14));

  // Position LIBRE (drag façon CapCut) : offsetPct = % de la hauteur (5-95).
  // \pos ancre le bas-centre du texte (align 2) exactement à cette hauteur.
  // « Centré » sans offset : \an5\pos au milieu exact (l'align 5 de style est bugué).
  // ATTENTION : Number(null) === 0 → il faut exclure null/'' AVANT isFinite.
  const hasOffset = offsetPct != null && offsetPct !== '' && Number.isFinite(Number(offsetPct));
  const freePos = hasOffset
    ? `{\\an2\\pos(${Math.round(w / 2)},${Math.round(h * Math.max(5, Math.min(95, Number(offsetPct))) / 100)})}`
    : position === 'middle'
      ? `{\\an5\\pos(${Math.round(w / 2)},${Math.round(h / 2)})}`
      : '';

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${fontName},${fontSize},${st.primary},&H00000000,${st.outline},${st.back},${st.bold},0,0,0,100,100,0,0,${st.border},${st.outlineW || outline},${st.shadow},${alignment},90,90,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const per = dur / chunks.length;
  const styleOv = st.ov || '';
  const lines = chunks.map((c, i) => {
    // startAt : décalage des événements (segment rembourré pour la transition
    // entrante — le sous-titre démarre avec la voix, pas pendant le fondu).
    const start = assTime(startAt + i * per);
    const end = assTime(startAt + Math.min(dur, (i + 1) * per + 0.03));
    const ov = mode === 'block' ? '{\\fad(150,120)}' : A.ov;
    // Accent : 1 groupe sur 3 en couleur (mots-clés surlignés) en mode dynamique.
    const accent = st.accent && mode !== 'block' && chunks.length > 1 && i % 3 === 2 ? `{\\c${st.accent}}` : '';
    return `Dialogue: 0,${start},${end},Cap,,0,0,0,,${freePos}${styleOv}${ov}${accent}${c}`;
  });
  return `${header}${lines.join('\n')}\n`;
}

/**
 * @param {object} spec
 *   { format:'9:16'|'1:1'|'16:9', subtitles:boolean, musicUrl?:string,
 *     musicVolume?:number, scenes:[{ videoUrl, audioUrl?, durationSec?, subtitleText? }] }
 * @param {(pct:number)=>void} onProgress
 * @returns {Promise<{ buffer:Buffer, durationSec:number, format:string }>}
 */
export async function renderMontage(spec = {}, onProgress = () => {}) {
  const format = DIMENSIONS[spec.format] ? spec.format : '9:16';
  const { w, h } = DIMENSIONS[format];
  const allScenes = Array.isArray(spec.scenes) ? spec.scenes.filter((s) => s && (s.videoUrl || s.imageUrl)) : [];
  const scenes = allScenes.slice(0, MAX_SCENES);
  if (!scenes.length) throw new Error('Aucune scène avec clip vidéo.');

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scalor-montage-'));
  try {
    const segPaths = [];
    const durs = [];
    const warnings = []; // problèmes non bloquants (musique/narration ignorées) remontés au front
    let musicApplied = false; // confirmation explicite que la musique est bien dans le mix final
    let cursor = 0;

    // Narration globale : on étire les scènes pour couvrir TOUTE la voix (sinon elle
    // serait coupée). scaleFactor = durée de la narration / somme des durées de scènes.
    let narrScale = 1;
    let narrationPath = null;
    if (spec.narrationUrl) {
      try {
        narrationPath = path.join(workDir, 'narration.mp3');
        await downloadWithRetry(spec.narrationUrl, narrationPath);
        const nd = await probeDuration(narrationPath);
        const sumDur = scenes.reduce((t, s) => t + Math.max(1, Math.min(MAX_SCENE_SEC, Number(s.durationSec) || 4)), 0);
        if (nd && nd > 1 && sumDur > 0) narrScale = Math.max(0.4, Math.min(4, nd / sumDur));
      } catch { narrationPath = null; }
    }

    // ── Passe A : durées de CONTENU (la voix sondée fixe la durée du plan).
    //    Nécessaire AVANT le rendu : les transitions xfade/acrossfade
    //    chevauchent les segments adjacents — sans précaution elles MANGENT la
    //    fin de la voix du plan A et le début de celle du plan B. On rembourre
    //    donc chaque segment (visuel prolongé + silence) de la durée exacte des
    //    fondus qui le concernent : le chevauchement consomme du rembourrage,
    //    jamais la parole. ──
    const pre = [];
    for (let i = 0; i < scenes.length; i += 1) {
      const sc = scenes[i];
      // Voix off PAR SCÈNE → la scène suit exactement la durée de son audio.
      let aIn = null;
      let audioDur = null;
      if (sc.audioUrl && !spec.narrationUrl) {
        aIn = path.join(workDir, `a${i}.mp3`);
        try { await download(sc.audioUrl, aIn); audioDur = await probeDuration(aIn); } catch { aIn = null; }
      }
      // AUDIO NATIF DU CLIP (UGC sans lip sync : le créateur parle DANS le clip
      // Veo) : la durée du plan = celle du clip — la parole embarquée dicte.
      let clipDur = null;
      if (!aIn && sc.useClipAudio && sc.videoUrl && !spec.narrationUrl) {
        const vPre = path.join(workDir, `v${i}.mp4`);
        try { await download(sc.videoUrl, vPre); clipDur = await probeDuration(vPre); } catch { clipDur = null; }
      }
      let dur;
      // LA VOIX DICTE LE RYTHME : un plan avec voix dure sa phrase + une courte
      // finale, ni plus ni moins. (L'ancienne règle max(voix, durée planifiée)
      // laissait un silence mort en fin de plan quand la voix était plus courte
      // que le plan — « petit silence entre 2 scènes » à couper.)
      if (audioDur && audioDur > 0.3) dur = Math.max(1.2, audioDur + VOICE_TAIL);
      else if (clipDur && clipDur > 0.5) dur = Math.max(1.2, clipDur - Math.max(0, Number(sc.trimStart) || 0)); // clip parlant : tout le clip
      else if (spec.narrationUrl) dur = (Number(sc.durationSec) || 4) * narrScale; // étiré sur la narration
      else dur = Number(sc.durationSec) || 4; // sans voix : la durée demandée fait foi
      dur = Math.max(1, Math.min(MAX_SCENE_SEC, dur));
      if (cursor + dur > MAX_TOTAL_SEC) dur = Math.max(1, MAX_TOTAL_SEC - cursor);
      if (dur <= 0) break;
      pre.push({ sc, aIn, dur });
      cursor += dur;
      onProgress(5 + Math.round(((i + 1) / scenes.length) * 6));
    }

    // ── Transitions décidées AVANT le rendu (le rembourrage en dépend) ──
    const TRANSITIONS = ['fade', 'fadeblack', 'fadewhite', 'slideleft', 'slideright', 'slideup', 'slidedown', 'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'circleopen', 'circleclose', 'radial', 'dissolve', 'pixelize', 'smoothleft', 'diagtl'];
    // Mode « dynamic » (défaut) : chaque jonction reçoit une transition punchy
    // différente, en rotation — rendu vivant sans réglage manuel.
    const DYNAMIC_SET = ['slideleft', 'circleopen', 'fadewhite', 'slideup', 'smoothleft', 'wipeleft', 'fadewhite', 'dissolve', 'slideright', 'radial'];
    const perJunction = Array.isArray(spec.transitions) && spec.transitions.length ? spec.transitions : null;
    const globalTransition = spec.transition === 'none' ? 'none'
      : TRANSITIONS.includes(spec.transition) ? spec.transition
      : 'dynamic';
    const junctionAt = (j) => {
      const t = perJunction ? (perJunction[j] || globalTransition) : globalTransition;
      if (t === 'none') return 'none';
      if (TRANSITIONS.includes(t)) return t;
      return DYNAMIC_SET[j % DYNAMIC_SET.length]; // 'dynamic' ou valeur inconnue
    };
    const anyTransition = pre.length >= 2 && (perJunction
      ? perJunction.some((t) => t && t !== 'none')
      : globalTransition !== 'none');
    // Fondu court (≤ 0,35 s) : la coupe reste dynamique, façon montage pub.
    const baseT = pre.length >= 2 ? Math.max(0.2, Math.min(0.35, Math.min(...pre.map((p) => p.dur)) / 2)) : 0;
    // Durée de fondu par jonction j (entre les plans j et j+1). Concat pur
    // (aucune transition) : aucun chevauchement → aucun rembourrage.
    const TJ = pre.length >= 2
      ? pre.slice(0, -1).map((_, j) => (anyTransition ? (junctionAt(j) === 'none' ? 0.04 : baseT) : 0))
      : [];

    // ── Passe B : rendu des segments, rembourrés pour les transitions ──
    for (let i = 0; i < pre.length; i += 1) {
      const { sc, aIn, dur } = pre[i];
      // Queue rembourrée (fondu sortant) : le xfade consomme cette queue —
      // image prolongée + silence de fin — jamais le contenu. Pas de
      // rembourrage de tête : le contenu (et la voix) du plan démarre PILE à
      // la coupe, pendant que le fondu visuel se termine (paroles enchaînées).
      const padOut = i < pre.length - 1 ? TJ[i] : 0;
      const padDur = dur + padOut;

      const seg = path.join(workDir, `seg${i}.mp4`);
      const durFrames = Math.max(1, Math.round(padDur * 30));
      // Effet ken-burns : léger zoom continu sur clips ET images → rendu dynamique.
      let vInputArgs;
      let vChain;
      if (sc.videoUrl) {
        const vIn = path.join(workDir, `v${i}.mp4`);
        // Déjà téléchargé en passe A pour sonder la durée (clip parlant) ?
        try { await fs.access(vIn); } catch { await download(sc.videoUrl, vIn); }
        // Découpe (cut/trim) : on démarre la lecture du clip à trimStart. Le
        // stream_loop comble si la durée demandée dépasse la portion restante.
        const trimStart = Math.max(0, Number(sc.trimStart) || 0);
        vInputArgs = ['-stream_loop', '-1', '-ss', String(trimStart), '-i', vIn];
        // PUNCH-IN sur les clips vidéo : zoompan d=1 (1 frame → 1 frame, donc la
        // vidéo continue de bouger) avec un zoom lent 1→1,08 alterné avant/arrière
        // selon l'index — l'énergie « montage pub » que le plan fixe n'a pas.
        const zExpr = i % 2 === 0
          ? `'min(1.08,1+0.08*in/${durFrames})'`
          : `'max(1.001,1.08-0.08*in/${durFrames})'`;
        vChain = `[0:v]scale=${Math.round(w * 1.15)}:${Math.round(h * 1.15)}:force_original_aspect_ratio=increase,crop=${Math.round(w * 1.15)}:${Math.round(h * 1.15)},zoompan=z=${zExpr}:d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h},setsar=1,fps=30,format=yuv420p,eq=saturation=1.13:contrast=1.05`;
      } else {
        const imgIn = path.join(workDir, `img${i}`);
        await download(sc.imageUrl, imgIn);
        vInputArgs = ['-loop', '1', '-i', imgIn];
        // Ken Burns VARIÉ : les scènes image (stratégie éco) alternent zoom
        // avant, zoom arrière et panoramiques → le montage reste vivant sans
        // coût de génération vidéo. Sur-échantillonnage ×2 pour la netteté.
        const KB = {
          zoomin: `zoompan=z='min(zoom+0.0013,1.18)':d=${durFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
          zoomout: `zoompan=z='max(1.001,1.18-0.18*on/${durFrames})':d=${durFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
          panleft: `zoompan=z='1.15':d=${durFrames}:x='(iw-iw/zoom)*on/${durFrames}':y='ih/2-(ih/zoom/2)'`,
          panright: `zoompan=z='1.15':d=${durFrames}:x='(iw-iw/zoom)*(1-on/${durFrames})':y='ih/2-(ih/zoom/2)'`,
        };
        const kbKeys = ['zoomin', 'panleft', 'zoomout', 'panright'];
        const kb = KB[sc.kenBurns] || KB[kbKeys[i % kbKeys.length]];
        vChain = `[0:v]scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},${kb}:s=${w}x${h}:fps=30,setsar=1,format=yuv420p,eq=saturation=1.13:contrast=1.05`;
      }

      // Fondus d'entrée / sortie du plan (animation par clip), sur la fenêtre
      // de contenu [0, dur] — la queue rembourrée reste après le fondu.
      const fadeIn = Math.max(0, Math.min(dur / 2, Number(sc.fadeIn) || 0));
      const fadeOut = Math.max(0, Math.min(dur / 2, Number(sc.fadeOut) || 0));
      if (fadeIn > 0) vChain += `,fade=t=in:st=0:d=${fadeIn.toFixed(2)}`;
      if (fadeOut > 0) vChain += `,fade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`;

      // Sous-titre incrusté sur CE segment (optionnel) : captions animées (ASS).
      let subFilter = '';
      const caption = spec.subtitles ? String(sc.subtitleText || '').trim() : '';
      if (caption) {
        // Style/position par scène (éditeur Pro) avec repli sur le réglage global.
        const ass = buildAssCaption(caption, dur, w, h, format, spec.captionMode || 'dynamic',
          sc.captionStyle || spec.captionStyle || 'classic', spec.captionAnim || 'pop',
          sc.captionPosition || spec.captionPosition || 'bottom',
          sc.captionOffsetPct ?? spec.captionOffsetPct ?? null,
          spec.captionScale ?? 1, spec.captionMaxLines ?? 1,
          spec.captionFont || 'sans', spec.captionCase || 'none');
        if (ass) {
          const assPath = path.join(workDir, `sub${i}.ass`);
          await fs.writeFile(assPath, ass);
          subFilter = `,subtitles='${assPath}':fontsdir='${FONTS_DIR}'`;
        }
      }

      // Images SUPERPOSÉES du plan (logo, sticker, packshot…) : composées par
      // ffmpeg au-dessus de la vidéo, SOUS les sous-titres. Position/taille en
      // % du cadre (ancre au centre de l'image). Échec de téléchargement →
      // overlay ignoré avec avertissement, le plan est rendu quand même.
      const ovList = [];
      const wantedOverlays = Array.isArray(sc.overlays)
        ? sc.overlays.filter((o) => o && (o.shape === 'ring' || SYMBOL_ACCENTS[o.shape] || /^https?:\/\//.test(String(o.url || '')) || /^https?:\/\//.test(String(o.videoUrl || '')))).slice(0, 3)
        : [];
      for (const o of wantedOverlays) {
        try {
          const p = path.join(workDir, `ov${i}_${ovList.length}.img`);
          if (o.shape === 'ring') {
            // Cercle d'accent (façon annotation d'expert) : anneau rouge à
            // liséré blanc SYNTHÉTISÉ par ffmpeg (geq sur canal alpha) —
            // aucun asset à héberger. Position/taille = mêmes règles.
            const ringPng = path.join(workDir, `ring${i}_${ovList.length}.png`);
            await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=400x400,format=rgba', '-frames:v', '1',
              '-vf', "geq=r='if(between(hypot(X-200,Y-200),146,186),225,255)':g='if(between(hypot(X-200,Y-200),146,186),35,255)':b='if(between(hypot(X-200,Y-200),146,186),60,255)':a='if(between(hypot(X-200,Y-200),140,192),if(between(hypot(X-200,Y-200),146,186),255,220),0)'",
              ringPng]);
            ovList.push({
              path: ringPng,
              xPct: Math.max(0, Math.min(100, Number(o.xPct) || 50)),
              yPct: Math.max(0, Math.min(100, Number(o.yPct) || 50)),
              wPct: Math.max(5, Math.min(80, Number(o.wPct) || 30)),
              hPct: null,
            });
            continue;
          }
          if (o.shape && SYMBOL_ACCENTS[o.shape]) {
            // Symbole (coche, croix, étoile, alerte, cœur, flèche) : drawtext
            // centré sur canevas transparent, contour + ombre pour la lisibilité.
            const sym = SYMBOL_ACCENTS[o.shape];
            const symPng = path.join(workDir, `sym${i}_${ovList.length}.png`);
            const fontFile = path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf');
            await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=400x400,format=rgba', '-frames:v', '1',
              '-vf', `drawtext=fontfile='${fontFile}':text='${sym.ch}':fontsize=300:fontcolor=${sym.color}:borderw=10:bordercolor=black@0.55:x=(w-tw)/2:y=(h-th)/2`,
              symPng]);
            ovList.push({
              path: symPng,
              xPct: Math.max(0, Math.min(100, Number(o.xPct) || 50)),
              yPct: Math.max(0, Math.min(100, Number(o.yPct) || 50)),
              wPct: Math.max(5, Math.min(80, Number(o.wPct) || 22)),
              hPct: null,
            });
            continue;
          }
          // B-ROLL VIDÉO plein écran : un clip (produit en action) COUVRE le
          // cadre pendant sa fenêtre — la voix du plan continue en dessous.
          const isVideoOverlay = /^https?:\/\//.test(String(o.videoUrl || ''));
          await downloadWithRetry(String(isVideoOverlay ? o.videoUrl : o.url), p);
          ovList.push({
            path: p,
            isVideo: isVideoOverlay,
            xPct: Math.max(0, Math.min(100, Number(o.xPct) || 50)),
            yPct: Math.max(0, Math.min(100, Number(o.yPct) || 30)),
            wPct: Math.max(5, Math.min(100, Number(o.wPct) || 35)),
            // hPct optionnel : étirement vertical libre ; sinon proportions gardées.
            hPct: Number(o.hPct) > 0 ? Math.max(5, Math.min(95, Number(o.hPct))) : null,
            // Fenêtre d'affichage optionnelle (B-ROLL) : l'insert n'apparaît
            // qu'entre startSec et endSec — la voix du plan continue dessous.
            tStart: Number(o.startSec) >= 0 && Number.isFinite(Number(o.startSec)) ? Number(o.startSec) : null,
            tEnd: Number(o.endSec) > 0 && Number.isFinite(Number(o.endSec)) ? Number(o.endSec) : null,
          });
        } catch (e) {
          console.warn(`[Montage] overlay ignoré (plan ${i + 1}):`, e.message);
          warnings.push(`Image superposée ignorée (plan ${i + 1})`);
        }
      }
      // 0 = vidéo/image du plan, 1 = audio (voix ou silence), 2+ = overlays.
      const ovInputArgs = ovList.flatMap((o) => ['-i', o.path]);
      const buildVFilter = (withSub) => {
        const sub = withSub ? subFilter : '';
        if (!ovList.length) return `${vChain}${sub}[v]`;
        let g = `${vChain}[vb]`;
        let cur = 'vb';
        ovList.forEach((o, k) => {
          const idx = 2 + k;
          // Overlay VIDÉO : recalé dans le temps (setpts) pour démarrer PILE à
          // l'ouverture de sa fenêtre (sinon le clip aurait déjà défilé).
          const ovPts = o.isVideo ? `,setpts=PTS-STARTPTS${o.tStart != null ? `+${o.tStart.toFixed(2)}/TB` : ''}` : '';
          g += `;[${idx}:v]scale=${Math.round(w * o.wPct / 100)}:${o.hPct ? Math.round(h * o.hPct / 100) : -1}${ovPts}[ov${k}]`;
          const ovEnable = o.tStart != null && o.tEnd != null ? `:enable='between(t,${o.tStart.toFixed(2)},${o.tEnd.toFixed(2)})'` : '';
          g += `;[${cur}][ov${k}]overlay=x='W*${(o.xPct / 100).toFixed(4)}-w/2':y='H*${(o.yPct / 100).toFixed(4)}-h/2':eof_action=repeat${ovEnable}[vc${k}]`;
          cur = `vc${k}`;
        });
        // Sous-titres appliqués en DERNIER (au-dessus des images superposées).
        g += sub ? `;[${cur}]${sub.slice(1)}[v]` : `;[${cur}]null[v]`;
        return g;
      };

      // (aIn — voix off de la scène — est déjà téléchargée en passe A.)
      const common = [
        '-t', String(padDur.toFixed(3)),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
        seg,
      ];
      // Audio natif du clip (UGC parlant Veo) : coupé au contenu (le
      // stream_loop rebouclerait la parole sur la queue rembourrée) puis
      // silence de queue. Si le clip n'a pas de piste audio (fallback muet),
      // on retombe proprement sur la branche silence.
      let clipAudioOn = Boolean(sc.useClipAudio && sc.videoUrl && !spec.narrationUrl && !aIn);
      const runSeg = async (withSub) => {
        const vFilter = buildVFilter(withSub);
        const vol = Math.max(0, Math.min(2, sc.volume == null ? 1 : Number(sc.volume)));
        if (aIn) {
          // La voix démarre à 0 (pile à la coupe — paroles enchaînées) ;
          // apad = silence de queue (le fondu sortant ne coupe rien).
          let aFilter = `[1:a]apad,volume=${vol}`;
          if (fadeIn > 0) aFilter += `,afade=t=in:st=0:d=${fadeIn.toFixed(2)}`;
          if (fadeOut > 0) aFilter += `,afade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`;
          await runFfmpeg(['-y', ...vInputArgs, '-i', aIn, ...ovInputArgs, '-filter_complex', `${vFilter};${aFilter}[a]`, '-map', '[v]', '-map', '[a]', ...common]);
        } else if (clipAudioOn) {
          // L'entrée 1 reste un anullsrc pour préserver les index d'overlays
          // (2+) ; la piste du plan vient de [0:a] (la parole du clip).
          let aFilter = `[0:a]atrim=0:${dur.toFixed(3)},apad,volume=${vol}`;
          if (fadeIn > 0) aFilter += `,afade=t=in:st=0:d=${fadeIn.toFixed(2)}`;
          if (fadeOut > 0) aFilter += `,afade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`;
          await runFfmpeg(['-y', ...vInputArgs, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', ...ovInputArgs, '-filter_complex', `${vFilter};${aFilter}[a]`, '-map', '[v]', '-map', '[a]', ...common]);
        } else {
          await runFfmpeg(['-y', ...vInputArgs, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', ...ovInputArgs, '-filter_complex', vFilter, '-map', '[v]', '-map', '1:a', ...common]);
        }
      };
      try {
        await runSeg(true);
      } catch (segErr) {
        if (clipAudioOn) {
          // Clip sans piste audio (provider de secours muet) → branche silence.
          console.warn(`[Montage] audio du clip indisponible sur le plan ${i} (${segErr.message}) — plan rendu muet.`);
          warnings.push(`Plan ${i + 1} : audio du clip indisponible`);
          clipAudioOn = false;
          try {
            await runSeg(true);
          } catch (e2) {
            if (subFilter) { console.warn(`[Montage] sous-titres échoués sur le plan ${i} (${e2.message}) — rendu sans sous-titre.`); await runSeg(false); }
            else throw e2;
          }
        } else if (subFilter) {
          console.warn(`[Montage] sous-titres échoués sur le plan ${i} (${segErr.message}) — rendu du plan sans sous-titre.`);
          await runSeg(false);
        } else {
          throw segErr;
        }
      }
      segPaths.push(seg);
      durs.push(padDur); // longueur RÉELLE du segment (contenu + rembourrages)
      onProgress(11 + Math.round(((i + 1) / pre.length) * 54));
    }

    // ── Assemblage : transitions PAR JONCTION (xfade + acrossfade) ou
    //    concaténation. Les transitions et leurs durées (TJ) ont été décidées
    //    AVANT le rendu : les segments sont déjà rembourrés en conséquence, le
    //    chevauchement des fondus ne consomme donc QUE du rembourrage. ──
    let current = path.join(workDir, 'assembled.mp4');
    let totalDuration = cursor;

    if (anyTransition) {
      const inputs = [];
      segPaths.forEach((p) => inputs.push('-i', p));
      const vParts = [];
      const aParts = [];
      const junctionSfx = []; // { off, kind } → effet sonore ADAPTÉ à chaque coupe
      let vPrev = '[0:v]';
      let acc = durs[0];
      for (let i = 1; i < segPaths.length; i += 1) {
        const tj = junctionAt(i - 1);
        const isCut = tj === 'none';
        const kind = isCut ? 'fade' : tj;
        const Tj = TJ[i - 1]; // même durée que la queue rembourrée des segments
        const off = (acc - Tj).toFixed(3);
        if (!isCut) junctionSfx.push({ off: Number(off), kind });
        const vOut = i === segPaths.length - 1 ? '[vout]' : `[vx${i}]`;
        vParts.push(`${vPrev}[${i}:v]xfade=transition=${kind}:duration=${Tj}:offset=${off}${vOut}`);
        vPrev = vOut;
        acc = acc + durs[i] - Tj;
      }
      totalDuration = acc;
      // PAROLES ENCHAÎNÉES (J-cut) : PAS d'acrossfade — il fondait la fin et le
      // début des phrases autour de chaque jonction. Chaque piste de segment
      // est posée à la position de départ de son plan (cumul des durées de
      // CONTENU, égal aux offsets xfade) puis le tout est sommé : la voix du
      // plan suivant démarre pile à la coupe, à plein niveau.
      {
        let sAt = 0;
        const lbl = [];
        for (let i = 0; i < segPaths.length; i += 1) {
          const ms = Math.round(sAt * 1000);
          aParts.push(ms > 0 ? `[${i}:a]adelay=${ms}|${ms}[adl${i}]` : `[${i}:a]anull[adl${i}]`);
          lbl.push(`[adl${i}]`);
          sAt += pre[i].dur;
        }
        aParts.push(`${lbl.join('')}amix=inputs=${segPaths.length}:normalize=0:duration=longest:dropout_transition=0[aout]`);
      }
      // EFFETS SONORES aux transitions (spec.sfx !== false) : une PALETTE
      // adaptée au type de coupe — plus jamais le même son partout :
      //  · fadewhite (flash)            → swish brillant et court
      //  · slide/wipe/smooth (directionnel) → whoosh classique
      //  · circle/radial/dissolve (révélation) → swoosh grave
      //  · fade/fadeblack (doux)        → souffle discret
      // + micro-variation de hauteur (±8 %) entre deux occurrences identiques.
      const SFX_VARIANTS = {
        swish: { src: 'anoisesrc=d=0.25:color=white:amplitude=0.6', chain: 'highpass=f=1400,lowpass=f=7000,afade=t=in:st=0:d=0.05,afade=t=out:st=0.09:d=0.15', vol: 0.38, lead: 0.1 },
        whoosh: { src: 'anoisesrc=d=0.35:color=pink:amplitude=0.7', chain: 'highpass=f=500,lowpass=f=4200,afade=t=in:st=0:d=0.08,afade=t=out:st=0.14:d=0.21', vol: 0.45, lead: 0.15 },
        deep: { src: 'anoisesrc=d=0.45:color=pink:amplitude=0.8', chain: 'highpass=f=150,lowpass=f=1800,afade=t=in:st=0:d=0.12,afade=t=out:st=0.2:d=0.25', vol: 0.5, lead: 0.2 },
        soft: { src: 'anoisesrc=d=0.3:color=pink:amplitude=0.5', chain: 'highpass=f=300,lowpass=f=2500,afade=t=in:st=0:d=0.1,afade=t=out:st=0.12:d=0.18', vol: 0.28, lead: 0.12 },
      };
      const variantFor = (kind) => (kind === 'fadewhite' ? 'swish'
        : /^(slide|wipe)|smoothleft|diagtl/.test(kind) ? 'whoosh'
          : /circle|radial|dissolve|pixelize/.test(kind) ? 'deep'
            : 'soft');
      const wantSfx = spec.sfx !== false && junctionSfx.length > 0;
      let aMap = '[aout]';
      const sfxParts = [];
      if (wantSfx) {
        const byVariant = new Map(); // variantId -> [{ off }...]
        junctionSfx.forEach((j) => {
          const v = variantFor(j.kind);
          if (!byVariant.has(v)) byVariant.set(v, []);
          byVariant.get(v).push(j);
        });
        const mixLabels = [];
        let inputIdx = segPaths.length; // après les segments vidéo
        const PITCHES = [1, 1.08, 0.92];
        for (const [vId, js] of byVariant) {
          const V = SFX_VARIANTS[vId];
          inputs.push('-f', 'lavfi', '-i', V.src);
          const splitLabels = js.map((_, k) => `[${vId}b${k}]`).join('');
          sfxParts.push(`[${inputIdx}:a]${V.chain}${js.length > 1 ? `,asplit=${js.length}${splitLabels}` : `[${vId}b0]`}`);
          js.forEach((j, k) => {
            const ms = Math.max(0, Math.round((j.off - V.lead) * 1000));
            const rate = PITCHES[k % PITCHES.length];
            const pitch = rate === 1 ? '' : `asetrate=44100*${rate},aresample=44100,`;
            sfxParts.push(`[${vId}b${k}]${pitch}adelay=${ms}|${ms},volume=${V.vol}[${vId}d${k}]`);
            mixLabels.push(`[${vId}d${k}]`);
          });
          inputIdx += 1;
        }
        sfxParts.push(`[aout]${mixLabels.join('')}amix=inputs=${mixLabels.length + 1}:normalize=0:duration=first:dropout_transition=0[afx]`);
        aMap = '[afx]';
      }
      await runFfmpeg(['-y', ...inputs, '-filter_complex', [...vParts, ...aParts, ...sfxParts].join(';'),
        '-map', '[vout]', '-map', aMap,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
        current]);
    } else {
      const listFile = path.join(workDir, 'list.txt');
      await fs.writeFile(listFile, segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
      await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', current]);
    }
    onProgress(74);

    // ── Narration globale (voix off générée par le kit) : remplace l'audio, calée sur la durée ──
    if (spec.narrationUrl) {
      try {
        const nIn = narrationPath || path.join(workDir, 'narration.mp3');
        if (!narrationPath) await downloadWithRetry(spec.narrationUrl, nIn);
        const narrated = path.join(workDir, 'narrated.mp4');
        await runFfmpeg([
          '-y', '-i', current, '-i', nIn,
          '-filter_complex', '[1:a]apad[a]',
          '-map', '0:v', '-map', '[a]', '-t', String(totalDuration),
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
          narrated,
        ]);
        current = narrated;
      } catch (e) {
        console.warn('[Montage] narration ignorée:', e.message);
        warnings.push(`Voix off ignorée (${e.message})`);
      }
      onProgress(80);
    }

    // (Les sous-titres sont désormais incrustés par segment, en amont de l'assemblage.)

    // ── Musique de fond (optionnelle) mixée sous la voix ──
    if (spec.musicUrl) {
      try {
        const mIn = path.join(workDir, 'music.mp3');
        await downloadWithRetry(spec.musicUrl, mIn);
        // Piste illisible (fichier corrompu, mauvais mime) → mieux vaut un
        // warning explicite qu'un montage silencieusement sans musique.
        const musicDur = await probeDuration(mIn);
        if (!musicDur || musicDur < 0.5) throw new Error('piste audio illisible');
        const vol = Math.max(0, Math.min(1.5, spec.musicVolume == null ? 0.5 : Number(spec.musicVolume)));
        const mixed = path.join(workDir, 'mixed.mp4');
        // stream_loop -1 : la musique boucle si le montage est plus long qu'elle.
        // atrim la cale EXACTEMENT sur la durée du montage, puis fondu de sortie
        // (1,5 s) pour une fin propre au lieu d'une coupe brute.
        // normalize=0 : amix NE divise PAS les volumes (sinon musique + voix réduites de moitié).
        // La voix reste à plein volume ; la musique est ajoutée au niveau `vol`.
        const fadeStart = Math.max(0, totalDuration - 1.5).toFixed(2);
        // Passe 1 — préparation de la piste : boucle sur la durée exacte,
        // loudnorm (niveau constant), volume, fondu de fin. Passe séparée car
        // -stream_loop + graphe multi-entrées fait échouer ffmpeg au rebouclage.
        const musPrepared = path.join(workDir, 'music-prepared.wav');
        await runFfmpeg([
          '-y', '-stream_loop', '-1', '-i', mIn,
          '-t', totalDuration.toFixed(2),
          '-af', `loudnorm=I=-16:TP=-1.5:LRA=11,volume=${vol},afade=t=out:st=${fadeStart}:d=1.5`,
          '-ar', '44100', '-ac', '2', musPrepared,
        ]);
        // Passe 2 — DUCKING sidechain : la musique s'abaisse quand la voix
        // parle et remonte dans les silences — le mix « pub pro ».
        await runFfmpeg([
          '-y', '-i', current, '-i', musPrepared,
          '-filter_complex',
          `[0:a]asplit=2[vox][sc];[1:a][sc]sidechaincompress=threshold=0.03:ratio=6:attack=80:release=350[duck];[vox][duck]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[a]`,
          '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
          mixed,
        ]);
        current = mixed;
        musicApplied = true;
      } catch (e) {
        // Musique optionnelle : on n'échoue pas le montage si elle pose problème,
        // mais l'utilisateur doit savoir qu'elle manque.
        console.warn('[Montage] musique ignorée:', e.message);
        warnings.push(`Musique de fond ignorée (${e.message})`);
      }
      onProgress(92);
    }

    // ── Remux faststart (lecture web progressive) ──
    const out = path.join(workDir, 'final.mp4');
    await runFfmpeg(['-y', '-i', current, '-c', 'copy', '-movflags', '+faststart', out]);
    const buffer = await fs.readFile(out);
    onProgress(98);
    return { buffer, durationSec: Math.round(totalDuration), format, warnings, musicApplied };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export default { renderMontage };
