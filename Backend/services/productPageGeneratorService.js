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

function normalizeLocaleKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COUNTRY_CITY_MAP = {
  cameroun: ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua'],
  senegal: ['Dakar', 'Thiès', 'Mbour', 'Saint-Louis'],
  'cote d ivoire': ['Abidjan', 'Bouaké', 'Yamoussoukro', 'San-Pédro'],
  ghana: ['Accra', 'Kumasi', 'Takoradi', 'Tamale'],
  togo: ['Lomé', 'Kara', 'Sokodé', 'Atakpamé'],
  benin: ['Cotonou', 'Porto-Novo', 'Parakou', 'Abomey-Calavi'],
  nigeria: ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan'],
  gabon: ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem'],
  mali: ['Bamako', 'Sikasso', 'Ségou', 'Kayes'],
  'burkina faso': ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Ouahigouya'],
  guinee: ['Conakry', 'Kankan', 'Kindia', 'Labé'],
  congo: ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi'],
  'rdc': ['Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani'],
  'republique democratique du congo': ['Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani'],
};

function getLocalizedTestimonialLocations(country = '', city = '') {
  const normalizedCountry = normalizeLocaleKey(country);
  const locations = [];
  const pushLocation = (value) => {
    const trimmed = cleanScrapedText(value || '');
    if (trimmed && !locations.includes(trimmed)) locations.push(trimmed);
  };

  if (city && country) pushLocation(`${city}, ${country}`);
  else if (city) pushLocation(city);

  const mappedCities = COUNTRY_CITY_MAP[normalizedCountry] || [];
  if (mappedCities.length > 0) {
    mappedCities.forEach((mappedCity) => pushLocation(country ? `${mappedCity}, ${country}` : mappedCity));
  } else if (country) {
    ['Centre-ville', 'Quartier résidentiel', 'Zone commerciale', 'Périphérie'].forEach((label) => {
      pushLocation(`${label}, ${country}`);
    });
  }

  while (locations.length < 4) {
    pushLocation(country || 'Afrique de l’Ouest');
  }

  return locations.slice(0, 4);
}

function buildStoreLocaleInstruction(country = '', city = '') {
  if (!country) {
    return 'Les témoignages doivent rester crédibles pour un contexte e-commerce africain réel.';
  }

  return `La boutique cible principalement le pays suivant : ${country}${city ? `, avec ${city} comme ville de référence` : ''}. Les témoignages, lieux, expressions et contexte d'achat doivent être cohérents avec ce pays.`;
}

function buildDefaultTestimonials(productName, country = '', city = '') {
  const locations = getLocalizedTestimonialLocations(country, city);

  return [
    {
      name: 'Mireille K.',
      location: locations[0],
      rating: 5,
      text: `J'utilise ce ${productName} depuis quelques jours et j'aime surtout le côté pratique au quotidien. Le rendu est propre, la qualité est sérieuse et ça correspond vraiment à ce que j'attendais.`,
      verified: true,
      date: 'Il y a 3 jours'
    },
    {
      name: 'Armand M.',
      location: locations[1],
      rating: 5,
      text: `Très bon achat. Ce ${productName} est facile à utiliser, bien présenté et on sent tout de suite que le produit a été pensé pour durer. La livraison s'est bien passée.`,
      verified: true,
      date: 'Il y a 1 semaine'
    },
    {
      name: 'Awa D.',
      location: locations[2],
      rating: 4,
      text: `Bonne surprise. Ce ${productName} m'aide vraiment dans mon usage de tous les jours et il fait ce qui est annoncé sans en faire trop. Je le recommande sans hésiter.`,
      verified: true,
      date: 'Il y a 5 jours'
    },
    {
      name: 'Koffi A.',
      location: locations[3],
      rating: 5,
      text: `Franchement satisfait. Le produit est conforme, agréable à utiliser et le résultat est visible dans un cadre normal d'utilisation. Je referai confiance à cette boutique.`,
      verified: true,
      date: 'Il y a 2 semaines'
    }
  ];
}

// ─── Étape 2 : Groq → JSON structuré ultra fiable ──────────────────

