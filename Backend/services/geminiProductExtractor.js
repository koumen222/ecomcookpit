/**
 * Gemini Product Information Extractor
 * Utilise Gemini avec fallback sur plusieurs modèles pour générer
 * des descriptions produits optimisées à partir d'URLs e-commerce.
 * 
 * Supporte: Amazon, Alibaba, AliExpress, boutiques e-commerce, etc.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.NANOBANANA_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY non configuré - l\'extraction de produit ne fonctionnera pas');
}

// Modèles par ordre de priorité (sans grounding qui nécessite des permissions spéciales)
const GEMINI_MODELS = [
  'gemini-3-flash-preview',
];

export async function extractProductInfo(url) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY non configuré. Ajoutez-le dans votre .env');
  }

  console.log('🤖 Gemini extraction pour:', url);

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Prompt optimisé pour générer du contenu réaliste sans accès direct à l'URL
  const prompt = `Tu es un assistant e-commerce expert. Analyse cette URL de produit et génère une fiche produit professionnelle et réaliste en français :

URL: ${url}

Basé sur l'URL et le nom du produit visible dans le lien, crée une description marketing complète avec :

1. Un TITRE descriptif et clair du produit
2. Une DESCRIPTION riche et détaillée (minimum 200 mots) incluant :
   - Caractéristiques principales du produit
   - Bénéfices pour le client
   - Utilisations recommandées
   - Spécifications techniques probables
   - Points de différenciation

Format de réponse STRICTEMENT en JSON valide :
{
  "title": "Titre du produit",
  "description": "Description complète et détaillée en français (minimum 200 mots)"
}

IMPORTANT: 
- Ne retourne QUE le JSON, sans markdown ni texte supplémentaire
- Sois créatif mais réaliste basé sur le type de produit visible dans l'URL
- Utilise un ton marketing engageant et professionnel
- La description doit être vendeuse et informative`;

  let lastError = null;

  // Essayer chaque modèle jusqu'à en trouver un qui fonctionne
  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`🔍 Tentative avec modèle: ${modelName}`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
        },
      });

      // Appel simple sans grounding (pas besoin de permissions spéciales)
      const result = await model.generateContent(prompt);

      const text = result.response.text();
      console.log('✅ Réponse Gemini reçue, longueur:', text.length);

      // Parse JSON de la réponse - essayer plusieurs formats
      let data = null;
      const candidates = [];

      // Format 1 : bloc ```json ... ``` ou ``` ... ```
      const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeMatch) candidates.push(codeMatch[1]);

      // Format 2 : premier objet JSON brut dans le texte
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) candidates.push(jsonMatch[0]);

      for (const candidate of candidates) {
        try {
          data = JSON.parse(candidate);
          break;
        } catch (_) { /* essayer le suivant */ }
      }

      if (!data) {
        console.warn('⚠️ Réponse brute Gemini:', text.slice(0, 300));
        throw new Error('Format de réponse JSON invalide de Gemini');
      }

      if (!data.title || !data.description) {
        throw new Error('Données incomplètes (title ou description manquant)');
      }
      if (data.title.length < 5) throw new Error('Titre trop court');
      if (data.description.length < 50) throw new Error('Description trop courte');

      // Nettoyage du titre
      const title = data.title
        .replace(/\s*[|–-]\s*(Amazon|Alibaba|AliExpress|eBay).*$/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim()
        .slice(0, 200);

      const description = data.description.trim();
      const rawText = `${title}\n\n${description}`.slice(0, 3000);

      console.log(`✅ Extraction OK avec ${modelName}:`, {
        title: title.slice(0, 60) + '...',
        descLength: description.length,
      });

      return { title, description, rawText };

    } catch (err) {
      console.warn(`⚠️ Modèle ${modelName} échoué: ${err.message}`);
      lastError = err;

      // Arrêter uniquement sur erreurs auth/quota (inutile d'essayer d'autres modèles)
      const isAuthError = err.message.includes('API key') || err.message.includes('401') || err.message.includes('403');
      const isQuotaError = err.message.includes('quota') || err.message.includes('429');
      if (isAuthError || isQuotaError) break;

      // Pour les erreurs 404 / modèle introuvable ou erreurs JSON → on continue avec le prochain modèle
    }
  }

  // Tous les modèles ont échoué
  console.error('❌ Tous les modèles Gemini ont échoué');

  if (lastError?.message.includes('API key')) {
    throw new Error('Clé API Gemini invalide ou manquante');
  }
  if (lastError?.message.includes('quota')) {
    throw new Error('Quota API Gemini dépassé - attendez ou utilisez une autre clé');
  }

  // Propager le dernier message d'erreur tel quel pour faciliter le débogage
  throw new Error(`Extraction Gemini échouée: ${lastError?.message}`);
}

/**
 * Vérifie que Gemini est configuré et disponible
 */
export function isGeminiConfigured() {
  return !!GEMINI_API_KEY;
}
