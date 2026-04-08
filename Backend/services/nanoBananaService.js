/**
 * Nano Banana 2 — Kie.ai NanoBanana 2 (primary, single provider)
 * Model: nano-banana-2 (text-to-image & image-to-image via image_input)
 * Docs: https://docs.kie.ai/market/google/nanobanana2
 */

import axios from 'axios';
import sharp from 'sharp';
import { uploadToR2 } from './cloudflareImagesService.js';

// Kie.ai NanoBanana 2 API
const KIE_API_KEY = process.env.NANOBANANA_PRO_API_KEY;
const KIE_BASE = 'https://api.kie.ai/api/v1/jobs';
const KIE_UPLOAD_BASE = 'https://kieai.redpandaai.co';

const NANOBANANA_PRO_COST_USD = 0.09; // 1K Pro
const USD_TO_FCFA = 600;

// Compteur de session
let sessionStats = { totalImages: 0, totalCostUsd: 0, totalCostFcfa: 0 };

export function getImageGenerationStats() { return { ...sessionStats }; }

/**
 * Resize image buffer to max 1024px and compress as JPEG
 */
async function resizeForApi(buffer) {
  try {
    const resized = await sharp(buffer)
      .resize(720, 720, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    console.log(`📐 Image resized: ${Math.round(buffer.length / 1024)}KB → ${Math.round(resized.length / 1024)}KB`);
    return { buffer: resized, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('⚠️ Resize failed, using original:', err.message);
    return { buffer, mimeType: 'image/jpeg' };
  }
}

// ─── Kie.ai NanoBanana 2 API ───────────────────────────────────

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
 * Submit a generation task to Kie.ai NanoBanana 2 API
 * Single model "nano-banana-2" — uses image_input for image-to-image
 */
async function submitGrokImagineTask(prompt, imageUrls = [], aspectRatio = '1:1', maxRetries = 3) {
  const input = {
    prompt: prompt.slice(0, 20000),
    image_input: imageUrls.slice(0, 14),
    aspect_ratio: aspectRatio || '1:1',
    resolution: '1K',
    output_format: 'jpg',
  };

  const body = { model: 'nano-banana-2', input };

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
      console.warn(`⚠️ NanoBanana 2 submit attempt ${attempt}/${maxRetries} failed (code ${response.data?.code}): ${errMsg}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`NanoBanana 2 submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    } catch (err) {
      if (err.message.startsWith('NanoBanana 2 submit failed after')) throw err;
      const errMsg = err.response?.data?.msg || err.response?.data?.message || err.message;
      console.warn(`⚠️ NanoBanana 2 submit attempt ${attempt}/${maxRetries} error: ${errMsg}`);
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`NanoBanana 2 submit failed after ${maxRetries} attempts: ${errMsg}`);
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
      if (resultUrls.length === 0) throw new Error('NanoBanana 2: no image URL in completed task');
      return resultUrls[0];
    }

    if (data.state === 'fail') {
      throw new Error(`NanoBanana 2 task failed: ${data.failMsg || data.failCode || 'unknown'}`);
    }

    // waiting | queuing | generating — wait and retry
    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error(`NanoBanana 2: timeout after ${maxWaitMs / 1000}s`);
}

/**
 * Generate image via Kie.ai NanoBanana 2 (submit + poll)
 * Returns image URL string (not data URL)
 */
async function generateViaGrokImagine(prompt, imageUrls = [], aspectRatio = '1:1') {
  console.log(`🤖 NanoBanana 2 (${imageUrls.length > 0 ? 'image-to-image' : 'text-to-image'}, ${aspectRatio})...`);
  const taskId = await submitGrokImagineTask(prompt, imageUrls, aspectRatio);
  console.log(`📋 NanoBanana 2 task submitted: ${taskId}`);

  const imageUrl = await pollGrokImagineTask(taskId);
  const costFcfa = Math.round(NANOBANANA_PRO_COST_USD * USD_TO_FCFA);
  sessionStats.totalImages++;
  sessionStats.totalCostUsd += NANOBANANA_PRO_COST_USD;
  sessionStats.totalCostFcfa += costFcfa;
  console.log(`💰 NanoBanana 2 → ~$${NANOBANANA_PRO_COST_USD} (~${costFcfa} FCFA) | SESSION: ${sessionStats.totalImages} img, ~$${sessionStats.totalCostUsd.toFixed(3)}`);
  console.log(`✅ NanoBanana 2 image: ${imageUrl.slice(0, 80)}...`);
  return imageUrl;
}

/**
 * Text-to-image — Kie.ai NanoBanana 2 (only)
 */
export async function generateNanoBananaImage(prompt, aspectRatio = '1:1', numImages = 1) {
  try {
    console.log(`🎨 NanoBanana 2 text-to-image (${aspectRatio})...`);
    return await generateViaGrokImagine(prompt, [], aspectRatio);
  } catch (err) {
    console.error(`❌ NanoBanana 2 text-to-image failed: ${err.message}`);
    return null;
  }
}

/**
 * Image-to-image — Kie.ai NanoBanana 2 (only)
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
      try {
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
          console.warn(`⚠️ R2 upload also failed: ${r2Err.message} — text-only mode`);
        }
      }
    }
    return await generateViaGrokImagine(prompt, imageUrls, aspectRatio);
  } catch (err) {
    console.error(`❌ NanoBanana 2 image-to-image failed: ${err.message}`);
    return null;
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
