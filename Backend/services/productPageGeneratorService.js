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

═══ 12 ANGLES MARKETING PUISSANTS (UNIVERSELS) ═══
🎯 Un angle marketing = La façon stratégique de présenter le produit + La raison principale qui pousse à acheter
Ce n'est PAS la description technique. C'est le MESSAGE qui touche le client.

Choisis 4 angles parmi ces 12 selon le produit :

1️⃣ **Problème → Solution** : Montre la douleur puis la solution (ex: "Marre des boutons qui reviennent ?")
2️⃣ **Résultat Rapide** : Les gens veulent vite des résultats (ex: "Résultats visibles dès les premières applications")
3️⃣ **Transformation** : Avant/Après mental ou visuel (ex: "Passez d'une peau marquée à un teint uniforme")
4️⃣ **Confiance en Soi** : Très fort en beauté (ex: "Sentez-vous mieux dans votre peau")
5️⃣ **Simplicité** : Les gens détestent les routines compliquées (ex: "Simple à utiliser au quotidien")
6️⃣ **Naturel/Bio** : Très vendeur en Afrique (ex: "Formule à base d'ingrédients naturels")
7️⃣ **Sécurité/Douceur** : Rassure les clients prudents (ex: "Convient aux peaux sensibles")
8️⃣ **Économie** : Très fort pour e-commerce Afrique (ex: "Moins cher que les soins en institut")
9️⃣ **Exclusivité** : Donne une valeur premium (ex: "Best-seller recommandé")
🔟 **Confort** : Pour produits corps/santé (ex: "Sensation agréable sur la peau")
1️⃣1️⃣ **Gain de Temps** : Les gens veulent aller vite (ex: "Routine rapide en 2 minutes")
1️⃣2️⃣ **Preuve Sociale** : Les gens suivent les autres (ex: "Déjà adopté par des milliers d'utilisateurs")

🧠 COMMENT CHOISIR LES 4 ANGLES ?
Pose-toi 3 questions :
1. Quel problème principal ça résout ?
2. Quel bénéfice est le plus visible ?
3. Qu'est-ce qui rassure le client ?

═══ TITRES DES ANGLES MARKETING — PHRASES COMPLÈTES ═══
✍️ RÈGLES ABSOLUES pour les titres des 4 angles :

✅ CE QU'IL FAUT FAIRE :
- De vraies phrases complètes (10-15 mots minimum)
- Naturelles et professionnelles
- Orientées bénéfice client
- Crédibles et réalistes
- Expliquent concrètement ce que fait le produit

❌ INTERDICTIONS :
- PAS de titres courts (2-4 mots)
- PAS de slogans raccourcis
- PAS de mots isolés
- PAS de formulations vagues

✅ EXEMPLES DE BONS TITRES :
✔ Ce produit aide à réduire visiblement les imperfections et améliore l'apparence
✔ Cette solution contribue à raffermir la zone ciblée avec une utilisation régulière
✔ Ce produit est conçu pour offrir un confort optimal aux zones sensibles
✔ Cette formule légère s'intègre facilement à votre routine quotidienne
✔ Ce produit permet d'obtenir un résultat plus éclatant sans traitement agressif

❌ MAUVAIS EXEMPLES (INTERDITS) :
✖ Minceur rapide (trop court)
✖ Résultats visibles (trop vague)
✖ Naturel & efficace (slogan vide)
✖ Confort absolu (pas informatif)
✖ Peau parfaite (promesse irréaliste)

🎯 Chaque titre doit expliquer CONCRÈTEMENT ce que le produit fait pour le client.

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

🎨 STYLE VISUEL :
✅ Réaliste et crédible
✅ Moderne e-commerce
✅ Lumière naturelle
✅ Scènes authentiques de vie quotidienne
❌ Pas d'effets exagérés
❌ Pas de texte sur l'image
❌ Pas de montage graphique artificiel

Les images doivent DÉPENDRE de l'angle marketing choisi et montrer le bénéfice SPÉCIFIQUE de cet angle.

═══ VISUEL HÉRO — 1ÈRE IMAGE SEULE IMAGE MARKETING ═══
⚠️ RÈGLE ABSOLUE : Seul le HERO est un visuel designé marketing. Les autres images doivent être simples et explicatives.

Le HERO doit contenir :
✅ L'image réelle du produit (EXACT produit fourni, jamais recréé)
✅ Un titre fort et visible (bénéfice principal)
✅ Éléments de crédibilité : ⭐ étoiles avis, 🏷️ badge promo/best-seller
✅ Design propre, professionnel, moderne e-commerce
✅ Format carré 1:1, fond clair minimaliste
✅ Texte descriptif court (1-2 phrases sur les bénéfices)

❌ PAS de prix (ni barré, ni promo)
❌ PAS d'effets flashy, PAS d'encombrement visuel

🎯 ADAPTE AU PRODUIT RÉEL :
- Le modèle et la scène doivent correspondre au type de produit (ex: cheveux, yeux, énergie, nettoyage, etc.)
- PAS de référence systématique à la peau
- Basé sur la fonction réelle du produit

═══ VISUEL AVANT/APRÈS — 2ÈME IMAGE SEULE AUTRE IMAGE ═══
⚠️ SEULEMENT 2 VISUELS AU TOTAL : Hero + Avant/Après

