/**
 * Product Page Generator Service
 * User photos + Alibaba URL → GPT-4o Vision → Page Structure → DALL-E scenes → R2
 */

import axios from 'axios';
import OpenAI from 'openai';
import { uploadImage, isConfigured } from './cloudflareImagesService.js';
import { scrapeAlibaba } from './alibabaImportService.js';
import { randomUUID } from 'crypto';

let _openai = null;
function getOpenAI() {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export { scrapeAlibaba };

// ─── Génération d'affiches marketing avec DALL-E ───────────────────────────────

export async function generateMarketingPoster(baseImageBuffer, posterTitle, posterSubtitle) {
  const openai = getOpenAI();
  if (!openai) throw new Error('Clé OpenAI API non configurée.');

  try {
    // Convertir l'image en base64
    const base64Image = baseImageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const response = await openai.images.edit({
      image: dataUrl,
      prompt: `Create a professional high-converting marketing poster for this product.
      
MAIN TITLE (large, prominent): "${posterTitle}"
SUBTITLE (smaller, explanatory): "${posterSubtitle}"

STYLE REQUIREMENTS:
- Modern and clean design
- Vertical 9:16 format (mobile optimized)
- Harmonious professional colors
- White or high-contrast text, very readable
- Product highlighted as the hero
- Professional background
- No external logos or brands
- Clear and impactful marketing message

Product must remain identical to reference image, same shape, same color, same details.
Must look like authentic ecommerce lifestyle photography with realistic skin texture and natural lighting.`,
      n: 1,
      size: "1024x1792", // Format vertical haute qualité
      model: "gpt-image-1",
      quality: "hd"
    });

    return response.data[0];
  } catch (error) {
    console.error('Erreur génération affiche:', error);
    throw new Error('Impossible de générer l\'affiche marketing');
  }
}

// ─── GPT-4o Vision: analyze product + build full page structure ───────────────

export async function analyzeWithVision(scrapedData, imageBuffers = []) {
  const openai = getOpenAI();
  if (!openai) throw new Error('Clé OpenAI API non configurée.');

  const systemPrompt = `You are an advanced AI Ecommerce Product Page Builder.

You MUST use the most recent available OpenAI text model (GPT-5.2 or newer if available).
You MUST generate image prompts optimized specifically for the latest OpenAI image model: "gpt-image-1".

Do NOT use deprecated models such as:
- dall-e-2
- dall-e-3
- gpt-4o-image
- any legacy image model

All generated image prompts must be optimized for "gpt-image-1".

Your role is to generate a complete high-converting ecommerce product page for the African market using:

1) A product reference image provided by the user
2) Scraped product information from a provided URL

Your objective is to SELL, not to describe technically.

--------------------------------------------------
STEP 1 — PRODUCT ANALYSIS
--------------------------------------------------

Analyze:
- The reference image
- The scraped URL content

Identify:
- Product category
- Real customer problems
- Emotional triggers
- Lifestyle usage situations in African context

Avoid copying supplier text.
Focus on transformation and benefit.

--------------------------------------------------
STEP 2 — MARKETING CONTENT GENERATION
--------------------------------------------------

Generate:

1) Product Title
- Short
- Powerful
- Conversion-focused

2) Hook Paragraph
- Emotional
- Problem → Solution oriented
- 2–3 sentences max

3) Exactly FIVE (5) Key Benefits

For each benefit generate:
- benefit_title
- benefit_description (max 2 sentences)
- image_prompt

--------------------------------------------------
STEP 3 — IMAGE PROMPT RULES (FOR gpt-image-1)
--------------------------------------------------

Each image_prompt MUST:

- Be optimized for the OpenAI model "gpt-image-1"
- Specify ultra realistic lifestyle photography
- Include African models
- Natural lighting
- Commercial ecommerce photography style
- Realistic skin texture
- Product clearly visible
- Product being used naturally
- No artificial AI look
- No CGI
- No illustration
- No cartoon style

VERY IMPORTANT:

The product MUST remain visually identical to the reference image across all 5 generated images.

Include this mandatory phrase in every image prompt:

"Product must remain identical to reference image, same shape, same color, same details."

Images must look like authentic ecommerce lifestyle photos.

--------------------------------------------------
STEP 4 — OUTPUT FORMAT
--------------------------------------------------

Return ONLY valid JSON.

Structure:

{
  "title": "",
  "hook": "",
  "benefits": [
    {
      "benefit_title": "",
      "benefit_description": "",
      "image_prompt": ""
    }
  ]
}

Generate EXACTLY 5 benefits.
No explanations.
No markdown.
No extra text.
Return only JSON.

PRODUCT CONTEXT:
Title: ${scrapedData.title || 'Not available'}
Description: ${(scrapedData.description || scrapedData.rawText || '').slice(0, 1000) || 'Not available'}
Images provided: ${imageBuffers.length} real product images

IMPORTANT: Use the provided images as reference. Generate content that sells the emotional transformation, not technical features.`;

  const content = [{ type: 'text', text: systemPrompt }];

  for (const buf of imageBuffers.slice(0, 8)) {
    try {
      const base64 = buf.toString('base64');
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' }
      });
    } catch (_) {}
  }

  let pageStructure;
  try {
    let response;
    let raw;
    
    // Try modern responses API first
    try {
      response = await openai.responses.create({
        model: "gpt-5.2",
        input: content,
        max_completion_tokens: 1500,
        response_format: { type: "json_object" }
      });
      raw = response.output?.[0]?.message?.content || response.choices?.[0]?.message?.content || '{}';
    } catch (responsesError) {
      console.warn('⚠️ responses API failed, falling back to chat.completions:', responsesError.message);
      
      // Fallback to chat.completions with max_completion_tokens
      response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content }],
        max_completion_tokens: 1500,
        response_format: { type: "json_object" }
      });
      raw = response.choices[0]?.message?.content || '{}';
    }
    
    try {
      pageStructure = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]+\}/);
      if (match) {
        pageStructure = JSON.parse(match[0]);
      } else {
        throw new Error('Réponse IA invalide — veuillez réessayer');
      }
    }
  } catch (error) {
    console.error('❌ OpenAI API error:', error.message);
    throw new Error(`OpenAI API error: ${error.message}`);
  }

  // Safety check before accessing pageStructure
  if (!pageStructure) {
    throw new Error('Failed to generate valid page structure from OpenAI');
  }

  return pageStructure;
}

