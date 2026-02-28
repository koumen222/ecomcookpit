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
  const blob = new Blob([fileBuffer]);
  form.append('file', blob, filename);
  
  // Add metadata as JSON string
  if (Object.keys(metadata).length > 0) {
    form.append('metadata', JSON.stringify(metadata));
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`
        },
        body: form
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.success) {
      const detail = payload?.errors?.[0]?.message || `HTTP ${response.status}`;
      const err = new Error(`Cloudflare upload failed: ${detail}`);
      err.status = response.status;
      throw err;
    }

    const result = payload.result;
    
    return {
      id: result.id,
      url: result.variants?.[0] || `https://imagedelivery.net/${ACCOUNT_ID}/${result.id}/public`,
      variants: result.variants || []
    };

  } catch (error) {
    console.error('❌ Cloudflare Images upload error:', error.message);
    if (error.status) console.error('   Status:', error.status);
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
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`
        }
      }
    );

    const payload = await response.json();
    return Boolean(response.ok && payload?.success);

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
