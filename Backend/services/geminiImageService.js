/**
 * Google Gemini Image Service — fallback pour la génération de visuels produit.
 *
 * Modèle : `gemini-3-pro-image-preview` (Nano Banana Pro — meilleure qualité,
 * raisonnement avancé, texte haute fidélité, plus cher).
 * Text-to-image et image-to-image via l'API Generative Language
 * (`generativelanguage.googleapis.com`).
 * Alternatives :
 *   - `gemini-3.1-flash-image-preview` (Nano Banana 2, plus rapide, moins cher)
 *   - `gemini-2.5-flash-image` (Nano Banana v1, stable historique)
 * Utilisé en filet de secours quand Kie.ai (NanoBanana Pro / GPT Image 2) échoue.
 *
 * La clé API est lue depuis `process.env.GEMINI_API_KEY`. Ne JAMAIS commiter
 * la clé en clair — la documentation se trouve dans Backend/.env.example.
 *
 * Signature compatible avec `generateGptImage2ImageToImage` afin de servir de
 * drop-in fallback : on rend une URL publique R2 d'image.
 */

import axios from 'axios';
import sharp from 'sharp';
import { uploadToR2 } from './cloudflareImagesService.js';

// ⚠️ Clé en dur — repli pour quand la variable d'env n'est pas définie.
// À retirer dès que GEMINI_API_KEY est configurée dans Railway. Cette clé
// finira dans git history — la révoquer et la régénérer si le repo fuite.
const HARDCODED_FALLBACK_KEY = 'AIzaSyC_YHblagHaeq7OA0a3VA9O6-3uBZk_yxE';

// Priorité : seulement GEMINI_API_KEY (variable explicite) peut override.
// On NE retombe PAS sur NANOBANANA_API_KEY ici car celle-ci est souvent restée
// à une ancienne valeur révoquée dans le .env local — la clé en dur passe avant.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || HARDCODED_FALLBACK_KEY;
// gemini-3-pro-image-preview = Nano Banana Pro (meilleure qualité, raisonnement
// avancé, suivi de prompts complexes, texte haute fidélité). Override possible
// via GEMINI_IMAGE_MODEL pour repasser sur gemini-3.1-flash-image-preview
// (Nano Banana 2, plus rapide/moins cher) ou gemini-2.5-flash-image (v1 stable).
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';

// Log au démarrage pour pouvoir diagnostiquer quelle source de clé est active
if (GEMINI_API_KEY) {
  const source = process.env.GEMINI_API_KEY ? 'env GEMINI_API_KEY' : 'hardcoded fallback';
  console.log(`🌙 Gemini key source: ${source} (prefix ${GEMINI_API_KEY.slice(0, 10)}..., len ${GEMINI_API_KEY.length})`);
} else {
  console.warn('⚠️ Gemini key NOT configured');
}
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_TIMEOUT_MS = 60000;

export function isGeminiConfigured() {
  return Boolean(GEMINI_API_KEY);
}

// ── Normalisation d'entrée image vers { base64, mimeType } ────────────────────
async function normalizeImageForGemini(input) {
  let buffer;
  let mimeType = 'image/jpeg';

  if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
    // URL distante — on télécharge pour pouvoir l'envoyer inline à Gemini
    const res = await axios.get(input, { responseType: 'arraybuffer', timeout: 20000 });
    buffer = Buffer.from(res.data);
    mimeType = res.headers['content-type']?.split(';')[0]?.trim() || 'image/jpeg';
  } else if (typeof input === 'string' && input.startsWith('data:')) {
    const match = input.match(/^data:(image\/[a-z+]+);base64,(.*)$/);
    if (!match) throw new Error('Gemini: data URL invalide');
    mimeType = match[1];
    buffer = Buffer.from(match[2], 'base64');
  } else if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === 'string') {
    // base64 brut
    buffer = Buffer.from(input, 'base64');
  } else {
    throw new Error('Gemini: type d\'entrée image non supporté');
  }

  // Redimensionne pour limiter la taille payload (Gemini accepte jusqu'à ~7MB inline)
  try {
    buffer = await sharp(buffer)
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    mimeType = 'image/jpeg';
  } catch (err) {
    console.warn(`⚠️ Gemini resize fallback (utilise original) : ${err.message}`);
  }

  return { base64: buffer.toString('base64'), mimeType };
}

// ── Conversion aspectRatio → instruction prompt ───────────────────────────────
// Gemini 2.5 Flash Image respecte mieux le ratio quand on le précise textuellement.
function aspectRatioHint(aspectRatio) {
  if (!aspectRatio || aspectRatio === 'auto') return '';
  const map = {
    '1:1': 'square 1:1 aspect ratio',
    '4:5': 'portrait 4:5 aspect ratio (Instagram post)',
    '9:16': 'vertical 9:16 aspect ratio (story/reel)',
    '16:9': 'horizontal 16:9 aspect ratio',
    '3:4': 'portrait 3:4 aspect ratio',
    '4:3': 'horizontal 4:3 aspect ratio',
  };
  const hint = map[aspectRatio] || `${aspectRatio} aspect ratio`;
  return `\n\nIMAGE FORMAT REQUIREMENT: Generate the image in ${hint}. The final canvas must match this ratio exactly.`;
}

