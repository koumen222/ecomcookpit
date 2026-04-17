/**
 * Product Page Generator Route
 * POST /api/ai/product-generator
 *
 * Architecture simple & fiable :
 * 1. Scrape title + description (minimal)
 * 2. Clean text
 * 3. GPT → JSON structuré (angles, raisons, FAQ, description, prompts affiches)
 * 4. Parse JSON
 * 5. Loop angles → generate 5 affiches publicitaires (1 par angle marketing)
 * 6. Assemble product page
 */

import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import axios from 'axios';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { analyzeWithVision, generateDescriptionGifFromImages, generatePosterImage } from '../services/productPageGeneratorService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { extractProductInfo } from '../services/geminiProductExtractor.js';
import EcomWorkspace from '../models/Workspace.js';
import FeatureUsageLog from '../models/FeatureUsageLog.js';
import GenerationTask from '../models/GenerationTask.js';
import GenerationPricingConfig from '../models/GenerationPricingConfig.js';

const router = express.Router();

// ─── In-memory store for async image generation jobs (legacy + cache) ─────────
const imageJobs = new Map();
const JOB_TTL = 30 * 60 * 1000; // 30min
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of imageJobs) {
    if (now - job.createdAt > JOB_TTL) imageJobs.delete(id);
  }
}, 5 * 60 * 1000);

// ─── Helper: save task progress to MongoDB (fire-and-forget) ──────────────────
async function updateTask(taskId, updates) {
  if (!taskId) return;
  try {
    await GenerationTask.findByIdAndUpdate(taskId, { $set: updates });
  } catch (e) {
    console.warn('[Task] Update failed:', e.message);
  }
}

function buildTaskImagesPayload(imageData = {}) {
  return {
    heroImage: imageData.heroImage || null,
    heroPosterImage: imageData.heroPosterImage || null,
    beforeAfterImage: imageData.beforeAfterImage || null,
    beforeAfterImages: Array.isArray(imageData.beforeAfterImages) ? imageData.beforeAfterImages.filter(Boolean) : [],
    angles: Array.isArray(imageData.angles) ? imageData.angles.filter(Boolean) : [],
    peoplePhotos: Array.isArray(imageData.peoplePhotos) ? imageData.peoplePhotos.filter(Boolean) : [],
    socialProofImages: Array.isArray(imageData.socialProofImages) ? imageData.socialProofImages.filter(Boolean) : [],
    descriptionGifs: Array.isArray(imageData.descriptionGifs)
      ? imageData.descriptionGifs.filter((entry) => entry?.url)
      : [],
  };
}

function mergeTaskProductWithImages(task = {}) {
  const imgs = buildTaskImagesPayload(task.images || {});
  const product = task.product ? { ...task.product } : null;
  if (!product) return null;

  if (imgs.heroImage) product.heroImage = imgs.heroImage;
  if (imgs.heroPosterImage) product.heroPosterImage = imgs.heroPosterImage;
  if (imgs.beforeAfterImage) product.beforeAfterImage = imgs.beforeAfterImage;
  if (imgs.beforeAfterImages.length) product.beforeAfterImages = imgs.beforeAfterImages;
  if (imgs.descriptionGifs.length) product.descriptionGifs = imgs.descriptionGifs;
  if (imgs.peoplePhotos.length) product.peoplePhotos = imgs.peoplePhotos;
  if (imgs.socialProofImages.length) product.socialProofImages = imgs.socialProofImages;

  if (imgs.angles.length) {
    product.angles = (product.angles || []).map((angle, index) => {
      const generatedAngle = imgs.angles.find((entry) => entry.index === index + 1);
      return generatedAngle
        ? { ...angle, poster_url: generatedAngle.poster_url, flashType: generatedAngle.flashType || angle?.flashType || null }
        : angle;
    });
  }

  const allImages = [
    ...(imgs.peoplePhotos || []),
    ...(imgs.heroImage ? [imgs.heroImage] : []),
    ...(imgs.heroPosterImage ? [imgs.heroPosterImage] : []),
    ...(imgs.beforeAfterImages || []),
    ...((product.angles || []).map((angle) => angle.poster_url).filter(Boolean)),
  ];
  product.allImages = [...new Set([...(product.allImages || []), ...allImages])];
  return product;
}

function buildTaskImageSnapshot(imageResults = []) {
  const beforeAfterImages = imageResults
    .filter((entry) => entry?.type === 'before_after')
    .sort((left, right) => (left?.index ?? 0) - (right?.index ?? 0))
    .map((entry) => entry?.url)
    .filter(Boolean);

  const angles = imageResults
    .filter((entry) => entry?.type === 'poster')
    .sort((left, right) => (left?.index ?? 0) - (right?.index ?? 0))
    .map((entry) => ({
      ...entry?.angle,
      poster_url: entry?.url || null,
      index: (entry?.index ?? 0) + 1,
      flashType: entry?.flashType || null,
    }))
    .filter((entry) => entry?.poster_url);

  const peoplePhotos = imageResults
    .filter((entry) => entry?.type === 'people_photo')
    .sort((left, right) => (left?.index ?? 0) - (right?.index ?? 0))
    .map((entry) => entry?.url)
    .filter(Boolean);

  const heroImage = imageResults.find((entry) => entry?.type === 'hero')?.url || null;
  const heroPosterImage = angles.find((entry) => entry?.poster_url)?.poster_url || null;
  const socialProofImages = [...peoplePhotos, ...beforeAfterImages]
    .filter((url, index, array) => url && array.indexOf(url) === index)
    .slice(0, 3);

  return {
    heroImage,
    heroPosterImage,
    beforeAfterImage: beforeAfterImages[0] || null,
    beforeAfterImages,
    angles,
    peoplePhotos,
    socialProofImages,
  };
}

function applyImageSnapshotToJob(jobData, snapshot) {
  if (!jobData || !snapshot) return;
  if (snapshot.heroImage) jobData.heroImage = snapshot.heroImage;
  if (snapshot.beforeAfterImage) jobData.beforeAfterImage = snapshot.beforeAfterImage;
  if (snapshot.beforeAfterImages?.length) jobData.beforeAfterImages = snapshot.beforeAfterImages;
  if (snapshot.angles?.length) jobData.angles = snapshot.angles;
  if (snapshot.peoplePhotos?.length) jobData.peoplePhotos = snapshot.peoplePhotos;
  if (snapshot.socialProofImages?.length) jobData.socialProofImages = snapshot.socialProofImages;
  const heroPosterFromAngles = snapshot.heroPosterImage || snapshot.angles?.find((entry) => entry?.poster_url)?.poster_url || null;
  if (heroPosterFromAngles) jobData.heroPosterImage = heroPosterFromAngles;
}

async function resolveReferenceImageBuffer({ sourceBuffer = null, photoUrl = '', cleanUrl = '' } = {}) {
  if (sourceBuffer) {
    try {
      return await sharp(sourceBuffer)
        .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch (error) {
      console.warn('⚠️ Normalisation image échouée, utilisation du buffer brut:', error.message);
      return sourceBuffer;
    }
  }

  if (photoUrl) {
    try {
      const response = await axios.get(photoUrl, { responseType: 'arraybuffer', timeout: 10000, maxRedirects: 3 });
      return await sharp(Buffer.from(response.data))
        .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch (error) {
      console.warn('⚠️ Téléchargement photo de référence échoué:', error.message);
    }
  }

  if (cleanUrl) {
    try {
      const pageResponse = await axios.get(cleanUrl, {
        timeout: 12000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EcomBot/1.0)' },
        maxRedirects: 5,
        responseType: 'text',
      });
      const html = typeof pageResponse.data === 'string' ? pageResponse.data : '';
      const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
        || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      const ogImageUrl = imageMatch?.[1];
      if (!ogImageUrl) return null;

      const imageResponse = await axios.get(ogImageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EcomBot/1.0)' },
        maxRedirects: 3,
      });

      return await sharp(Buffer.from(imageResponse.data))
        .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch (error) {
      console.warn('⚠️ Extraction og:image échouée:', error.message);
    }
  }

  return null;
}

