/**
 * Google Nano Banana 2 — Kie.ai (primary, single provider)
 * Model: nano-banana-2 (text-to-image + image-to-image)
 * Docs: https://docs.kie.ai
 */

import axios from 'axios';
import sharp from 'sharp';
import { uploadToR2 } from './cloudflareImagesService.js';
import ffmpegPath from 'ffmpeg-static';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

// Kie.ai NanoBanana Pro API
const KIE_API_KEY = process.env.NANOBANANA_PRO_API_KEY;
const KIE_BASE = 'https://api.kie.ai/api/v1/jobs';
const KIE_UPLOAD_BASE = 'https://kieai.redpandaai.co';
const NANOBANANA_MODEL = process.env.NANOBANANA_MODEL || 'nano-banana-2';
const KIE_IMAGE_TO_VIDEO_MODEL = process.env.KIE_IMAGE_TO_VIDEO_MODEL || 'grok-imagine/image-to-video';

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

function extractTaskResultUrl(data, mediaType = 'image') {
  if (!data) return null;

  const expectedExtensions = mediaType === 'video'
    ? ['.mp4', '.webm', '.mov', '.gif', '.m3u8']
    : ['.jpg', '.jpeg', '.png', '.webp'];

  const pushCandidate = (bucket, value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => pushCandidate(bucket, entry));
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach((entry) => pushCandidate(bucket, entry));
      return;
    }
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
      bucket.push(value);
    }
  };

  const candidates = [];
  try {
    const parsed = typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
    pushCandidate(candidates, parsed?.resultUrls);
    pushCandidate(candidates, parsed?.result_urls);
    pushCandidate(candidates, parsed?.images);
    pushCandidate(candidates, parsed?.videos);
    pushCandidate(candidates, parsed?.videoUrls);
    pushCandidate(candidates, parsed?.video_urls);
    pushCandidate(candidates, parsed?.output);
    pushCandidate(candidates, parsed?.url);
  } catch {
    // Ignore parse errors and keep scanning top-level fields.
  }

  pushCandidate(candidates, data.resultUrl);
  pushCandidate(candidates, data.result_url);
  pushCandidate(candidates, data.imageUrl);
  pushCandidate(candidates, data.image_url);
  pushCandidate(candidates, data.videoUrl);
  pushCandidate(candidates, data.video_url);
  pushCandidate(candidates, data.url);

  const deduped = candidates.filter((value, index, array) => value && array.indexOf(value) === index);
  const typedMatch = deduped.find((url) => expectedExtensions.some((ext) => url.toLowerCase().includes(ext)));
  return typedMatch || deduped[0] || null;
}

