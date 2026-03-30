/**
 * Google Imagen 3 / Gemini Image Generation Service
 * - Text-to-image  : imagen-3.0-generate-002 (Imagen 3)
 * - Image-to-image : gemini-2.5-flash-image (Gemini 2.5 Flash)
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.NANOBANANA_API_KEY || 'AIzaSyCXG6SYfRLYkM2NG5303Uf-AhHhRgq_G1A';
const IMAGEN3_URL   = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';
const GEMINI_IMG_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

/**
 * Generate image using Google Imagen 3 (text-to-image)
 * @param {string} prompt - Text description of the image
 * @param {string} aspectRatio - Image aspect ratio (default: "1:1")
 * @param {number} numImages - Number of images to generate (1-4)
 * @returns {Promise<string|null>} - Base64 image data URL or null
 */
export async function generateNanoBananaImage(prompt, aspectRatio = '1:1', numImages = 1) {
  if (!GEMINI_API_KEY) {
    throw new Error('Google Gemini API key not configured');
  }

  try {
    console.log('🎨 Generating image with Google Imagen 3...');

    const response = await axios.post(
      `${IMAGEN3_URL}?key=${GEMINI_API_KEY}`,
      {
        instances: [{ prompt: prompt.slice(0, 4000) }],
        parameters: {
          sampleCount: numImages,
          aspectRatio,
          safetyFilterLevel: 'BLOCK_SOME',
          personGeneration: 'ALLOW_ADULT'
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );

    const prediction = response.data?.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new Error('No image data in Imagen 3 response');
    }

    const mimeType = prediction.mimeType || 'image/png';
    console.log('✅ Imagen 3 image generated successfully');
    return `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    console.error('❌ Imagen 3 error:', msg);
    return null;
  }
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
  if (!GEMINI_API_KEY) {
    throw new Error('Google Gemini API key not configured');
  }

  try {
    console.log('🎨 Generating image-to-image with Gemini 2.5 Flash...');

    let base64Image;
    if (Buffer.isBuffer(imageInput)) {
      base64Image = imageInput.toString('base64');
    } else if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
      base64Image = imageInput.split(',')[1];
    } else {
      base64Image = imageInput;
    }

    const response = await axios.post(
      `${GEMINI_IMG_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [
            { text: prompt.slice(0, 4000) },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE']
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );

    const parts = response.data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) {
      throw new Error('No image data in Gemini response');
    }

    const mimeType = imagePart.inlineData.mimeType;
    console.log('✅ Gemini image-to-image generated successfully');
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    console.error('❌ Gemini image-to-image error:', msg);
    return null;
  }
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
