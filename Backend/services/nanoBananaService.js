/**
 * Nano Banana 2 — Gemini 3.1 Flash Image + Kie.ai Nano Banana Pro fallback
 * Primary: Gemini 3.1 Flash Image direct (fast, cheap)
 * Fallback: Kie.ai Nano Banana Pro API (async task-based, premium quality)
 */

import axios from 'axios';
import sharp from 'sharp';
import { uploadToR2 } from './cloudflareImagesService.js';

const GEMINI_API_KEY = process.env.NANOBANANA_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Kie.ai Grok Imagine API fallback
const KIE_API_KEY = process.env.NANOBANANA_PRO_API_KEY;
const KIE_BASE = 'https://api.kie.ai/api/v1/jobs';
const KIE_UPLOAD_BASE = 'https://kieai.redpandaai.co';

// Gemini 3.1 Flash Image
const MODEL = 'gemini-3.1-flash-preview';
const MODEL_COST_USD = 0.02;
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

// ─── Kie.ai Grok Imagine API (fallback) ───────────────────────────────────

/**
 * Upload base64 image to Kie.ai for use as image_urls reference
 */
async function uploadToKieAi(base64Data, mimeType = 'image/jpeg') {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await axios.post(
    `${KIE_UPLOAD_BASE}/api/file-base64-upload`,
    { base64Data: `data:${mimeType};base64,${base64Data}`, uploadPath: 'product-refs', fileName },
    { headers: { 'Authorization': `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  if (response.data?.success && response.data?.data?.fileUrl) {
    console.log(`📎 Uploaded to Kie.ai: ${response.data.data.fileUrl.slice(0, 80)}...`);
    return response.data.data.fileUrl;
  }
  throw new Error(`Kie.ai file upload failed: ${response.data?.msg || 'unknown'}`);
}

/**
 * Submit a generation task to Kie.ai Grok Imagine API
 * Uses grok-imagine/text-to-image or grok-imagine/image-to-image depending on imageUrls
 */
async function submitGrokImagineTask(prompt, imageUrls = [], aspectRatio = '1:1', maxRetries = 3) {
  const isImageToImage = imageUrls.length > 0;
  const model = isImageToImage ? 'grok-imagine/image-to-image' : 'grok-imagine/text-to-image';

  const input = { prompt: prompt.slice(0, 5000) };
  if (isImageToImage) {
    input.image_urls = imageUrls.slice(0, 5);
  }
  // Map aspect ratios to grok-imagine supported values
  const arMap = { '1:1': '1:1', '9:16': '9:16', '16:9': '16:9', '2:3': '2:3', '3:2': '3:2' };
  input.aspect_ratio = arMap[aspectRatio] || '1:1';
  input.nsfw_checker = false;

  const body = { model, input };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${KIE_BASE}/createTask`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${KIE_API_KEY}`,
          },
          timeout: 30000,
        }
      );

      if (response.data?.code === 200 && response.data?.data?.taskId) {
        return response.data.data.taskId;
      }

      const errMsg = response.data?.msg || response.data?.message || JSON.stringify(response.data).slice(0, 200);
      console.warn(`⚠️ Grok Imagine submit attempt ${attempt}/${maxRetries} failed (code ${response.data?.code}): ${errMsg}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`Grok Imagine submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    } catch (err) {
      if (err.message.startsWith('Grok Imagine submit failed after')) throw err;
      const errMsg = err.response?.data?.msg || err.response?.data?.message || err.message;
      console.warn(`⚠️ Grok Imagine submit attempt ${attempt}/${maxRetries} error: ${errMsg}`);
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`Grok Imagine submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    }
  }
}

/**
 * Poll Kie.ai task until completion
 * state: waiting | queuing | generating | success | fail
 */
async function pollGrokImagineTask(taskId, maxWaitMs = 180000) {
  const pollInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const response = await axios.get(
      `${KIE_BASE}/recordInfo`,
      {
        params: { taskId },
        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
        timeout: 15000,
      }
    );

    const data = response.data?.data;
    if (!data) throw new Error('Kie.ai: empty poll response');

    if (data.state === 'success') {
      let resultUrls = [];
      try {
        const parsed = typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
        resultUrls = parsed?.resultUrls || [];
      } catch { /* ignore parse error */ }
      if (resultUrls.length === 0) throw new Error('Grok Imagine: no image URL in completed task');
      return resultUrls[0];
    }

    if (data.state === 'fail') {
      throw new Error(`Grok Imagine task failed: ${data.failMsg || data.failCode || 'unknown'}`);
    }

    // waiting | queuing | generating — wait and retry
    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error(`Grok Imagine: timeout after ${maxWaitMs / 1000}s`);
}

/**
 * Generate image via Kie.ai Grok Imagine (submit + poll)
 * Returns image URL string (not data URL)
 */
async function generateViaGrokImagine(prompt, imageUrls = [], aspectRatio = '1:1') {
  console.log(`🤖 Kie.ai Grok Imagine fallback (${imageUrls.length > 0 ? 'image-to-image' : 'text-to-image'}, ${aspectRatio})...`);
  const taskId = await submitGrokImagineTask(prompt, imageUrls, aspectRatio);
  console.log(`📋 Grok Imagine task submitted: ${taskId}`);

  const imageUrl = await pollGrokImagineTask(taskId);
  const costFcfa = Math.round(NANOBANANA_PRO_COST_USD * USD_TO_FCFA);
  sessionStats.totalImages++;
  sessionStats.totalCostUsd += NANOBANANA_PRO_COST_USD;
  sessionStats.totalCostFcfa += costFcfa;
  console.log(`💰 Grok Imagine → ~$${NANOBANANA_PRO_COST_USD} (~${costFcfa} FCFA) | SESSION: ${sessionStats.totalImages} img, ~$${sessionStats.totalCostUsd.toFixed(3)}`);
  console.log(`✅ Grok Imagine image: ${imageUrl.slice(0, 80)}...`);
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
    // Fallback Kie.ai Grok Imagine
    try {
      return await generateViaGrokImagine(fullPrompt, [], aspectRatio);
    } catch (fallbackErr) {
      console.error(`❌ Grok Imagine fallback failed: ${fallbackErr.message}`);
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
    // Fallback Kie.ai Grok Imagine — upload image ref to Kie.ai first
    console.log('🔄 Fallback Grok Imagine image-to-image...');
    try {
      let imageUrls = [];
      if (base64Image) {
        try {
          // Upload to Kie.ai file storage (required for grok-imagine image_urls)
          const kieUrl = await uploadToKieAi(base64Image, imageMimeType);
          imageUrls = [kieUrl];
        } catch (uploadErr) {
          console.warn(`⚠️ Upload to Kie.ai failed: ${uploadErr.message} — trying R2...`);
          try {
            const imgBuffer = Buffer.from(base64Image, 'base64');
            const tempName = `temp-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const r2Result = await uploadToR2(imgBuffer, tempName, imageMimeType);
            if (r2Result.success && r2Result.url) {
              imageUrls = [r2Result.url];
              console.log(`📎 Image ref uploadée vers R2: ${r2Result.url.slice(0, 80)}...`);
            }
          } catch (r2Err) {
            console.warn(`⚠️ R2 upload also failed: ${r2Err.message} — fallback text-only`);
          }
        }
      }
      return await generateViaGrokImagine(fullPrompt, imageUrls, aspectRatio);
    } catch (fallbackErr) {
      console.error(`❌ Grok Imagine fallback failed: ${fallbackErr.message}`);
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
