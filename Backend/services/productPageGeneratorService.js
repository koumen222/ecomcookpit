/**
 * Product Page Generator Service
 * Architecture simple & fiable :
 * 1. Scrape title + description (minimal)
 * 2. Groq → JSON structuré (angles, raisons, FAQ, description, prompts affiches)
 * 3. NanoBanana → Affiches publicitaires complètes
 * 4. Upload R2 → Assemble page produit
 */

import axios from 'axios';
import Groq from 'groq-sdk';
import { uploadImage, isConfigured } from './cloudflareImagesService.js';
import { generateNanoBananaImage, generateNanoBananaImageToImage } from './nanoBananaService.js';
import { randomUUID } from 'crypto';

let _groq = null;
function getGroq() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// ─── Étape 1 : Nettoyage du texte scrappé ────────────────────────────────────

function cleanScrapedText(text) {
  if (!text) return '';
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/[^\w\s\u00C0-\u024F.,!?;:()''""«»\-–—/&%€$£¥₹+@#]/g, '')
    .trim()
    .slice(0, 2000);
}

// ─── Étape 2 : Groq → JSON structuré ultra fiable ──────────────────

export async function analyzeWithVision(scrapedData, imageBuffers = []) {
  const groq = getGroq();
  if (!groq) throw new Error('Clé Groq API non configurée.');

  const title = cleanScrapedText(scrapedData.title || '');
  const description = cleanScrapedText(scrapedData.description || scrapedData.rawText || '');

  const userPrompt = `Tu es expert e-commerce et copywriting SPÉCIALISTE du marché africain.

PRODUIT À ANALYSER :
TITRE : ${title || 'Non disponible'}
DESCRIPTION : ${description || 'Non disponible'}

RÈGLES CRITIQUES :
1. 🇫🇷 **100% FRANÇAIS** - AUCUN mot en anglais dans les titres, angles, raisons, FAQ
2. 🎯 **ANGLES DIFFÉRENTS** - Chaque angle doit aborder un bénéfice UNIQUE et SPÉCIFIQUE au produit
3. 💡 **RAISONS PERSONNALISÉES** - Basées sur les caractéristiques réelles du produit
4. ❓ **FAQ SPÉCIFIQUE** - Questions pertinentes pour CE produit exact
5. 🖼️ **CONTEXTES DIFFÉRENTS** - Chaque affiche dans un contexte unique (maison, bureau, extérieur, sport, etc.)

ANALYSE DU PRODUIT :
- Identifie les bénéfices principaux du produit
- Détermine les problèmes qu'il résout
- Trouve 4 angles marketing complètement différents
- Crée des raisons d'acheter spécifiques et convaincantes
- Génère une FAQ adaptée au produit

STRUCTURE DES ANGLES (DOIVENT ÊTRE DIFFÉRENTS) :
Angle 1 : Focus sur le bénéfice PRINCIPAL
Angle 2 : Focus sur un bénéfice SECONDAIRE ou CAS D'USAGE
Angle 3 : Focus sur l'ÉMOTION ou le MODE DE VIE
Angle 4 : Focus sur la PREUVE SOCIALE ou la CONFIANCE (avis, garantie, certification)

CONTEXTES D'AFFICHES DIFFÉRENTS :
- Affiche 1 : Contexte intérieur moderne (cuisine, salon, bureau)
- Affiche 2 : Contexte extérieur ou sportif (jardin, parc, activité)
- Affiche 3 : Contexte social ou familial (en groupe, avec amis/famille)
- Affiche 4 : Contexte avant/après ou transformation (résultat visible, comparaison)

EXEMPLE POUR UN PRODUIT DE SANTÉ :
Angle 1: " Énergie naturelle quotidienne" (bénéfice principal)
Angle 2: " Performance sportive boostée" (cas d'usage)
Angle 3: " Bien-être familial partagé" (mode de vie)
Angle 4: " Des milliers de clients satisfaits" (preuve sociale)

IMPORTANT POUR LES PROMPTS D'AFFICHE :

Chaque prompt_affiche doit décrire une AFFICHE PUBLICITAIRE COMPLÈTE incluant :
- **MODÈLES AFRICAINS** visibles (hommes/femmes selon le produit)
- **TEXTE EN FRANÇAIS** bien visible sur l'affiche (titre marketing + slogan)
- **CALL-TO-ACTION EN FRANÇAIS** (ex: "Commandez Maintenant", "Offre Limitée")
- Mise en scène réaliste du produit en situation d'utilisation
- Style visuel précis (moderne, premium, minimaliste, etc.)
- Couleurs dominantes cohérentes
- Ambiance émotionnelle (confiance, énergie, luxe, etc.)
- Fond lifestyle contextuel africain (maison moderne, bureau, ville, etc.)
- Le produit bien visible et identique à la photo de référence

Le prompt doit être EN ANGLAIS et DOIT commencer par :
"Create a complete advertising poster for this product with FRENCH text overlay:

RÈGLES ANTI-HALLUCINATION :
- Nettoie les informations marketing exagérées du fournisseur
- Ne garde que les bénéfices réalistes
- Ne fabrique pas de caractéristiques techniques non présentes
- Si une information est absente, ne l'invente pas
- Tout le contenu textuel en FRANÇAIS

Format de réponse STRICT JSON :
{
  "title": "Titre produit court et percutant en français",
  "hero_headline": "TITRE PRINCIPAL EN MAJUSCULES (3-5 mots max, ex: BOOSTEZ VOTRE BIEN-ÊTRE)",
  "hero_slogan": "Slogan accrocheur en français (ex: Bouclier Antioxydant Naturel)",
  "hero_baseline": "Baseline courte (ex: Un soutien naturel du quotidien)",
  "prompt_affiche_hero": "Create a HERO advertising poster for this product with FRENCH text overlay: Beautiful smiling African woman holding the product prominently, natural outdoor background with greenery. LARGE BOLD FRENCH HEADLINE at top: '[hero_headline]'. Stylized golden brush stroke with text: '[hero_slogan]'. Product bottle clearly visible in hand, centered. Bottom section with icons and benefits text in French. Baseline text at bottom: '[hero_baseline]'. Professional commercial photography, vibrant natural colors, warm lighting, premium e-commerce feel, high resolution.",
  "angles": [
    {
      "titre_angle": " Titre avec émoji (5-8 mots max)",
      "explication": "Explication détaillée du bénéfice en 2-3 phrases complètes. Explique comment le produit résout un problème spécifique ou apporte une transformation. Sois persuasif et concret.",
      "message_principal": "Message marketing court et mémorable (1 phrase d'accroche percutante)",
      "promesse": "La promesse de transformation en français",
      "prompt_affiche": "Create a complete advertising poster for this product with FRENCH text overlay: [prompt détaillé en anglais avec modèles africains, texte français visible, CTA, mise en scène, style, couleurs, ambiance]"
    }
  ],
  "raisons_acheter": [
    "Raison 1 claire et persuasive",
    "Raison 2 claire et persuasive",
    "Raison 3 claire et persuasive",
    "Raison 4 claire et persuasive"
  ],
  "faq": [
    {
      "question": "Question fréquente en français",
      "reponse": "Réponse rassurante et précise en français"
    }
  ],
  "testimonials": [
    {
      "name": "Prénom N.",
      "location": "Ville, Pays",
      "rating": 5,
      "text": "Témoignage authentique et convaincant en français (2-3 phrases). Décrire une expérience positive spécifique avec le produit, les bénéfices ressentis, et la satisfaction. Ton naturel et crédible.",
      "verified": true,
      "date": "Il y a X jours/semaines"
    }
  ],
  "description_optimisee": "Description e-commerce complète en français (4-5 paragraphes). Structure : problème → solution → bénéfices → confiance → CTA. Utilise **gras** pour les points clés. Intègre les placeholders {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}} entre les paragraphes."
}

 EXACTEMENT 4 angles, 4 raisons, 5 questions FAQ.
 EXACTEMENT 4 TÉMOIGNAGES dans "testimonials" (noms africains authentiques).
 Chaque angle DOIT avoir une explication détaillée (2-3 phrases).
 JSON uniquement. Pas d'explication. Pas de texte avant/après.
 Tout en FRANÇAIS sauf les prompt_affiche qui sont en ANGLAIS.`;

  const messages = [
    {
      role: "system",
      content: "Tu es un expert e-commerce et copywriting SPÉCIALISTE du marché africain. RÈGLES STRICTES : 1) 100% FRANÇAIS dans tout le contenu sauf prompts d'affiche. 2) Jamais de contenu générique comme 'Découvrez ce produit exceptionnel' ou 'Qualité premium garantie'. 3) Chaque angle doit être UNIQUE et SPÉCIFIQUE au produit analysé. 4) Les raisons d'acheter doivent être basées sur les caractéristiques réelles du produit. 5) La FAQ doit contenir des questions pertinentes pour CE produit exact. 6) Génère UNIQUEMENT du JSON valide, pas d'explications. Sois créatif et spécifique !"
    },
    {
      role: "user",
      content: userPrompt
    }
  ];

  // Note: Groq ne supporte pas la vision, on utilise seulement le texte
  console.log('⚠️ Note: Groq ne supporte pas la vision, analyse basée sur le texte uniquement');

  let result;
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 4000,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const raw = response.choices[0]?.message?.content || '{}';
    console.log('📝 Groq raw response length:', raw.length);

    try {
      result = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]+\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        throw new Error('Réponse IA invalide — JSON non parsable');
      }
    }
  } catch (error) {
    console.error('❌ Groq API error:', error.message);
    throw new Error(`Erreur Groq: ${error.message}`);
  }

  if (!result) {
    throw new Error('Aucune structure générée par GPT');
  }

  // Validation de la structure - Fallbacks SPÉCIFIQUES au produit
  if (!result.angles || !Array.isArray(result.angles) || result.angles.length < 4) {
    console.warn('⚠️ Moins de 4 angles générés, padding avec angles spécifiques...');
    result.angles = result.angles || [];
    const fallbackAngles = [
      {
        titre_angle: "✨ Qualité supérieure garantie",
        explication: `Ce ${title || 'produit'} est fabriqué avec des matériaux premium pour garantir durabilité et performance. Une qualité professionnelle adaptée à un usage quotidien intensif.`,
        message_principal: "Investissez dans la qualité qui dure",
        promesse: "Un produit fiable pour vos besoins quotidiens",
        prompt_affiche: `Create a complete advertising poster for this product with FRENCH text overlay: Professional setting, African model confidently using ${title || 'product'}, clean background. Bold French headline: 'Qualité Supérieure'. CTA: 'Commandez Maintenant'. Premium commercial photography.`
      },
      {
        titre_angle: "🚀 Performance optimisée",
        explication: `Conçu pour offrir des résultats exceptionnels, ce ${title || 'produit'} combine technologie avancée et simplicité d'utilisation pour une expérience utilisateur sans compromis.`,
        message_principal: "Des résultats qui dépassent vos attentes",
        promesse: "Maximisez votre efficacité au quotidien",
        prompt_affiche: `Create a complete advertising poster for this product with FRENCH text overlay: Dynamic action shot, African athlete or professional using ${title || 'product'}, outdoor setting. Bold French headline: 'Performance Maximale'. CTA: 'Découvrez Maintenant'. Action photography style.`
      },
      {
        titre_angle: "💎 Design élégant et pratique",
        explication: `Alliant esthétique moderne et fonctionnalité intuitive, ce ${title || 'produit'} s'intègre parfaitement dans votre vie quotidienne avec style et efficacité.`,
        message_principal: "L'élégance rencontre la fonctionnalité",
        promesse: "Un design qui embellit votre quotidien",
        prompt_affiche: `Create a complete advertising poster for this product with FRENCH text overlay: Lifestyle setting, stylish African model with ${title || 'product'}, modern home or office. Bold French headline: 'Design Élégant'. CTA: 'Adoptez le Style'. Lifestyle fashion photography.`
      },
      {
        titre_angle: "🏆 Des milliers de clients satisfaits",
        explication: `La confiance de milliers de clients africains prouve que ce ${title || 'produit'} tient ses promesses. Avec une satisfaction garantie et des avis positifs, ce choix est approuvé par votre communauté.`,
        message_principal: "La qualité approuvée par des milliers",
        promesse: "Rejoignez des milliers de clients satisfaits",
        prompt_affiche: `Create a complete advertising poster for this product with FRENCH text overlay: Smiling group of diverse African customers, before/after transformation visual with ${title || 'product'}, testimonial-style scene. Bold French headline: 'Des Milliers Satisfaits'. Stars rating visual. CTA: 'Rejoignez-les Maintenant'. Warm, trustworthy photography.`
      }
    ];
    while (result.angles.length < 4) {
      result.angles.push(fallbackAngles[result.angles.length]);
    }
  }

  if (!result.raisons_acheter || result.raisons_acheter.length < 4) {
    result.raisons_acheter = result.raisons_acheter || [];
    const productName = title || 'produit';
    const fallbackRaisons = [
      `Matériaux premium et fabrication durable pour ce ${productName}`,
      `Performance exceptionnelle adaptée à vos besoins spécifiques`,
      `Design moderne qui s'intègre parfaitement à votre quotidien`,
      `Satisfaction garantie avec service client réactif et livraison rapide`
    ];
    while (result.raisons_acheter.length < 4) {
      result.raisons_acheter.push(fallbackRaisons[result.raisons_acheter.length % fallbackRaisons.length]);
    }
  }

  if (!result.faq || result.faq.length < 5) {
    result.faq = result.faq || [];
    const productName = title || 'produit';
    const defaultFaq = [
      { question: `Comment utiliser ce ${productName} efficacement ?`, reponse: `Ce ${productName} s'utilise très simplement. Suivez les instructions fournies pour des résultats optimaux dès la première utilisation.` },
      { question: `Quelle est la durée de vie de ce ${productName} ?`, reponse: `Fabriqué avec des matériaux de haute qualité, ce ${productName} est conçu pour durer plusieurs années avec un usage normal.` },
      { question: `Ce ${productName} est-il adapté à mon climat ?`, reponse: `Oui, ce ${productName} est conçu pour fonctionner parfaitement dans les conditions climatiques africaines.` },
      { question: `Quelle est la politique de retour ?`, reponse: `Nous offrons une garantie satisfaction de 14 jours. Retour possible si le produit ne vous convient pas.` },
      { question: `Comment entretenir ce ${productName} ?`, reponse: `Un simple entretien régulier suffit. Utilisez les produits recommandés pour préserver la performance et l'apparence.` }
    ];
    while (result.faq.length < 5) {
      result.faq.push(defaultFaq[result.faq.length % defaultFaq.length]);
    }
  }

  // Fallback testimonials if not generated or less than 4
  if (!result.testimonials || result.testimonials.length < 4) {
    const productName = title || 'produit';
    const defaultTestimonials = [
      {
        name: "Marie K.",
        location: "Douala, Cameroun",
        rating: 5,
        text: `J'adore ce ${productName} ! La qualité est excellente et il correspond parfaitement à mes attentes. Livraison rapide et service client au top. Je recommande vivement !`,
        verified: true,
        date: "Il y a 3 jours"
      },
      {
        name: "Jean-Pierre M.",
        location: "Abidjan, Côte d'Ivoire",
        rating: 5,
        text: `Produit arrivé en parfait état. Je l'utilise depuis une semaine et les résultats sont déjà visibles. Très satisfait de mon achat, rapport qualité-prix imbattable.`,
        verified: true,
        date: "Il y a 1 semaine"
      },
      {
        name: "Aminata D.",
        location: "Dakar, Sénégal",
        rating: 4,
        text: `Bonne surprise ! Ce ${productName} est exactement comme décrit. Fonctionne parfaitement et fait vraiment ce qu'il promet. Je vais en commander un second pour ma sœur.`,
        verified: true,
        date: "Il y a 5 jours"
      },
      {
        name: "Kofi A.",
        location: "Accra, Ghana",
        rating: 5,
        text: `Excellent produit ! J'en avais entendu parler par un ami et je ne suis pas déçu. Ce ${productName} a dépassé toutes mes attentes. Commande simple, livraison rapide. 5 étoiles méritées !`,
        verified: true,
        date: "Il y a 2 semaines"
      }
    ];
    result.testimonials = result.testimonials || [];
    while (result.testimonials.length < 4) {
      result.testimonials.push(defaultTestimonials[result.testimonials.length % defaultTestimonials.length]);
    }
  }

  return result;
}