// ─── DALL-E 3: generate a single scene image ──────────────────────────────────

export async function generateSceneImage(prompt) {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: String(prompt).slice(0, 4000),
      n: 1,
      size: '1024x1024',
      quality: 'hd'
    });
    return resp.data?.[0]?.url || null;
  } catch (err) {
    console.warn(`⚠️  gpt-image-1 scene error: ${err.message}`);
    return null;
  }
}

// ─── Upload raw buffer → R2 ───────────────────────────────────────────────────

export async function uploadBufferToR2(buffer, mimeType, workspaceId, userId) {
  if (!buffer || !isConfigured()) return null;
  try {
    const extRaw = (mimeType || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
    const ext = extRaw === 'jpeg' ? 'jpg' : extRaw.slice(0, 4);
    const filename = `product-gen-${randomUUID()}.${ext}`;
    const result = await uploadImage(buffer, filename, {
      workspaceId: String(workspaceId || 'unknown'),
      uploadedBy: String(userId || 'system'),
      mimeType: mimeType || 'image/jpeg'
    });
    return result?.url ? { url: result.url, key: result.key || result.id } : null;
  } catch (err) {
    console.warn(`⚠️  Buffer R2 upload error: ${err.message}`);
    return null;
  }
}

// ─── Download external URL → upload to R2 ────────────────────────────────────

export async function downloadAndUploadToR2(imgUrl, workspaceId, userId) {
  try {
    const resp = await axios.get(imgUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'ScalorImporter/1.0' },
      maxRedirects: 3
    });
    const ct = resp.headers['content-type'] || 'image/jpeg';
    return await uploadBufferToR2(Buffer.from(resp.data), ct, workspaceId, userId);
  } catch (err) {
    console.warn(`⚠️  Download+R2 upload failed: ${err.message}`);
    return null;
  }
}