async function runBackgroundImageGeneration({
  taskId,
  workspaceId,
  userId,
  productData,
  visualTemplate,
  visualContext,
  approach,
  realPhotos = [],
  cleanUrl = '',
  sourceBuffer = null,
  imageJobId = null,
  existingImages = null,
}) {
  const jobData = {
    status: 'generating',
    progress: 0,
    total: 0,
    createdAt: Date.now(),
    ...buildTaskImagesPayload(existingImages || {}),
  };

  if (imageJobId) {
    imageJobs.set(imageJobId, jobData);
  }

  try {
    const baseImageBuffer = await resolveReferenceImageBuffer({
      sourceBuffer,
      photoUrl: realPhotos[0] || '',
      cleanUrl,
    });

    if (!baseImageBuffer) {
      const errorMessage = 'Aucune image produit fournie — impossible de générer en mode image-to-image';
      jobData.status = 'error';
      await updateTask(taskId, {
        status: 'error',
        currentStep: 'Échec partiel — contenu sauvegardé',
        errorMessage,
        images: buildTaskImagesPayload(jobData),
      });
      return;
    }

    const generateAndUpload = async (prompt, filename, mode = 'scene', aspectRatio = '4:5') => {
      if (!prompt) return null;

      const attempt = async () => {
        const generatedDataUrl = await generatePosterImage(prompt, baseImageBuffer, { mode, aspectRatio });
        if (!generatedDataUrl) throw new Error('generatePosterImage returned null');

        let imageBuffer;
        if (generatedDataUrl.startsWith('data:')) {
          imageBuffer = Buffer.from(generatedDataUrl.split(',')[1], 'base64');
        } else {
          const response = await axios.get(generatedDataUrl, { responseType: 'arraybuffer', timeout: 30000 });
          imageBuffer = Buffer.from(response.data);
        }

        const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number);
        const targetWidth = 1080;
        const targetHeight = Math.round(targetWidth * (ratioHeight / ratioWidth));
        imageBuffer = await sharp(imageBuffer)
          .resize(targetWidth, targetHeight, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 92 })
          .toBuffer();

        const uploaded = await uploadImage(imageBuffer, filename.replace(/\.[^.]+$/, '.jpg'), {
          workspaceId,
          uploadedBy: userId,
          mimeType: 'image/jpeg',
          optimize: false,
        });

        if (!uploaded?.url) throw new Error('Upload retourné sans URL');
        return uploaded.url;
      };

      const maxRetries = 5;
      for (let attemptIndex = 1; attemptIndex <= maxRetries; attemptIndex += 1) {
        try {
          return await attempt();
        } catch (error) {
          console.warn(`⚠️ Image ${filename} tentative ${attemptIndex}/${maxRetries} échouée: ${error.message}`);
          if (attemptIndex === maxRetries) {
            console.error(`❌ Image ${filename} abandonnée après ${maxRetries} tentatives`);
            return null;
          }
          const delay = Math.min(2000 * Math.pow(2, attemptIndex - 1), 60000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return null;
    };

    const imageTasks = [];
    const descriptionGifSpecs = buildDescriptionGifSpecs(productData);

    imageTasks.push(
      () => generateAndUpload(buildHeroPrompt(productData, true, visualTemplate, visualContext), `hero-${Date.now()}.png`, 'hero', productData.imageAspectRatio || '4:5')
        .then((url) => ({ type: 'hero', url }))
        .finally(() => { jobData.progress += 1; })
    );

    if (productData.prompt_avant_apres) {
      imageTasks.push(
        () => generateAndUpload(productData.prompt_avant_apres, `before-after-1-${Date.now()}.png`, 'before_after', '1:1')
          .then((url) => ({ type: 'before_after', index: 0, url }))
          .finally(() => { jobData.progress += 1; })
      );
    }

    imageTasks.push(
      () => generateAndUpload(buildSecondBeforeAfterPrompt(productData, visualContext), `before-after-2-${Date.now()}.png`, 'before_after', '1:1')
        .then((url) => ({ type: 'before_after', index: 1, url }))
        .finally(() => { jobData.progress += 1; })
    );

    const flashPrompts = buildFlashPrompts(productData, true, approach, visualTemplate, visualContext);
    const angles = productData.angles || [];
    for (let index = 0; index < flashPrompts.length; index += 1) {
      const flash = flashPrompts[index];
      const angle = angles[index] || null;
      const fallbackAngle = {
        titre_angle: flash?.type || `angle_${index + 1}`,
        explication: productData.benefits_bullets?.[index] || productData.hero_slogan || getMainBenefit(productData),
        promesse: productData.urgency_elements?.primary_urgency || productData.reassurance?.titre || getMainBenefit(productData),
      };
      const anglePrompt = index === 0
        ? buildBenefitsInfographicPrompt(productData, visualTemplate, visualContext)
        : (buildAngleImagePrompt(angle || fallbackAngle, productData, true, visualTemplate, index, visualContext, approach)
          || buildFlashFallbackPrompt(flash, angle || fallbackAngle, productData, visualTemplate, visualContext, approach, index));

      imageTasks.push(
        () => generateAndUpload(anglePrompt, `flash-${index + 1}-${Date.now()}.png`, 'scene', productData.imageAspectRatio || '4:5')
          .then((url) => ({ type: 'poster', index, url, angle, flashType: flash.type }))
          .finally(() => { jobData.progress += 1; })
      );
    }

    buildPeopleHoldingProductPrompts(productData, visualContext).forEach((peoplePrompt, index) => {
      imageTasks.push(
        () => generateAndUpload(peoplePrompt, `people-${index + 1}-${Date.now()}.png`, 'scene', '1:1')
          .then((url) => ({ type: 'people_photo', index, url }))
          .finally(() => { jobData.progress += 1; })
      );
    });

    const batchSize = 6;
    const batchDelayMs = 800;
    const imageResults = [];
    jobData.total = imageTasks.length + descriptionGifSpecs.length;

    for (let batchStart = 0; batchStart < imageTasks.length; batchStart += batchSize) {
      const batch = imageTasks.slice(batchStart, batchStart + batchSize);
      const batchNumber = Math.floor(batchStart / batchSize) + 1;
      const totalBatches = Math.ceil(imageTasks.length / batchSize);

      const batchResults = await Promise.allSettled(batch.map((factory) => factory()));
      batchResults.forEach((result) => {
        imageResults.push(result.status === 'fulfilled' ? result.value : null);
      });

      applyImageSnapshotToJob(jobData, buildTaskImageSnapshot(imageResults));

      const progressPercent = Math.min(95, Math.round((jobData.progress / jobData.total) * 100));
      await updateTask(taskId, {
        status: 'generating_images',
        progress: jobData.progress,
        totalImages: jobData.total,
        progressPercent,
        currentStep: `Images: batch ${batchNumber}/${totalBatches}`,
        errorMessage: null,
        images: buildTaskImagesPayload(jobData),
      });

      if (batchStart + batchSize < imageTasks.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    const descriptionGifImageGroups = [
      [jobData.heroImage, jobData.angles?.[0]?.poster_url, jobData.beforeAfterImages?.[0], jobData.angles?.[1]?.poster_url, realPhotos[0]],
      [jobData.heroPosterImage, jobData.angles?.[2]?.poster_url, jobData.beforeAfterImages?.[1] || jobData.beforeAfterImages?.[0], jobData.angles?.[3]?.poster_url],
    ].map((group) => group.filter(Boolean));

    const gifResults = await Promise.allSettled(descriptionGifSpecs.map((gifSpec, index) => (async () => {
      const sourceImages = descriptionGifImageGroups[index] || [];
      if (sourceImages.length < 2) return null;
      try {
        const url = await generateDescriptionGifFromImages(sourceImages, {
          width: 768,
          height: 432,
          fps: 8,
          frameDurationMs: 1200,
          filePrefix: `${gifSpec.key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        });
        return { url, key: gifSpec.key, title: gifSpec.title, order: index };
      } catch (error) {
        console.warn(`⚠️ GIF description ${gifSpec.key} échoué: ${error.message}`);
        return null;
      } finally {
        jobData.progress += 1;
      }
    })()));

    jobData.descriptionGifs = gifResults
      .map((result) => (result.status === 'fulfilled' ? result.value : null))
      .filter((entry) => entry?.url)
      .map((entry) => ({
        url: entry.url,
        type: 'direct',
        title: entry.title || (entry.key === 'usage-demo' ? 'GIF usage' : 'GIF résultat'),
        order: entry.order,
      }));

    jobData.status = 'done';
    await updateTask(taskId, {
      status: 'done',
      progress: jobData.progress,
      totalImages: jobData.total,
      progressPercent: 100,
      currentStep: 'Terminé',
      errorMessage: null,
      images: buildTaskImagesPayload(jobData),
    });
  } catch (error) {
    console.error('❌ [BG] Erreur génération images:', error.message);
    jobData.status = 'error';
    await updateTask(taskId, {
      status: 'error',
      progress: jobData.progress,
      totalImages: jobData.total,
      progressPercent: Math.max(40, Math.min(95, Math.round((jobData.progress / Math.max(jobData.total || 1, 1)) * 100))),
      currentStep: 'Échec partiel — contenu sauvegardé',
      errorMessage: error.message,
      images: buildTaskImagesPayload(jobData),
    });
  }
}

// ─── Image prompt builders ────────────────────────────────────────────────────

/**
 * Niche-based accent color for hero image
 */
function getNicheAccentColor(template) {
  const nicheColors = {
    health:  { color: 'natural green (#2E7D32)',  name: 'green',     mood: 'healthy, natural, organic' },
    beauty:  { color: 'rose gold / soft pink (#E91E63)', name: 'pink',  mood: 'luxurious, feminine, elegant' },
    tech:    { color: 'electric blue (#1565C0)',   name: 'blue',      mood: 'modern, innovative, trustworthy' },
    fashion: { color: 'elegant gold (#F59E0B)',    name: 'gold',      mood: 'premium, stylish, trendy' },
    home:    { color: 'warm amber (#EF6C00)',      name: 'amber',     mood: 'warm, cozy, reliable' },
    general: { color: 'vibrant coral (#FF5722)',   name: 'coral',     mood: 'energetic, bold, eye-catching' },
  };
  return nicheColors[template] || nicheColors.general;
}

function buildVisualPromptDirectives(visualPrefs = {}) {
  return '';
}

function getNicheDescriptionGraphicProfile(template = 'general') {
  const profiles = {
    beauty: {
      referenceMood: 'premium skincare, cosmetic editorial boards, luxury beauty campaign layouts, ingredient ritual storytelling',
      layoutFamilies: [
        'clean beauty composition with one central product, soft rounded skincare cards, ingredient macros and elegant efficacy callouts',
        'editorial beauty grid with portrait crop, product macro, texture panel and 2 to 3 premium benefit statements',
        'luxury ritual storyboard with top beauty promise, middle serum or cream close-up, bottom transformation or usage sequence',
        'refined split-screen with product hero on one side and skin result, ingredient or routine proof blocks on the other side',
        'premium cosmetic poster with glowing model, oversized product, soft gradient panels and trust-building callout chips',
      ],
      peopleRule: 'If a person is present, compose them like a real premium skincare or beauty campaign subject: clean crop, elegant posture, believable grooming, no awkward cutout layering',
      objectRule: 'If textures, drops or ingredients are shown, make them tactile, glossy and premium like a beauty brand visual board',
      extraRules: [
        'Prefer soft cosmetic gradients, refined white space and premium editorial balance rather than dense medical-looking boards',
      ],
    },
    health: {
      referenceMood: 'high-end supplement creatives, pharmacy-grade wellness boards, premium omega-3 and collagen campaign layouts, clean efficacy visuals, reassuring health campaign structure',
      layoutFamilies: [
        'central supplement jar or balm product with 3 to 4 rounded benefit cards around it, each tied to a concrete body result, body zone or active ingredient',
        'premium modular health board with capsules, spoons, leaves, honey, herbs or ingredient zones, body-benefit icons and one clear reassurance panel',
        'vertical supplement storyboard with top promise, middle ingredient or scientific proof section, lower usage guidance and bottom visible result section',
        'split healthcare composition mixing one large product shot with clean efficacy blocks, result icons, dosage guidance and natural active callouts',
        'conversion health poster with one dominant product, one authentic active person and several reassuring proof zones such as relief, mobility, vitality or anti-aging support',
      ],
      peopleRule: 'If a person is present, integrate them like a real wellness or supplement ad: healthy, credible, active, not theatrical and not like a random smiling stock portrait',
      objectRule: 'If ingredients, capsules or body zones are shown, present them clearly with a clean scientific-meets-natural logic, never as random decorative elements',
      extraRules: [
        'For supplements, gels, balms, oils, capsules or wellness products, the visual should strongly resemble a premium nutraceutical or pharmacy ad rather than a generic ecommerce collage',
        'Favor clean health-brand structures seen in top supplement creatives: hero packshot, ingredient proof tiles, body-zone benefit icons, dosage or routine strip, and one reassurance block',
        'If the product format allows it, show believable premium support elements such as capsules, spoon dosage, botanical ingredients, molecular icons, measuring cues or body-zone indicators',
        'Health visuals should feel clinically reassuring but still warm and sellable: clean whites or soft gradients, polished accent color, premium shadows, controlled iconography',
        'When text is used, keep it short and ad-like: one strong promise, a few benefit labels, maybe one routine or usage cue, never a long paragraph inside the image',
      ],
    },
    tech: {
      referenceMood: 'premium gadget launch creatives, sleek product boards, interface-driven explainer layouts, structured performance marketing',
      layoutFamilies: [
        'hero product tech poster with feature cards orbiting the device or object, precision connectors and strong contrast hierarchy',
        'structured spec grid with one large product render or photo, interface close-ups, feature icons and short proof modules',
        'editorial launch storyboard with top attention hook, middle detail zooms, bottom performance or trust indicators',
        'split composition balancing one dominant device shot with smaller feature panels, usage context and modern data-style callouts',
        'performance-led tech ad board with dramatic hero angle, sleek shadows, clean spec blocks and premium badge treatments',
      ],
      peopleRule: 'If a person is present, place them in a believable premium usage context such as a desk, living room, workspace or commute scene, never as a generic smiling model',
      objectRule: 'If UI, specs or technical highlights are shown, keep them crisp, minimal, modern and highly legible like a real launch creative',
      extraRules: [],
    },
    fashion: {
      referenceMood: 'fashion campaign editorials, lookbook ad boards, premium accessory showcases, style-first commercial layouts',
      layoutFamilies: [
        'fashion hero poster with one dominant product or accessory, 2 to 4 style cards and a strong editorial headline area',
        'lookbook grid mixing product close-ups, full or half-body styling shots and short desirability callouts',
        'editorial style storyboard with top attitude image, middle craft or material detail panel, bottom confidence or lifestyle block',
        'split fashion composition with one statement subject shot and several clean premium product or texture panels',
        'prestige fashion board with oversized product details, elegant spacing, premium chips and magazine-like hierarchy',
      ],
      peopleRule: 'If a person is present, treat them like part of a premium fashion campaign: intentional styling, strong but natural posture, polished crop, believable clothing logic',
      objectRule: 'If material details or accessories are highlighted, make them tactile and luxurious with close-up realism and clean premium labeling',
      extraRules: [],
    },
    home: {
      referenceMood: 'premium household ads, organized utility boards, home-improvement benefit layouts, warm practical ecommerce creatives',
      layoutFamilies: [
        'home utility poster with one large product block and 3 to 4 rounded practical benefit cards showing solved household problems',
        'organized home grid with room context, product close-up, before versus after panel and reassuring result statements',
        'vertical household storyboard with top problem scene, middle product-in-action proof, bottom freshness or ease-of-use reassurance',
        'split composition mixing one dominant product scene with smaller practical usage panels, icons and room-specific callouts',
        'premium domestic conversion board with authentic user, real room context and neat practical proof blocks',
      ],
      peopleRule: 'If a person is present, integrate them in a believable domestic environment solving a real household issue, not posing like a beauty ad',
      objectRule: 'If room zones, surfaces or practical results are shown, make them concrete and legible so the visual instantly explains the household benefit',
      extraRules: [],
    },
    general: {
      referenceMood: 'premium ecommerce ad creatives, marketplace-ready conversion posters, polished product explainer boards',
      layoutFamilies: [
        'central hero product with 3 to 4 rounded benefit cards placed around it, clear directional connectors, one dominant focal point',
        'premium modular grid with 4 to 6 panels, alternating product close-ups, benefit icons, usage scene and short proof statements',
        'editorial vertical storyboard with top attention zone, middle proof or ingredient zone, and bottom reassurance or usage zone',
        'split composition mixing one large product block and smaller information blocks with strong spacing, clean rhythm and premium hierarchy',
        'conversion poster layout with one oversized product shot, one authentic human subject, and several structured callout zones that explain the promise',
      ],
      peopleRule: 'If a person is present, integrate the person as part of the advertising composition in a polished way: real commercial photography, believable crop, no awkward pasted cutout feeling',
      objectRule: 'If ingredients or active components are shown, present them like a premium brand board: clean grouping, macro realism, neat labels or callouts, no random scattered objects',
      extraRules: [],
    },
  };

  return profiles[template] || profiles.general;
}

function buildProfessionalDescriptionGraphicRules(slotIndex = 0, template = 'general', visualPrefs = {}) {
  const brandColor = resolveBrandColor(visualPrefs, template);
  const profile = getNicheDescriptionGraphicProfile(template);
  const selectedLayout = profile.layoutFamilies[slotIndex % profile.layoutFamilies.length];
  const extraRules = (profile.extraRules || []).map((rule) => `• ${rule}`).join('\n');

  return `

═══ PROFESSIONAL DESCRIPTION GRAPHICS — MANDATORY ═══
• These description visuals must look like PREMIUM ecommerce ad creatives designed by a senior graphic designer, not generic AI collages
• Niche-specific premium reference mood for this product: ${profile.referenceMood}
• Use the visual language that matches this niche, not a one-size-fits-all graphic style
• Preferred structural direction for this visual: ${selectedLayout}
• The design may borrow PROFESSIONAL advertising grammar from reference-style creatives such as: centered product hero with surrounding benefit boxes, premium panel grid, magazine-like editorial blocks, ingredient callouts, transformation sections, usage demonstration panels, reassurance badges
• Do NOT copy one exact layout. Use that professional structure language while creating a new composition specific to this product
• The product must stay visually dominant. Supporting panels, icons, ingredients, people and proof blocks must reinforce the product instead of competing with it
• Keep the layout easy to scan on mobile: bold focal point, 2 to 5 short text zones maximum, clear reading path, no clutter
• Typography must feel premium and commercial: bold headline hierarchy, short claims, strong spacing, clean alignment, no tiny unreadable text
• Graphic elements must feel intentional and polished: rounded cards, soft shadows, subtle gradients, clean separators, premium badge treatment, elegant arrows or dotted connectors only when useful
• ${profile.peopleRule}
• ${profile.objectRule}
${extraRules ? `${extraRules}\n` : ''}• Use the brand color ${brandColor} as the main accent color for key badges, dividers, icons or highlight panels while preserving a refined overall palette
• The final result must feel export-ready for a paid social ad or marketplace creative, not like a draft, a flyer, or a cheap Canva template`;
}

function buildHumanPhotoRealismRules() {
  return `

═══ HUMAN REALISM — NON-NEGOTIABLE ═══
• The person must look like a REAL photographed human being, not a synthetic AI face
• Keep natural skin texture, pores, tiny imperfections, realistic teeth, realistic eyes, realistic ears, realistic hands
• Natural facial asymmetry is required. Do NOT make the face too perfect, too smooth, too glossy, too symmetrical, or wax-like
• Hands and fingers must be anatomically correct: no extra fingers, fused fingers, broken wrists, duplicated limbs, or distorted nails
• Hairline, braids, locs, afro texture, edges and baby hairs must look naturally photographed, never plastic or painted
• Avoid uncanny AI traits: plastic skin, fake smile, glassy eyes, over-beautified face, over-sharpened pores, blurred accessories, broken jewelry, distorted backgrounds
• Final result must feel like a real commercial photo captured by a skilled photographer with a real model`;
}

function buildSemanticIllustrationRules({ mainClaim = '', supportText = '', promise = '', bullets = [] } = {}) {
  const bulletList = bullets.filter(Boolean).slice(0, 4).join(' | ');
  return `

═══ SEMANTIC ILLUSTRATION — MANDATORY ═══
• The image must VISUALLY EXPLAIN the exact marketing message, not just decorate it
• Main claim to illustrate: "${mainClaim || 'specific product benefit'}"
• Supporting text to reflect: "${supportText || 'specific product explanation'}"
• Concrete promise to make visible: "${promise || 'credible visible result'}"
${bulletList ? `• Benefit cues that must be visible through the scene, icons, callouts or body language: ${bulletList}` : ''}
• If the text mentions a problem, show that problem concretely in the visual context, expression, body zone, object state, or environment
• If the text mentions relief, transformation, comfort, cleanliness, speed, confidence, simplicity or another result, make that exact result readable in the image itself
• Infographic elements must NOT be generic decoration. Every icon, badge, mini-scene, annotation, object and gesture must correspond to what the text says
• Do not use random smiling portraits unrelated to the copy. The person, the product and the infographic elements must all tell the same story`;
}

function buildThreePeopleHoldingProductRules() {
  return `

═══ THREE REAL PEOPLE — MANDATORY ═══
• The image must feature EXACTLY 3 authentic photographed Black African people, not illustrations, not avatars, not synthetic faces
• All 3 people must look like real commercial-photo subjects with natural skin texture, natural asymmetry, realistic hands and realistic expressions
• Each of the 3 people must be clearly visible in the composition, not hidden in the background
• At least 2 of them must clearly HOLD the exact product in hand, and ideally all 3 are interacting with or presenting the product naturally
• The product must be visible in their hands at a believable size with correct finger placement and natural grip
• Prefer a trio composition, 3-panel composition, or grouped scene showing three distinct real people rather than icons or generic infographic characters`;
}

function buildStructuredHeroDesignRules(gptResult = {}, template = 'general', visualPrefs = {}) {
  const brandColor = resolveBrandColor(visualPrefs, template);
  const mainBenefit = getMainBenefit(gptResult);
  const benefits = (gptResult.benefits_bullets || gptResult.raisons_acheter || [])
    .filter(Boolean)
    .slice(0, 4)
    .join(' | ');
  const socialProof = gptResult.urgency_elements?.social_proof_count || '1000+ clients satisfaits';
  const title = gptResult.title || 'Produit';

  return `

═══ HERO STRUCTURE — MANDATORY ═══
• This first hero image must follow the STRUCTURAL LOGIC of a premium conversion cover, similar to a polished marketplace ad board, not a loose lifestyle photo
• Use a strong top headline zone, a clear secondary subtitle zone, one dominant human-plus-product visual zone, one structured benefit column, and one strong bottom CTA zone
• Preferred composition logic:
  1. TOP: bold premium headline in French with strong hierarchy
  2. UNDER THE HEADLINE: short elegant supporting subtitle clarifying the key promise
  3. MAIN BODY: split or asymmetric layout with a real African model plus the exact product as the dominant visual focus
  4. SIDE BENEFIT COLUMN: 3 to 4 short benefit bullets with premium icon treatment or check markers
  5. TRUST BADGE: one visible social-proof badge such as "${socialProof}"
  6. BOTTOM STRIP: reassurance line or service promises
  7. BOTTOM CTA BUTTON: large premium call-to-action block styled like a real ecommerce conversion button
• The design must feel BETTER than the reference: more premium spacing, more elegant typography, cleaner visual rhythm, stronger hierarchy, softer luxury finish, and less template-like
• Do not literally copy the reference. Recreate its advertising structure language for this product in a fresher and more premium way
• The product and person must feel naturally integrated into the layout, not pasted between text blocks
• The CTA must look like a real polished marketplace call-to-action button, but the whole board must remain visually refined and premium
• The text zones must stay short, bold and highly readable on mobile
• Recommended hero promise to express visually and typographically: "${mainBenefit}"
${benefits ? `• Benefit bullets that can inspire the side column: ${benefits}` : ''}
• The final result must look like a top-performing ecommerce hero creative for ${title}, with a premium African-market advertising finish
• Use ${brandColor} as the dominant accent color for headline emphasis, trust badge, icons, separators and CTA button while keeping the overall look refined and high-end`;
}

function buildDescriptionGifSpecs(gptResult = {}) {
  const productTitle = gptResult.title || 'Produit';
  return [
    { key: 'usage-demo', title: `GIF usage — ${productTitle}` },
    { key: 'result-demo', title: `GIF résultat — ${productTitle}` },
  ];
}

function buildTargetAvatarSummary({ targetAvatar = '', targetGender = 'auto', targetAgeRange = 'auto', targetProfile = 'auto' } = {}) {
  const genderLabels = {
    auto: '',
    female: 'femme',
    male: 'homme',
    mixed: 'hommes et femmes',
  };
  const profileLabels = {
    auto: '',
    general: 'grand public',
    urban_active: 'actif urbain',
    parent: 'parent actif',
    student: 'etudiant ou jeune actif',
    professional: 'professionnel',
    sporty: 'profil sportif et actif',
    premium: 'client premium',
    senior: 'senior',
  };

  const directAvatar = typeof targetAvatar === 'string' ? targetAvatar.trim().slice(0, 180) : '';
  if (directAvatar) return directAvatar;

  const parts = [
    genderLabels[targetGender] || '',
    targetAgeRange && targetAgeRange !== 'auto' ? `${String(targetAgeRange).trim()} ans` : '',
    profileLabels[targetProfile] || '',
  ].filter(Boolean);

  return parts.join(', ');
}

function resolveHeroAvatar(gptResult = {}, template = 'general') {
  const rawTarget = String(gptResult.hero_target_person || '').toLowerCase();
  if (/(woman|femme|female|lady|girl)/.test(rawTarget)) return 'African woman';
  if (/(man|homme|male|boy)/.test(rawTarget)) return 'African man';
  if (template === 'beauty' || template === 'fashion') return 'African woman';
  return 'African customer';
}

function resolveBrandColor(visualPrefs = {}, template = 'general') {
  const niche = getNicheAccentColor(template);
  return visualPrefs.preferredColor || visualPrefs.titleColor || visualPrefs.contentColor || niche.color;
}

function getMainBenefit(gptResult = {}) {
  return (gptResult.benefits_bullets || []).find(Boolean)
    || gptResult.hero_slogan
    || gptResult.solution_section?.title
    || 'Résultats visibles rapidement';
}

function getHeroContextHints(gptResult = {}, template = 'general') {
  const textCorpus = [
    gptResult.title,
    gptResult.hero_headline,
    gptResult.hero_slogan,
    gptResult.hero_baseline,
    gptResult.problem_section?.title,
    ...(gptResult.problem_section?.pain_points || []),
    ...(gptResult.benefits_bullets || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isToiletCleaning = /(wc|toilet|toilette|cuvette|odeur|odeurs|mauvaises odeurs|desodoris|nettoyant wc|toilet bowl|bathroom odor)/.test(textCorpus);
  const isHouseholdCleaning = /(nettoy|cleaner|detergent|degraiss|desinfect|menage|maison propre|salle de bain|kitchen|cuisine|surface sale)/.test(textCorpus);

  if (isToiletCleaning) {
    return {
      scene: 'modern upscale bathroom or WC, the exact product attached to or used around a clean toilet bowl, visible freshness and odor-relief result, believable household context',
      subject: 'an authentic Black African parent or household adult naturally using or presenting the product in the bathroom',
      placement: 'the product must be large, real-size, and clearly visible near the toilet rim or in the hand during usage, never floating and never oversized',
      mood: 'fresh, relieved, hygienic, practical, reassuring, premium household realism',
      composition: 'show the real problem being solved through the environment: clean WC, freshness, comfort, confidence, no generic beauty pose',
    };
  }

  if (template === 'home' || isHouseholdCleaning) {
    return {
      scene: 'real modern home usage context matching the exact room or surface the product is made for',
      subject: 'an authentic Black African adult naturally using or showing the product in a believable domestic scene',
      placement: 'the product must stay clearly visible in the hands or in active use on the exact household area it improves',
      mood: 'practical, clean, trustworthy, warm, premium domestic realism',
      composition: 'the image must explain the concrete household benefit, not a generic portrait',
    };
  }

  return {
    scene: 'believable usage context matching the real product category and benefit',
    subject: `a ${resolveHeroAvatar(gptResult, template)} naturally interacting with the product`,
    placement: 'the exact product must be clearly visible at realistic size, naturally held or used in context',
    mood: 'premium, trustworthy, realistic, ecommerce-ready',
    composition: 'avoid static generic posing and make the product benefit readable in the scene',
  };
}

function getBenefitPairs(gptResult = {}) {
  const rawItems = [
    ...(gptResult.benefits_bullets || []),
    ...(gptResult.raisons_acheter || []),
  ].filter(Boolean).slice(0, 4);

  const normalized = rawItems.map((item, index) => {
    const clean = String(item).replace(/^[^\p{L}\p{N}]+/u, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    const label = words.slice(0, 2).join(' ') || `Actif ${index + 1}`;
    const benefit = words.slice(2).join(' ') || clean || 'Bénéfice clé';
    return { label, benefit };
  });

  while (normalized.length < 4) {
    normalized.push({
      label: `Actif ${normalized.length + 1}`,
      benefit: 'Bénéfice visible et facile à comprendre',
    });
  }

  return normalized;
}

function buildDynamicDesignRules(gptResult = {}, template = 'general', visualPrefs = {}, marketingIntent = '') {
  const brandColor = resolveBrandColor(visualPrefs, template);
  const title = gptResult.title || 'the product';
  const mainBenefit = getMainBenefit(gptResult);
  const painPoint = gptResult.problem_section?.pain_points?.[0] || gptResult.problem_section?.title || '';
  const toneHints = [
    visualPrefs.heroVisualDirection,
    visualPrefs.decorationDirection,
    visualPrefs.preferredColor,
  ].filter(Boolean).join(' | ');

  return `

═══ DYNAMIC DESIGN SYSTEM — CRITICAL ═══
• Do NOT reuse a fixed template, fixed composition, repeated card arrangement, repeated badge layout, repeated split-screen, or repeated infographic structure
• The visual structure must be invented dynamically for THIS product only
• Let the AI choose the most convincing design composition according to:
  - the real product type: ${title}
  - the main benefit: ${mainBenefit}
  - the main problem or tension: ${painPoint || 'deduce it from the product'}
  - the marketing intent: ${marketingIntent || 'high-conversion ecommerce visual'}
  - the brand color or dominant website color: ${brandColor}
  - the target audience and expected level of trust or urgency
• The final design must NOT look like a reused house template seen on every other product page
• Typography, text placement, product placement, supporting icons, badges, arrows, ingredient callouts, social proof blocks and background treatment must all be decided dynamically from the product itself
• Use the template only as a mood direction, never as a rigid wireframe
${toneHints ? `• Additional visual mood hints: ${toneHints}` : ''}
• If a more minimal design fits the product, keep it minimal. If a richer composition fits the product, build it. The AI decides.`;
}

function hashVisualSeed(value = '') {
  return Array.from(String(value)).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function getTemplateArtDirectionFamilies(template = 'general') {
  const families = {
    beauty: [
      { name: 'editorial glow portrait', direction: 'heroic close-up, luminous skin, premium cosmetic editorial composition' },
      { name: 'ritual macro still-life', direction: 'tactile textures, product macro, elegant ingredient choreography' },
      { name: 'clinical luxury proof', direction: 'clean scientific beauty cues, refined annotations, visible efficacy' },
      { name: 'ugc confidence collage', direction: 'trust-first real-customer rhythm, natural smiles, relatable framing' },
      { name: 'color-field conversion poster', direction: 'bold beauty color-blocking, sharp hierarchy, one dominant promise' },
    ],
    tech: [
      { name: 'dark premium hardware', direction: 'dramatic contrast, reflective surfaces, precise product spotlight' },
      { name: 'interface-led explainer', direction: 'clean data overlays, directional callouts, structured spec hierarchy' },
      { name: 'urban performance energy', direction: 'kinetic lighting, modern environment, speed and power cues' },
      { name: 'creator desk realism', direction: 'lifestyle usage in a believable workspace, premium but human' },
      { name: 'trust architecture layout', direction: 'stability, reliability, order, confidence-building composition' },
    ],
    fashion: [
      { name: 'luxury editorial cover', direction: 'fashion-magazine hero framing, attitude, styling-first hierarchy' },
      { name: 'texture and craft close-up', direction: 'material detail, tactile zoom, refined luxury surfaces' },
      { name: 'street-style motion', direction: 'movement, candid confidence, urban silhouette and rhythm' },
      { name: 'wardrobe story composition', direction: 'complete outfit logic, aspirational styling context' },
      { name: 'identity-led prestige poster', direction: 'bold representation, cultural pride, premium statement framing' },
    ],
    health: [
      { name: 'clean vitality poster', direction: 'fresh energy, bright confidence, visible wellness transformation' },
      { name: 'ingredient efficacy board', direction: 'science-meets-natural balance, proof-oriented composition' },
      { name: 'active routine realism', direction: 'movement, daylight, believable daily health ritual' },
      { name: 'trust and reassurance layout', direction: 'clarity, safety, simple proof blocks, calm authority' },
      { name: 'results momentum visual', direction: 'progress, action, optimism, powerful but credible performance cues' },
    ],
    home: [
      { name: 'warm utility showcase', direction: 'practical product hero, cozy atmosphere, household clarity' },
      { name: 'lived-in interior story', direction: 'modern domestic realism, believable daily usage' },
      { name: 'organised benefit board', direction: 'clean practical callouts, reassuring rhythm, easy-to-scan layout' },
      { name: 'family trust composition', direction: 'human warmth, reliability, comfort-centric framing' },
      { name: 'premium home catalog', direction: 'styled surfaces, elevated decor, polished ecommerce presentation' },
    ],
    general: [
      { name: 'conversion-led hero poster', direction: 'one dominant promise, bold focal point, scroll-stopping simplicity' },
      { name: 'editorial explainer spread', direction: 'magazine-like hierarchy, product story with clean rhythm' },
      { name: 'proof-heavy trust layout', direction: 'social proof, badges, reassurance blocks, confidence-first design' },
      { name: 'lifestyle immersion scene', direction: 'real context, human usage, believable environment' },
      { name: 'premium tactile close-up', direction: 'macro detail, material richness, elevated product desirability' },
    ],
  };

  return families[template] || families.general;
}

function buildArtDirectionProfile(slotIndex = 0, gptResult = {}, template = 'general', visualPrefs = {}, marketingIntent = '') {
  const title = gptResult.title || 'the product';
  const mainBenefit = getMainBenefit(gptResult);
  const seed = hashVisualSeed(`${title}|${mainBenefit}|${template}|${visualPrefs.heroVisualDirection || ''}|${visualPrefs.decorationDirection || ''}`);
  const families = getTemplateArtDirectionFamilies(template);
  const profile = families[(seed + slotIndex) % families.length];

  return `

═══ ART DIRECTION VARIATION — THIS VISUAL ONLY ═══
• Selected art-direction family: ${profile.name}
• Composition mood to follow: ${profile.direction}
• This direction is only a starting point for this specific visual about: ${marketingIntent || 'high-conversion ecommerce communication'}
• Keep strong variation between visuals in the same product page. Do not repeat the same framing rhythm, spacing logic, badge arrangement or text placement from one image to the next.`;
}

function buildBenefitsInfographicPrompt(gptResult, template = 'general', visualPrefs = {}) {
  const productName = gptResult.title || 'the product';
  const avatar = resolveHeroAvatar(gptResult, template);
  const brandColor = resolveBrandColor(visualPrefs, template);
  const productBlock = 'THE EXACT product from the reference image, centered, large, ultra sharp, same packaging, same label, same color, same shape.';
  const pairs = getBenefitPairs(gptResult);
  const pairLines = pairs.map((pair) => `- ${pair.label} -> ${pair.benefit}`).join('\n');

  return `Create a product benefit image for an African ecommerce audience. Vertical 4:5, premium photorealistic quality.

The product is centered and must be the exact product from the reference image.
${productBlock}

Around the product, show 3 to 4 natural ingredients, active components, or benefit callouts relevant to the product, with clean arrows pointing to the product.

Use these ingredient or benefit associations:
${pairLines}

Include ${avatar} in a secondary but realistic position to reinforce trust, natural usage and relatability.

Style: clean, educational, modern, easy to understand, premium, trustworthy.
Colors must match this website / brand color: ${brandColor}.
French text only. Perfect spelling. No fake stock-photo feel. No price, no phone number, no URL, no watermark.
The design structure must be chosen dynamically by the AI according to the product. Do not use a repeated template.
${buildArtDirectionProfile(1, gptResult, template, visualPrefs, 'benefits explanation image')}${buildDynamicDesignRules(gptResult, template, visualPrefs, 'benefits explanation image')}${buildProfessionalDescriptionGraphicRules(0, template, visualPrefs)}${buildHumanPhotoRealismRules()}${buildVisualPromptDirectives(visualPrefs)}`;
}

function buildSocialProofCollagePrompt(gptResult, template = 'general', visualPrefs = {}) {
  const productName = gptResult.title || 'the product';
  const avatar = resolveHeroAvatar(gptResult, template);
  const brandColor = resolveBrandColor(visualPrefs, template);
  const socialCount = gptResult.urgency_elements?.social_proof_count || '+2500 satisfied customers';

  return `Create a social proof image for an African ecommerce audience. Vertical 4:5, premium realistic quality.

Show 6 to 9 authentic ${avatar === 'African woman' ? 'African women' : 'African customers'} holding the exact product from the reference image, smiling and reacting naturally.
The product must stay clearly visible in multiple hands and must remain identical to the reference image.

Add a central badge with this exact text: "${socialCount}".
Add a visible 5-star rating graphic.

Style: UGC, authentic, trust-building, realistic, premium but natural.
Background must match brand identity and website color: ${brandColor}.
No stock-photo feeling, no exaggerated poses, no fake hands, no watermark, no phone number, no URL.
The AI must decide the most convincing collage or group composition dynamically for this product instead of reusing the same layout.
${buildArtDirectionProfile(2, gptResult, template, visualPrefs, 'social proof and trust image')}${buildDynamicDesignRules(gptResult, template, visualPrefs, 'social proof and trust image')}${buildProfessionalDescriptionGraphicRules(1, template, visualPrefs)}${buildHumanPhotoRealismRules()}${buildVisualPromptDirectives(visualPrefs)}`;
}

/**
 * Hero — Product in action layout:
 * The product is shown being USED in its real context (not a cosmetic studio pose).
 * Bold headline + product dominant + contextual usage scene.
 */
function buildHeroPrompt(gptResult, hasProductRef, template = 'general', visualPrefs = {}) {
  const mainBenefit = getMainBenefit(gptResult);
  const brandColor = resolveBrandColor(visualPrefs, template);
  const heroContext = getHeroContextHints(gptResult, template);
  const productNote = 'THE EXACT product from the reference image, same packaging, same label, same colors, same shape, no redesign, no approximation.';

  return `Create a high-converting ecommerce hero image for an African audience.

A realistic hero scene showing ${heroContext.subject}.

Scene and environment: ${heroContext.scene}.
Composition goal: ${heroContext.composition}.
Emotional tone: ${heroContext.mood}.

The person must naturally HOLD the product in hand, or wear/use it in the most obvious way for the niche, so the product is immediately identifiable in the hero.
The product must be clearly visible and placed naturally in the usage scene.
${productNote}
${heroContext.placement}.

Clean soft lighting, premium ecommerce photography style, realistic and trustworthy.
Background color must match the website color: ${brandColor}.

Text structure must resemble a high-end hero advertising board, not just a lifestyle photo with one small badge.
Use French text only, with perfect spelling and premium ad hierarchy.
You may use:
- one strong headline
- one short supporting subtitle
- 3 to 4 short benefit bullets
- one social proof badge
- one bottom reassurance strip
- one CTA button label

Suggested CTA language can be direct and conversion-oriented, such as a premium variation of "Je commande maintenant" adapted to the product.
Do NOT use long paragraphs. Keep every text block short, high-impact and highly legible.
The main promise must reflect this benefit: "${mainBenefit}"

Style: realistic, premium, trustworthy, no stock feeling, no fake hands, no watermark, no phone number, no URL.
Do not force the product near the face unless that is the natural real usage of the product.
For home, bathroom, kitchen or cleaning products, the image must prioritize the exact usage context and the solved problem in the room itself.
${buildStructuredHeroDesignRules(gptResult, template, visualPrefs)}${buildArtDirectionProfile(0, gptResult, template, visualPrefs, 'hero hook image')}${buildDynamicDesignRules(gptResult, template, visualPrefs, 'hero hook image')}${buildHumanPhotoRealismRules()}${buildVisualPromptDirectives(visualPrefs)}`;
}

/**
 * Builds an INFOGRAPHIC image prompt that visually illustrates the SPECIFIC angle text.
 * Each slide (index 0-3) gets a DIFFERENT infographic layout style.
 * Category-specific design (beauty, tech, fashion, health, home, general).
 */
function buildAngleImagePrompt(angle, gptResult, hasProductRef, template = 'general', slideIndex = 0, visualPrefs = {}, method = 'PAS') {
  const productTitle = gptResult.title || 'the product';
  const targetPerson = gptResult.hero_target_person || 'authentic Black African person';
  const benefits = gptResult.benefits_bullets || gptResult.raisons_acheter || [];
  const angleTitle = (angle.titre_angle || '').slice(0, 120);
  const angleExplication = (angle.explication || angle.message_principal || '').slice(0, 220);
  const anglePromesse = (angle.promesse || '').slice(0, 120);
  const brandColor = resolveBrandColor(visualPrefs, template);
  const productNote = 'THE EXACT product from the reference image, large, sharp, dominant, same packaging, same label, same color, same shape.';
  const marketingIntent = method === 'PAS' && slideIndex === 0
    ? 'problem awareness visual'
    : `marketing angle visual for: ${angleTitle || 'product benefit'}`;

  return `Create a high-converting ecommerce description visual for an African audience. Vertical 4:5, premium photorealistic quality.

This image must express a specific marketing angle for this product.
- Product: ${productTitle}
- Marketing angle title: ${angleTitle || 'benefit-driven angle'}
- Main explanation: ${angleExplication || 'show the concrete benefit in a visible way'}
- Promise or result: ${anglePromesse || 'credible visible result'}
- Target person: ${targetPerson}
- Brand color or site color to respect: ${brandColor}

The exact product from the reference image must remain visible and accurate.
${productNote}

The design must be dynamic and invented specifically for this product. Do not use a repeated template or fixed layout. The AI must decide the best composition, hierarchy, framing, badge placement, callouts, arrows, icons, collage, close-up, split, lifestyle scene, or editorial arrangement according to the product and the angle.

If the angle is about a problem, show the problem clearly and concretely.
If the angle is about a result, make the result visually obvious.
If the angle is about reassurance, trust, ingredients, mechanism, transformation or proof, build the visual language that fits that exact message.

French text only if necessary, with perfect spelling. No price, no phone number, no URL, no watermark.
The image must not feel generic and must not look like the same design system reused on every product.
${buildArtDirectionProfile(slideIndex + 3, gptResult, template, visualPrefs, marketingIntent)}${buildDynamicDesignRules(gptResult, template, visualPrefs, marketingIntent)}${buildHumanPhotoRealismRules()}${buildSemanticIllustrationRules({
    mainClaim: angleTitle,
    supportText: angleExplication,
    promise: anglePromesse,
    bullets: benefits.slice(0, 4),
  })}${buildProfessionalDescriptionGraphicRules(slideIndex + 2, template, visualPrefs)}${buildVisualPromptDirectives(visualPrefs)}`;
}

function buildFlashPrompts(gptResult, hasProductRef, method = 'PAS', template = 'general', visualPrefs = {}) {
  const angles = gptResult.angles || [];
  const corePlans = [
    { type: 'benefits_explainer', intent: 'educational benefits and mechanism visual', cue: getMainBenefit(gptResult) },
    { type: 'problem_solution', intent: 'problem to solution transformation visual', cue: gptResult.problem_section?.pain_points?.[0] || gptResult.problem_section?.title || getMainBenefit(gptResult) },
    { type: 'usage_context', intent: 'real usage and product-in-context visual', cue: gptResult.guide_utilisation?.titre || gptResult.hero_slogan || getMainBenefit(gptResult) },
    { type: 'desired_result', intent: 'aspirational outcome and transformation visual', cue: gptResult.solution_section?.title || gptResult.hero_slogan || getMainBenefit(gptResult) },
    { type: 'reassurance_close', intent: 'objection crushing reassurance visual', cue: gptResult.reassurance?.titre || gptResult.urgency_elements?.primary_urgency || 'simple, fiable, crédible' },
  ];

  return corePlans.map((plan, index) => ({
    ...plan,
    angle: angles[index] || null,
    artDirection: buildArtDirectionProfile(index + 3, gptResult, template, visualPrefs, plan.intent),
  }));
}

function buildFlashFallbackPrompt(plan, angle, gptResult, template = 'general', visualPrefs = {}, method = 'PAS', slideIndex = 0) {
  const productTitle = gptResult.title || 'the product';
  const brandColor = resolveBrandColor(visualPrefs, template);
  const angleTitle = angle?.titre_angle || plan?.type || `angle ${slideIndex + 1}`;
  const angleExplication = angle?.explication || angle?.message_principal || plan?.cue || getMainBenefit(gptResult);
  const anglePromesse = angle?.promesse || gptResult.solution_section?.title || getMainBenefit(gptResult);

  return `Create a high-converting ecommerce description visual for an African audience. Vertical 4:5, premium photorealistic quality.

Build a non-generic marketing image specifically for this product.
- Product: ${productTitle}
- Angle title: ${angleTitle}
- Message to make visible: ${angleExplication}
- Promise to make believable: ${anglePromesse}
- Brand color to respect: ${brandColor}

Use the exact product from the reference image when visible. Do not invent packaging, labels or colors.
French text only if truly necessary. No price, no phone number, no URL, no watermark.
${plan?.artDirection || buildArtDirectionProfile(slideIndex + 3, gptResult, template, visualPrefs, plan?.intent || 'dynamic marketing visual')}${buildDynamicDesignRules(gptResult, template, visualPrefs, plan?.intent || 'dynamic marketing visual')}${buildHumanPhotoRealismRules()}${buildSemanticIllustrationRules({
    mainClaim: angleTitle,
    supportText: angleExplication,
    promise: anglePromesse,
    bullets: gptResult.benefits_bullets || [],
  })}${buildProfessionalDescriptionGraphicRules(slideIndex + 2, template, visualPrefs)}${buildVisualPromptDirectives(visualPrefs)}`;
}

/**
 * 4 lifestyle prompts — photos réalistes de personnes africaines tenant LE produit
 * de référence (même packaging exact). Aucune infographie, aucun texte overlay.
 * Alimente la galerie photo "Photos du produit" sur la page produit.
 */
function buildPeopleHoldingProductPrompts(gptResult, visualPrefs = {}) {
  const title = 'the product';
  const template = visualPrefs?.template || 'general';
  const productNote = `THE EXACT product from the reference image — same packaging, same shape, same color, same label, same design. CRITICAL: Use the provided product reference image and reproduce the IDENTICAL product as it appears in the photo. Do NOT redraw, redesign, or invent a product. If you cannot faithfully reproduce the EXACT same product, generate the photo WITHOUT the product visible rather than showing a wrong/invented product. A photo without the product is better than a photo with a fake product.`;
  const nichePrompt = {
    beauty: 'Niche context: beauty/cosmetics. Use bathroom vanity, skincare routine energy, glow, softness, and beauty confidence when relevant.',
    health: 'Niche context: health/wellness. Use a credible daily routine, energy, vitality, supplement or wellness context.',
    tech: 'Niche context: tech/electronics. Use modern desk, sleek living room, setup or gadget usage context.',
    fashion: 'Niche context: fashion/accessories. Use style confidence, mirror-selfie feel, outfit coordination, and personal lookbook energy.',
    home: 'Niche context: home/kitchen. Use warm domestic comfort, organization, cooking or home-practicality context.',
    general: 'Niche context: adapt the customer photo to the real category and benefit of the product.',
  }[template] || 'Niche context: adapt the customer photo to the real category and benefit of the product.';

  const baseRules = `
═══ MANDATORY REAL CUSTOMER PHOTO RULES ═══
• This must look EXACTLY like a real photo taken by a CUSTOMER with their smartphone — NOT a professional photoshoot, NOT AI art, NOT a studio render
• Think: a real person just received their order, they're happy, they take a quick photo/selfie with the product to share on WhatsApp or Instagram
• Authentic Black African person (dark brown skin, natural African features, natural African hair or headwrap). Natural skin texture, pores, imperfections — REAL human skin
• Realistic hands with correct finger count (5 fingers per hand) and natural grip on the product
• Modern stylish clothing — t-shirt, casual dress, smart casual, regular modern clothes. NOT traditional market attire
• FACE MUST BE CLEARLY VISIBLE — this is like a selfie or a photo taken by a friend. We see the person's face, their smile, their eyes. The face is a major part of the photo
• Natural warm lighting — smartphone flash, window light, room light, daylight. Slightly imperfect lighting like a real phone photo
• The person is HOLDING the EXACT product (from reference image) in their hands clearly — the product packaging/label must be recognizable and readable
• ${productNote}
• Mid-range or selfie-style crop. Vertical 4:5 (1080×1250). Smartphone photo quality — sharp but not studio-perfect
• Setting: MODERN UPSCALE interior — contemporary living room, sleek bedroom, modern kitchen, minimalist bathroom. Modern furniture, clean walls, contemporary decor. NOT a traditional setting, NOT a market
• NO text overlay, NO caption, NO price, NO CTA, NO logo, NO frame, NO marketing layout
• NO extra objects arranged around the product — this is NOT a flat lay. It's a person holding the product
• The overall feel must be: "a real customer took this photo after receiving their package"
• ${nichePrompt}
${buildHumanPhotoRealismRules()}`;

  return [
    `A real smartphone selfie photo of a young African woman (25-35 years old, natural hair or braids, genuine happy smile showing teeth) holding "${title}" up next to her face with one hand while taking the selfie with the other. She is at home in her modern living room — we can see a contemporary sofa, stylish cushions, or modern curtains slightly blurred behind her. The product packaging is clearly visible and facing the camera. Her face takes up about 40% of the frame, the product about 30%. Natural room lighting, slightly warm. This looks like a real photo she just posted on WhatsApp saying "Mon colis est arrivé!" — genuine excitement, not posed.
${baseRules}`,

    `A real smartphone photo of an African man (28-40 years old, short natural hair or close cut, relaxed genuine smile) sitting on a sofa or chair in his living room, holding "${title}" in both hands at chest level, product label facing the camera. He looks directly at the camera like a friend just took his photo. We see his full face clearly, his modern casual t-shirt or polo. The background shows a modern interior — contemporary TV setup, clean shelves, modern curtains visible but slightly blurred. Natural indoor lighting. This looks like a real testimonial photo a customer would send.
${baseRules}`,

    `A real smartphone photo of an African woman (30-40 years old, natural hair wrapped in a headwrap, expression of delight and surprise) who just opened her package. She holds "${title}" up with one hand, the product clearly visible with its packaging. There's a torn delivery package or cardboard box visible on the table or her lap. She is sitting in her modern bedroom or sleek living room. Her face is clearly visible — genuine joy of receiving an order. We see the product AND her face prominently. Natural indoor lighting, slightly warm. This looks like a real unboxing moment shared on social media.
${baseRules}`,
  ];
}

/**
 * Construit un 2e prompt avant/après basé sur un bénéfice différent du premier.
 */
function buildSecondBeforeAfterPrompt(gptResult, visualPrefs = {}) {
  const benefits = gptResult.benefits_bullets || [];
  const secondBenefit = (benefits[1] || benefits[2] || benefits[0] || 'improved appearance').replace(/^[^\w]*/, '');
  const targetPerson = gptResult.hero_target_person || 'african person';
  const template = visualPrefs?.template || 'general';
  const nichePrompt = {
    beauty: 'Adapt the transformation to skincare, haircare, beauty comfort or visible aesthetic improvement.',
    health: 'Adapt the transformation to wellness, relief, energy, posture, comfort or health-related improvement.',
    tech: 'Adapt the transformation to convenience, usability, productivity or visible everyday ease.',
    fashion: 'Adapt the transformation to fit, elegance, style confidence or stronger presence.',
    home: 'Adapt the transformation to cleanliness, comfort, organization, cooking ease or household practicality.',
    general: 'Adapt the transformation to the product niche and make the benefit visually obvious.',
  }[template] || 'Adapt the transformation to the product niche and make the benefit visually obvious.';
  // Inverser le genre pour varier
  const altPerson = targetPerson.toLowerCase().includes('woman') || targetPerson.toLowerCase().includes('femme')
    ? 'an African man (30-40 years old, short natural hair, confident expression)'
    : 'an African woman (25-35 years old, natural braids or afro, warm expression)';
  const painPoints = gptResult.problem_section?.pain_points || [];
  const secondProblem = painPoints[1] || painPoints[0] || secondBenefit;

  return `Photorealistic split-screen before/after transformation image for a product. Ultra realistic, 4K quality, sharp focus. Vertical 4:5 (1080×1250).

LEFT SIDE (AVANT): ${altPerson} clearly showing the problem "${secondProblem}" — visible discomfort, frustration, or issue related to this specific product benefit. The problem must be PHYSICALLY VISIBLE, not just a sad expression. Natural, not exaggerated.

RIGHT SIDE (APRÈS): The SAME person showing clear improvement after using the product — "${secondBenefit}". Confident, relieved, visibly better. The product visible at REAL SIZE on the AFTER side, natural placement.

MANDATORY:
- Authentic Black African person with dark brown skin, natural African features, natural African hair
- Modern stylish clothing, SUBTLE natural expressions — NOT theatrical
- Setting: MODERN CONTEMPORARY interior (sleek living room, modern bedroom, contemporary bathroom — NOT traditional, NOT a market)
- The SAME person on BOTH sides with clear visual transformation
- Small 'Avant' / 'Après' labels in perfect French with correct accents
- Soft natural lighting, clean style, NO aggressive filters
- PHOTOREALISTIC — must look like a REAL photograph, NOT AI-generated
- NO title text, NO price, NO CTA, NO URL
- Tight crop, ZERO empty margins
- ${nichePrompt}${buildHumanPhotoRealismRules()}`;
}

// Plusieurs générations simultanées autorisées — lock supprimé

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Seules les images sont acceptées'), false);
  }
});

// ── GET /info — fetch credit info for modal ──────────────────
router.get('/info', requireEcomAuth, async (req, res) => {
  try {
    const wsId = req.workspaceId;
    if (!wsId) return res.json({ success: true, generations: null });

    const pricingConfig = await GenerationPricingConfig.getSingleton();
    const pricing = pricingConfig.getSnapshot();

    const workspace = await EcomWorkspace.findById(wsId)
      .select('simpleGenerationsRemaining freeGenerationsRemaining paidGenerationsRemaining totalGenerations')
      .lean();

    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace introuvable' });

    const remaining = (workspace.simpleGenerationsRemaining || 0) + (workspace.freeGenerationsRemaining || 0) + (workspace.paidGenerationsRemaining || 0);

    res.json({
      success: true,
      generations: {
        remaining,
        freeRemaining: workspace.freeGenerationsRemaining || 0,
        paidRemaining: workspace.paidGenerationsRemaining || 0,
        totalUsed: workspace.totalGenerations || 0,
        pricing,
      }
    });
  } catch (err) {
    console.error('[ProductGenerator] GET /info error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── GET /images/:jobId — Poll async image generation status ───────────────────
router.get('/images/:jobId', requireEcomAuth, (req, res) => {
  const job = imageJobs.get(req.params.jobId);
  if (!job) return res.json({ success: true, status: 'not_found', images: {} });

  const images = {};
  if (job.heroImage) images.heroImage = job.heroImage;
  if (job.heroPosterImage) images.heroPosterImage = job.heroPosterImage;
  if (job.beforeAfterImage) images.beforeAfterImage = job.beforeAfterImage;
  if (job.beforeAfterImages?.length) images.beforeAfterImages = job.beforeAfterImages;
  if (job.angles?.length) images.angles = job.angles;
  if (job.peoplePhotos?.length) images.peoplePhotos = job.peoplePhotos;
  if (job.socialProofImages?.length) images.socialProofImages = job.socialProofImages;
  if (job.descriptionGifs?.length) images.descriptionGifs = job.descriptionGifs;

  res.json({
    success: true,
    status: job.status, // 'generating' | 'done' | 'error'
    progress: job.progress || 0,
    total: job.total || 0,
    images,
  });
});

// ── GET /tasks — List generation tasks for the workspace ──────────────────────
router.get('/tasks', requireEcomAuth, async (req, res) => {
  try {
    const tasks = await GenerationTask.find({ workspaceId: req.workspaceId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('status productName progressPercent currentStep product images errorMessage createdAt updatedAt')
      .lean();
    res.json({ success: true, tasks });
  } catch (err) {
    console.error('[Tasks] List error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── GET /tasks/:id — Get a single task status ────────────────────────────────
router.get('/tasks/:id', requireEcomAuth, async (req, res) => {
  try {
    const task = await GenerationTask.findOne({ _id: req.params.id, workspaceId: req.workspaceId }).lean();
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable' });

    const mergedProduct = mergeTaskProductWithImages(task);

    res.json({
      success: true,
      task: {
        _id: task._id,
        status: task.status,
        productName: task.productName,
        progressPercent: task.progressPercent,
        currentStep: task.currentStep,
        errorMessage: task.errorMessage,
        product: mergedProduct,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }
    });
  } catch (err) {
    console.error('[Tasks] Get error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/tasks/:id/retry', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const task = await GenerationTask.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Tâche introuvable' });
    }

    if (!task.product) {
      return res.status(400).json({ success: false, message: 'Aucun contenu sauvegardé pour cette génération' });
    }

    if (['pending', 'generating_text', 'generating_images'].includes(task.status)) {
      return res.status(409).json({ success: false, message: 'Cette génération est déjà en cours' });
    }

    const imageJobId = `retry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const visualTemplate = task.input?.visualTemplate || task.product?.visualTemplate || 'general';
    const realPhotos = task.input?.photoUrls?.length ? task.input.photoUrls : (task.product?.realPhotos || []);
    const sourceBuffer = task.input?.referenceImageBase64
      ? Buffer.from(task.input.referenceImageBase64, 'base64')
      : null;

    const visualContext = {
      template: visualTemplate,
      imageGenerationMode: task.input?.imageGenerationMode || task.product?.imageGenerationMode || 'ad_4_5',
      imageAspectRatio: task.input?.imageAspectRatio || task.product?.imageAspectRatio || '4:5',
      preferredColor: task.input?.preferredColor || task.product?.preferredColor || '',
      heroVisualDirection: task.input?.heroVisualDirection || task.product?.heroVisualDirection || '',
      decorationDirection: task.input?.decorationDirection || task.product?.decorationDirection || '',
      titleColor: task.input?.titleColor || task.product?.titleColor || '',
      contentColor: task.input?.contentColor || task.product?.contentColor || '',
    };

    task.status = 'generating_images';
    task.currentStep = 'Reprise de la génération...';
    task.progressPercent = 40;
    task.errorMessage = null;
    task.imageJobId = imageJobId;
    task.retryCount = (task.retryCount || 0) + 1;
    await task.save();

    void runBackgroundImageGeneration({
      taskId: task._id.toString(),
      workspaceId: req.workspaceId,
      userId: req.user?._id || req.user?.id,
      productData: task.product,
      visualTemplate,
      visualContext,
      approach: task.input?.marketingApproach || 'PAS',
      realPhotos,
      cleanUrl: task.input?.url || task.product?.sourceUrl || '',
      sourceBuffer,
      imageJobId,
      existingImages: task.images || {},
    });

    return res.json({
      success: true,
      message: 'Reprise lancée',
      task: {
        _id: task._id,
        status: task.status,
        currentStep: task.currentStep,
        progressPercent: task.progressPercent,
        imageJobId,
      },
    });
  } catch (error) {
    console.error('[Tasks] Retry error:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── DELETE /tasks/:id — Cancel / delete a generation task ─────────────────────
router.delete('/tasks/:id', requireEcomAuth, async (req, res) => {
  try {
    const task = await GenerationTask.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId,
    });
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable' });
    console.log(`[Tasks] Deleted task ${task._id} (${task.productName || 'sans nom'})`);
    res.json({ success: true, message: 'Tâche supprimée' });
  } catch (err) {
    console.error('[Tasks] Delete error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/', requireEcomAuth, validateEcomAccess('products', 'write'), upload.array('images', 8), async (req, res) => {
  const userId = req.user?.id || req.user?._id || 'anonymous';
  console.log(`🚀 [PG] Requête génération reçue — user=${userId} workspace=${req.workspaceId} files=${(req.files||[]).length}`);

  const {
    url,
    description: userDescription,
    skipScraping,
    withImages,
    imageGenerationMode: rawImageGenerationMode,
    imageAspectRatio: rawImageAspectRatio,
    marketingApproach,
    visualTemplate: rawVisualTemplate,
    preferredColor: rawPreferredColor,
    heroVisualDirection: rawHeroVisualDirection,
    decorationDirection: rawDecorationDirection,
    titleColor: rawTitleColor,
    contentColor: rawContentColor,
    // Paramètres copywriting simplifiés
    targetAvatar,
    targetGender,
    targetAgeRange,
    targetProfile,
    mainProblem,
    tone,
    language,
    fashionAvatar: rawFashionAvatar,
    fashionMinimalist: rawFashionMinimalist,
    fashionSizes: rawFashionSizes,
    fashionColors: rawFashionColors
  } = req.body || {};
  const imageFiles = req.files || [];
  const approach = marketingApproach || 'PAS';
  const visualTemplate = rawVisualTemplate || 'general';
  const imageGenerationMode = rawImageGenerationMode === 'standard' ? 'standard' : 'ad_4_5';
  const shouldGenerateImages = withImages !== 'false';
  const imageAspectRatio = rawImageAspectRatio === '1:1' ? '1:1' : '4:5';
  const preferredColor = typeof rawPreferredColor === 'string' ? rawPreferredColor.trim().slice(0, 80) : '';
  const heroVisualDirection = typeof rawHeroVisualDirection === 'string' ? rawHeroVisualDirection.trim().slice(0, 180) : '';
  const decorationDirection = typeof rawDecorationDirection === 'string' ? rawDecorationDirection.trim().slice(0, 180) : '';
  const titleColor = typeof rawTitleColor === 'string' ? rawTitleColor.trim().slice(0, 30) : '';
  const contentColor = typeof rawContentColor === 'string' ? rawContentColor.trim().slice(0, 30) : '';
  const avatarSummary = buildTargetAvatarSummary({
    targetAvatar,
    targetGender,
    targetAgeRange,
    targetProfile,
  });

  // Contexte copywriting simplifié : méthode + avatar + problème
  const copywritingContext = {
    method: approach,
    avatar: avatarSummary,
    problem: mainProblem || '',
    tone: tone || 'urgence',
    language: language || 'français'
  };

  let fashionConfig = null;
  if (visualTemplate === 'fashion') {
    const parseJson = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
    const sizes = Array.isArray(rawFashionSizes) ? rawFashionSizes : (parseJson(rawFashionSizes) || []);
    const colors = Array.isArray(rawFashionColors) ? rawFashionColors : (parseJson(rawFashionColors) || []);
    fashionConfig = {
      avatar: ['female', 'male', 'both'].includes(rawFashionAvatar) ? rawFashionAvatar : 'female',
      minimalist: rawFashionMinimalist === 'true' || rawFashionMinimalist === true,
      sizes: Array.isArray(sizes) ? sizes.slice(0, 20).map(String) : [],
      colors: Array.isArray(colors) ? colors.slice(0, 20).filter(c => c && c.name && c.hex) : [],
    };
  }

  const visualContext = {
    template: visualTemplate,
    imageGenerationMode,
    imageAspectRatio,
    preferredColor,
    heroVisualDirection,
    decorationDirection,
    titleColor,
    contentColor,
    fashionConfig,
  };

  // ── Validation selon le mode ──────────────────────────────────────────────
  const isDescriptionMode = skipScraping === 'true' || skipScraping === true;

  if (isDescriptionMode) {
    // Mode description directe
    if (!userDescription || typeof userDescription !== 'string' || userDescription.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'Description requise (minimum 20 caractères)' });
    }
    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins une photo requise en mode description' });
    }
  } else {
    // Mode URL produit
    if (!url || typeof url !== 'string' || url.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'URL du produit requise' });
    }
    const cleanUrl = url.trim();
    // Validation basique de l'URL
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return res.status(400).json({ success: false, message: 'URL invalide - doit commencer par http:// ou https://' });
    }
  }

  let scraped;
  let gptResult;
  let realPhotos = [];
  let posterImages = [];
  const cleanUrl = url?.trim() || '';
  let storeContext = {};

  try {
    let workspace;
    if (req.workspaceId) {
      workspace = await EcomWorkspace.findById(req.workspaceId)
        .select('storeSettings.country storeSettings.city storeSettings.storeName storeSettings.storeCurrency storeSettings.currency name freeGenerationsRemaining paidGenerationsRemaining totalGenerations simpleGenerationsRemaining');

      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace introuvable' });
      }

      storeContext = {
        country: workspace?.storeSettings?.country || '',
        city: workspace?.storeSettings?.city || '',
        currency: workspace?.storeSettings?.storeCurrency || workspace?.storeSettings?.currency || '',
        shopName: workspace?.storeSettings?.storeName || workspace?.name || '',
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // VÉRIFICATION DES LIMITES DE GÉNÉRATION
    // ══════════════════════════════════════════════════════════════════════════
    if (workspace) {
      const pricingConfig = await GenerationPricingConfig.getSingleton();
      const pricing = pricingConfig.getSnapshot();
      const simpleRemaining = workspace.simpleGenerationsRemaining || 0;
      const freeRemaining = workspace.freeGenerationsRemaining || 0;
      const paidRemaining = workspace.paidGenerationsRemaining || 0;
      const totalRemaining = simpleRemaining + freeRemaining + paidRemaining;

      if (totalRemaining <= 0) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          message: '🎯 Tu n\'as plus de crédits !\n\nAchète des crédits pour générer des pages produit.',
          remaining: 0,
          totalGenerations: workspace.totalGenerations || 0,
          pricing
        });
      }

      // Décrémenter: simpleRemaining d'abord, puis free, puis paid
      if (simpleRemaining > 0) {
        workspace.simpleGenerationsRemaining = simpleRemaining - 1;
      } else if (freeRemaining > 0) {
        workspace.freeGenerationsRemaining = freeRemaining - 1;
      } else {
        workspace.paidGenerationsRemaining = paidRemaining - 1;
      }

      workspace.totalGenerations = (workspace.totalGenerations || 0) + 1;
      workspace.lastGenerationAt = new Date();
      await workspace.save();

      const newRemaining = (workspace.simpleGenerationsRemaining || 0) + (workspace.freeGenerationsRemaining || 0) + (workspace.paidGenerationsRemaining || 0);
      console.log(`✅ Génération autorisée. Crédits restants: ${newRemaining}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CREATE TASK IMMEDIATELY — so it appears in "Mes Générations" right away
    // ══════════════════════════════════════════════════════════════════════════
    let generationTask = null;
    let taskId = null;
    try {
      generationTask = await GenerationTask.create({
        workspaceId: req.workspaceId,
        userId: req.user._id || req.user.id,
        status: 'generating_text',
        productName: isDescriptionMode ? (userDescription || '').slice(0, 60) : (cleanUrl || 'Produit'),
        currentStep: 'Analyse du produit...',
        progressPercent: 5,
        input: {
          url: cleanUrl || null,
          description: isDescriptionMode ? (userDescription || '').slice(0, 2000) : null,
          skipScraping: isDescriptionMode,
          marketingApproach: approach,
          visualTemplate,
          imageGenerationMode,
          imageAspectRatio,
          preferredColor,
          heroVisualDirection,
          decorationDirection,
          titleColor,
          contentColor,
          tone: tone || 'urgence',
          language: language || 'français',
        },
      });
      taskId = generationTask._id.toString();
      console.log(`📋 [Task] Created early with status=generating_text, id=${taskId}`);
    } catch (taskErr) {
      console.warn('[Task] Could not create early task:', taskErr.message);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Extraction des infos produit avec Gemini OU utilisation de la description directe
    // ══════════════════════════════════════════════════════════════════════════
    if (isDescriptionMode) {
      console.log('📝 Étape 1: Mode description directe (skip extraction Gemini)');
      scraped = {
        title: 'Produit',
        description: userDescription.trim(),
        rawText: userDescription.trim()
      };
      console.log('✅ Description utilisée:', userDescription.slice(0, 100));
    } else {
      console.log('🤖 Étape 1: Extraction Gemini depuis', cleanUrl);
      scraped = await extractProductInfo(cleanUrl);
      console.log('✅ Extraction Gemini OK:', { title: scraped.title?.slice(0, 50) });
    }

    // Update task: extraction done, starting AI analysis
    await updateTask(taskId, {
      productName: scraped?.title?.slice(0, 80) || (isDescriptionMode ? (userDescription || '').slice(0, 60) : 'Produit'),
      currentStep: 'Rédaction par l\'IA...',
      progressPercent: 15,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 : GPT-4o Vision → JSON structuré
    // ══════════════════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPES 2 & 3 EN PARALLÈLE : Groq analyse + Upload photos simultanément
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🧠⚡ Étape 2+3: Groq analyse + Upload photos EN PARALLÈLE');

    const imageBuffers = (imageFiles || []).map(f => f.buffer);

    // Lancer les deux en parallèle
    const UPLOAD_TIMEOUT_MS = 30000; // 30s max par photo
    const uploadWithTimeout = (uploadPromise) =>
      Promise.race([
        uploadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), UPLOAD_TIMEOUT_MS))
      ]);

    const [gptResultSettled, uploadResults] = await Promise.all([
      // Groq analyse
      analyzeWithVision(scraped, imageBuffers, approach, storeContext, copywritingContext, visualContext),
      // Uploads photos en parallèle (toutes en même temps)
      Promise.allSettled(
        imageFiles.slice(0, 8).map(f =>
          uploadWithTimeout(
            uploadImage(f.buffer, f.originalname || `photo-${Date.now()}.jpg`, {
              workspaceId: req.workspaceId,
              uploadedBy: userId,
              mimeType: f.mimetype
            })
          )
        )
      )
    ]);

    gptResult = gptResultSettled;

    console.log('✅ GPT OK:', {
      title: gptResult.title?.slice(0, 40),
      angles: gptResult.angles?.length,
      raisons: gptResult.raisons_acheter?.length,
      faq: gptResult.faq?.length
    });

    // Collecter les URLs des photos uploadées
    for (const r of uploadResults) {
      if (r.status === 'fulfilled' && r.value?.url) realPhotos.push(r.value.url);
      else if (r.status === 'rejected') console.warn('⚠️ Upload photo échoué:', r.reason?.message);
    }
    console.log('✅ Photos uploadées:', realPhotos.length);

    // ══════════════════════════════════════════════════════════════════════════
    // RESPOND EARLY — Send text data immediately, generate images in background
    // ══════════════════════════════════════════════════════════════════════════
    const jobId = shouldGenerateImages ? `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : null;

    // Testimonials sans images individuelles
    const finalTestimonials = (gptResult.testimonials || []).map(t => ({ ...t, image: '' }));

    const productPage = {
      title: gptResult.title || scraped.title || '',
      currency: storeContext.currency || '',
      targetMarket: storeContext.country || '',
      country: storeContext.country || '',
      city: storeContext.city || '',
      locale: '',
      hero_headline: gptResult.hero_headline || null,
      hero_slogan: gptResult.hero_slogan || null,
      hero_baseline: gptResult.hero_baseline || null,
      hero_cta: gptResult.hero_cta || null,
      urgency_badge: gptResult.urgency_badge || null,
      problem_section: gptResult.problem_section || null,
      solution_section: gptResult.solution_section || null,
      stats_bar: gptResult.stats_bar || [],
      offer_block: gptResult.offer_block || null,
      seo: gptResult.seo || null,
      prompt_avant_apres: gptResult.prompt_avant_apres || null,
      hero_target_person: gptResult.hero_target_person || null,
      heroImage: null,
      heroPosterImage: null,
      beforeAfterImage: null,
      beforeAfterImages: [],
      socialProofImages: [],
      descriptionGifs: [],
      angles: (gptResult.angles || []).map((a, i) => ({ ...a, poster_url: null, index: i + 1 })),
      raisons_acheter: gptResult.raisons_acheter || [],
      benefits_bullets: gptResult.benefits_bullets || [],
      conversion_blocks: gptResult.conversion_blocks || [],
      urgency_elements: gptResult.urgency_elements || null,
      faq: gptResult.faq || [],
      testimonials: finalTestimonials,
      testimonialsGroupImage: null,
      testimonialsSocialProofImage: null,
      reassurance: gptResult.reassurance || null,
      guide_utilisation: gptResult.guide_utilisation || null,
      description: '',
      realPhotos,
      allImages: [],
      sourceUrl: cleanUrl,
      createdByAI: true,
      generatedAt: new Date().toISOString(),
      imageJobId: jobId,
      imageGenerationMode,
      imageAspectRatio,
      visualTemplate,
      preferredColor,
      heroVisualDirection,
      decorationDirection,
      titleColor,
      contentColor,
    };

    // Récupérer le nombre de générations restantes
    const updatedWorkspace = workspace ? await EcomWorkspace.findById(workspace._id)
      .select('freeGenerationsRemaining paidGenerationsRemaining totalGenerations simpleGenerationsRemaining')
      .lean() : null;

    const generationsInfo = updatedWorkspace ? {
      remaining: (updatedWorkspace.simpleGenerationsRemaining || 0) + (updatedWorkspace.freeGenerationsRemaining || 0) + (updatedWorkspace.paidGenerationsRemaining || 0),
      totalUsed: updatedWorkspace.totalGenerations || 0
    } : null;

    // Track feature usage
    if (req.workspaceId && req.user) {
      FeatureUsageLog.create({
        workspaceId: req.workspaceId,
        userId: req.user._id || req.user.id,
        feature: 'product_page_generator',
        meta: {
          productUrl: cleanUrl || null,
          productName: gptResult?.title || scraped?.title || null,
          success: true
        }
      }).catch(() => { });
    }

    // ── Update task with generated product data ────────────────────────────────
    await updateTask(taskId, {
      status: shouldGenerateImages ? 'generating_images' : 'done',
      productName: gptResult.title || scraped?.title || 'Produit sans nom',
      product: productPage,
      imageJobId: jobId,
      currentStep: shouldGenerateImages ? 'Génération des images en cours...' : 'Terminé',
      progressPercent: shouldGenerateImages ? 40 : 100,
      'input.photoUrls': realPhotos,
    });

    // ── RESPOND NOW — client gets the preview immediately
    console.log('📤 Réponse envoyée, génération images en arrière-plan (jobId:', jobId, ', taskId:', taskId, ')');
    res.json({
      success: true,
      product: productPage,
      generations: generationsInfo,
      imageJobId: jobId,
      taskId,
    });

    if (!shouldGenerateImages) {
      console.log('🖼️ [PG] Génération d\'images désactivée par la requête');
      return;
    }

    void runBackgroundImageGeneration({
      taskId,
      workspaceId: req.workspaceId,
      userId,
      productData: productPage,
      visualTemplate,
      visualContext,
      approach,
      realPhotos,
      cleanUrl,
      sourceBuffer: imageFiles[0]?.buffer || null,
      imageJobId: jobId,
    });

  } catch (error) {
    console.error('❌ Erreur génération:', error.message);
    console.error('❌ Stack:', error.stack);

    // Update the early-created task with error status
    if (taskId) {
      await updateTask(taskId, {
        status: 'error',
        errorMessage: error.message || 'Erreur lors de la génération',
        currentStep: 'Erreur',
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération'
    });
  }
});

export default router;