// ─── Étape 3 : Génération d'AFFICHES PUBLICITAIRES avec NanoBanana ───────────

export async function generatePosterImage(promptAffiche, originalImageBuffer = null) {
  try {
    console.log('🎨 Generating POSTER with NanoBanana...');

    // Enrichir le prompt pour forcer une affiche complète avec texte français et modèles africains
    const posterPrompt = `${promptAffiche}

CRITICAL REQUIREMENTS FOR THIS ADVERTISING POSTER:
- This must be a COMPLETE ADVERTISING POSTER with TEXT OVERLAY, not just a product photo
- AFRICAN MODELS must be visible and prominent (men/women as appropriate)
- FRENCH TEXT must be clearly visible on the poster (headline + slogan)
- FRENCH CALL-TO-ACTION must be visible (button or text like "Commandez Maintenant", "Offre Limitée")
- Product must be prominently visible and identical to reference image
- Professional lifestyle background setting (modern African home, office, or urban setting)
- Modern e-commerce advertising style
- High resolution, commercial quality
- Vibrant, cohesive color scheme
- Emotional atmosphere that drives purchase intent
- Ultra realistic photography, no CGI, no illustration, no cartoon
- Text must be bold, readable, and professionally integrated into the design`;

    let result;

    if (originalImageBuffer) {
      console.log('📸 Image-to-image poster generation...');
      result = await generateNanoBananaImageToImage(
        posterPrompt,
        originalImageBuffer,
        '1:1',
        1
      );
    } else {
      console.log('📝 Text-to-image poster generation...');
      result = await generateNanoBananaImage(
        posterPrompt.slice(0, 4000),
        '1:1',
        1
      );
    }

    return result;
  } catch (err) {
    console.warn(`⚠️ Erreur génération affiche NanoBanana: ${err.message}`);
    return null;
  }
}

// ─── Upload buffer → R2 ─────────────────────────────────────────────────────

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
    console.warn(`⚠️ Buffer R2 upload error: ${err.message}`);
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
    console.warn(`⚠️ Download+R2 upload failed: ${err.message}`);
    return null;
  }
}