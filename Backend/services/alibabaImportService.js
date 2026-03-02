/**
 * Alibaba Import Service
 * Scrape → GPT copywriting → DALL-E images → R2 upload
 */

import axios from 'axios';
import OpenAI from 'openai';
import { uploadImage, isConfigured } from './cloudflareImagesService.js';

let _openai = null;

function getOpenAI() {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

// ─── Step 1: Scrape Alibaba ───────────────────────────────────────────────────

export async function scrapeAlibaba(url) {
  const result = { url, title: '', description: '', images: [], specs: {}, rawText: '' };

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: SCRAPE_HEADERS
    });
    clearTimeout(t);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = String(await resp.text());

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]{3,200})<\/title>/i);
    result.title = (titleMatch?.[1] || '')
      .replace(/\s*[|–-]\s*Alibaba.*$/i, '')
      .replace(/\s*\|\s*.*$/, '')
      .trim();

    // Meta description
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,500})["']/i)
      || html.match(/<meta[^>]+content=["']([^"']{10,500})["'][^>]+name=["']description["']/i);
    result.description = metaDesc?.[1] || '';

    // Product images (alicdn CDN)
    const imgRegex = /(?:https?:)?\/\/[a-z0-9._-]*alicdn\.com\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>)]*)?/gi;
    const rawImgs = [...new Set([...html.matchAll(imgRegex)].map(m => m[0]))];
    result.images = rawImgs
      .filter(s => !s.includes('icon') && !s.includes('logo') && !s.includes('avatar') && s.length < 300)
      .slice(0, 6)
      .map(s => (s.startsWith('//') ? 'https:' + s : s));

    // Key-value specs from JSON-LD or inline data
    const kvRegex = /"(?:name|key)"\s*:\s*"([^"]{2,60})"\s*,\s*"(?:value|detail)"\s*:\s*"([^"]{1,200})"/gi;
    let m;
    let count = 0;
    while ((m = kvRegex.exec(html)) !== null && count < 25) {
      result.specs[m[1]] = m[2];
      count++;
    }

    // Raw text for GPT context (strip scripts/styles/tags)
    result.rawText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 5000);

  } catch (err) {
    console.warn(`⚠️  Alibaba scrape failed (${url}): ${err.message}`);
    throw new Error(`Impossible d'accéder à la page Alibaba : ${err.message}`);
  }

  // Si le titre ET le texte brut sont vides → Alibaba a bloqué la requête
  if (!result.title && result.rawText.length < 200) {
    throw new Error('Alibaba a bloqué le scraping. Attendez 30 secondes et réessayez, ou essayez une autre URL.');
  }

  return result;
}

// ─── Step 2: GPT Copywriting ─────────────────────────────────────────────────

