/**
 * Gemini Product Information Extractor
 * Utilise Gemini 2.0 Flash avec Google Search Grounding pour extraire
 * les informations d'un produit à partir de n'importe quel lien web.
 * 
 * Supporte: Amazon, Alibaba, AliExpress, boutiques e-commerce, etc.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.NANOBANANA_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY non configuré - l\'extraction de produit ne fonctionnera pas');
}

/**
 * Extrait les informations d'un produit à partir d'un lien
 * @param {string} url - URL du produit (Amazon, Alibaba, AliExpress, etc.)
 * @returns {Promise<{title: string, description: string, rawText: string}>}
 */
export async function extractProductInfo(url) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY non configuré. Ajoutez-le dans votre .env');
  }

  console.log('🤖 Gemini extraction pour:', url);

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Utilisez gemini-1.5-pro qui supporte le grounding avec Google Search
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.3, // Plus bas pour des résultats factuels
        maxOutputTokens: 2000,
      }
    });

    const prompt = `Analyse cette page produit e-commerce et extrait les informations clés en français :

URL: ${url}

Instructions :
1. Visite cette URL et analyse le contenu de la page produit
2. Extrait le TITRE EXACT du produit (pas de reformulation)
3. Extrait la DESCRIPTION complète et détaillée du produit (caractéristiques, spécifications, matériaux, dimensions, utilisation, etc.)
4. Si la description est courte, enrichis-la avec les détails visibles sur la page (bullet points, specs, etc.)

Format de réponse STRICTEMENT en JSON valide :
{
  "title": "Titre exact du produit",
  "description": "Description complète et détaillée en français, incluant toutes les caractéristiques importantes (minimum 150 mots). Décris les matériaux, dimensions, fonctionnalités, utilisation, avantages, etc."
}

IMPORTANT: 
- Ne retourne QUE le JSON, rien d'autre
- La description doit être riche et détaillée (minimum 150 mots)
- Utilise les informations réelles de la page produit
- Traduis en français si nécessaire`;

    console.log('🔍 Envoi de la requête à Gemini avec grounding...');
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{
        googleSearch: {} // Active Google Search Grounding
      }]
    });

    const response = result.response;
    const text = response.text();
    
    console.log('✅ Réponse Gemini reçue, longueur:', text.length);

    // Parse le JSON de la réponse
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: chercher entre ```json et ```
      jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonMatch = [jsonMatch[1]];
      }
    }

    if (!jsonMatch) {
      throw new Error('Format de réponse JSON invalide de Gemini');
    }

    const data = JSON.parse(jsonMatch[0]);

    if (!data.title || !data.description) {
      throw new Error('Données incomplètes de Gemini (title ou description manquant)');
    }

    // Validation basique
    if (data.title.length < 5) {
      throw new Error('Titre trop court - extraction échouée');
    }

    if (data.description.length < 50) {
      throw new Error('Description trop courte - extraction échouée');
    }

    // Nettoyage du titre
    const title = data.title
      .replace(/\s*[|–-]\s*(Amazon|Alibaba|AliExpress|eBay).*$/i, '')
      .replace(/\s*\|\s*.*$/, '')
      .trim()
      .slice(0, 200);

    // Garder la description complète
    const description = data.description.trim();

    // rawText pour contexte (utilisé par l'IA de génération)
    const rawText = `${title}\n\n${description}`.slice(0, 3000);

    console.log('✅ Extraction Gemini complétée:', { 
      title: title.slice(0, 60) + '...', 
      descLength: description.length,
      rawLength: rawText.length 
    });

    return {
      title,
      description,
      rawText
    };

  } catch (error) {
    console.error('❌ Erreur Gemini extraction:', error.message);
    
    // Message d'erreur plus informatif
    if (error.message.includes('API key')) {
      throw new Error('Clé API Gemini invalide ou manquante');
    }
    if (error.message.includes('grounding') || error.message.includes('search')) {
      throw new Error('Gemini grounding non disponible - vérifiez votre quota API');
    }
    if (error.message.includes('JSON')) {
      throw new Error('Impossible de parser la réponse de Gemini - format invalide');
    }
    
    throw new Error(`Extraction Gemini échouée: ${error.message}`);
  }
}

/**
 * Vérifie que Gemini est configuré et disponible
 */
export function isGeminiConfigured() {
  return !!GEMINI_API_KEY;
}
