/**
 * Nano Banana — Gemini 3 Pro + NanoBanana Pro API fallback
 * Primary: Gemini 3 Pro direct (fast, cheap)
 * Fallback: NanoBanana Pro API 1K (async task-based, premium quality)
 */

import axios from 'axios';
import sharp from 'sharp';
import { uploadToR2 } from './cloudflareImagesService.js';

const GEMINI_API_KEY = process.env.NANOBANANA_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// NanoBanana Pro API fallback
const NANOBANANA_PRO_API_KEY = process.env.NANOBANANA_PRO_API_KEY;
const NANOBANANA_PRO_BASE = 'https://api.nanobananaapi.ai/api/v1/nanobanana';

// Gemini 3 Pro Image Preview
const MODEL = 'gemini-3-pro-image-preview';
const MODEL_COST_USD = 0.04;
const NANOBANANA_PRO_COST_USD = 0.09; // 1K Pro
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

// ─── NanoBanana Pro API (fallback) ────────────────────────────────────────────

/**
 * Submit a generation task to NanoBanana Pro API
 */
async function submitNanoBananaProTask(prompt, imageUrls = [], aspectRatio = '1:1', maxRetries = 3) {
  const body = {
    prompt: prompt.slice(0, 8000),
    resolution: '1K',
    aspectRatio: aspectRatio,
  };
  if (imageUrls.length > 0) {
    body.imageUrls = imageUrls.slice(0, 8);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${NANOBANANA_PRO_BASE}/generate-pro`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NANOBANANA_PRO_API_KEY}`,
          },
          timeout: 30000,
        }
      );

      if (response.data?.code === 200) {
        return response.data?.data?.taskId;
      }

      const errMsg = response.data?.message || response.data?.msg || JSON.stringify(response.data).slice(0, 200);
      console.warn(`⚠️ NanoBanana Pro submit attempt ${attempt}/${maxRetries} failed (code ${response.data?.code}): ${errMsg}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000; // 2s, 4s
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`NanoBanana Pro submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    } catch (err) {
      if (err.message.startsWith('NanoBanana Pro submit failed after')) throw err;
      const errMsg = err.response?.data?.message || err.message;
      console.warn(`⚠️ NanoBanana Pro submit attempt ${attempt}/${maxRetries} error: ${errMsg}`);
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`NanoBanana Pro submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    }
  }
}

/**
 * Poll NanoBanana Pro task until completion
 * successFlag: 0=GENERATING, 1=SUCCESS, 2=CREATE_FAILED, 3=GENERATE_FAILED
 */
async function pollNanoBananaProTask(taskId, maxWaitMs = 120000) {
  const pollInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const response = await axios.get(
      `${NANOBANANA_PRO_BASE}/record-info`,
      {
        params: { taskId },
        headers: { 'Authorization': `Bearer ${NANOBANANA_PRO_API_KEY}` },
        timeout: 15000,
      }
    );

    const data = response.data?.data;
    if (!data) throw new Error('NanoBanana Pro: empty poll response');

    if (data.successFlag === 1) {
      // Success — return the result image URL
      const url = data.response?.resultImageUrl || data.response?.originImageUrl;
      if (!url) throw new Error('NanoBanana Pro: no image URL in completed task');
      return url;
    }

    if (data.successFlag === 2 || data.successFlag === 3) {
      throw new Error(`NanoBanana Pro task failed (flag=${data.successFlag}): ${data.errorMessage || 'unknown'}`);
    }

    // Still generating — wait and retry
    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error(`NanoBanana Pro: timeout after ${maxWaitMs / 1000}s`);
}

/**
 * Generate image via NanoBanana Pro API (submit + poll)
 * Returns image URL string (not data URL)
 */
async function generateViaNanoBananaPro(prompt, imageUrls = [], aspectRatio = '1:1') {
  console.log(`🍌 NanoBanana Pro 1K fallback (${aspectRatio})...`);
  const taskId = await submitNanoBananaProTask(prompt, imageUrls, aspectRatio);
  console.log(`📋 Task submitted: ${taskId}`);

  const imageUrl = await pollNanoBananaProTask(taskId);
  const costFcfa = Math.round(NANOBANANA_PRO_COST_USD * USD_TO_FCFA);
  sessionStats.totalImages++;
  sessionStats.totalCostUsd += NANOBANANA_PRO_COST_USD;
  sessionStats.totalCostFcfa += costFcfa;
  console.log(`💰 NanoBanana Pro 1K → ~$${NANOBANANA_PRO_COST_USD} (~${costFcfa} FCFA) | SESSION: ${sessionStats.totalImages} img, ~$${sessionStats.totalCostUsd.toFixed(3)}`);
  console.log(`✅ NanoBanana Pro image: ${imageUrl.slice(0, 80)}...`);
  return imageUrl;
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
    // Fallback NanoBanana Pro API
    try {
      return await generateViaNanoBananaPro(fullPrompt, [], aspectRatio);
    } catch (fallbackErr) {
      console.error(`❌ NanoBanana Pro fallback failed: ${fallbackErr.message}`);
      return null;
    }
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
    // Fallback NanoBanana Pro API — upload image ref to R2 first
    console.log('🔄 Fallback NanoBanana Pro 1K (with image ref)...');
    try {
      let imageUrls = [];
      if (base64Image) {
        try {
          const imgBuffer = Buffer.from(base64Image, 'base64');
          const tempName = `temp-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const r2Result = await uploadToR2(imgBuffer, tempName, imageMimeType);
          if (r2Result.success && r2Result.url) {
            imageUrls = [r2Result.url];
            console.log(`📎 Image ref uploadée vers R2: ${r2Result.url.slice(0, 80)}...`);
          }
        } catch (uploadErr) {
          console.warn(`⚠️ Upload image ref R2 échoué: ${uploadErr.message} — fallback text-only`);
        }
      }
      return await generateViaNanoBananaPro(fullPrompt, imageUrls, aspectRatio);
    } catch (fallbackErr) {
      console.error(`❌ NanoBanana Pro fallback failed: ${fallbackErr.message}`);
      return null;
    }
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