export async function analyzeWithGPT(scraped) {
  const openai = getOpenAI();
  if (!openai) throw new Error('Clé OpenAI API non configurée. Ajoutez OPENAI_API_KEY dans les variables d\'environnement.');

  const contextLines = [
    scraped.title && `Titre extrait: ${scraped.title}`,
    scraped.description && `Méta-description: ${scraped.description}`,
    Object.keys(scraped.specs).length > 0 && `Spécifications: ${JSON.stringify(scraped.specs)}`,
    scraped.rawText && `Texte brut page: ${scraped.rawText.slice(0, 3500)}`
  ].filter(Boolean).join('\n\n');

  const prompt = `Tu es un copywriter premium spécialisé en transformation de produits Alibaba en fiches produits haut de gamme pour les marchés africains modernes (Cameroun, Sénégal, Côte d'Ivoire, Togo, Bénin, Mali…).

Ton style: inspiré des plus grandes marques (Apple, Samsung, Nike) mais adapté au marché africain. Tu vends du RÊVE et de la TRANSFORMATION, pas des caractéristiques.

On t'a fourni des données brutes extraites de cette page Alibaba: ${scraped.url}

DONNÉES EXTRAITES:
${contextLines || 'Seule l\'URL est disponible — déduis le produit depuis l\'URL et génère un contenu premium.'}

TON OBJECTIF: Transformer ces données fournisseur basiques en une FICHE PRODUIT PREMIUM ultra-désirable en FRANÇAIS, avec positionnement haut de gamme.

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant/après, aucun markdown):
{
  "name": "Nom produit court et percutant (max 7 mots, pas de marques génériques)",
  "hook": "Accroche émotionnelle ultra-courte (1 phrase choc, max 12 mots)",
  "headline": "Titre de page produit émotionnel (max 15 mots)",
  "problemSolved": "Problème principal résolu clairement (1-2 phrases)",
  "benefits": [
    "Bénéfice concret #1 (commence par un verbe d'action)",
    "Bénéfice concret #2",
    "Bénéfice concret #3",
    "Bénéfice concret #4",
    "Bénéfice concret #5"
  ],
  "useCases": [
    "Situation d'usage réelle #1 (contexte africain)",
    "Situation d'usage réelle #2",
    "Situation d'usage réelle #3"
  ],
  "description": "Description storytelling complète en HTML (4-5 sections, 350-500 mots). Utilise <h3> pour les titres de section (en gras), <p> pour les paragraphes, <img> pour les images marketing. Structure: problème → solution → bénéfices → confiance → CTA. Phrases courtes pour mobile. Exemple: '<h3>Pourquoi ce produit ?</h3><p>Texte du paragraphe...</p><img src=\"PLACEHOLDER_IMG_1\" alt=\"Marketing Image\" /><h3>Bénéfices clés</h3><p>Texte...</p>'",
  "specs": [
    {"label": "Matière", "value": "..."},
    {"label": "Dimensions", "value": "..."},
    {"label": "Poids", "value": "..."},
    {"label": "Couleurs disponibles", "value": "..."},
    {"label": "Compatibilité", "value": "..."}
  ],
  "faq": [
    {"question": "Est-ce que la livraison est rapide ?", "answer": "Réponse rassurante et précise"},
    {"question": "Quelle est la qualité du produit ?", "answer": "Réponse avec preuve sociale"},
    {"question": "Puis-je retourner le produit ?", "answer": "Réponse claire sur la politique"},
    {"question": "Est-ce adapté à mon pays ?", "answer": "Réponse spécifique Afrique de l'Ouest"},
    {"question": "Comment passer commande ?", "answer": "Étapes simples et rassurantes"}
  ],
  "marketingAngles": [
    "Angle marketing #1 (ex: urgence, peur de rater)",
    "Angle marketing #2 (ex: social proof, succès)",
    "Angle marketing #3 (ex: économies, valeur)"
  ],
  "tiktokHooks": [
    "POV: tu découvres enfin [problème résolu] 😱",
    "Ce produit a changé ma routine quotidienne 🔥",
    "Attends... c'est quoi CE truc ?! 👀",
    "Avant vs Après [produit] — la différence est ÉNORME",
    "Le secret que les [cible] ne veulent pas te dire"
  ],
  "whatsappMessage": "Message de vente WhatsApp complet (2-3 paragraphes, émojis, CTA, prix, lien commande fictif). Prêt à copier-coller.",
  "seoTitle": "Titre SEO optimisé (55-65 caractères max, mot-clé principal en premier)",
  "seoDescription": "Description SEO (140-155 caractères, inclut bénéfice principal + CTA)",
  "category": "Catégorie principale (ex: Électronique, Mode, Maison, Beauté, Sport)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "suggestedPrice": 15000,
  "currency": "XAF"
}

RÈGLES STRICTES:
- Français premium, naturel, adapté au marché africain moderne
- NE JAMAIS copier le texte Alibaba — TOUT réécrire avec style premium
- Phrases courtes (mobile-first) mais langage élevé, professionnel
- Accent sur les BÉNÉFICES ÉMOTIONNELS et transformation, pas caractéristiques
- Positionnement premium: qualité supérieure, design moderne, résultats garantis
- suggestedPrice en FCFA (XAF): si prix USD trouvé × 750 (premium), sinon estime selon catégorie + 30%
- Les specs: utilise les vraies données si disponibles, sinon génère des specs premium
- Marketing style: inspiré des grandes marques (Apple, Samsung, Nike) mais adapté Afrique
- Retourne UNIQUEMENT du JSON valide, sans \`\`\`json ni aucune explication`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.78,
    max_tokens: 3500,
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

// ─── Step 3: DALL-E Marketing Images ─────────────────────────────────────────

export async function generateMarketingImages(productName, description) {
  const openai = getOpenAI();
  if (!openai) return [];

  const name = (productName || 'product').slice(0, 80);
  const desc = (description || '').slice(0, 200);

  const prompts = [
    // Image 1: Product studio shot ultra-réaliste
    `Premium commercial product photography, professional studio setup. ${name} showcased on pristine white seamless background. Ultra-detailed macro shot, crystal clear focus, perfect exposure. Professional lighting setup: softbox overhead + two rim lights creating subtle depth. DSLR camera, 85mm f/1.8 lens, 4K resolution. Photorealistic, commercial grade, no shadows, clean aesthetic. Product centered, rule of thirds composition. Vibrant yet accurate colors, sharp textures visible. High-end ecommerce catalog style.`,
    
    // Image 2: Lifestyle scene ultra-réaliste  
    `Cinematic lifestyle photography featuring ${name}. Setting: modern minimalist workspace or contemporary African urban environment. Natural golden hour lighting streaming through large windows. Subject: stylish young African professional (28-35) authentically interacting with product. Depth of field with subject in sharp focus, beautiful bokeh background. Shot on Sony A7R IV with prime lens, 4K quality. Realistic skin tones, genuine expression, product integration feels natural. Architectural elements, warm color palette, aspirational yet relatable mood. Professional commercial photography style.`
  ];

  const urls = [];
  for (let i = 0; i < prompts.length; i++) {
    try {
      console.log(`🎨 Generating DALL-E image ${i + 1}/2 for: ${name}`);
      const resp = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompts[i],
        n: 1,
        size: '1024x1024',
        quality: 'hd', // HD quality for more realistic images
        style: 'vivid' // More vibrant and realistic
      });
      const url = resp.data?.[0]?.url;
      if (url) {
        urls.push(url);
        console.log(`✅ DALL-E image ${i + 1} generated successfully`);
      }
    } catch (err) {
      console.warn(`⚠️  DALL-E error image ${i + 1}: ${err.message}`);
      // Fallback to standard quality if HD fails
      if (err.message.includes('quality')) {
        try {
          console.log(`🔄 Retrying image ${i + 1} with standard quality...`);
          const resp = await openai.images.generate({
            model: 'dall-e-3',
            prompt: prompts[i],
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            style: 'vivid'
          });
          const url = resp.data?.[0]?.url;
          if (url) {
            urls.push(url);
            console.log(`✅ DALL-E image ${i + 1} generated with standard quality`);
          }
        } catch (retryErr) {
          console.warn(`⚠️  DALL-E retry failed for image ${i + 1}: ${retryErr.message}`);
        }
      }
    }
  }

  console.log(`🎯 Generated ${urls.length}/2 marketing images for: ${name}`);
  return urls;
}

// ─── Step 4: Download external image → upload to R2 ──────────────────────────

export async function downloadAndUploadImage(imgUrl, workspaceId, userId) {
  try {
    if (!isConfigured()) {
      // R2 not configured — return external URL as-is (no upload)
      return { url: imgUrl, key: null };
    }

    const resp = await axios.get(imgUrl, {
      responseType: 'arraybuffer',
      timeout: 25000,
      headers: { 'User-Agent': 'ScalorImporter/1.0' },
      maxRedirects: 3
    });

    const ct = resp.headers['content-type'] || 'image/jpeg';
    const extRaw = ct.split('/')[1]?.split(';')[0] || 'jpg';
    const ext = extRaw === 'jpeg' ? 'jpg' : extRaw.slice(0, 4);
    const filename = `alibaba-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

    const result = await uploadImage(Buffer.from(resp.data), filename, {
      workspaceId: String(workspaceId || 'unknown'),
      uploadedBy: String(userId || 'system'),
      mimeType: ct
    });

    return result?.url ? { url: result.url, key: result.key || result.id } : null;
  } catch (err) {
    console.warn(`⚠️  Image upload from URL failed: ${err.message}`);
    return null;
  }
}
