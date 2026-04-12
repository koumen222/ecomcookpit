/**
 * Google Nano Banana 2 — Kie.ai (primary, single provider)
 * Model: nano-banana-2 (text-to-image + image-to-image)
 * Docs: https://docs.kie.ai
 */

import axios from 'axios';
import sharp from 'sharp';
import { uploadToR2 } from './cloudflareImagesService.js';

// Kie.ai NanoBanana Pro API
const KIE_API_KEY = process.env.NANOBANANA_PRO_API_KEY;
const KIE_BASE = 'https://api.kie.ai/api/v1/jobs';
const KIE_UPLOAD_BASE = 'https://kieai.redpandaai.co';
const NANOBANANA_MODEL = process.env.NANOBANANA_MODEL || 'nano-banana-2';

const NANOBANANA_PRO_COST_USD = 0.09; // 1K Pro
const USD_TO_FCFA = 600;

// ── Rate limiter: max 15 createTask calls per 10s window (API limit is 20) ───
const RATE_WINDOW_MS = 10000;
const RATE_MAX = 15; // leave headroom below 20
const rateBuckets = [];
function acquireSlot() {
  return new Promise(resolve => {
    const tryAcquire = () => {
      const now = Date.now();
      // Remove expired entries
      while (rateBuckets.length && rateBuckets[0] <= now - RATE_WINDOW_MS) rateBuckets.shift();
      if (rateBuckets.length < RATE_MAX) {
        rateBuckets.push(now);
        resolve();
      } else {
        // Wait until oldest slot expires
        const waitMs = rateBuckets[0] + RATE_WINDOW_MS - now + 100;
        setTimeout(tryAcquire, waitMs);
      }
    };
    tryAcquire();
  });
}

// Compteur de session
let sessionStats = { totalImages: 0, totalCostUsd: 0, totalCostFcfa: 0 };

export function getImageGenerationStats() { return { ...sessionStats }; }

/**
 * Resize image buffer to max 1024px and compress as JPEG.
 * Keep the input close to 1K so the Pro model has enough detail to preserve the real product.
 */
async function resizeForApi(buffer) {
  try {
    const resized = await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    console.log(`📐 Image resized: ${Math.round(buffer.length / 1024)}KB → ${Math.round(resized.length / 1024)}KB`);
    return { buffer: resized, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('⚠️ Resize failed, using original:', err.message);
    return { buffer, mimeType: 'image/jpeg' };
  }
}

// ─── Kie.ai NanoBanana Pro API ─────────────────────────────────

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
  const rd = response.data;
  // Kie.ai returns downloadUrl (not fileUrl)
  const fileUrl = rd?.data?.downloadUrl || rd?.data?.fileUrl || rd?.data?.url || rd?.fileUrl || rd?.url;
  if (fileUrl) {
    console.log(`📎 Uploaded to Kie.ai: ${fileUrl.slice(0, 80)}...`);
    return fileUrl;
  }
  // Log full response for debugging
  console.warn('⚠️ Kie.ai upload response:', JSON.stringify(rd).slice(0, 500));
  throw new Error(`Kie.ai file upload failed: ${rd?.msg || rd?.message || 'no fileUrl in response'}`);
}

/**
 * Submit a generation task to Kie.ai NanoBanana API.
 * Uses nano-banana-pro by default for 1K product visuals.
 */
async function submitGrokImagineTask(prompt, imageUrls = [], aspectRatio = '1:1', maxRetries = 3) {
  // Acquire rate-limit slot before calling API
  await acquireSlot();

  // nano-banana-2 supports up to 20000 chars
  const truncatedPrompt = prompt.length > 20000
    ? prompt.slice(0, 19900) + '\n[...prompt truncated]'
    : prompt;

  const input = {
    prompt: truncatedPrompt,
    aspect_ratio: aspectRatio || '1:1',
    resolution: '1K',
    output_format: 'jpg',
  };
  // image_input — always present (image-to-image mode obligatoire)
  input.image_input = imageUrls.length > 0 ? imageUrls.slice(0, 14) : [];

  const body = { model: NANOBANANA_MODEL, input };

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
        console.log(`✅ Kie.ai task created: ${response.data.data.taskId} (model=${NANOBANANA_MODEL})`);
        return response.data.data.taskId;
      }

      const errMsg = response.data?.msg || response.data?.message || JSON.stringify(response.data).slice(0, 400);
      console.warn(`⚠️ NanoBanana Pro submit attempt ${attempt}/${maxRetries} failed (code ${response.data?.code}): ${errMsg}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`NanoBanana Pro submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    } catch (err) {
      if (err.message.startsWith('NanoBanana Pro submit failed after')) throw err;
      const errMsg = err.response?.data?.msg || err.response?.data?.message || err.message;
      const status = err.response?.status;
      console.warn(`⚠️ NanoBanana Pro submit attempt ${attempt}/${maxRetries} error (HTTP ${status || '?'}): ${errMsg}`);
      if (attempt < maxRetries) {
        // HTTP 429 — back off longer
        const delay = status === 429 ? 10000 + attempt * 2000 : attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`NanoBanana Pro submit failed after ${maxRetries} attempts: ${errMsg}`);
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

    if (data.state === 'success' || data.state === 'completed') {
      // Try multiple result field formats depending on model
      let imageUrl = null;
      try {
        const parsed = typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
        // gpt-image/1.5 returns resultUrls or images or result_urls
        const urls = parsed?.resultUrls || parsed?.result_urls || parsed?.images || parsed?.output || [];
        imageUrl = Array.isArray(urls) ? urls[0] : (typeof urls === 'string' ? urls : null);
        if (!imageUrl && parsed?.url) imageUrl = parsed.url;
      } catch { /* ignore parse error */ }
      // Also check top-level fields
      if (!imageUrl) imageUrl = data.resultUrl || data.result_url || data.imageUrl || data.image_url;
      if (!imageUrl) {
        console.error('⚠️ Kie.ai success but no URL found. Full response:', JSON.stringify(data).slice(0, 500));
        throw new Error('NanoBanana Pro: no image URL in completed task');
      }
      return imageUrl;
    }

    if (data.state === 'fail' || data.state === 'failed' || data.state === 'error') {
      throw new Error(`NanoBanana Pro task failed: ${data.failMsg || data.failCode || data.message || 'unknown'}`);
    }

    // waiting | queuing | generating — wait and retry
    console.log(`⏳ Kie.ai [${taskId}] state="${data.state}" elapsed=${Math.round((Date.now()-startTime)/1000)}s`);
    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error(`NanoBanana Pro: timeout after ${maxWaitMs / 1000}s`);
}