export async function analyzeWithVision(scrapedData, imageBuffers = [], marketingApproach = 'AIDA', storeContext = {}) {
  const groq = getGroq();
  if (!groq) throw new Error('Clé Groq API non configurée.');

  const title = cleanScrapedText(scrapedData.title || '');
  const description = cleanScrapedText(scrapedData.description || scrapedData.rawText || '');
  const storeCountry = cleanScrapedText(storeContext.country || '');
  const storeCity = cleanScrapedText(storeContext.city || '');
  const storeLocaleInstruction = buildStoreLocaleInstruction(storeCountry, storeCity);
  const testimonialLocationTemplate = storeCountry
    ? `${storeCity ? `${storeCity}, ` : 'Ville crédible, '}${storeCountry}`
    : 'Ville, Pays africain';

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
6. ✅ Témoignages localisés selon la boutique et son marché réel

${storeLocaleInstruction}

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

═══ IMAGES D'ANGLES — PHOTOS PURES SANS TEXTE ═══
Les 4 images d'angles sont de simples photos illustratives. AUCUN texte, AUCUN badge, AUCUN design graphique.

🎯 OBJECTIF : Photo réelle qui montre la situation ou le bénéfice de l'angle en un coup d'œil.

✅ CE QU'IL FAUT :
- Photo réaliste de la situation, du résultat ou du contexte d'utilisation
- Cadrage 1:1 serré, plein cadre, sujet bien rempli, ZÉRO espace mort
- Adaptée au type RÉEL du produit (pas un template beauté pour un produit tech)
- Lumière naturelle propre, scène crédible

❌ CE QUI EST INTERDIT (zéro exception) :
- Tout texte visible (mot, lettre, chiffre, slogan)
- Tout badge, icône graphique, prix, CTA, watermark
- Tout overlay graphique ou mise en page d'affiche
- Toute mise en scène d'influenceur avec produit tendu à la caméra
- Espaces vides / marges autour du sujet

═══ VISUEL HÉRO — SEUL VISUEL MARKETING ═══
⚠️ RÈGLE ABSOLUE : Le HERO est le SEUL visuel avec un éventuel texte très court. Les 4 images d'angles sont de pures scènes sans texte.

Le HERO doit être :
✅ Le produit réel (EXACT, jamais recréé) en cadrage carré 1:1 tight crop, plein cadre, ZÉRO espace vide
✅ Fond clean ou contexte d'utilisation naturel selon le produit
✅ Universel : s'adapte à TOUT type de produit sans template figé par catégorie
✅ Au maximum un badge TRÈS court (3 mots max) OU absent — pas plus

❌ PAS de texte long, PAS de paragraphe, PAS de prix, PAS de bouton
❌ PAS de template beauté imposé si ce n'est pas un produit beauté
❌ PAS de cadrage trop large avec marges vides autour du produit
❌ PAS de design d'affiche publicitaire chargé

═══ VISUEL AVANT/APRÈS — 2ÈME IMAGE SEULE AUTRE IMAGE ═══
⚠️ Le visuel avant/après est le second visuel fort. Les 4 visuels d'angles restent autorisés, mais doivent rester simples et sans texte.

Le champ "prompt_avant_apres" doit décrire un AVANT/APRÈS SPÉCIFIQUE à CE produit :
✅ Split-screen : côté gauche = AVANT (le problème concret que CE produit résout)
✅ Côté droit = APRÈS (le résultat réel et crédible après utilisation)
✅ Cadrage carré 1:1, serré, sans texte ni espace inutile
✅ Personnes africaines authentiques, transformation réaliste (pas exagérée)
❌ Aucun texte, aucune flèche, aucun label sur l'image

🎯 ADAPTE AU PRODUIT RÉEL :
- Pour produit cheveux → cheveux abîmés → cheveux sains
- Pour produit yeux → yeux fatigués → yeux éclatants
- Pour produit énergie → personne fatiguée → personne énergique
- Pour produit nettoyage → surface sale → surface propre
- Pour produit minceur → silhouette avant → silhouette après

═══ FORMAT JSON STRICT ═══
{
  "title": "Titre produit professionnel (8-15 mots) basé sur la promesse principale + bénéfice clé",
  "hero_headline": "PROMESSE PRINCIPALE EN MAJUSCULES (4-6 mots)",
  "hero_slogan": "Sous-titre accrocheur orienté bénéfice spécifique au produit",
  "hero_baseline": "Phrase de réassurance courte spécifique au produit",
  "prompt_affiche_hero": "[Generate in English a universal square 1:1 premium e-commerce hero image using the EXACT real product provided (never recreate it). Tight crop, full-bleed framing, zero empty margins, clean or contextual background adapted to the product function — not a beauty template unless it is a beauty product. Universal composition adaptable to any product category. At most one very short French badge (3 words max) OR no text at all. No paragraphs, no button, no prices, no heavy design.]",
  "prompt_avant_apres": "[Generate in English a square 1:1 split-screen before/after visual specific to this product. Left shows the real problem this product solves, right shows the realistic improved result. Tight crop, no text, no arrows, no labels, no empty margins, authentic African context if humans are shown.]",
  "angles": [
    {
      "titre_angle": "Phrase complète de 10-15 mots expliquant concrètement le bénéfice (PAS de titre court, PAS de slogan de 2-3 mots)",
      "explication": "3-4 phrases concrètes et persuasives. Décris comment ce bénéfice spécifique se manifeste dans la vie réelle. Reste crédible et factuel, sans exagération.",
      "message_principal": "1 phrase d'accroche mémorable spécifique à ce bénéfice",
      "promesse": "La transformation concrète que l'utilisateur va vivre",
      "prompt_affiche": "Pure photo square 1:1: [describe in English the exact real-life scene or context that illustrates this marketing angle for THIS specific product. Tight crop, full-bleed framing, subject fills the frame completely. ABSOLUTELY NO text, NO words, NO letters, NO badge, NO overlay, NO graphic element of any kind. Just a clean professional photo that speaks for itself.]"
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
      "location": "${testimonialLocationTemplate}",
      "rating": 5,
      "text": "Témoignage réaliste et spécifique (2-3 phrases). Bénéfice concret ressenti. Ton naturel.",
      "verified": true,
      "date": "Il y a X jours/semaines"
    }
  ],
  "description_optimisee": ""
}

⚠️ EXACTEMENT 4 angles, 4 raisons, 5 questions FAQ, 4 témoignages.
⚠️ guide_utilisation.applicable = false si le produit n'a pas besoin d'explication.
⚠️ Adapte prompt_avant_apres au PROBLÈME RÉEL que résout CE produit spécifique.
⚠️ description_optimisee doit toujours être une chaîne vide car la page commence directement par les angles marketing.
⚠️ JSON uniquement. Pas d'explication. Pas de texte avant/après.`;

  const messages = [
    {
      role: "system",
      content: "Tu es expert e-commerce, copywriting et psychologie de l'acheteur, spécialiste marché africain. MISSION : générer une page produit optimisée pour la conversion. RÈGLES ABSOLUES : 1) Analyse le produit en profondeur avant de rédiger quoi que ce soit. 2) 100% FRANÇAIS (sauf prompts images en anglais). 3) ZÉRO généricité — tout doit être spécifique à CE produit. 4) ZÉRO exagération — bénéfices réels et crédibles. 5) CRITIQUE hero : prompt_affiche_hero = produit réel, cadrage serré plein cadre, zéro marge vide, fond adaptatif universel (PAS un template beauté pour un produit tech ou autre), badge optionnel très court ou rien. 6) CRITIQUE avant/après : split-screen carré, zéro texte ni flèche, transformation réaliste liée au produit spécifique. 7) CRITIQUE angles : 4 photos pures sans AUCUN texte (même pas une lettre), scène réelle plein cadre, adaptées au type RÉEL du produit. 8) Les témoignages respectent le pays de la boutique. 9) Prompts ENTIÈREMENT réécrits pour CE produit — JAMAIS copier les exemples. 10) description_optimisee = chaîne vide toujours. 11) JSON uniquement."
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
      model: imageBuffers.length > 0 ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
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
        titre_angle: `Ce ${title || 'produit'} mise sur une qualité sérieuse pour durer dans le temps`,
        explication: `Ce ${title || 'produit'} est fabriqué avec des matériaux premium pour garantir durabilité et performance. Une qualité professionnelle adaptée à un usage quotidien intensif.`,
        message_principal: "Investissez dans la qualité qui dure",
        promesse: "Un produit fiable pour vos besoins quotidiens",
        prompt_affiche: `Square 1:1 lifestyle scene illustrating durability and confidence around the ${title || 'product'}. Tight crop, subject fills the frame, clean natural light, real everyday setting, no text overlay, no badges, no poster design.`
      },
      {
        titre_angle: `Ce ${title || 'produit'} apporte un bénéfice concret perceptible dès les premiers usages`,
        explication: `Conçu pour offrir des résultats concrets, ce ${title || 'produit'} s'intègre facilement dans votre routine quotidienne pour un impact mesurable dès les premières utilisations.`,
        message_principal: "Des résultats réels dès la première utilisation",
        promesse: "Une efficacité prouvée dans votre quotidien",
        prompt_affiche: `Square 1:1 explanatory lifestyle image showing the immediate practical benefit of the ${title || 'product'}. Tight crop, authentic movement, natural light, everyday environment, no text overlay, no CTA, no marketing layout.`
      },
      {
        titre_angle: `Ce ${title || 'produit'} simplifie l'usage au quotidien avec un confort immédiat`,
        explication: `Alliant ergonomie et design intuitif, ce ${title || 'produit'} s'intègre naturellement dans votre style de vie. Simple à utiliser, il devient vite indispensable.`,
        message_principal: "La simplicité qui change tout",
        promesse: "Un quotidien plus confortable et agréable",
        prompt_affiche: `Square 1:1 real-life scene showing comfort and ease of use with the ${title || 'product'}. Tight crop, calm authentic setting, no text, no promotional elements, clear visual storytelling.`
      },
      {
        titre_angle: `Ce ${title || 'produit'} rassure par sa fiabilité et sa conception bien pensée`,
        explication: `Ce ${title || 'produit'} est conçu pour durer et répondre aux standards de qualité les plus exigeants. Sa solidité et sa fiabilité en font un investissement judicieux sur le long terme.`,
        message_principal: "Un produit de confiance pour les années à venir",
        promesse: "La tranquillité d'esprit avec chaque utilisation",
        prompt_affiche: `Square 1:1 close-up visual focused on reliability, finish and trust around the ${title || 'product'}. Tight crop, premium but simple, no text overlay, no promotional elements, no empty margins.`
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
    const defaultTestimonials = buildDefaultTestimonials(productName, storeCountry, storeCity);
    result.testimonials = result.testimonials || [];
    while (result.testimonials.length < 4) {
      result.testimonials.push(defaultTestimonials[result.testimonials.length % defaultTestimonials.length]);
    }
  }

  return result;
}

// ─── Étape 3 : Génération d'AFFICHES PUBLICITAIRES avec NanoBanana ───────────

export async function generatePosterImage(promptAffiche, originalImageBuffer = null, options = {}) {
  try {
    const mode = options?.mode || 'scene';
    console.log(`🎨 Generating ${mode} image with NanoBanana...`);

    const heroRules = `
USE THE EXACT REAL PRODUCT IMAGE PROVIDED. NEVER invent, recreate or redesign the product.
Square 1:1 premium hero, tight crop, full-bleed composition, ZERO empty margins around the subject.
Universal composition adaptable to any product category — do NOT impose a beauty or fashion template if this is not a beauty product.
Background should be clean, contextual or neutral according to the product function.
At most one very short French badge (3 words max) OR no text at all.
No paragraphs, no long text, no button, no price, no clutter, no flashy effects.`;

    const beforeAfterRules = `
Square 1:1 split-screen before/after visual specific to this product.
Tight crop, clear transformation, no text, no arrows, no labels, no numbers, no graphic overlays of any kind.
If humans are shown, keep the scene authentic and directly relevant to the product function.`;

    const sceneRules = `
Square 1:1 pure photo, tight crop, subject fills the entire frame, ZERO empty space.
ABSOLUTELY NO TEXT of any kind — no words, no letters, no numbers, no badge, no overlay, no watermark, no graphic element.
No poster layout, no CTA, no price, no button.
Show a real-life scene or context that visually illustrates the marketing angle for this specific product.
Adapted to the actual product category — not a generic beauty template.`;

    const posterPrompt = `${promptAffiche}

${mode === 'hero' ? heroRules : mode === 'before_after' ? beforeAfterRules : sceneRules}`;

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