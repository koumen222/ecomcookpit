import express from 'express';
import multer from 'multer';
import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, R2_CONFIG, getR2PublicUrl } from '../config/r2.js';
import { randomUUID } from 'crypto';
import path from 'path';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// Allowed MIME types for messaging
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/wav', 'audio/m4a', 'audio/x-m4a'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             'text/plain', 'text/csv']
};

const ALL_ALLOWED_TYPES = Object.values(ALLOWED_MIME_TYPES).flat();

// Max file sizes by type (in bytes)
const MAX_SIZES = {
  image: 10 * 1024 * 1024,    // 10MB
  audio: 25 * 1024 * 1024,    // 25MB
  video: 100 * 1024 * 1024,   // 100MB
  document: 25 * 1024 * 1024  // 25MB
};

// Determine media kind from MIME type
function getMediaKind(mimeType) {
  for (const [kind, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mimeType)) return kind;
  }
  return null;
}

// Memory storage for multer (we'll stream to R2)
const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    if (ALL_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
    }
  }
});

/**
 * POST /api/ecom/media/presign
 * Get a presigned URL for direct upload to R2
 * Client uploads directly to storage, then calls /confirm
 */
router.post('/presign', requireEcomAuth, async (req, res) => {
  try {
    const { kind, mimeType, size, fileName } = req.body;
    
    if (!kind || !mimeType) {
      return res.status(400).json({ success: false, message: 'kind et mimeType requis' });
    }
    
    // Validate kind
    if (!ALLOWED_MIME_TYPES[kind]) {
      return res.status(400).json({ success: false, message: 'Type de média invalide' });
    }
    
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES[kind].includes(mimeType)) {
      return res.status(400).json({ success: false, message: `Type MIME non autorisé pour ${kind}` });
    }
    
    // Validate size
    if (size && size > MAX_SIZES[kind]) {
      return res.status(400).json({ 
        success: false, 
        message: `Fichier trop volumineux. Max: ${MAX_SIZES[kind] / (1024 * 1024)}MB` 
      });
    }
    
    // Generate storage key
    const userId = req.ecomUser._id.toString();
    const workspaceId = req.workspaceId.toString();
    const ext = fileName ? path.extname(fileName) : `.${mimeType.split('/')[1]}`;
    const storageKey = `ecom/${workspaceId}/messages/${kind}/${randomUUID()}${ext}`;
    
    // Generate presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: storageKey,
      ContentType: mimeType,
      Metadata: {
        uploadedBy: userId,
        workspaceId: workspaceId,
        kind: kind,
        originalName: fileName || 'unknown'
      }
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    
    res.json({
      success: true,
      uploadUrl,
      storageKey,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Erreur POST /media/presign:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /api/ecom/media/confirm
 * Confirm upload and get public URL
 */
router.post('/confirm', requireEcomAuth, async (req, res) => {
  try {
    const { storageKey, kind, metadata = {} } = req.body;
    
    if (!storageKey) {
      return res.status(400).json({ success: false, message: 'storageKey requis' });
    }
    
    // Get public URL
    const publicUrl = getR2PublicUrl(storageKey);
    
    // Generate a media ID (the storage key serves as the ID)
    const mediaId = storageKey;
    
    res.json({
      success: true,
      mediaId,
      mediaUrl: publicUrl,
      storageKey,
      kind: kind || getMediaKind(metadata.mimeType) || 'document'
    });
  } catch (error) {
    console.error('Erreur POST /media/confirm:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /api/ecom/media/upload
 * Direct upload endpoint (alternative to presign flow)
 * For smaller files or when presign is not practical
 */
router.post('/upload', requireEcomAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fichier requis' });
    }
    
    const file = req.file;
    const kind = getMediaKind(file.mimetype);
    
    if (!kind) {
      return res.status(400).json({ success: false, message: 'Type de fichier non supporté' });
    }
    
    // Check size limit
    if (file.size > MAX_SIZES[kind]) {
      return res.status(413).json({ 
        success: false, 
        message: `Fichier trop volumineux. Max: ${MAX_SIZES[kind] / (1024 * 1024)}MB` 
      });
    }
    
    const userId = req.ecomUser._id.toString();
    const workspaceId = req.workspaceId.toString();
    const ext = path.extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
    const storageKey = `ecom/${workspaceId}/messages/${kind}/${randomUUID()}${ext}`;
    
    // Upload to R2
    const uploadCmd = new Upload({
      client: s3Client,
      params: {
        Bucket: R2_CONFIG.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          uploadedBy: userId,
          workspaceId: workspaceId,
          kind: kind,
          originalName: file.originalname
        }
      }
    });
    
    await uploadCmd.done();
    
    const publicUrl = getR2PublicUrl(storageKey);
    
    res.json({
      success: true,
      mediaId: storageKey,
      mediaUrl: publicUrl,
      storageKey,
      kind,
      metadata: {
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size
      }
    });
  } catch (error) {
    console.error('Erreur POST /media/upload:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /api/ecom/media/signed-url/:key
 * Get a signed URL for private media access (with expiration)
 */
router.get('/signed-url/*', requireEcomAuth, async (req, res) => {
  try {
    const storageKey = req.params[0];
    
    if (!storageKey) {
      return res.status(400).json({ success: false, message: 'Clé de stockage requise' });
    }
    
    // Verify the key belongs to the user's workspace
    const workspaceId = req.workspaceId.toString();
    if (!storageKey.startsWith(`ecom/${workspaceId}/`)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }
    
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: storageKey
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    
    res.json({
      success: true,
      signedUrl,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Erreur GET /media/signed-url:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Fichier trop volumineux' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

export default router;