/**
 * Generate image via Kie.ai NanoBanana Pro (submit + poll)
 * Returns image URL string (not data URL)
 */
async function generateViaGrokImagine(prompt, imageUrls = [], aspectRatio = '1:1') {
  console.log(`🤖 NanoBanana Pro [${NANOBANANA_MODEL}] (${imageUrls.length > 0 ? 'image-to-image' : 'text-to-image'}, ${aspectRatio}, 1K)...`);
  const taskId = await submitGrokImagineTask(prompt, imageUrls, aspectRatio);
  console.log(`📋 NanoBanana Pro task submitted: ${taskId}`);

  const imageUrl = await pollGrokImagineTask(taskId);
  const costFcfa = Math.round(NANOBANANA_PRO_COST_USD * USD_TO_FCFA);
  sessionStats.totalImages++;
  sessionStats.totalCostUsd += NANOBANANA_PRO_COST_USD;
  sessionStats.totalCostFcfa += costFcfa;
  console.log(`💰 NanoBanana Pro → ~$${NANOBANANA_PRO_COST_USD} (~${costFcfa} FCFA) | SESSION: ${sessionStats.totalImages} img, ~$${sessionStats.totalCostUsd.toFixed(3)}`);
  console.log(`✅ NanoBanana Pro image: ${imageUrl.slice(0, 80)}...`);
  return imageUrl;
}

/**
 * Text-to-image — nano-banana-2 supports text-to-image natively.
 */
export async function generateNanoBananaImage(prompt, aspectRatio = '1:1', numImages = 1) {
  console.log(`🎨 NanoBanana 2 text-to-image (${aspectRatio})...`);
  return await generateViaGrokImagine(prompt, [], aspectRatio);
}

/**
 * Image-to-image — Kie.ai NanoBanana Pro (only)
 */
export async function generateNanoBananaImageToImage(prompt, imageInput, aspectRatio = '1:1', numImages = 1) {

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
    console.log(`🎨 NanoBanana 2 image-to-image...`);
    let imageUrls = [];
    if (base64Image) {
      // 1st try: R2 (reliable public URL, works with all models)
      try {
        const imgBuffer = Buffer.from(base64Image, 'base64');
        const tempName = `temp-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const r2Result = await uploadToR2(imgBuffer, tempName, imageMimeType);
        if (r2Result.success && r2Result.url) {
          imageUrls = [r2Result.url];
          console.log(`📎 Image ref uploadée R2: ${r2Result.url.slice(0, 80)}...`);
        } else {
          throw new Error(r2Result?.error || 'R2 upload returned no URL');
        }
      } catch (r2Err) {
        console.warn(`⚠️ R2 upload failed: ${r2Err.message} — trying Kie.ai upload...`);
        // 2nd try: Kie.ai upload endpoint
        try {
          const kieUrl = await uploadToKieAi(base64Image, imageMimeType);
          imageUrls = [kieUrl];
        } catch (kieErr) {
          throw new Error(`Product reference upload failed (r2: ${r2Err.message} | kie: ${kieErr.message})`);
        }
      }
    }
    if (imageInput && imageUrls.length === 0) {
      throw new Error('Image reference requested but no imageUrls available — refusing to fall back to text-to-image');
    }
    return await generateViaGrokImagine(prompt, imageUrls, aspectRatio);
  } catch (err) {
    console.error(`❌ NanoBanana Pro image-to-image failed: ${err.message}`);
    // STRICT: throw instead of returning null — the caller requires image-to-image.
    // Returning null would silently skip the image; throwing lets upstream retry logic work.
    throw err;
  }
}

/**
 * Check Kie.ai API availability
 */
export async function getNanoBananaCredits() {
  if (!KIE_API_KEY) {
    return { credits: 0, error: 'Kie.ai API key not configured' };
  }
  return { credits: 999, status: 'active', provider: 'kie.ai' };
}