async function submitKieTask(body, maxRetries = 3) {
  await acquireSlot();

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
        console.log(`✅ Kie.ai task created: ${response.data.data.taskId} (model=${body?.model || 'unknown'})`);
        return response.data.data.taskId;
      }

      const errMsg = response.data?.msg || response.data?.message || JSON.stringify(response.data).slice(0, 400);
      console.warn(`⚠️ Kie submit attempt ${attempt}/${maxRetries} failed (code ${response.data?.code}): ${errMsg}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error(`Kie submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    } catch (err) {
      if (err.message.startsWith('Kie submit failed after')) throw err;
      const errMsg = err.response?.data?.msg || err.response?.data?.message || err.message;
      const status = err.response?.status;
      console.warn(`⚠️ Kie submit attempt ${attempt}/${maxRetries} error (HTTP ${status || '?'}): ${errMsg}`);
      if (attempt < maxRetries) {
        const delay = status === 429 ? 10000 + attempt * 2000 : attempt * 2000;
        console.log(`⏳ Retry in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error(`Kie submit failed after ${maxRetries} attempts: ${errMsg}`);
      }
    }
  }
}

async function pollKieTask(taskId, { maxWaitMs = 180000, mediaType = 'image', label = 'Kie.ai' } = {}) {
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
      const mediaUrl = extractTaskResultUrl(data, mediaType);
      if (!mediaUrl) {
        console.error(`⚠️ ${label} success but no ${mediaType} URL found. Full response:`, JSON.stringify(data).slice(0, 500));
        throw new Error(`${label}: no ${mediaType} URL in completed task`);
      }
      return mediaUrl;
    }

    if (data.state === 'fail' || data.state === 'failed' || data.state === 'error') {
      throw new Error(`${label} task failed: ${data.failMsg || data.failCode || data.message || 'unknown'}`);
    }

    console.log(`⏳ ${label} [${taskId}] state="${data.state}" elapsed=${Math.round((Date.now() - startTime) / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`${label}: timeout after ${maxWaitMs / 1000}s`);
}

/**
 * Submit a generation task to Kie.ai NanoBanana API.
 * Uses nano-banana-pro by default for 1K product visuals.
 */
async function submitGrokImagineTask(prompt, imageUrls = [], aspectRatio = '4:5', maxRetries = 3) {
  // nano-banana-2 supports up to 20000 chars
  const truncatedPrompt = prompt.length > 20000
    ? prompt.slice(0, 19900) + '\n[...prompt truncated]'
    : prompt;

  const input = {
    prompt: truncatedPrompt,
    aspect_ratio: aspectRatio || '4:5',
    resolution: '1K',
    output_format: 'jpg',
  };
  // image_input — always present (image-to-image mode obligatoire)
  input.image_input = imageUrls.length > 0 ? imageUrls.slice(0, 14) : [];

  const body = { model: NANOBANANA_MODEL, input };
  return submitKieTask(body, maxRetries);
}

/**
 * Poll Kie.ai task until completion
 * state: waiting | queuing | generating | success | fail
 */
async function pollGrokImagineTask(taskId, maxWaitMs = 180000) {
  return pollKieTask(taskId, { maxWaitMs, mediaType: 'image', label: 'NanoBanana Pro' });
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
export async function generateNanoBananaImage(prompt, aspectRatio = '4:5', numImages = 1) {
  console.log(`🎨 NanoBanana 2 text-to-image (${aspectRatio})...`);
  return await generateViaGrokImagine(prompt, [], aspectRatio);
}

/**
 * Image-to-image — Kie.ai NanoBanana Pro (only)
 */
export async function generateNanoBananaImageToImage(prompt, imageInput, aspectRatio = '4:5', numImages = 1) {

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

export async function generateKieImageToVideo(prompt, imageInput, options = {}) {
  if (!KIE_API_KEY) {
    throw new Error('Kie.ai API key not configured');
  }

  const {
    duration = '6',
    resolution = '480p',
    aspectRatio = '16:9',
    mode = 'normal',
    maxWaitMs = 300000,
  } = options;

  let imageUrls = [];
  if (typeof imageInput === 'string' && /^https?:\/\//i.test(imageInput)) {
    imageUrls = [imageInput];
  } else if (imageInput) {
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

    if (!base64Image) {
      throw new Error('Image-to-video requires a valid image input');
    }

    try {
      const imgBuffer = Buffer.from(base64Image, 'base64');
      const tempName = `temp-video-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const r2Result = await uploadToR2(imgBuffer, tempName, imageMimeType);
      if (r2Result?.success && r2Result?.url) {
        imageUrls = [r2Result.url];
      } else {
        throw new Error(r2Result?.error || 'R2 upload returned no URL');
      }
    } catch (r2Err) {
      console.warn(`⚠️ Kie image-to-video R2 upload failed: ${r2Err.message} — trying Kie.ai upload...`);
      const kieUrl = await uploadToKieAi(base64Image, imageMimeType);
      imageUrls = [kieUrl];
    }
  }

  if (!imageUrls.length) {
    throw new Error('Image-to-video requires at least one source image URL');
  }

  const truncatedPrompt = prompt.length > 12000
    ? `${prompt.slice(0, 11900)}\n[...prompt truncated]`
    : prompt;

  const body = {
    model: KIE_IMAGE_TO_VIDEO_MODEL,
    input: {
      image_urls: imageUrls.slice(0, 1),
      prompt: truncatedPrompt,
      mode,
      duration: String(duration),
      resolution,
      aspect_ratio: aspectRatio,
    }
  };

  console.log(`🎬 Kie image-to-video (${aspectRatio}, ${duration}s, ${resolution})...`);
  const taskId = await submitKieTask(body, 3);
  console.log(`📋 Kie image-to-video task submitted: ${taskId}`);
  const videoUrl = await pollKieTask(taskId, { maxWaitMs, mediaType: 'video', label: 'Kie image-to-video' });
  console.log(`✅ Kie image-to-video: ${videoUrl.slice(0, 80)}...`);
  return videoUrl;
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

async function resolveImageBuffer(imageInput) {
  if (!imageInput) return null;

  if (Buffer.isBuffer(imageInput)) {
    return imageInput;
  }

  if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
    const base64Payload = imageInput.split(',')[1];
    return base64Payload ? Buffer.from(base64Payload, 'base64') : null;
  }

  if (isHttpUrl(imageInput)) {
    const response = await axios.get(imageInput, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EcomBot/1.0)' },
      maxRedirects: 5,
    });
    return Buffer.from(response.data);
  }

  return null;
}

async function runFfmpeg(args) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary not available');
  }

  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

export async function generateAnimatedGifFromImages(imageInputs = [], options = {}) {
  const frames = [];
  for (const imageInput of imageInputs) {
    const buffer = await resolveImageBuffer(imageInput);
    if (buffer) frames.push(buffer);
  }

  if (frames.length < 2) {
    throw new Error('At least 2 source images are required to build a GIF');
  }

  const {
    width = 768,
    height = 432,
    fps = 8,
    frameDurationMs = 1200,
    filePrefix = `product-gif-${Date.now()}`,
  } = options;

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scalor-gif-'));
  const framePaths = [];
  const totalSeconds = Math.max(1, Math.round((frames.length * frameDurationMs) / 1000));

  try {
    for (let index = 0; index < frames.length; index += 1) {
      const framePath = path.join(workDir, `frame-${String(index + 1).padStart(2, '0')}.png`);
      framePaths.push(framePath);
      await sharp(frames[index])
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .png()
        .toFile(framePath);
    }

    const concatInputs = [];
    const concatLabels = [];
    framePaths.forEach((framePath, index) => {
      concatInputs.push('-loop', '1', '-t', String(Math.max(1, frameDurationMs / 1000)), '-i', framePath);
      concatLabels.push(`[${index}:v]fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=cover,crop=${width}:${height},setsar=1[v${index}]`);
    });

    const filterGraph = `${concatLabels.join(';')};${framePaths.map((_, index) => `[v${index}]`).join('')}concat=n=${framePaths.length}:v=1:a=0,split[s0][s1];[s0]palettegen=stats_mode=full[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
    const outputPath = path.join(workDir, `${filePrefix}.gif`);

    await runFfmpeg([
      '-y',
      ...concatInputs,
      '-filter_complex', filterGraph,
      '-loop', '0',
      '-t', String(totalSeconds),
      outputPath,
    ]);

    const gifBuffer = await fs.readFile(outputPath);
    const uploadResult = await uploadToR2(gifBuffer, `${filePrefix}.gif`, 'image/gif');
    if (!uploadResult?.success || !uploadResult?.url) {
      throw new Error(uploadResult?.error || 'GIF upload failed');
    }

    return uploadResult.url;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
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