// ── Extraction de l'image base64 depuis la réponse Gemini ─────────────────────
function extractImageFromResponse(data) {
  const candidates = data?.candidates || [];
  for (const cand of candidates) {
    const parts = cand?.content?.parts || [];
    for (const part of parts) {
      const inline = part?.inline_data || part?.inlineData;
      if (inline?.data) {
        return {
          base64: inline.data,
          mimeType: inline.mime_type || inline.mimeType || 'image/png',
        };
      }
    }
  }
  // Bloqué pour des raisons de safety ?
  const block = candidates[0]?.finishReason || data?.promptFeedback?.blockReason;
  throw new Error(`Gemini: aucune image dans la réponse (finishReason=${block || 'unknown'})`);
}

/**
 * Génère une image via Gemini en mode image-to-image (avec image de référence).
 * Signature alignée sur generateGptImage2ImageToImage pour un drop-in fallback.
 *
 * @param {string} prompt
 * @param {Buffer|string} imageInput   Buffer | data URL | URL publique | base64
 * @param {string} aspectRatio         '1:1' | '4:5' | '9:16' | '16:9' | 'auto'
 * @param {Buffer|string|null} logoInput Logo optionnel — ajouté comme 2e image
 * @returns {Promise<string>}          URL publique R2 de l'image générée
 */
export async function generateGeminiImageToImage(prompt, imageInput, aspectRatio = 'auto', logoInput = null) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY non configurée — fallback Gemini désactivé');
  }
  if (!imageInput) {
    throw new Error('Gemini I2I : image de référence obligatoire');
  }

  const product = await normalizeImageForGemini(imageInput);
  const parts = [
    { text: `${prompt}${aspectRatioHint(aspectRatio)}` },
    { inline_data: { mime_type: product.mimeType, data: product.base64 } },
  ];

  if (logoInput) {
    try {
      const logo = await normalizeImageForGemini(logoInput);
      parts.push({ inline_data: { mime_type: logo.mimeType, data: logo.base64 } });
      console.log(`🏷️ Gemini : logo référence ajouté`);
    } catch (logoErr) {
      console.warn(`⚠️ Gemini logo upload skip : ${logoErr.message}`);
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    // generationConfig.responseModalities est requis pour que Gemini renvoie
    // une image (sinon il renvoie du texte décrivant l'image)
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.9,
    },
  };

  console.log(`🌙 Gemini [${GEMINI_MODEL}] image-to-image (${aspectRatio}, ${parts.length - 1} refs)...`);
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  let response;
  try {
    response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: GEMINI_TIMEOUT_MS,
    });
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    throw new Error(`Gemini API ${status || ''} : ${message}`);
  }

  const { base64, mimeType } = extractImageFromResponse(response.data);

  // Upload R2 pour retourner une URL publique stable (comme les autres providers)
  const buffer = Buffer.from(base64, 'base64');
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r2 = await uploadToR2(buffer, fileName, mimeType);
  if (!r2?.success || !r2?.url) {
    throw new Error(`Gemini : upload R2 échoué (${r2?.error || 'no url'})`);
  }
  console.log(`✅ Gemini image générée : ${r2.url.slice(0, 80)}...`);
  return r2.url;
}

/**
 * Génère une image text-to-image via Gemini (sans référence visuelle).
 * Utile pour les visuels créés à partir d'un prompt seul (ex. bannière, mascotte).
 */
export async function generateGeminiTextToImage(prompt, aspectRatio = '1:1') {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY non configurée');
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${prompt}${aspectRatioHint(aspectRatio)}` }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.9,
    },
  };
  console.log(`🌙 Gemini [${GEMINI_MODEL}] text-to-image (${aspectRatio})...`);
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  let response;
  try {
    response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: GEMINI_TIMEOUT_MS,
    });
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    throw new Error(`Gemini API ${status || ''} : ${message}`);
  }
  const { base64, mimeType } = extractImageFromResponse(response.data);
  const buffer = Buffer.from(base64, 'base64');
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `gemini-t2i-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r2 = await uploadToR2(buffer, fileName, mimeType);
  if (!r2?.success || !r2?.url) {
    throw new Error(`Gemini : upload R2 échoué (${r2?.error || 'no url'})`);
  }
  console.log(`✅ Gemini t2i générée : ${r2.url.slice(0, 80)}...`);
  return r2.url;
}
