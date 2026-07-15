import axios from 'axios';
import FormData from 'form-data';
import { uploadToR2 } from './cloudflareImagesService.js';

/**
 * Génération d'images via l'API OpenAI Images (GPT Image), en direct.
 * https://platform.openai.com/docs — endpoints /v1/images/generations et /v1/images/edits
 *
 * L'API renvoie du base64 (b64_json) : on republie sur R2 pour obtenir une URL
 * publique, même contrat que les services d'images existants (retour = URL string).
 *
 * Env :
 *  - OPENAI_IMAGE_API_KEY (prioritaire) ou OPENAI_API_KEY
 *  - OPENAI_IMAGE_MODEL   (défaut: gpt-image-2)
 *  - OPENAI_IMAGE_QUALITY (défaut: medium — low|medium|high|auto)
 */

const OPENAI_IMAGE_API_KEY = process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'low';
const GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const EDITS_URL = 'https://api.openai.com/v1/images/edits';
const TIMEOUT_MS = 180000; // la doc annonce jusqu'à 2 min sur les prompts complexes

export function isOpenAiImageConfigured() {
  return Boolean(OPENAI_IMAGE_API_KEY);
}

/**
 * Analyse visuelle d'une photo produit (vision) pour les vidéos/GIF :
 * fiche d'inventaire ultra précise — type exact, forme, couleurs, matériaux,
 * packaging, et surtout les GESTES physiques d'utilisation.
 * Retourne un texte anglais compact ('' en cas d'échec : étape best-effort).
 */
// ── Description générique d'une image pour le chat Scalor (pièce jointe) ──
// Le modèle de chat (DeepSeek) n'est pas multimodal : cette description écrite
// devient les « yeux » de l'assistant. Générique (produit, capture d'écran,
// facture, graphique…), chiffres et textes lisibles retranscrits.
export async function describeImageForAssistant(imageUrl) {
  if (!isOpenAiImageConfigured() || !imageUrl) return '';
  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      max_tokens: 320,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: "Décris cette image en français pour un assistant e-commerce qui ne la voit pas : nature de l'image (photo produit, capture d'écran, facture, graphique…), contenu principal, et RETRANSCRIS fidèlement les textes et chiffres lisibles importants. 3 à 6 phrases, factuel, sans interprétation.",
          },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
    }, {
      headers: { Authorization: `Bearer ${OPENAI_IMAGE_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 45000,
    });
    return String(res.data?.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    console.warn('[OpenAI vision] assistant image description failed:', err?.response?.data?.error?.message || err.message);
    return '';
  }
}

// Cache mémoire de l'analyse visuelle : en montage auto, la MÊME photo produit
// est analysée pour CHAQUE scène (6-9 appels vision identiques) — on ne paie
// et n'attend qu'une fois. TTL 15 min, ~50 entrées max.
const VISION_CACHE = new Map(); // url -> { text, ts }
const VISION_TTL_MS = 15 * 60 * 1000;

export async function analyzeProductImageForVideo(imageUrl) {
  if (!isOpenAiImageConfigured() || !imageUrl) return '';
  const cached = VISION_CACHE.get(imageUrl);
  if (cached && Date.now() - cached.ts < VISION_TTL_MS) return cached.text;
  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      max_tokens: 380,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe this e-commerce product with inventory-level precision for a video director. Cover: exact product type; shape and size relative to a hand; colors; materials/texture; packaging (cap, pump, lid, wrapper...); how a person physically uses it step by step (precise hand gestures, which hand, where it goes on the body or in the scene); what visible problem it solves if obvious; and IMPORTANT: any plants, ingredients or key actives named or pictured on the label (list them explicitly, e.g. "aloe vera, ginger, shea butter") — the director will show them on set. English, max 140 words, plain text.',
          },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
    }, {
      headers: { Authorization: `Bearer ${OPENAI_IMAGE_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 45000,
    });
    const text = String(res.data?.choices?.[0]?.message?.content || '').trim();
    if (text) {
      VISION_CACHE.set(imageUrl, { text, ts: Date.now() });
      if (VISION_CACHE.size > 50) VISION_CACHE.delete(VISION_CACHE.keys().next().value);
    }
    return text;
  } catch (err) {
    console.warn('[OpenAI vision] product analysis failed:', err?.response?.data?.error?.message || err.message);
    return '';
  }
}

// Ratio → taille acceptée par gpt-image-2 (bords multiples de 16, ratio ≤ 3:1,
// total pixels dans les bornes). Ratios inconnus → 'auto'.
function sizeFromAspectRatio(aspectRatio) {
  switch (String(aspectRatio || 'auto')) {
    case '1:1': return '1024x1024';
    case '4:5': return '1024x1280';
    case '5:4': return '1280x1024';
    case '3:4': return '1024x1360';
    case '4:3': return '1360x1024';
    case '2:3': return '1024x1536';
    case '3:2': return '1536x1024';
    case '9:16': return '1088x1920';
    case '16:9': return '1920x1088';
    default: return 'auto';
  }
}

