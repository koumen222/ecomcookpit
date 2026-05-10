/**
 * Product Image Upload Service — Cloudflare R2
 * 
 * Uploads product images to Cloudflare R2 (S3-compatible).
 * Uses the same s3Client/R2_CONFIG already configured for media uploads.
 * 
 * Storage path: ecom/{workspaceId}/store/products/{uuid}.{ext}
 * Public URL:   R2_PUBLIC_URL/{key}  (e.g. https://pub-xxx.r2.dev/...)
 */

import { Upload } from '@aws-sdk/lib-storage';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, R2_CONFIG, getR2PublicUrl } from '../config/r2.js';
import imageOptimizer from './imageOptimizer.js';
import { randomUUID } from 'crypto';
import path from 'path';

function getOptimizationOptions(filename, metadata = {}, mimeType = '') {
  const extNorm = path.extname(filename).replace('.', '').toLowerCase();
  const lowerMimeType = String(mimeType || '').toLowerCase();
  const isRasterImage = lowerMimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(extNorm);
  const isUnsupportedAnimatedOrVector = extNorm === 'gif' || extNorm === 'svg' || lowerMimeType.includes('gif') || lowerMimeType.includes('svg');

  if (!isRasterImage || isUnsupportedAnimatedOrVector || metadata.optimize === false) {
    return null;
  }

  return {
    width: metadata.width || metadata.maxWidth || 1200,
    height: metadata.height || metadata.maxHeight || 1200,
    quality: metadata.quality || 82,
  };
}

/**
 * Upload a product image to Cloudflare R2
 *
 * @param {Buffer} fileBuffer - Image file buffer (from multer memoryStorage)
 * @param {string} filename - Original filename (used for extension)
 * @param {Object} metadata - { workspaceId, uploadedBy, ... }
 * @returns {Promise<{ id: string, url: string, key: string }>}
 */
export async function uploadImage(fileBuffer, filename, metadata = {}) {
  if (!isConfigured()) {
    throw new Error('R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  }

  const workspaceId = metadata.workspaceId || 'unknown';
  let ext = path.extname(filename) || '.jpg';

  let extNorm = ext.replace('.', '').toLowerCase();
  let mimeType = metadata.mimeType
    || `image/${extNorm === 'jpg' ? 'jpeg' : extNorm || 'jpeg'}`;
  let uploadBuffer = fileBuffer;

  const optimizationOptions = getOptimizationOptions(filename, metadata, mimeType);
  if (optimizationOptions) {
    try {
      uploadBuffer = await imageOptimizer.optimizeImage(fileBuffer, optimizationOptions);
      ext = '.webp';
      extNorm = 'webp';
      mimeType = 'image/webp';
    } catch (error) {
      console.warn('⚠️ Image optimization skipped:', error.message);
    }
  }

  const storageKey = `ecom/${workspaceId}/store/products/${randomUUID()}${ext}`;

  const uploader = new Upload({
    client: s3Client,
    params: {
      Bucket: R2_CONFIG.bucket,
      Key: storageKey,
      Body: uploadBuffer,
      ContentType: mimeType,
      Metadata: {
        uploadedBy: String(metadata.uploadedBy || ''),
        workspaceId: workspaceId,
        originalName: filename
      }
    }
  });

  await uploader.done();

  const publicUrl = getR2PublicUrl(storageKey);

  return {
    id: storageKey,
    url: publicUrl,
    key: storageKey,
    filename: path.basename(storageKey),
    contentType: mimeType,
    size: uploadBuffer.length
  };
}

/**
 * Get the public URL of a stored image by its storage key
 *
 * @param {string} storageKey - R2 object key
 * @returns {string}
 */
export function getImageUrl(storageKey) {
  return getR2PublicUrl(storageKey);
}

/**
 * Delete a product image from R2
 *
 * @param {string} storageKey - R2 object key (the `id` returned by uploadImage)
 */
export async function deleteImage(storageKey) {
  if (!isConfigured()) {
    throw new Error('R2 not configured');
  }

  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: storageKey
    }));
    return true;
  } catch (error) {
    console.error('❌ R2 delete error:', error.message);
    throw new Error(`Image delete failed: ${error.message}`);
  }
}

/**
 * Upload media file (image or audio) to R2 for campaigns
 * 
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name with extension
 * @param {string} mimeType - MIME type (e.g., 'image/jpeg', 'audio/mp3')
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
export async function uploadToR2(fileBuffer, fileName, mimeType) {
  if (!isConfigured()) {
    return { success: false, error: 'R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME' };
  }

  try {
    const storageKey = `ecom/campaigns/media/${fileName}`;

    const uploader = new Upload({
      client: s3Client,
      params: {
        Bucket: R2_CONFIG.bucket,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
          originalName: fileName
        }
      }
    });

    await uploader.done();
    const publicUrl = getR2PublicUrl(storageKey);

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('❌ R2 upload error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete media file from R2
 * 
 * @param {string} fileName - File name to delete
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteFromR2(fileName) {
  if (!isConfigured()) {
    return { success: false, error: 'R2 not configured' };
  }

  try {
    const storageKey = `ecom/campaigns/media/${fileName}`;
    
    await s3Client.send(new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: storageKey
    }));
    
    return { success: true };
  } catch (error) {
    console.error('❌ R2 delete error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check if R2 is configured
 */
export function isConfigured() {
  return !!(R2_CONFIG.bucket && R2_CONFIG.accountId);
}

export default {
  uploadImage,
  getImageUrl,
  deleteImage,
  uploadToR2,
  deleteFromR2,
  isConfigured
};
