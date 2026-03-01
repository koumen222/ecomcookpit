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

// ─── GPT-4o Vision: analyze product + build full page structure ───────────────

export async function analyzeWithVision(scrapedData, imageBuffers = []) {
  const openai = getOpenAI();
  if (!openai) throw new Error('Clé OpenAI API non configurée.');

  const contextText = [
    scrapedData.title && `Titre: ${scrapedData.title}`,
    scrapedData.description && `Description: ${scrapedData.description}`,
    Object.keys(scrapedData.specs || {}).length > 0 && `Specs: ${JSON.stringify(scrapedData.specs)}`,
    scrapedData.rawText && `Texte page: ${scrapedData.rawText.slice(0, 2500)}`
  ].filter(Boolean).join('\n\n');

  const systemPrompt = `Tu es un senior ecommerce product page designer et conversion expert.

Tu reçois des données Alibaba et ${imageBuffers.length > 0 ? imageBuffers.length + ' vraie(s) photo(s) du produit' : 'aucune photo'}.

DONNÉES ALIBABA (URL: ${scrapedData.url}):
${contextText || 'Déduis le produit depuis l\'URL.'}

Crée une PAGE PRODUIT COMPLÈTE haute conversion pour l'Afrique de l'Ouest.
Analyse les photos pour comprendre le produit réel et générer des prompts cohérents.

Retourne UNIQUEMENT ce JSON valide:
{
  "product_title": "Titre court max 8 mots",
  "emotional_hook": "Accroche 1 phrase choc max 15 mots",
  "hero_image_prompt": "Ultra realistic ecommerce lifestyle photo. Young West African professional using the product in modern bright urban environment. Professional photography, natural lighting, ecommerce quality. 4K sharp. (60 words max)",
  "sections": [
    {
      "title": "Titre bénéfice",
      "description": "Description persuasive 2-3 phrases mobile-first en français",
      "image_scene_prompt": "Ultra realistic photo showing this exact benefit in action. West African context, natural light, ecommerce style. (50 words max)"
    }
  ],
  "advantages_infographic_prompt": "Clean modern product benefits infographic. White background, bright icons, all key advantages visible, professional ecommerce style. (40 words max)",
  "faq": [
    {"question": "Question ?", "answer": "Réponse rassurante en français"}
  ],
  "category": "Catégorie",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6"],
  "suggested_price": 15000,
  "seo_title": "Titre SEO 55-65 chars",
  "seo_description": "Description SEO 140-155 chars",
  "whatsapp_message": "Message WhatsApp complet émojis + CTA"
}

RÈGLES: 3 à 5 sections. Chaque image_scene_prompt illustre précisément son bénéfice. Prompts EN ANGLAIS. Reste en FRANÇAIS. suggested_price en FCFA.`;

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

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    max_tokens: 4000,
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]+\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Réponse IA invalide — veuillez réessayer');
  }
}

// ─── DALL-E 3: generate a single scene image ──────────────────────────────────

export async function generateSceneImage(prompt) {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const resp = await openai.images.generate({
      model: 'dall-e-3',
      prompt: String(prompt).slice(0, 4000),
      n: 1,
      size: '1024x1024',
      quality: 'standard'
    });
    return resp.data?.[0]?.url || null;
  } catch (err) {
    console.warn(`⚠️  DALL-E scene error: ${err.message}`);
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
