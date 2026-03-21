/**
 * NanoBanana API Service
 * Alternative to DALL-E for image generation
 */

import axios from 'axios';

const NANOBANANA_API_URL = 'https://api.nanobananaapi.ai/api/v1/nanobanana';
const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY;

/**
 * Generate image using NanoBanana API (text-to-image)
 * @param {string} prompt - Text description of the image
 * @param {string} aspectRatio - Image aspect ratio (default: "1:1")
 * @param {number} numImages - Number of images to generate (1-4)
 * @returns {Promise<string|null>} - Base64 image data URL or null
 */
export async function generateNanoBananaImage(prompt, aspectRatio = '1:1', numImages = 1) {
  if (!NANOBANANA_API_KEY) {
    throw new Error('NanoBanana API key not configured');
  }
  
  try {
    console.log('🎨 Generating image with NanoBanana API...');
    
    const response = await axios.post(`${NANOBANANA_API_URL}/generate`, {
      prompt: prompt.slice(0, 4000), // Limit prompt length
      numImages,
      type: 'TEXTTOIAMGE', // Text to Image generation
      image_size: aspectRatio,
      watermark: 'NanoBanana'
    }, {
      headers: {
        'Authorization': `Bearer ${NANOBANANA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.data?.code === 200 && response.data?.data?.taskId) {
      const taskId = response.data.data.taskId;
      console.log(`✅ NanoBanana task created: ${taskId}`);
      
      // Poll for task completion
      const result = await pollNanoBananaTask(taskId);
      return result;
    } else {
      throw new Error(`NanoBanana API error: ${response.data?.msg || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ NanoBanana API error:', error.message);
    return null;
  }
}

/**
 * Poll task status until completion
 * @param {string} taskId - Task ID to poll
 * @param {number} maxAttempts - Maximum polling attempts
 * @param {number} interval - Polling interval in ms
 * @returns {Promise<string|null>} - Base64 image data URL or null
 */
async function pollNanoBananaTask(taskId, maxAttempts = 30, interval = 2000) {
  console.log(`⏳ Polling NanoBanana task ${taskId}...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${NANOBANANA_API_URL}/record-info`, {
        headers: {
          'Authorization': `Bearer ${NANOBANANA_API_KEY}`
        },
        params: {
          taskId: taskId
        },
        timeout: 10000
      });

      const task = response.data?.data;
      if (!task) {
        throw new Error('Invalid task response');
      }

      console.log(`📊 Task ${taskId} successFlag: ${task.successFlag} (attempt ${attempt}/${maxAttempts})`);

      if (task.successFlag === 1 && task.response?.resultImageUrl) {
        const imageUrl = task.response.resultImageUrl;
        console.log(`✅ NanoBanana image generated: ${imageUrl}`);
        
        // Download and convert to base64
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 15000
        });
        const base64 = Buffer.from(imageResponse.data).toString('base64');
        return `data:image/png;base64,${base64}`;
      }

      if (task.successFlag === 0 || task.errorCode !== 0) {
        throw new Error(`Task failed: ${task.errorMessage || 'Unknown error'}`);
      }

      // Wait before next poll
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      console.error(`❌ Polling attempt ${attempt} failed:`, error.message);
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Task ${taskId} did not complete within ${maxAttempts} attempts`);
}

/**
 * Generate image using NanoBanana API (image-to-image)
 * @param {string} prompt - Text description of the desired edit/transformation
 * @param {string|Buffer} imageInput - Base64 image data or image buffer
 * @param {string} aspectRatio - Image aspect ratio (default: "1:1")
 * @param {number} numImages - Number of images to generate (1-4)
 * @returns {Promise<string|null>} - Base64 image data URL or null
 */
export async function generateNanoBananaImageToImage(prompt, imageInput, aspectRatio = '1:1', numImages = 1) {
  if (!NANOBANANA_API_KEY) {
    throw new Error('NanoBanana API key not configured');
  }
  
  try {
    console.log('🎨 Generating image-to-image with NanoBanana API...');
    
    // Convert image to base64 if it's a buffer
    let base64Image;
    if (Buffer.isBuffer(imageInput)) {
      base64Image = imageInput.toString('base64');
    } else if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
      // Extract base64 from data URL
      base64Image = imageInput.split(',')[1];
    } else {
      base64Image = imageInput;
    }
    
    // Upload image to get a URL (NanoBanana needs URLs for image-to-image)
    const imageUrl = await uploadImageToTempUrl(base64Image);
    
    const response = await axios.post(`${NANOBANANA_API_URL}/generate`, {
      prompt: prompt.slice(0, 4000), // Limit prompt length
      numImages,
      type: 'IMAGETOIAMGE', // Image to Image generation
      image_size: aspectRatio,
      imageUrls: [imageUrl], // Array of input image URLs
      watermark: 'NanoBanana'
    }, {
      headers: {
        'Authorization': `Bearer ${NANOBANANA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.data?.code === 200 && response.data?.data?.taskId) {
      const taskId = response.data.data.taskId;
      console.log(`✅ NanoBanana image-to-image task created: ${taskId}`);
      
      // Poll for task completion
      const result = await pollNanoBananaTask(taskId);
      return result;
    } else {
      throw new Error(`NanoBanana API error: ${response.data?.msg || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ NanoBanana image-to-image API error:', error.message);
    return null;
  }
}

/**
 * Upload image to temporary hosting service for NanoBanana
 * @param {string} base64Image - Base64 image data
 * @returns {Promise<string>} - Image URL
 */
async function uploadImageToTempUrl(base64Image) {
  try {
    // For now, we'll use a temporary solution - in production, you might want to use
    // a service like Imgur, Cloudinary, or your own temporary storage
    // For this example, we'll simulate by uploading to R2 first
    
    // Import the upload function
    const { uploadImage } = await import('./cloudflareImagesService.js');
    
    // Create a temporary filename
    const tempFilename = `temp-nanobanana-${Date.now()}.jpg`;
    
    // Upload to R2
    const result = await uploadImage(
      Buffer.from(base64Image, 'base64'),
      tempFilename,
      {
        workspaceId: 'nanobanana-temp',
        uploadedBy: 'nanobanana-service',
        mimeType: 'image/jpeg'
      }
    );
    
    if (!result?.url) {
      throw new Error('Failed to upload temporary image');
    }
    
    console.log(`📤 Temporary image uploaded: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('❌ Failed to upload temporary image:', error.message);
    throw error;
  }
}

/**
 * Check NanoBanana API credits
 * @returns {Promise<Object>} - Account credits info
 */
export async function getNanoBananaCredits() {
  if (!NANOBANANA_API_KEY) {
    return { credits: 0, error: 'NanoBanana API key not configured' };
  }
  
  try {
    const response = await axios.get(`${NANOBANANA_API_URL}/record-info`, {
      headers: {
        'Authorization': `Bearer ${NANOBANANA_API_KEY}`
      },
      timeout: 10000
    });

    return response.data?.data || { credits: 0 };
  } catch (error) {
    console.error('❌ Failed to get NanoBanana credits:', error.message);
    return { credits: 0 };
  }
}
