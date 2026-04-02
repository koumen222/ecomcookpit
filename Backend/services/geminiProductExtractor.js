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

// Modèle unique — celui qui fonctionne
const GEMINI_MODEL = 'gemini-3-flash-preview';

/**
 * Extrait et parse robustement un objet JSON d'une réponse Gemini.
 * Gère : blocs markdown, texte parasite, newlines littéraux, virgules traînantes,
 * guillemets non échappés dans les valeurs.
 */
function parseGeminiJSON(text) {
  // 1. Supprimer les blocs markdown ```json ... ```
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // 2. Isoler du premier { au dernier }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  cleaned = cleaned.slice(start, end + 1);

  // 3. Tentative directe
  try { return JSON.parse(cleaned); } catch (_) {}

  // 4. Échapper les newlines/tabs littéraux à l'intérieur des valeurs de chaînes
  //    On remplace les \n \r \t qui tombent entre des guillemets
  let fixed = cleaned.replace(/"((?:[^"\\]|\\.)*)"/gs, (match, inner) =>
    '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"'
  );
  try { return JSON.parse(fixed); } catch (_) {}

  // 5. Supprimer les virgules traînantes (,} ou ,])
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch (_) {}

  // 6. Fallback regex : extraire title et description directement du texte brut
  const titleMatch = cleaned.match(/"title"\s*:\s*"([\s\S]*?)"\s*[,}]/);
  const descMatch  = cleaned.match(/"description"\s*:\s*"([\s\S]*?)"\s*[,}]/);
  if (titleMatch && descMatch) {
    return {
      title: titleMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').trim(),
      description: descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim(),
    };
  }

  return null;
}

/**
 * Fallback : extrait title + description depuis du texte brut non-JSON.
 */
function extractFromPlainText(text, url) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Titre = première ligne non vide (nettoyée des #, *, etc.)
  let title = lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '').trim();

  // Si la première ligne ressemble à du JSON cassé, prendre le nom du produit depuis l'URL
  if (title.startsWith('{') || title.length < 3) {
    const urlParts = url.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.html?$/i, '') || 'Produit';
    title = urlParts.slice(0, 150);
  }

  // Description = tout le reste
  const description = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim() || title;

  if (title.length < 3 || description.length < 10) return null;
  return { title, description };
}

export async function extractProductInfo(url) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY non configuré. Ajoutez-le dans votre .env');
  }

  console.log('🤖 Gemini extraction pour:', url);

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log(`🔍 Extraction avec ${GEMINI_MODEL}...`);

  const prompt = `Tu es un assistant e-commerce expert. Analyse cette URL de produit et génère une fiche produit professionnelle et réaliste en français :

URL: ${url}

Basé sur l'URL et le nom du produit visible dans le lien, crée une description marketing complète avec :
1. Un TITRE descriptif et clair du produit
2. Une DESCRIPTION riche et détaillée (minimum 200 mots)

Format de réponse STRICTEMENT en JSON valide :
{
  "title": "Titre du produit",
  "description": "Description complète et détaillée en français (minimum 200 mots)"
}

IMPORTANT: Ne retourne QUE le JSON, sans markdown ni texte supplémentaire.`;

  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('✅ Réponse Gemini reçue, longueur:', text.length);

    // Parse JSON de la réponse - extraction robuste
    let data = parseGeminiJSON(text);

    // Dernier recours : extraire titre (1ère ligne) + reste comme description
    if (!data) {
      console.warn('⚠️ JSON invalide, fallback extraction texte brut. Début:', text.slice(0, 200));
      data = extractFromPlainText(text, url);
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

    console.log(`✅ Extraction OK:`, {
      title: title.slice(0, 60) + '...',
      descLength: description.length,
    });

    return { title, description, rawText };

  } catch (err) {
    console.error(`❌ ${GEMINI_MODEL} échoué:`, err.message);
    throw new Error(`Extraction Gemini échouée: ${err.message}`);
  }
}

/**
 * Vérifie que Gemini est configuré et disponible
 */
export function isGeminiConfigured() {
  return !!GEMINI_API_KEY;
}
