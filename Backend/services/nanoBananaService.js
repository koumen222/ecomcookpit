/**
 * Nano Banana 2 — Gemini 2.0 Flash Image Generation Service
 * - Un seul modèle, zéro fallback, zéro latence perdue
 */

import axios from 'axios';
import sharp from 'sharp';

const GEMINI_API_KEY = process.env.NANOBANANA_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini 3 Pro Image Preview
const MODEL = 'gemini-3-pro-image-preview';
const MODEL_COST_USD = 0.04;
const USD_TO_FCFA = 600;

// Compteur de session
let sessionStats = { totalImages: 0, totalCostUsd: 0, totalCostFcfa: 0 };

function logCost(type = 'text-to-image') {
  const costFcfa = Math.round(MODEL_COST_USD * USD_TO_FCFA);
  sessionStats.totalImages++;
  sessionStats.totalCostUsd += MODEL_COST_USD;
  sessionStats.totalCostFcfa += costFcfa;
  console.log(`💰 ${MODEL} (${type}) → ~$${MODEL_COST_USD} (~${costFcfa} FCFA) | SESSION: ${sessionStats.totalImages} img, ~$${sessionStats.totalCostUsd.toFixed(3)} (~${sessionStats.totalCostFcfa} FCFA)`);
}

export function getImageGenerationStats() { return { ...sessionStats }; }

/**
 * Resize image buffer to max 512px and compress as JPEG for cost optimization
 */
async function resizeForApi(buffer) {
  try {
    const resized = await sharp(buffer)
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    console.log(`📐 Image resized: ${Math.round(buffer.length / 1024)}KB → ${Math.round(resized.length / 1024)}KB`);
    return { buffer: resized, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('⚠️ Resize failed, using original:', err.message);
    return { buffer, mimeType: 'image/jpeg' };
  }
}

/**
 * Call Gemini 3 Pro generateContent — single call, no fallback
 */
async function callGemini(parts) {
  const response = await axios.post(
    `${GEMINI_BASE_URL}/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 0.6 }
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 90000 }
  );
  const resParts = response.data?.candidates?.[0]?.content?.parts || [];
  const imagePart = resParts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart) throw new Error('Gemini n\'a pas retourné d\'image');
  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

function buildArInstruction(aspectRatio) {
  if (aspectRatio === '1:1') return '\n\nIMPORTANT: Generate a SQUARE image (1:1 aspect ratio).';
  if (aspectRatio === '9:16') return '\n\nIMPORTANT: Generate a VERTICAL image (9:16 portrait).';
  if (aspectRatio === '16:9') return '\n\nIMPORTANT: Generate a HORIZONTAL image (16:9 landscape).';
  return '';
}

/**
 * Text-to-image — Gemini 3 Pro direct
 */
export async function generateNanoBananaImage(prompt, aspectRatio = '1:1', numImages = 1) {
  if (!GEMINI_API_KEY) throw new Error('Google Gemini API key not configured');

  const fullPrompt = prompt + buildArInstruction(aspectRatio);

  try {
    console.log(`🎨 ${MODEL} text-to-image...`);
    const dataUrl = await callGemini([{ text: fullPrompt.slice(0, 8000) }]);
    logCost('text-to-image');
    console.log(`✅ Image générée`);
    return dataUrl;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`❌ ${MODEL} failed: ${msg}`);
    return null;
  }
}

/**
 * Image-to-image — Gemini 3 Pro direct (product reference)
 */
export async function generateNanoBananaImageToImage(prompt, imageInput, aspectRatio = '1:1', numImages = 1) {
  if (!GEMINI_API_KEY) throw new Error('Google Gemini API key not configured');

  const fullPrompt = prompt + buildArInstruction(aspectRatio);

  // Resize input image
  let base64Image;
  let imageMimeType = 'image/jpeg';
  if (Buffer.isBuffer(imageInput)) {
    const resized = await resizeForApi(imageInput);
    base64Image = resized.buffer.toString('base64');
    imageMimeType = resized.mimeType;
  } else if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
    const match = imageInput.match(/^data:(image\/[a-z+]+);base64,/);
    if (match) imageMimeType = match[1];
    base64Image = imageInput.split(',')[1];
  } else {
    base64Image = imageInput;
  }

  try {
    console.log(`🎨 ${MODEL} image-to-image (${Math.round((base64Image?.length || 0) * 0.75 / 1024)}Ko)...`);
    const dataUrl = await callGemini([
      { text: fullPrompt.slice(0, 8000) },
      { inlineData: { mimeType: imageMimeType, data: base64Image } }
    ]);
    logCost('image-to-image');
    console.log(`✅ Image-to-image générée`);
    return dataUrl;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`❌ ${MODEL} image-to-image failed: ${msg}`);
    // Fallback text-to-image si l'image pose problème
    console.log('🔄 Fallback text-to-image...');
    return generateNanoBananaImage(prompt, aspectRatio, numImages);
  }
}

/**
 * Check Gemini API availability
 */
export async function getNanoBananaCredits() {
  if (!GEMINI_API_KEY) {
    return { credits: 0, error: 'Gemini API key not configured' };
  }

  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`,
      { timeout: 10000 }
    );
    const models = response.data?.models || [];
    return { credits: 999, models: models.length, status: 'active' };
  } catch (error) {
    console.error('❌ Failed to check Gemini API:', error.message);
    return { credits: 0 };
  }
}
