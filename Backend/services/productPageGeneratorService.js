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

  const systemPrompt = `TU ES : Scalor AI, un moteur intelligent de création de pages produit e-commerce optimisées pour la conversion sur le marché africain francophone.

MISSION :
Transformer des informations brutes fournisseur + des images réelles utilisateur en une page produit professionnelle prête à vendre.

--------------------------------------------------

ENTRÉES FOURNIES :

CONTEXTE PRODUIT (HTML Alibaba simplifié — uniquement pour compréhension)

Titre brut :
${scrapedData.title || 'Non disponible'}

Description brute :
${(scrapedData.description || scrapedData.rawText || '').slice(0, 1000) || 'Non disponible'}

Images envoyées par l'utilisateur :
${imageBuffers.length} images réelles du produit.

IMPORTANT :
- Les images utilisateur sont la SEULE source visuelle autorisée.
- Ne jamais utiliser ni mentionner Alibaba.
- Ne jamais parler du fournisseur.
- Tout doit être reformulé.

--------------------------------------------------

PHASE 1 — COMPRÉHENSION PRODUIT

Déduis :
- le problème principal résolu
- le type de client cible en Afrique
- le contexte d'utilisation réel
- les motivations d'achat

--------------------------------------------------

PHASE 2 — ANALYSE DES IMAGES

Pour chaque image :

1. Décris brièvement ce que montre l'image.
2. Identifie le bénéfice client visible.
3. Associe un angle marketing.

Chaque image doit servir une intention marketing.

--------------------------------------------------

PHASE 3 — STRATÉGIE MARKETING

Détermine automatiquement :

- angle de vente principal
- promesse centrale
- émotion dominante (gain temps, confort, simplicité, économie, modernité…)

--------------------------------------------------

PHASE 4 — GÉNÉRATION PAGE PRODUIT

Créer une page optimisée mobile-first contenant :

1. Titre principal impactant
2. Accroche émotionnelle courte
3. Section PROBLÈME client
4. Section SOLUTION produit
5. 4 à 6 sections bénéfices illustrées par images
6. Comment utiliser (simple et rassurant)
7. Pourquoi choisir ce produit
8. Appel à l'action final

STYLE D'ÉCRITURE :

- Français simple
- Clair et naturel
- Ton humain
- Adapté Afrique francophone
- Axé bénéfices clients
- Phrases courtes
- Pas de jargon technique

--------------------------------------------------

PHASE 5 — STRUCTURATION TECHNIQUE

Retourner UNIQUEMENT un JSON valide.

FORMAT OBLIGATOIRE :

{
  "productUnderstanding": {
    "targetCustomer": "",
    "mainProblem": "",
    "mainPromise": "",
    "marketingAngle": ""
  },
  "mainTitle": "",
  "hook": "",
  "problem": "",
  "solution": "",
  "sections": [
    {
      "title": "",
      "description": "",
      "imageIndex": 0,
      "marketingGoal": ""
    }
  ],
  "howToUse": "",
  "whyChooseUs": "",
  "cta": ""
}

RÈGLES STRICTES :

- Aucun texte hors JSON.
- imageIndex commence à 0.
- Chaque section doit correspondre à une image utilisateur (max imageIndex = ${Math.max(0, imageBuffers.length - 1)}).
- Ne jamais inventer d'images supplémentaires.
- Maximum conversion, minimum blabla.`;

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
