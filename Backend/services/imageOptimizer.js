import sharp from 'sharp';

/**
 * Image Optimization Service
 * Converts images to WebP and compresses them for better performance
 */
class ImageOptimizer {
  constructor() {
    this.quality = 80; // Good balance between quality and size
    this.maxWidth = 600; // Maximum width for large images
    this.maxHeight = 400; // Maximum height for large images
    this.thumbnailSize = 300; // Size for product thumbnails
  }

  /**
   * Optimize an image buffer
   * @param {Buffer} inputBuffer - Original image buffer
   * @param {Object} options - Optimization options
   * @returns {Promise<Buffer>} Optimized image buffer
   */
  async optimizeImage(inputBuffer, options = {}) {
    const {
      width = this.maxWidth,
      height = this.maxHeight,
      quality = this.quality,
      format = 'webp',
      isThumbnail = false
    } = options;

    try {
      let sharpInstance = sharp(inputBuffer);

      // Get image metadata
      const metadata = await sharpInstance.metadata();
      
      // Resize if needed
      if (isThumbnail) {
        sharpInstance = sharpInstance.resize(this.thumbnailSize, this.thumbnailSize, {
          fit: 'cover',
          position: 'center'
        });
      } else {
        // Only resize if image is larger than max dimensions
        if (metadata.width > width || metadata.height > height) {
          sharpInstance = sharpInstance.resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }

      // Convert to WebP with compression
      const optimizedBuffer = await sharpInstance
        .webp({ 
          quality,
          effort: 4, // High compression effort
          smartSubsample: true
        })
        .toBuffer();

      console.log(`🖼️  Image optimized: ${(inputBuffer.length / 1024 / 1024).toFixed(2)}MB → ${(optimizedBuffer.length / 1024 / 1024).toFixed(2)}MB (${((1 - optimizedBuffer.length / inputBuffer.length) * 100).toFixed(1)}% reduction)`);

      return optimizedBuffer;
    } catch (error) {
      console.error('❌ Image optimization failed:', error);
      throw new Error('Failed to optimize image');
    }
  }

  /**
   * Optimize product image (thumbnail size)
   * @param {Buffer} inputBuffer - Original image buffer
   * @returns {Promise<Buffer>} Optimized thumbnail buffer
   */
  async optimizeProductImage(inputBuffer) {
    return this.optimizeImage(inputBuffer, {
      isThumbnail: true,
      quality: 85
    });
  }

  /**
   * Optimize banner/hero image
   * @param {Buffer} inputBuffer - Original image buffer
   * @returns {Promise<Buffer>} Optimized banner buffer
   */
  async optimizeBannerImage(inputBuffer) {
    return this.optimizeImage(inputBuffer, {
      width: 1200,
      height: 400,
      quality: 75
    });
  }

  /**
   * Get image metadata without processing
   * @param {Buffer} inputBuffer - Image buffer
   * @returns {Promise<Object>} Image metadata
   */
  async getImageMetadata(inputBuffer) {
    try {
      const metadata = await sharp(inputBuffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: inputBuffer.length,
        hasAlpha: metadata.hasAlpha,
        density: metadata.density
      };
    } catch (error) {
      console.error('❌ Failed to get image metadata:', error);
      throw new Error('Invalid image format');
    }
  }

  /**
   * Generate multiple sizes for responsive images
   * @param {Buffer} inputBuffer - Original image buffer
   * @returns {Promise<Object>} Object with different sizes
   */
  async generateResponsiveImages(inputBuffer) {
    const sizes = {
      small: 400,
      medium: 800,
      large: 1200
    };

    const results = {};

    for (const [name, width] of Object.entries(sizes)) {
      try {
        const optimized = await this.optimizeImage(inputBuffer, {
          width,
          height: width * 0.75, // 4:3 aspect ratio
          quality: name === 'large' ? 75 : 80
        });
        results[name] = optimized;
      } catch (error) {
        console.error(`❌ Failed to generate ${name} size:`, error);
      }
    }

    return results;
  }
}

export default new ImageOptimizer();