Le champ "prompt_avant_apres" doit décrire un AVANT/APRÈS SPÉCIFIQUE à CE produit :
✅ Split-screen : côté gauche = AVANT (le problème concret que CE produit résout)
✅ Côté droit = APRÈS (le résultat réel et crédible après utilisation)
✅ Personnes africaines authentiques, transformation réaliste (pas exagérée)
❌ Aucun texte, aucune flèche, aucun label sur l'image

🎯 ADAPTE AU PRODUIT RÉEL :
- Pour produit cheveux → cheveux abîmés → cheveux sains
- Pour produit yeux → yeux fatigués → yeux éclatants
- Pour produit énergie → personne fatiguée → personne énergique
- Pour produit nettoyage → surface sale → surface propre
- Pour produit minceur → silhouette avant → silhouette après

❌ PAS d'autres visuels marketing
❌ PAS de visuels pour les angles marketing
❌ SEULEMENT Hero + Avant/Après

═══ FORMAT JSON STRICT ═══
{
  "title": "Titre produit professionnel (8-15 mots) basé sur la promesse principale + bénéfice clé",
  "hero_headline": "PROMESSE PRINCIPALE EN MAJUSCULES (4-6 mots)",
  "hero_slogan": "Sous-titre accrocheur orienté bénéfice spécifique au produit",
  "hero_baseline": "Phrase de réassurance courte spécifique au produit",
  "prompt_affiche_hero": "[GÉNÈRE ICI un prompt en anglais ADAPTÉ À CE PRODUIT suivant cette structure: Square 1:1 e-commerce product poster. Right side (60%): Close-up portrait of natural African [woman/man], [relevant feature based on product function], gentle expression, looking at camera, [pose naturelle adaptée]. Left side (40%): Premium product display - [description packaging], clean placement, soft shadow. Light clean background. Minimal text: small badge top 'BEST-SELLER [CATÉGORIE]', short title '[BÉNÉFICE]'. NO prices, NO price information. Premium style, clean design, French text, no flashy effects.]",
  "prompt_avant_apres": "[GÉNÈRE ICI un prompt en anglais spécifique à CE produit: décris le problème exact à gauche et le résultat exact à droite, avec des personnes africaines. La transformation doit être liée directement à la fonction de CE produit.]",
  "angles": [
    {
      "titre_angle": "Phrase complète de 10-15 mots expliquant concrètement le bénéfice (PAS de titre court, PAS de slogan de 2-3 mots)",
      "explication": "3-4 phrases concrètes et persuasives. Décris comment ce bénéfice spécifique se manifeste dans la vie réelle. Reste crédible et factuel, sans exagération.",
      "message_principal": "1 phrase d'accroche mémorable spécifique à ce bénéfice",
      "promesse": "La transformation concrète que l'utilisateur va vivre",
      "prompt_affiche": "Simple explanatory photo: [décrire en anglais la SITUATION RÉELLE montrant le bénéfice de cet angle. PAS de design publicitaire, PAS de boutons, PAS de CTA, PAS de texte overlay. Photo naturelle, réaliste, qui explique visuellement le bénéfice sans mise en scène marketing. Contexte de vie authentique, lumière naturelle, professionnel mais simple.]"
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

  // Groq supporte la vision via Llama 4 Scout
  if (imageBuffers.length > 0) {
    console.log(`🖼️ ${imageBuffers.length} image(s) disponible(s) — analyse avec Groq Vision`);
    const imageContent = imageBuffers.slice(0, 3).map(buf => ({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${buf.toString('base64')}`,
        detail: 'low'
      }
    }));
    messages[1].content = [
      { type: 'text', text: userPrompt },
      ...imageContent
    ];
  } else {
    console.log('ℹ️ Aucune image fournie — analyse basée sur le texte uniquement');
  }

  let result;
  try {
    const response = await groq.chat.completions.create({
      model: imageBuffers.length > 0 ? 'llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
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

    // Enrichir le prompt avec les règles ABSOLUES pour l'image hero
    const posterPrompt = `${promptAffiche}

⚠️ RÈGLE ABSOLUE — PRODUIT RÉEL UNIQUEMENT:
- USE THE EXACT REAL PRODUCT IMAGE PROVIDED — NEVER generate a new product
- DO NOT recreate the product, DO NOT modify packaging, DO NOT create different mockup
- The EXACT product provided must be clearly visible and recognizable
- Focus on compositing the real product with marketing elements, NOT generating a new product

CRITICAL REQUIREMENTS FOR E-COMMERCE HERO IMAGE:
- Square format 1:1, clean white or light gray background
- Real product image (tube, box, packaging) clearly visible on left/center
- Optional: Natural African model on right side if relevant (gentle expression, soft lighting)
- MUST include conversion elements with text:
  * Star rating (⭐⭐⭐⭐⭐ 4.5-5/5) visible
  * Badge at top (e.g., "BEST-SELLER SOIN PEAU")
  * Bold title showing main benefit (2-3 lines max, in French)
  * Small "Acheter" button
- NO pricing information, NO prices, NO price comparisons
- Add descriptive text on image: short phrases (1-2 sentences) highlighting key benefits
- Professional e-commerce style, modern, credible, premium quality
- NO flashy effects, NO clutter, clean and elegant design
- Text must be readable and well-integrated graphically

CRITICAL: The product shown MUST be the exact real product provided, not a generated/recreated version.`;

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