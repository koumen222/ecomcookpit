import express from 'express';
import multer from 'multer';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import cloudflareImagesService from '../services/cloudflareImagesService.js';
import imageOptimizer from '../services/imageOptimizer.js';

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
    const ext = originalname.split('.').pop().toLowerCase();

    let optimizedBuffer = buffer;
    let originalSize = buffer.length;
    let finalFileName;
    let finalMimetype;

    if (mediaType === 'image') {
      // Images: optimize and convert to webp
      finalFileName = `campaign-image-${timestamp}-${randomStr}.webp`;
      finalMimetype = 'image/webp';

      try {
        const isProductImage = req.body.context === 'product';
        const isBannerImage = req.body.context === 'banner';
        
        if (isProductImage) {
          optimizedBuffer = await imageOptimizer.optimizeProductImage(buffer);
        } else if (isBannerImage) {
          optimizedBuffer = await imageOptimizer.optimizeBannerImage(buffer);
        } else {
          optimizedBuffer = await imageOptimizer.optimizeImage(buffer);
        }
        
        console.log(`🖼️  Image optimized: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(optimizedBuffer.length / 1024 / 1024).toFixed(2)}MB (${((1 - optimizedBuffer.length / originalSize) * 100).toFixed(1)}% reduction)`);
      } catch (error) {
        console.warn('⚠️  Image optimization failed, uploading original:', error.message);
      }
    } else {
      // Audio: keep original format and mimetype
      const audioExt = ['mp3', 'ogg', 'wav', 'm4a', 'mp4'].includes(ext) ? ext : 'mp3';
      finalFileName = `campaign-audio-${timestamp}-${randomStr}.${audioExt}`;
      finalMimetype = mimetype;
      console.log(`🎵 Audio upload: ${originalname} (${mimetype}, ${(originalSize / 1024).toFixed(1)}KB)`);
    }

    // Upload vers Cloudflare R2
    const uploadResult = await cloudflareImagesService.uploadToR2(optimizedBuffer, finalFileName, finalMimetype);

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
        fileName: finalFileName,
        type: mediaType,
        size: optimizedBuffer.length,
        originalSize: originalSize,
        compressionRatio: originalSize !== optimizedBuffer.length ? ((1 - optimizedBuffer.length / originalSize) * 100).toFixed(1) : 0,
        format: mediaType === 'image' ? 'webp' : ext,
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
