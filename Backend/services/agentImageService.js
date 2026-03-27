import Groq from 'groq-sdk';
import StoreProduct from '../models/StoreProduct.js';
import ProductConfig from '../models/ProductConfig.js';

let groq = null;

const initGroq = () => {
  if (!groq && process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
};

/**
 * Analyse une image envoyée par un client via OpenAI Vision
 * et détermine si elle correspond à un produit du catalogue.
 *
 * @param {string} base64Image - Image encodée en base64
 * @param {string} mimetype    - ex: 'image/jpeg', 'image/png'
 * @param {string} workspaceId - ID du workspace pour filtrer les produits
 * @returns {Promise<Object>}  - { description, matchedProduct, confidence, isProductImage }
 */
const analyzeImage = async (base64Image, mimetype, workspaceId) => {
  initGroq();
  if (!groq) throw new Error('Groq non configuré – GROQ_API_KEY manquante');

  // 1. Récupérer le catalogue produits du workspace
  const [storeProducts, productConfigs] = await Promise.all([
    StoreProduct.find({ workspaceId, isPublished: true })
      .select('name description category price images tags')
      .lean(),
    ProductConfig.find({ workspaceId, isActive: true })
      .select('productName productNameVariants pricing')
      .lean()
  ]);

  const catalogSummary = buildCatalogSummary(storeProducts, productConfigs);

  // 2. Appeler Groq Vision pour analyser l'image
  const startTime = Date.now();

  const completion = await groq.chat.completions.create({
    model: process.env.AGENT_VISION_MODEL || 'llama-3.2-11b-vision-preview',
    messages: [
      {
        role: 'system',
        content: `Tu es un assistant spécialisé dans la reconnaissance de produits pour une boutique en ligne.
Tu dois analyser l'image envoyée et déterminer si elle correspond à un produit du catalogue.

CATALOGUE PRODUITS:
${catalogSummary}

INSTRUCTIONS:
1. Décris brièvement ce que tu vois dans l'image (en 1-2 phrases).
2. Détermine si l'image montre un produit qui correspond à un article du catalogue.
3. Si oui, indique le nom exact du produit correspondant.
4. Donne un score de confiance de 0 à 100.

Réponds UNIQUEMENT en JSON (sans markdown) avec ce format:
{
  "description": "Description courte de l'image",
  "isProductImage": true/false,
  "matchedProductName": "Nom du produit correspondant ou null",
  "confidence": 0-100,
  "details": "Détails supplémentaires sur la correspondance"
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimetype || 'image/jpeg'};base64,${base64Image}`
            }
          },
          {
            type: 'text',
            text: 'Analyse cette image et dis-moi si elle correspond à un produit de notre catalogue.'
          }
        ]
      }
    ],
    max_tokens: 500,
    temperature: 0.3
  });

  const processingTime = Date.now() - startTime;
  const responseText = completion.choices[0].message.content.trim();
  const tokensUsed = completion.usage?.total_tokens || 0;

  // 3. Parser la réponse JSON
  let analysis;
  try {
    const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    analysis = JSON.parse(jsonStr);
  } catch {
    analysis = {
      description: responseText,
      isProductImage: false,
      matchedProductName: null,
      confidence: 0,
      details: 'Impossible de parser la réponse vision'
    };
  }

  // 4. Si un produit est détecté, enrichir avec les données du catalogue
  let matchedProduct = null;
  if (analysis.isProductImage && analysis.matchedProductName) {
    matchedProduct = findMatchingProduct(
      analysis.matchedProductName,
      storeProducts,
      productConfigs
    );
  }

  return {
    description: analysis.description,
    isProductImage: analysis.isProductImage,
    matchedProductName: analysis.matchedProductName,
    matchedProduct,
    confidence: analysis.confidence || 0,
    details: analysis.details,
    tokensUsed,
    processingTime
  };
};

/**
 * Construit un résumé textuel du catalogue pour le prompt Vision.
 */
function buildCatalogSummary(storeProducts, productConfigs) {
  const lines = [];

  for (const p of storeProducts) {
    const tags = p.tags?.length ? ` (tags: ${p.tags.join(', ')})` : '';
    lines.push(`- ${p.name} | ${p.price} FCFA | catégorie: ${p.category || 'N/A'}${tags}`);
  }

  for (const pc of productConfigs) {
    const alreadyListed = storeProducts.some(
      sp => sp.name.toLowerCase() === pc.productName.toLowerCase()
    );
    if (!alreadyListed) {
      const variants = pc.productNameVariants?.length
        ? ` (alias: ${pc.productNameVariants.join(', ')})`
        : '';
      lines.push(`- ${pc.productName} | ${pc.pricing?.sellingPrice || '?'} FCFA${variants}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Aucun produit dans le catalogue.';
}

/**
 * Cherche le produit correspondant dans le catalogue.
 */
function findMatchingProduct(matchedName, storeProducts, productConfigs) {
  const normalised = matchedName.toLowerCase().trim();

  // Chercher dans StoreProduct
  for (const p of storeProducts) {
    if (p.name.toLowerCase().includes(normalised) || normalised.includes(p.name.toLowerCase())) {
      return {
        source: 'store',
        id: p._id,
        name: p.name,
        price: p.price,
        category: p.category,
        image: p.images?.[0]?.url || null,
        description: p.description?.substring(0, 200) || ''
      };
    }
  }

  // Chercher dans ProductConfig (+ variantes)
  for (const pc of productConfigs) {
    const names = [pc.productName, ...(pc.productNameVariants || [])].map(n => n.toLowerCase());
    for (const name of names) {
      if (name.includes(normalised) || normalised.includes(name)) {
        return {
          source: 'config',
          id: pc._id,
          name: pc.productName,
          price: pc.pricing?.sellingPrice || null,
          category: null,
          image: null,
          description: ''
        };
      }
    }
  }

  return null;
}

/**
 * Génère une réponse agent adaptée au résultat de l'analyse d'image.
 */
const buildImageResponsePrompt = (analysis, conversation) => {
  if (analysis.isProductImage && analysis.matchedProduct) {
    const p = analysis.matchedProduct;
    return `Le client a envoyé une image qui correspond au produit "${p.name}" (${p.price} FCFA).
Image: "${analysis.description}"
Confiance: ${analysis.confidence}%

Confirme au client qu'il s'agit bien de ce produit, donne quelques détails positifs et pousse vers la livraison aujourd'hui.`;
  }

  if (analysis.isProductImage && !analysis.matchedProduct) {
    return `Le client a envoyé une image d'un produit mais il ne correspond à aucun article de notre catalogue.
Image: "${analysis.description}"

Informe poliment le client que ce produit n'est pas disponible dans notre boutique. 
Propose-lui de regarder nos produits disponibles et demande-lui ce qu'il recherche.`;
  }

  return `Le client a envoyé une image qui ne semble pas être un produit.
Image: "${analysis.description}"

Remercie le client pour l'image et ramène la conversation vers sa commande ou nos produits.`;
};

export {
  analyzeImage,
  buildImageResponsePrompt,
  findMatchingProduct,
  buildCatalogSummary
};
