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

export async function analyzeWithVision(scrapedData, imageBuffers = [], marketingApproach = 'AIDA') {
  const groq = getGroq();
  if (!groq) throw new Error('Clé Groq API non configurée.');

  const title = cleanScrapedText(scrapedData.title || '');
  const description = cleanScrapedText(scrapedData.description || scrapedData.rawText || '');

  // Marketing approach definitions
  const approachGuides = {
    AIDA: `APPROCHE AIDA (Attention → Intérêt → Désir → Action) :
- Angle 1 : ATTENTION — Accroche forte qui capte l'attention (problème urgent ou bénéfice spectaculaire)
- Angle 2 : INTÉRÊT — Éveiller la curiosité avec des détails fascinants ou des preuves
- Angle 3 : DÉSIR — Créer l'envie avec la transformation émotionnelle ou le résultat idéal
- Angle 4 : ACTION — Lever les objections et pousser à l'achat (garantie, urgence, facilité)`,

    PAS: `APPROCHE PAS (Problème → Agitation → Solution) :
- Angle 1 : PROBLÈME — Identifier clairement le problème principal que vit la cible
- Angle 2 : AGITATION — Amplifier la douleur, montrer les conséquences de ne rien faire
- Angle 3 : SOLUTION — Présenter le produit comme LA solution évidente et efficace
- Angle 4 : PREUVE — Rassurer avec des éléments concrets (qualité, garantie, résultats)`,

    BAB: `APPROCHE BAB (Before → After → Bridge) :
- Angle 1 : BEFORE — Décrire la situation actuelle frustrante (vie sans le produit)
- Angle 2 : AFTER — Peindre la vie idéale après avoir utilisé le produit
- Angle 3 : BRIDGE — Expliquer comment le produit fait le pont entre avant et après
- Angle 4 : CONFIANCE — Renforcer la crédibilité et éliminer les doutes`,

    FAB: `APPROCHE FAB (Features → Advantages → Benefits) :
- Angle 1 : FEATURE principale — Caractéristique technique ou composition unique du produit
- Angle 2 : ADVANTAGE — Avantage pratique direct de cette caractéristique
- Angle 3 : BENEFIT émotionnel — Bénéfice ressenti dans la vie quotidienne
- Angle 4 : DIFFÉRENCIATION — Ce qui rend ce produit supérieur aux alternatives`
  };

  const approachGuide = approachGuides[marketingApproach] || approachGuides.AIDA;

  const userPrompt = `Tu es expert e-commerce et copywriting SPÉCIALISTE du marché africain. Tu dois générer une page produit professionnelle, persuasive et optimisée pour la conversion.

PRODUIT À ANALYSER :
TITRE : ${title || 'Non disponible'}
DESCRIPTION : ${description || 'Non disponible'}

═══ ÉTAPE 1 : ANALYSE INTELLIGENTE DU PRODUIT ═══
Avant de générer quoi que ce soit, réponds mentalement à ces questions :
- À quoi sert réellement ce produit ?
- Quel problème principal résout-il ?
- Qui est la cible idéale (homme, femme, âge, contexte) ?
- Pourquoi quelqu'un l'achèterait aujourd'hui ?
- Quelles sont les objections possibles ?
Utilise ces réponses pour personnaliser TOUT le contenu.

═══ RÈGLES FONDAMENTALES ═══
1. 🇫🇷 100% FRANÇAIS dans tout le contenu (sauf prompt_image qui est en anglais)
2. 🚫 PAS de promesses irréalistes — seulement des bénéfices concrets et crédibles
3. 🚫 PAS de généricité — chaque mot doit être spécifique à CE produit
4. ✅ Angles basés sur la FONCTION RÉELLE du produit, les résultats réels, l'expérience utilisateur
5. ✅ FAQ basée sur les vraies questions que se pose l'acheteur

${approachGuide}

⚠️ IMPORTANT : Suis STRICTEMENT cette structure pour les 4 angles. Chaque angle doit correspondre à l'étape de l'approche marketing sélectionnée.

═══ IMAGES SECONDAIRES — MISE EN SITUATION RÉELLE (CRITIQUES) ═══
Les 4 images doivent illustrer la VRAIE SITUATION du problème et les bénéfices, selon l'angle marketing choisi.

🎯 OBJECTIF : Montrer la situation réelle du client, le problème traité, et le résultat visible

✅ CE QU'ON DOIT MONTRER :
- La situation réelle du client (contexte de vie authentique)
- Le problème que le produit traite (visible et crédible)
- Le résultat ou l'amélioration visible (transformation réaliste)
- Des scènes naturelles et crédibles (pas de mise en scène fake)

❌ CE QU'ON NE DOIT PAS MONTRER :
- Personnes tenant le produit en main (pose influenceur)
- Modèles présentant le produit à la caméra
- Mise en scène publicitaire artificielle
- Poses non naturelles ou forcées

🎨 EXEMPLES SELON LE TYPE DE PRODUIT :
- **Produit anti-acné** → Peau avec boutons visibles → Amélioration visible de la peau
- **Produit minceur** → Silhouette avant → Silhouette après (réaliste, pas exagéré)
- **Produit cheveux** → Cheveux abîmés/secs → Cheveux plus soignés/brillants
- **Produit énergie** → Personne fatiguée au travail → Personne active et concentrée
- **Aspirateur** → Sol avec poussière/débris → Sol propre et brillant
- **Fer à lisser** → Cheveux frisés → Cheveux lisses et soignés

🎨 STYLE VISUEL :
✅ Réaliste et crédible
✅ Moderne e-commerce
✅ Lumière naturelle
✅ Scènes authentiques de vie quotidienne
❌ Pas d'effets exagérés
❌ Pas de texte sur l'image
❌ Pas de montage graphique artificiel

Les images doivent DÉPENDRE de l'angle marketing et montrer le bénéfice SPÉCIFIQUE de cet angle.

═══ VISUEL HÉRO — 1ÈRE IMAGE GALERIE (TRÈS IMPORTANT) ═══
⚠️ RÈGLE ABSOLUE : L'image DOIT utiliser le produit RÉEL fourni par l'utilisateur, JAMAIS un produit généré ou modifié.

Le champ "prompt_affiche_hero" doit décrire une AFFICHE E-COMMERCE CARRÉE (1:1) construite autour du PRODUIT RÉEL :

🖼️ IMAGE DU PRODUIT (OBLIGATOIRE) :
✅ Utilise l'image réelle du produit fournie (claire, propre, mise en valeur)
❌ N'invente JAMAIS un nouveau produit
❌ Ne modifie PAS l'emballage
❌ Ne crée PAS de mockup différent
✅ Le produit EXACT fourni doit être visible et reconnaissable

🎨 COMPOSITION VISUELLE :
✅ CENTRE/GAUCHE : Produit réel bien visible et mis en avant
✅ DROITE (optionnel) : Modèle africain(e) naturel(le) si pertinent pour le produit
   - Expression douce, regard caméra
   - Pose naturelle adaptée au produit
   - Lumière douce, rendu naturel

🧴 ÉLÉMENTS DE CONVERSION (OBLIGATOIRES) :
✅ ⭐ Étoiles d'avis clients (4.5-5 étoiles)
✅ 💰 Prix barré + nouveau prix en orange (gros et visible)
✅ 🏷️ Badge promo / best-seller en haut
✅ Titre fort et visible (bénéfice principal, 2-3 lignes max)

🎨 STYLE :
- Format carré (1:1)
- Fond clair minimaliste (blanc ou gris très clair)
- Design e-commerce moderne et crédible
- Pas d'effets flashy
- Pas de long texte
- Pas d'encombrement visuel

EXEMPLE CONCRET (crème anti-cicatrices) :
"Square 1:1 e-commerce product poster using the REAL product image provided. Center-left: The actual product (tube + box) clearly visible, clean placement, soft shadow. Right side (optional): Natural African woman with gentle expression, soft lighting. Top: Orange badge 'BEST-SELLER SOIN PEAU'. Title: 'Atténuez cicatrices et marques d'acné' (bold, visible). Star rating: ⭐⭐⭐⭐⭐ 4.8/5. Prices: crossed-out '19 000 FCFA', large orange '15 000 FCFA'. Clean white background. Modern e-commerce style, French text, credible design. CRITICAL: Use the exact real product image, never generate a new product."

═══ VISUEL AVANT/APRÈS — 2ÈME IMAGE GALERIE (TRÈS IMPORTANT) ═══
Le champ "prompt_avant_apres" doit décrire un AVANT/APRÈS SPÉCIFIQUE à CE produit :
✅ Split-screen : côté gauche = AVANT (le problème concret que CE produit résout)
✅ Côté droit = APRÈS (le résultat réel et crédible après utilisation)
✅ Personnes africaines authentiques, transformation réaliste (pas exagérée)
❌ Aucun texte, aucune flèche, aucun label sur l'image
→ Exemples selon le produit :
  • Crème visage → AVANT: peau terne/teint inégal | APRÈS: peau lumineuse/unifiée
  • Aspirateur → AVANT: sol avec poussière/débris | APRÈS: sol propre et brillant
  • Complément énergie → AVANT: personne fatiguée au bureau | APRÈS: même personne active/concentrée
  • Fer à lisser → AVANT: cheveux frisés/indomptés | APRÈS: cheveux lisses et brillants
  • Casque → AVANT: personne stressée dans environnement bruyant | APRÈS: personne sereine avec casque

═══ FORMAT JSON STRICT ═══
{
  "title": "Titre produit professionnel (8-15 mots) basé sur la promesse principale + bénéfice clé",
  "hero_headline": "PROMESSE PRINCIPALE EN MAJUSCULES (4-6 mots)",
  "hero_slogan": "Sous-titre accrocheur orienté bénéfice spécifique au produit",
  "hero_baseline": "Phrase de réassurance courte spécifique au produit",
  "prompt_affiche_hero": "[GÉNÈRE ICI un prompt en anglais ADAPTÉ À CE PRODUIT suivant cette structure: Square 1:1 e-commerce product poster. Right side (60%): Close-up portrait of natural African [woman/man], beautiful skin [+ détail problème visible si pertinent], gentle expression, looking at camera, [pose naturelle adaptée]. Left side (40%): Premium product display - [description packaging], clean placement, soft shadow. Light clean background. Minimal text: small badge top 'BEST-SELLER [CATÉGORIE]', short title '[BÉNÉFICE]', prices '[PRIX BARRÉ] [PRIX PROMO]' (orange), small 'Acheter' button. Premium style, clean design, French text, no flashy effects.]",
  "prompt_avant_apres": "[GÉNÈRE ICI un prompt en anglais spécifique à CE produit: décris le problème exact à gauche et le résultat exact à droite, avec des personnes africaines. La transformation doit être liée directement à la fonction de CE produit.]",
  "angles": [
    {
      "titre_angle": "Émoji + Titre bénéfice réel (5-9 mots)",
      "explication": "3-4 phrases concrètes et persuasives. Décris comment ce bénéfice spécifique se manifeste dans la vie réelle. Reste crédible et factuel, sans exagération.",
      "message_principal": "1 phrase d'accroche mémorable spécifique à ce bénéfice",
      "promesse": "La transformation concrète que l'utilisateur va vivre",
      "prompt_affiche": "Real situation photo: [décrire en anglais la SITUATION RÉELLE et le BÉNÉFICE VISIBLE selon l'angle: For skincare → show skin condition improvement (before/after aspect), For energy → show person in real work/life context showing vitality, For cleaning → show clean vs dirty comparison, For hair → show hair transformation. NO people holding products, NO influencer poses, NO fake advertising scenes. Show authentic real-life situations, natural lighting, credible and realistic, no text overlay, professional e-commerce photography]"
    }
  ],
  "raisons_acheter": [
    "Fait concret sur la qualité ou composition",
    "Bénéfice pratique mesurable",
    "Avantage différenciant vs alternatives",
    "Garantie ou élément de sécurité"
  ],
  "reassurance": {
    "titre": "Notre Garantie Qualité (adapter au produit)",
    "texte": "2-3 phrases rassurantes sur la qualité, sécurité ou garantie spécifique au produit.",
    "points": ["Point rassurant 1", "Point rassurant 2", "Point rassurant 3"]
  },
  "guide_utilisation": {
    "applicable": true,
    "titre": "Comment utiliser ce produit",
    "etapes": [
      {"numero": 1, "action": "Étape courte", "detail": "Détail pratique"}
    ]
  },
  "faq": [
    {
      "question": "Vraie question d'un acheteur potentiel",
      "reponse": "Réponse franche, précise et rassurante"
    }
  ],
  "testimonials": [
    {
      "name": "Prénom N.",
      "location": "Ville, Pays africain",
      "rating": 5,
      "text": "Témoignage réaliste et spécifique (2-3 phrases). Bénéfice concret ressenti. Ton naturel.",
      "verified": true,
      "date": "Il y a X jours/semaines"
    }
  ],
  "description_optimisee": "Introduction (2-3 paragraphes). Commence par le problème, puis la solution, puis les bénéfices. Utilise **gras** pour les points clés."
}

⚠️ EXACTEMENT 4 angles, 4 raisons, 5 questions FAQ, 4 témoignages.
⚠️ guide_utilisation.applicable = false si le produit n'a pas besoin d'explication.
⚠️ Adapte prompt_avant_apres au PROBLÈME RÉEL que résout CE produit spécifique.
⚠️ JSON uniquement. Pas d'explication. Pas de texte avant/après.`;

  const messages = [
    {
      role: "system",
      content: "Tu es expert e-commerce, copywriting et psychologie de l'acheteur, spécialiste marché africain. MISSION : générer une page produit optimisée pour la conversion. RÈGLES ABSOLUES : 1) Analyse le produit en profondeur avant de rédiger quoi que ce soit. 2) 100% FRANÇAIS (sauf prompts images en anglais). 3) ZÉRO généricité — tout doit être spécifique à CE produit. 4) ZÉRO exagération — bénéfices réels et crédibles. 5) CRITIQUE : prompt_affiche_hero = AFFICHE E-COMMERCE avec le PRODUIT RÉEL fourni (JAMAIS générer un nouveau produit) + éléments de conversion (étoiles, prix, badge, titre). 6) CRITIQUE : prompt_avant_apres = transformation RÉELLE split-screen (avant problème | après résultat) avec personnes africaines. 7) CRITIQUE : prompts angles = SITUATIONS RÉELLES montrant le problème et le bénéfice (PAS de personnes tenant le produit, PAS de poses influenceur). 8) Ces prompts doivent être ENTIÈREMENT RÉÉCRITS pour CE produit — JAMAIS copier les exemples. 9) Génère UNIQUEMENT du JSON valide."
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
        prompt_affiche: `Lifestyle product photo: Confident African professional holding or using the ${title || 'product'} in a clean, modern home setting. Warm natural light from window. Product clearly visible. Genuine satisfied expression. No text overlay, no banners. Professional e-commerce photography.`
      },
      {
        titre_angle: "🚀 Résultats visibles rapidement",
        explication: `Conçu pour offrir des résultats concrets, ce ${title || 'produit'} s'intègre facilement dans votre routine quotidienne pour un impact mesurable dès les premières utilisations.`,
        message_principal: "Des résultats réels dès la première utilisation",
        promesse: "Une efficacité prouvée dans votre quotidien",
        prompt_affiche: `Lifestyle product photo: African woman or man actively using the ${title || 'product'} outdoors or in a bright modern space. Dynamic, natural pose showing the product in action. Warm golden light, authentic lifestyle scene. No text overlay, no CTA, no banners. High quality e-commerce photography.`
      },
      {
        titre_angle: "💎 Confort et facilité au quotidien",
        explication: `Alliant ergonomie et design intuitif, ce ${title || 'produit'} s'intègre naturellement dans votre style de vie. Simple à utiliser, il devient vite indispensable.`,
        message_principal: "La simplicité qui change tout",
        promesse: "Un quotidien plus confortable et agréable",
        prompt_affiche: `Lifestyle product photo: Stylish African family or individual relaxing at home with the ${title || 'product'} naturally integrated in the scene. Warm, cozy atmosphere. Modern African interior. Product visible and in use. No text, no promotional elements. Professional lifestyle photography.`
      },
      {
        titre_angle: "🛡️ Fiabilité et confiance assurées",
        explication: `Ce ${title || 'produit'} est conçu pour durer et répondre aux standards de qualité les plus exigeants. Sa solidité et sa fiabilité en font un investissement judicieux sur le long terme.`,
        message_principal: "Un produit de confiance pour les années à venir",
        promesse: "La tranquillité d'esprit avec chaque utilisation",
        prompt_affiche: `Lifestyle product photo: Close-up detail shot of the ${title || 'product'} showing quality craftsmanship and materials. Clean, minimal background. Natural studio lighting highlighting texture and finish. No text overlay, no promotional elements. Premium product photography.`
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

    // Enrichir le prompt avec les règles de photo lifestyle professionnelle
    const posterPrompt = `${promptAffiche}

CRITICAL REQUIREMENTS FOR THIS LIFESTYLE PRODUCT PHOTO:
- AFRICAN MODELS must be visible, authentic, naturally using or holding the product
- NO text overlay on the image
- NO call-to-action, NO banners, NO price badges, NO promotional elements
- Product must be clearly visible and identifiable
- Realistic lifestyle setting: modern African home, office, outdoor, or social context
- Warm, natural lighting — professional e-commerce photography style
- Genuine, natural expressions (not overly posed)
- High resolution, clean composition
- Ultra realistic photography — no CGI, no illustration, no cartoon
- The scene should feel authentic and aspirational`;

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