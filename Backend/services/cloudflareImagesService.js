/**
 * Cloudflare Images Service
 * 
 * Handles direct image uploads to Cloudflare Images API.
 * 
 * Prerequisites:
 * - CLOUDFLARE_ACCOUNT_ID (from Cloudflare dashboard)
 * - CLOUDFLARE_API_TOKEN (with Cloudflare Images:Edit permission)
 * 
 * Cloudflare Images provides:
 * - Automatic format optimization (WebP, AVIF)
 * - Resizing via URL parameters (width, height, fit)
 * - Global CDN delivery
 * - 100,000 images free tier
 * 
 * Docs: https://developers.cloudflare.com/images/
 */

import axios from 'axios';
import FormData from 'form-data';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

/**
 * Upload an image to Cloudflare Images
 * 
 * @param {Buffer|Stream} fileBuffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {Object} metadata - Optional metadata (productId, workspaceId, etc.)
 * @returns {Promise<{id: string, url: string, variants: string[]}>}
 */
export async function uploadImage(fileBuffer, filename, metadata = {}) {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error('Cloudflare Images not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN');
  }

  const form = new FormData();
  form.append('file', fileBuffer, { filename });
  
  // Add metadata as JSON string
  if (Object.keys(metadata).length > 0) {
    form.append('metadata', JSON.stringify(metadata));
  }

  try {
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${API_TOKEN}`
        },
        maxBodyLength: 10 * 1024 * 1024, // 10MB max
        maxContentLength: 10 * 1024 * 1024
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.errors?.[0]?.message || 'Cloudflare upload failed');
    }

    const result = response.data.result;
    
    return {
      id: result.id,
      url: result.variants?.[0] || `https://imagedelivery.net/${ACCOUNT_ID}/${result.id}/public`,
      variants: result.variants || []
    };

  } catch (error) {
    console.error('❌ Cloudflare Images upload error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw new Error(`Image upload failed: ${error.message}`);
  }
}

/**
 * Get optimized image URL with transformation parameters
 * 
 * @param {string} imageId - Cloudflare image ID
 * @param {Object} options - Transformation options
 * @param {number} options.width - Resize width
 * @param {number} options.height - Resize height
 * @param {string} options.fit - 'cover', 'contain', 'fill', 'inside', 'outside'
 * @param {string} options.format - 'auto', 'webp', 'avif', 'jpeg'
 * @returns {string}
 */
export function getImageUrl(imageId, options = {}) {
  if (!ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID not configured');
  }

  const { width, height, fit = 'cover', format = 'auto' } = options;
  
  // Build transformation string
  let transform = '';
  if (width) transform += `width=${width},`;
  if (height) transform += `height=${height},`;
  if (fit) transform += `fit=${fit},`;
  if (format && format !== 'auto') transform += `format=${format},`;
  
  // Remove trailing comma
  transform = transform.replace(/,$/, '');
  
  const variant = transform || 'public';
  
  return `https://imagedelivery.net/${ACCOUNT_ID}/${imageId}/${variant}`;
}

/**
 * Delete an image from Cloudflare Images
 * 
 * @param {string} imageId - Cloudflare image ID
 */
export async function deleteImage(imageId) {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error('Cloudflare Images not configured');
  }

  try {
    const response = await axios.delete(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1/${imageId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      }
    );

    return response.data.success;

  } catch (error) {
    console.error('❌ Cloudflare Images delete error:', error.message);
    throw new Error(`Image delete failed: ${error.message}`);
  }
}

/**
 * Check if Cloudflare Images is configured
 */
export function isConfigured() {
  return !!(ACCOUNT_ID && API_TOKEN);
}

export default {
  uploadImage,
  getImageUrl,
  deleteImage,
  isConfigured
};