async function publishBase64ToR2(b64) {
  const buffer = Buffer.from(b64, 'base64');
  const fileName = `openai-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const result = await uploadToR2(buffer, fileName, 'image/jpeg');
  if (!result?.success || !result?.url) {
    throw new Error(`Image IA: upload R2 échoué (${result?.error || 'aucune URL'})`);
  }
  return result.url;
}

function describeOpenAiError(err) {
  const status = err?.response?.status;
  const apiMsg = err?.response?.data?.error?.message || err.message;
  const code = err?.response?.data?.error?.code;
  // Messages neutres côté marchand (marque blanche) — le détail part en console
  console.warn(`[Image IA] erreur ${status || 'réseau'} (${OPENAI_IMAGE_MODEL}):`, apiMsg);
  if (code === 'moderation_blocked') return 'Image IA bloquée par la modération — reformulez votre demande';
  if (status === 401 || status === 403) return 'Service d\'images IA mal configuré — contactez le support';
  if (status === 429) return 'Service d\'images IA saturé — réessayez dans un instant';
  return `Image IA indisponible (${status || 'réseau'}), réessayez`;
}

// Qualité effective : choix explicite de l'appelant sinon défaut env
const resolveQuality = (quality) => (['low', 'medium', 'high', 'auto'].includes(quality) ? quality : OPENAI_IMAGE_QUALITY);

/**
 * Text-to-image. Retourne une URL publique (R2).
 * options.quality : 'low' | 'medium' | 'high' (défaut: OPENAI_IMAGE_QUALITY)
 */
export async function generateOpenAiImage(prompt, aspectRatio = '1:1', { quality } = {}) {
  if (!OPENAI_IMAGE_API_KEY) throw new Error('OPENAI_IMAGE_API_KEY non configurée');
  const effectiveQuality = resolveQuality(quality);
  console.log(`🎨 OpenAI ${OPENAI_IMAGE_MODEL} text-to-image (${aspectRatio}, ${effectiveQuality})...`);
  try {
    const res = await axios.post(GENERATIONS_URL, {
      model: OPENAI_IMAGE_MODEL,
      prompt: String(prompt).slice(0, 32000),
      size: sizeFromAspectRatio(aspectRatio),
      quality: effectiveQuality,
      output_format: 'jpeg',
    }, {
      headers: { Authorization: `Bearer ${OPENAI_IMAGE_API_KEY}` },
      timeout: TIMEOUT_MS,
    });
    const b64 = res.data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('réponse sans b64_json');
    const url = await publishBase64ToR2(b64);
    console.log(`✅ OpenAI image: ${url.slice(0, 80)}...`);
    return url;
  } catch (err) {
    throw new Error(describeOpenAiError(err));
  }
}

// Normalise une référence (Buffer | data URL | base64 | URL https) en Buffer
async function inputToBuffer(input, label = 'ref') {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === 'string') {
    if (/^https?:\/\//i.test(input)) {
      const res = await axios.get(input, { responseType: 'arraybuffer', timeout: 60000 });
      return Buffer.from(res.data);
    }
    const b64 = input.startsWith('data:') ? input.split(',')[1] : input;
    return Buffer.from(b64, 'base64');
  }
  throw new Error(`Image IA: référence ${label} invalide`);
}

/**
 * Image-to-image (endpoint edits) — une ou plusieurs images de référence.
 * Retourne une URL publique (R2).
 */
export async function generateOpenAiImageEdit(prompt, imageInputs = [], aspectRatio = 'auto', { quality } = {}) {
  if (!OPENAI_IMAGE_API_KEY) throw new Error('OPENAI_IMAGE_API_KEY non configurée');
  const inputs = (Array.isArray(imageInputs) ? imageInputs : [imageInputs]).filter(Boolean);
  if (!inputs.length) throw new Error('Image IA: aucune image de référence');
  const effectiveQuality = resolveQuality(quality);
  console.log(`🎨 OpenAI ${OPENAI_IMAGE_MODEL} image-to-image (${inputs.length} réf, ${aspectRatio}, ${effectiveQuality})...`);
  try {
    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('prompt', String(prompt).slice(0, 32000));
    const size = sizeFromAspectRatio(aspectRatio);
    if (size !== 'auto') form.append('size', size);
    form.append('quality', effectiveQuality);
    form.append('output_format', 'jpeg');
    for (let i = 0; i < inputs.length; i++) {
      const buffer = await inputToBuffer(inputs[i], `ref-${i}`);
      form.append('image[]', buffer, { filename: `ref-${i}.jpg`, contentType: 'image/jpeg' });
    }
    const res = await axios.post(EDITS_URL, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${OPENAI_IMAGE_API_KEY}` },
      timeout: TIMEOUT_MS,
      maxBodyLength: Infinity,
    });
    const b64 = res.data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('réponse sans b64_json');
    const url = await publishBase64ToR2(b64);
    console.log(`✅ OpenAI image (edit): ${url.slice(0, 80)}...`);
    return url;
  } catch (err) {
    throw new Error(describeOpenAiError(err));
  }
}
