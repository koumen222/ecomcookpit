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
import { randomUUID } from 'crypto';
import path from 'path';

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
  const ext = path.extname(filename) || '.jpg';
  const storageKey = `ecom/${workspaceId}/store/products/${randomUUID()}${ext}`;

  // Normalize extension to valid MIME type (jpg → jpeg)
  const extNorm = ext.replace('.', '').toLowerCase();
  const mimeType = metadata.mimeType
    || `image/${extNorm === 'jpg' ? 'jpeg' : extNorm || 'jpeg'}`;

  const uploader = new Upload({
    client: s3Client,
    params: {
      Bucket: R2_CONFIG.bucket,
      Key: storageKey,
      Body: fileBuffer,
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
    key: storageKey
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
 * Check if R2 is configured
 */
export function isConfigured() {
  return !!(R2_CONFIG.bucket && R2_CONFIG.accountId);
}

export default {
  uploadImage,
  getImageUrl,
  deleteImage,
  isConfigured
};
