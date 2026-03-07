import express from 'express';
import multer from 'multer';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import cloudflareImagesService from '../services/cloudflareImagesService.js';

const router = express.Router();

// Configuration multer pour stocker les fichiers en mémoire
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter images et audio
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/m4a'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez des images (JPG, PNG, GIF, WebP) ou des fichiers audio (MP3, OGG, WAV, M4A)'));
    }
  }
});

/**
 * POST /api/ecom/media/upload
 * Upload d'image ou audio pour les campagnes marketing
 */
router.post('/upload', requireEcomAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const mediaType = mimetype.startsWith('image/') ? 'image' : 'audio';

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = originalname.split('.').pop();
    const fileName = `campaign-${mediaType}-${timestamp}-${randomStr}.${ext}`;

    // Upload vers Cloudflare R2
    const uploadResult = await cloudflareImagesService.uploadToR2(buffer, fileName, mimetype);

    if (!uploadResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: uploadResult.error || 'Erreur lors de l\'upload du fichier' 
      });
    }

    res.json({
      success: true,
      data: {
        url: uploadResult.url,
        fileName: fileName,
        type: mediaType,
        size: buffer.length,
        originalName: originalname
      }
    });
  } catch (error) {
    console.error('Erreur upload média:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erreur lors de l\'upload' 
    });
  }
});

/**
 * DELETE /api/ecom/media/:fileName
 * Suppression d'un média uploadé
 */
router.delete('/:fileName', requireEcomAuth, async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName || !fileName.startsWith('campaign-')) {
      return res.status(400).json({ success: false, message: 'Nom de fichier invalide' });
    }

    const deleteResult = await cloudflareImagesService.deleteFromR2(fileName);

    if (!deleteResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: deleteResult.error || 'Erreur lors de la suppression' 
      });
    }

    res.json({ success: true, message: 'Fichier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression média:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la suppression' 
    });
  }
});

export default router;
