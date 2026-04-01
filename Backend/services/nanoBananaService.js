/**
 * Gemini 3 Pro Image / Imagen 4 Generation Service
 * - Image generation : gemini-3-pro-image-preview → gemini-3.1-flash-image-preview (generateContent)
 * - Fallback         : imagen-4.0-fast-generate-001 (predict)
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.NANOBANANA_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Modèles Gemini image (generateContent, responseModalities IMAGE)
const GEMINI_IMAGE_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
];

// Imagen 4 fallback (predict endpoint)
const IMAGEN_MODELS = [
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-001',
];
const IMAGEN_BASE_URL = GEMINI_BASE_URL;

/**
 * Generate image using Google Imagen 3 (text-to-image)
 * @param {string} prompt - Text description of the image
 * @param {string} aspectRatio - Image aspect ratio (default: "1:1")
 * @param {number} numImages - Number of images to generate (1-4)
 * @returns {Promise<string|null>} - Base64 image data URL or null
 */
export async function generateNanoBananaImage(prompt, aspectRatio = '1:1', numImages = 1) {
  if (!GEMINI_API_KEY) throw new Error('Google Gemini API key not configured');

  // 1ère tentative : Gemini 3 Pro Image (generateContent) — priorité au modèle Pro
  for (const model of GEMINI_IMAGE_MODELS) {
    const isPro = model.includes('-pro-');
    try {
      console.log(`🎨 Generating image with ${model}${isPro ? ' (PRO)' : ''}...`);
      const response = await axios.post(
        `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt.slice(0, 4000) }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 1.0 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: isPro ? 90000 : 60000 }
      );
      const parts = response.data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
      if (!imagePart) { console.warn(`⚠️ ${model}: pas de donnée image`); continue; }
      console.log(`✅ Image générée avec ${model}`);
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`⚠️ ${model} failed: ${msg}`);
    }
  }

  // Fallback : Imagen 4 (predict)
  for (const model of IMAGEN_MODELS) {
    try {
      console.log(`🎨 Fallback Imagen 4: ${model}...`);
      const response = await axios.post(
        `${IMAGEN_BASE_URL}/${model}:predict?key=${GEMINI_API_KEY}`,
        {
          instances: [{ prompt: prompt.slice(0, 4000) }],
          parameters: { sampleCount: 1, aspectRatio, safetyFilterLevel: 'BLOCK_SOME', personGeneration: 'ALLOW_ADULT' }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 45000 }
      );
      const prediction = response.data?.predictions?.[0];
      if (!prediction?.bytesBase64Encoded) { console.warn(`⚠️ ${model}: pas de donnée image`); continue; }
      console.log(`✅ Image générée avec ${model}`);
      return `data:${prediction.mimeType || 'image/png'};base64,${prediction.bytesBase64Encoded}`;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`⚠️ ${model} failed: ${msg}`);
    }
  }

  console.error('❌ Tous les modèles image ont échoué');
  return null;
}

/**
 * Generate image using Gemini 2.5 Flash Image (image-to-image with product reference)
 * @param {string} prompt - Text description of the desired transformation
 * @param {string|Buffer} imageInput - Reference product image (base64 or buffer)
 * @param {string} aspectRatio - Unused (Gemini Flash outputs square by default)
 * @param {number} numImages - Unused (Gemini Flash returns 1 image)
 * @returns {Promise<string|null>} - Base64 image data URL or null
 */
export async function generateNanoBananaImageToImage(prompt, imageInput, aspectRatio = '1:1', numImages = 1) {
  if (!GEMINI_API_KEY) throw new Error('Google Gemini API key not configured');

  let base64Image;
  let imageMimeType = 'image/jpeg'; // défaut
  if (Buffer.isBuffer(imageInput)) {
    // Détecter le vrai format d'après les magic bytes du buffer
    if (imageInput[0] === 0x89 && imageInput[1] === 0x50) imageMimeType = 'image/png';
    else if (imageInput[0] === 0x47 && imageInput[1] === 0x49) imageMimeType = 'image/gif';
    else if (imageInput[0] === 0x52 && imageInput[1] === 0x49) imageMimeType = 'image/webp';
    base64Image = imageInput.toString('base64');
  } else if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
    const match = imageInput.match(/^data:(image\/[a-z+]+);base64,/);
    if (match) imageMimeType = match[1];
    base64Image = imageInput.split(',')[1];
  } else {
    base64Image = imageInput;
  }

  // Gemini 3 Pro Image supporte image-to-image via inlineData — priorité au Pro
  for (const model of GEMINI_IMAGE_MODELS) {
    const isPro = model.includes('-pro-');
    try {
      console.log(`🎨 Image-to-image with ${model}${isPro ? ' (PRO)' : ''} (ref: ${imageMimeType}, ${Math.round((base64Image?.length || 0) * 0.75 / 1024)}Ko)...`);
      const response = await axios.post(
        `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [
            { text: prompt.slice(0, 4000) },
            { inlineData: { mimeType: imageMimeType, data: base64Image } }
          ]}],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 1.0 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: isPro ? 90000 : 60000 }
      );
      const parts = response.data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
      if (!imagePart) { console.warn(`⚠️ ${model}: pas de donnée image`); continue; }
      console.log(`✅ Image-to-image générée avec ${model}`);
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`⚠️ ${model} image-to-image failed: ${msg}`);
    }
  }

  // Fallback text-to-image
  console.log('🔄 Fallback text-to-image...');
  return generateNanoBananaImage(prompt, aspectRatio, numImages);
}

/**
 * Check Gemini API availability
 * @returns {Promise<Object>} - API status info
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
    const hasImagen = models.some(m => m.name?.includes('imagen'));
    return { credits: hasImagen ? 999 : 0, models: models.length, status: 'active' };
  } catch (error) {
    console.error('❌ Failed to check Gemini API:', error.message);
    return { credits: 0 };
  }
}
