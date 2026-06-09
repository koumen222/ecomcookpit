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
import sharp from 'sharp';
import { uploadImage, isConfigured } from './cloudflareImagesService.js';
import { generateAnimatedGifFromImages, generateKieImageToVideo, generateGptImage2ImageToImage } from './nanoBananaService.js';
import { randomUUID } from 'crypto';
import { callKieChatCompletion, isKieConfigured } from './kieChatService.js';

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

  // Fallback avec suffixes pour éviter les doublons (pas de boucle infinie)
  const fallbacks = [
    country || "Afrique de l'Ouest",
    'Dakar, Sénégal',
    "Abidjan, Côte d'Ivoire",
    'Douala, Cameroun',
    'Lomé, Togo',
  ];
  for (const fb of fallbacks) {
    if (locations.length >= 4) break;
    const trimmed = cleanScrapedText(fb);
    if (trimmed && !locations.includes(trimmed)) locations.push(trimmed);
  }
  // Dernier recours numéroté
  let i = 1;
  while (locations.length < 4) {
    locations.push(`Client vérifié ${i++}`);
  }

  return locations.slice(0, 6);
}

function buildStoreLocaleInstruction(country = '', city = '') {
  if (!country) {
    return 'Les témoignages doivent rester crédibles pour un contexte e-commerce africain réel.';
  }

  return `La boutique cible principalement le pays suivant : ${country}${city ? `, avec ${city} comme ville de référence` : ''}. Les témoignages, lieux, expressions et contexte d'achat doivent être cohérents avec ce pays.`;
}

const compactText = (value = '', max = 180) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const removeLeadingMarker = (value = '') => compactText(value, 220)
  .replace(/^[^\p{L}\p{N}#]+/u, '')
  .trim();

const GENERIC_PREMIUM_LABELS = new Set([
  'illustration',
  'qualite',
  'verifie',
  'acheteur verifie',
  'conforme',
  'pratique',
  'resultat',
  'ingredient actif',
  'premiers resultats',
  'formule et fonctionnement',
  'resultats produit',
  'produit a',
  'produit b',
]);

function isWeakPremiumText(value = '', minLength = 20) {
  const text = compactText(value, 600);
  if (!text || text.length < minLength) return true;
  return GENERIC_PREMIUM_LABELS.has(normalizeLocaleKey(text));
}

function uniqueMeaningfulStrings(items = [], minLength = 20) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => removeLeadingMarker(item))
    .filter((item) => !isWeakPremiumText(item, minLength))
    .filter((item) => {
      const key = normalizeLocaleKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const normalizeStatValue = (entry) => {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';
  return [entry.value, entry.label].filter(Boolean).join(' ');
};

function buildPremiumPageInstruction(enabled = false) {
  if (!enabled) return '';

  return `

═══ MODE PAGE PRODUIT PREMIUM / AVANCÉE ═══
Le client a choisi une PAGE PRODUIT PREMIUM. Tu dois ajouter au JSON un objet "premium_page" complet, pensé comme une vraie landing page longue, mobile-first, haut de gamme, et adapté au produit.

STRUCTURE À RESPECTER ET ADAPTER AU PRODUIT :
1. Header simple : nom de marque/produit centré, contact à gauche, icônes compte/panier à droite.
2. Hero split : grande image produit à gauche, rating/preuve sociale, titre, sous-titre, prix, bénéfices checkés, bloc offre spéciale, CTA clair, réassurance.
3. Bande d'autorité : 3 à 5 mini citations crédibles. Ne JAMAIS inventer Vogue, People, Shape, Refinery29 ou une vraie presse si la source produit ne les mentionne pas. Utilise plutôt "Clients vérifiés", "Communauté", "Routine populaire", "Qualité contrôlée", etc.
4. Galerie témoignages : headline émotionnel, sous-texte, EXACTEMENT 6 cartes avis détaillées (2 à 4 phrases chacune) de personnes ayant réellement utilisé le produit, avec photo prompt, tags, étoiles, acheteur vérifié.
5. Section problème : gros titre + 4 douleurs concrètes + image lifestyle montrant la gêne réelle.
6. Section cause/mécanisme : expliquer pourquoi le problème arrive. Pour santé/beauté, rester simple et crédible, sans diagnostic médical. Pour tech/home/fashion, transformer cette section en "ce qui bloque / pourquoi les solutions classiques échouent".
7. Section science/ingrédients/technologie : liste d'actifs, matières, composants ou fonctionnalités + image explicative. Si complément ou soin, parler de formule/actifs; si produit tech, parler de technologie; si maison, parler de mécanisme; si mode, parler de matière/coupe.
8. Résultats + rituel : timeline de résultats crédibles + étapes d'utilisation simples.
9. Tableau comparaison : le produit vs 2 alternatives logiques. Checks verts pour le produit, croix rouges pour alternatives si vrai et crédible.
10. Closing : bénéfices émotionnels, image produit avec callouts, CTA mental final.

RÈGLES PREMIUM :
- Tout doit être spécifique au produit et à ce qu'il fait, jamais copié tel quel des exemples.
- Titres courts, très lisibles, beaucoup d'espace, style premium Shopify.
- IMPORTANT — beaucoup de texte : développe chaque bloc de contenu (problème, mécanisme, science, rituel, closing, FAQ, témoignages) avec 3 à 5 phrases concrètes, utiles et spécifiques au produit, jamais une seule phrase. Seuls les TITRES restent courts.
- PUCES = PHRASES COMPLÈTES : chaque bénéfice et chaque puce (hero benefits, closingSection.bullets, problemSection.bullets) doit être une phrase complète et concrète de 6 à 12 mots. INTERDIT d'écrire des étiquettes courtes de 1 à 3 mots comme "Facile à utiliser", "Résultats rapides" ou "Confiance en soi" : développe-les (ex. "Très facile à utiliser au quotidien, en une seule étape simple").
- DEVISE : n'écris JAMAIS de prix en dollars ($) ni "USD". Laisse priceLabel, price et oldPrice vides : le prix réel est injecté automatiquement dans la devise locale de la boutique (FCFA par défaut).
- Les imagePrompt doivent être en anglais, photoréalistes, modernes, avec personnes africaines authentiques quand humains présents.
- Pas de fausses promesses médicales, pas de guérison, pas de chiffres inventés trop précis. Si tu utilises des chiffres, ils doivent rester marketing et crédibles.
- Le champ premium_page doit être généré même si certaines infos manquent, avec des formulations prudentes.
`;
}

function buildPremiumJsonContract(enabled = false) {
  if (!enabled) return '';

  return `,
  "premium_page": {
    "template": "premium_product_page",
    "brandName": "Nom court affiché en header",
    "navContactLabel": "Contact",
    "rating": {"score": "4,9/5", "count": "+1 000", "label": "clients satisfaits"},
    "hero": {
      "eyebrow": "Phrase courte de preuve ou positionnement",
      "headline": "Titre hero premium adapté au produit",
      "subheadline": "Promesse claire et crédible en une phrase",
      "priceLabel": "",
      "benefits": ["Bénéfice hero complet décrit en 6 à 12 mots", "Deuxième bénéfice en phrase complète et concrète", "Troisième bénéfice en phrase complète et concrète", "Quatrième bénéfice en phrase complète et concrète"],
      "offerTitle": "OFFRE SPÉCIALE",
      "countdownLabel": "L'offre expire bientôt",
      "offerCards": [{"title": "1 + 1 OFFERT", "badge": "Économisez", "price": "", "oldPrice": ""}],
      "ctaLabel": "Commander",
      "reassurance": ["Paiement à la livraison", "Livraison rapide", "Support WhatsApp"],
      "accordions": [
        {"title": "Comment ça marche ?", "content": "Explication claire du fonctionnement du produit en 2-3 phrases"},
        {"title": "Ingrédients clés", "content": "Liste des principaux ingrédients/composants et leur rôle"},
        {"title": "Et si cela ne fonctionne pas ?", "content": "Garantie satisfaction ou politique de retour rassurante"}
      ]
    },
    "authorityStrip": [
      {"label": "Clients vérifiés", "quote": "Citation crédible liée au bénéfice principal"},
      {"label": "Routine populaire", "quote": "Citation courte et rassurante"},
      {"label": "Qualité contrôlée", "quote": "Citation courte et crédible"}
    ],
    "testimonialGallery": {
      "headline": "Titre émotionnel sur la transformation",
      "subheadline": "Phrase invitant à rejoindre les clients satisfaits",
      "items": [
        {"name": "Prénom N.", "text": "Avis détaillé et crédible de 2 à 4 phrases d'une personne ayant vraiment utilisé le produit : contexte d'achat, bénéfice ressenti, qualité, livraison ou paiement à la livraison", "tags": ["Tag 1", "Tag 2"], "rating": 5, "verified": true, "imagePrompt": "English photorealistic customer photo prompt"}
      ],
      "_instruction": "Génère EXACTEMENT 6 objets différents dans items, chacun avec un prénom distinct et un avis détaillé de 2 à 4 phrases."
    },
    "problemSection": {"headline": "Titre problème puissant", "bullets": ["Douleur concrète décrite en une phrase complète", "Douleur 2 en une phrase", "Douleur 3 en une phrase", "Douleur 4 en une phrase"], "imagePrompt": "English photorealistic problem scene prompt"},
    "mechanismSection": {"headline": "Titre expliquant la vraie cause", "body": "Paragraphe développé de 3 à 5 phrases, simple, concret et crédible", "imagePrompt": "English explanatory lifestyle prompt"},
    "scienceSection": {"headline": "Titre science/formule/technologie", "subheadline": "Sous-titre développé en une à deux phrases", "items": [{"name": "Actif ou fonctionnalité", "description": "Rôle concret expliqué en 2 à 3 phrases", "imagePrompt": "English close-up prompt"}], "imagePrompt": "English explanatory diagram or product board prompt"},
    "ritualSection": {"headline": "Titre rituel", "subheadline": "Sous-titre", "resultsTimeline": [{"label": "Jour 1", "description": "Résultat crédible"}], "steps": [{"label": "Étape 1", "title": "Action courte", "description": "Détail"}], "imagePrompt": "English ritual/results prompt"},
    "comparisonSection": {"columns": ["Votre produit", "Alternative 1", "Alternative 2"], "rows": [{"label": "Critère concret", "values": [true, false, false]}]},
    "closingSection": {"headline": "Titre final bénéfice émotionnel", "subheadline": "Phrase finale développée en une à deux phrases", "bullets": ["Bénéfice final en phrase complète de 6 à 12 mots", "Deuxième bénéfice final en phrase complète", "Troisième bénéfice final en phrase complète"], "imagePrompt": "English product callout prompt"},
    "faq": {"headline": "Questions fréquentes", "subheadline": "Tout ce que vous devez savoir", "items": [{"question": "Question pertinente 1", "answer": "Réponse claire et rassurante"}, {"question": "Question pertinente 2", "answer": "Réponse claire"}, {"question": "Question pertinente 3", "answer": "Réponse claire"}, {"question": "Question pertinente 4", "answer": "Réponse claire"}, {"question": "Question pertinente 5", "answer": "Réponse claire"}]}
  }`;
}

function buildFallbackPremiumPage(result = {}, productTitle = '', storeContext = {}) {
  const productName = compactText(result.title || productTitle || 'Produit', 80);
  const benefits = (Array.isArray(result.benefits_bullets) ? result.benefits_bullets : [])
    .map(removeLeadingMarker)
    .filter(Boolean)
    .slice(0, 4);
  const reasons = (Array.isArray(result.raisons_acheter) ? result.raisons_acheter : [])
    .map(removeLeadingMarker)
    .filter(Boolean);
  const painPoints = (Array.isArray(result.problem_section?.pain_points) ? result.problem_section.pain_points : [])
    .map(removeLeadingMarker)
    .filter(Boolean)
    .slice(0, 4);
  const testimonials = (Array.isArray(result.testimonials) ? result.testimonials : []).slice(0, 6);
  const stats = (Array.isArray(result.stats_bar) ? result.stats_bar : []).map(normalizeStatValue).filter(Boolean);
  const fallbackBenefits = benefits.length ? benefits : [
    `Une solution simple pour profiter pleinement de ${productName}`,
    'Une utilisation facile au quotidien',
    'Un résultat visible avec une routine régulière',
    'Une qualité rassurante pour acheter sans stress',
  ];
  const fallbackPainPoints = painPoints.length ? painPoints : [
    'Vous perdez du temps avec des solutions qui ne tiennent pas leurs promesses.',
    'Vous hésitez à acheter parce que le résultat n’est pas clair.',
    'Vous voulez une solution pratique, fiable et simple à utiliser.',
    'Vous cherchez un produit qui s’intègre facilement à votre quotidien.',
  ];
  const scienceItems = (reasons.length ? reasons : fallbackBenefits).slice(0, 4).map((item, index) => ({
    name: compactText(item.split(/[,:—-]/)[0] || `Point clé ${index + 1}`, 48),
    description: compactText(item, 300),
    imagePrompt: `photorealistic premium close-up visual representing ${item} for ${productName}, clean ecommerce style, no text overlay`,
  }));
  const location = storeContext.city || storeContext.country || 'Afrique francophone';

  return {
    template: 'premium_product_page',
    brandName: productName,
    navContactLabel: 'Contact',
    rating: {
      score: '4,9/5',
      count: stats[0]?.match(/[+\d][\d\s.,+]*/)?.[0]?.trim() || '+1 000',
      label: 'clients satisfaits',
    },
    hero: {
      eyebrow: result.hero_baseline || result.urgency_badge || 'Solution appréciée par nos clients',
      headline: result.hero_headline || productName,
      subheadline: result.hero_slogan || result.solution_section?.description || fallbackBenefits[0],
      priceLabel: '',
      benefits: fallbackBenefits,
      offerTitle: result.offer_block?.offer_label || 'OFFRE SPÉCIALE',
      countdownLabel: result.offer_block?.countdown ? "L'offre expire bientôt" : 'Offre disponible aujourd’hui',
      offerCards: [{ title: 'Offre du moment', badge: 'Meilleur choix', price: '', oldPrice: '' }],
      ctaLabel: result.hero_cta || 'Commander',
      reassurance: result.reassurance?.points?.length ? result.reassurance.points.slice(0, 3) : ['Paiement à la livraison', 'Livraison rapide', 'Support WhatsApp'],
      accordions: [
        { title: 'Comment ça marche ?', content: compactText(result.solution_section?.description || `${productName} agit efficacement pour vous offrir des résultats visibles.`, 520) },
        { title: 'Ingrédients clés', content: compactText((result.raisons_acheter || []).slice(0, 4).join('. ') || 'Formule naturelle et efficace à base d\'ingrédients sélectionnés.', 520) },
        { title: 'Et si cela ne fonctionne pas ?', content: 'Nous offrons une garantie de satisfaction totale. Contactez-nous pour un remboursement intégral, sans aucune question.' },
      ],
    },
    authorityStrip: [
      { label: 'Clients vérifiés', quote: fallbackBenefits[0] },
      { label: 'Routine populaire', quote: fallbackBenefits[1] || fallbackBenefits[0] },
      { label: 'Qualité contrôlée', quote: result.reassurance?.titre || 'Une expérience pensée pour rassurer avant et après l’achat.' },
    ],
    testimonialGallery: {
      headline: result.hero_slogan || `Ils ont choisi ${productName} avec confiance`,
      subheadline: `Des clients de ${location} et d’ailleurs partagent leur expérience.`,
      items: testimonials.map((testimonial, index) => ({
        name: testimonial.name || `Client ${index + 1}`,
        text: testimonial.text || fallbackBenefits[index % fallbackBenefits.length],
        tags: [fallbackBenefits[index % fallbackBenefits.length].split(' ').slice(0, 2).join(' '), 'Acheteur vérifié'].filter(Boolean),
        rating: testimonial.rating || 5,
        verified: testimonial.verified !== false,
        imagePrompt: testimonial.image_prompt || `realistic portrait photo of a satisfied Black African ecommerce customer holding or using ${productName}, modern setting, natural light`,
      })),
    },
    problemSection: {
      headline: result.problem_section?.title || 'Ce petit problème peut gâcher votre quotidien',
      bullets: fallbackPainPoints,
      imagePrompt: `photorealistic lifestyle scene of a Black African customer experiencing the specific problem solved by ${productName}, modern upscale home, natural light, no text overlay`,
    },
    mechanismSection: {
      headline: result.solution_section?.title || 'La différence vient de ce que le produit corrige vraiment',
      body: compactText(result.solution_section?.description || fallbackBenefits.join(' '), 1000),
      imagePrompt: `premium explanatory lifestyle image showing how ${productName} solves its core problem, product visible, modern African ecommerce campaign, no text overlay`,
    },
    scienceSection: {
      headline: 'Ce qui rend la formule efficace',
      subheadline: 'Des éléments clés sélectionnés pour un usage simple, crédible et rassurant.',
      items: scienceItems,
      imagePrompt: `premium product explainer board for ${productName}, clean ingredient or feature callouts, photorealistic, no fake medical claims, no long text`,
    },
    ritualSection: {
      headline: result.guide_utilisation?.titre || 'Votre rituel simple au quotidien',
      subheadline: 'Une routine claire, facile à suivre et pensée pour rester régulière.',
      resultsTimeline: [
        { label: 'Jour 1', description: 'Vous commencez la routine et découvrez la sensation ou le bénéfice principal.' },
        { label: 'Jour 7', description: 'L’usage devient plus naturel et les premiers changements se remarquent.' },
        { label: 'Jour 15', description: 'La routine s’installe pour un résultat plus stable et rassurant.' },
      ],
      steps: (result.guide_utilisation?.etapes || []).slice(0, 4).map((step, index) => ({
        label: `Étape ${step.numero || index + 1}`,
        title: step.action || `Utilisez ${productName}`,
        description: step.detail || 'Suivez l’usage recommandé pour profiter du produit correctement.',
      })),
      imagePrompt: `photorealistic premium routine scene with ${productName}, Black African customer, clean modern interior, natural light, no text overlay`,
    },
    comparisonSection: {
      columns: [productName, 'Solution classique', 'Alternative basique'],
      rows: fallbackBenefits.slice(0, 5).map((benefit) => ({ label: benefit, values: [true, false, false] })),
    },
    closingSection: {
      headline: result.hero_headline || `Passez à ${productName}`,
      subheadline: result.hero_slogan || 'Une solution simple pour acheter avec confiance et utiliser sans complication.',
      bullets: fallbackBenefits.slice(0, 3),
      imagePrompt: `premium product callout image for ${productName}, product large and sharp, clean white background, elegant feature lines, no fake logos, no price text`,
    },
    faq: {
      headline: 'Questions fréquentes',
      subheadline: 'Tout ce que vous devez savoir avant de commander.',
      items: [
        { question: `Comment utiliser ${productName} ?`, answer: "Suivez les instructions sur l'emballage. En cas de doute, contactez-nous via WhatsApp." },
        { question: 'Quels sont les délais de livraison ?', answer: 'La livraison est effectuée sous 24h à 72h selon votre zone géographique.' },
        { question: 'Le paiement à la livraison est-il disponible ?', answer: 'Oui, vous payez en espèces à la réception de votre colis.' },
        { question: 'Comment contacter le service client ?', answer: 'Écrivez-nous sur WhatsApp, nous répondons en moins de 10 minutes.' },
        { question: 'Y a-t-il une garantie ?', answer: 'Nous offrons une garantie de satisfaction. Contactez-nous si le produit ne vous convient pas.' },
      ],
    },
  };
}

function countKeywordMatches(source = '', keywords = []) {
  return keywords.reduce((score, keyword) => (source.includes(keyword) ? score + 1 : score), 0);
}

function inferInfographicGenderContext(product = {}) {
  const source = normalizeLocaleKey([
    product.name,
    product.description,
    product.targetAudience,
    product.painPoint,
    product.bodyZone,
  ].filter(Boolean).join(' '));

  const femaleKeywords = [
    'femme', 'femmes', 'woman', 'women', 'lady', 'ladies', 'feminin', 'femininite', 'feminite',
    'lingerie', 'soutien gorge', 'rouge a levres', 'menopause', 'ovulation', 'vaginal', 'vagin',
    'seins', 'post partum', 'perruque', 'wig', 'tissage', 'extensions', 'maquillage', 'bikini'
  ];
  const maleKeywords = [
    'homme', 'hommes', 'man', 'men', 'male', 'masculin', 'virilite', 'viril', 'barbe', 'beard',
    'moustache', 'rasage', 'shaving', 'prostate', 'testosterone', 'erection', 'penis', 'penile'
  ];

  const femaleScore = countKeywordMatches(source, femaleKeywords);
  const maleScore = countKeywordMatches(source, maleKeywords);

  if (femaleScore > maleScore && femaleScore > 0) return 'female';
  if (maleScore > femaleScore && maleScore > 0) return 'male';
  return 'neutral';
}

function buildInfographicCastingInstruction(product = {}) {
  // 1. Explicit gender set by the user takes absolute priority
  const explicit = product._targetGender;
  if (explicit === 'female') {
    return 'ALL people in this image MUST be Black African women only — every portrait, avatar, model, silhouette or figure. No men. No boys. No male figures anywhere.';
  }
  if (explicit === 'male') {
    return 'ALL people in this image MUST be Black African men only — every portrait, avatar, model, silhouette or figure. No women. No girls. No female figures anywhere.';
  }
  if (explicit === 'mixed') {
    return 'Show a natural mix of Black African men and women. Do NOT make the image exclusively one gender.';
  }

  // 2. Fall back to keyword inference from product data
  const genderContext = inferInfographicGenderContext(product);

  if (genderContext === 'female') {
    return 'Use Black African women only for the visible people and testimonial avatars in this generation. Do not insert men unless the product context explicitly requires a tiny secondary background role.';
  }

  if (genderContext === 'male') {
    return 'Use Black African men only for the visible people and testimonial avatars in this generation. Do not insert women unless the product context explicitly requires a tiny secondary background role.';
  }

  return 'Choose the most natural Black African person for this product. Do NOT automatically mix women and men in the same slide. Keep the casting coherent with the product category and the target audience.';
}

function buildInfographicLocaleInstruction(country = '', city = '') {
  const cleanCountry = cleanScrapedText(country || '');
  if (!cleanCountry) {
    return 'Keep names, expressions, and social proof credible for a real African e-commerce market.';
  }

  const locations = getLocalizedTestimonialLocations(cleanCountry, city).slice(0, 6);
  return `The market focus is ${cleanCountry}${city ? ` with ${cleanScrapedText(city)} as a reference city` : ''}. Review cards, names, styling cues, language tone and city labels must feel native to this country. Prefer locations such as ${locations.join(', ')}. Do not mix multiple countries in the same slide.`;
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex) {
  const cleaned = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => clampColorChannel(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function mixHexColors(baseHex, mixHex, ratio = 0.5) {
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHex);
  if (!base || !mix) return baseHex;

  return rgbToHex({
    r: base.r + (mix.r - base.r) * ratio,
    g: base.g + (mix.g - base.g) * ratio,
    b: base.b + (mix.b - base.b) * ratio,
  });
}

function getContrastTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.62 ? '#111827' : '#FFFFFF';
}

function buildCustomInfographicPalette(brandColor) {
  // Always use ivory background — brand color becomes the accent/headline color
  return {
    bg: '#FFF8F0',
    card: '#FFFFFF',
    text: brandColor,
    accent: brandColor,
    highlight: brandColor,
    description: `warm ivory background with custom brand color (${brandColor}) as headline and accent`,
  };
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
      text: `Franchement satisfait. Le produit est conforme, agréable à utiliser et le résultat est visible dans un cadre normal d'utilisation. La commande a été simple et la livraison rapide. Je referai confiance à cette boutique sans hésiter.`,
      verified: true,
      date: 'Il y a 2 semaines'
    },
    {
      name: 'Grace E.',
      location: locations[4],
      rating: 5,
      text: `J'ai commandé ce ${productName} un peu par curiosité et je suis agréablement surprise. La qualité est vraiment au rendez-vous, l'utilisation est simple et le résultat se ressent au quotidien. Le paiement à la livraison m'a beaucoup rassurée.`,
      verified: true,
      date: 'Il y a 4 jours'
    },
    {
      name: 'Salif K.',
      location: locations[5],
      rating: 5,
      text: `Très bon rapport qualité-prix. Ce ${productName} tient ses promesses, il est solide et bien pensé. Je l'utilise tous les jours depuis plusieurs semaines et je le recommande à tous mes proches. Service client réactif sur WhatsApp.`,
      verified: true,
      date: 'Il y a 6 jours'
    }
  ];
}

function buildVisualTemplateInstruction(template = 'general', preferredColor = '', heroVisualDirection = '', decorationDirection = '', titleColor = '', contentColor = '') {
  const visualDirections = {
    beauty: 'ambiance beaute premium, formes douces, icones elegantes, surfaces cosmetiques, composition editoriale feminine et raffinee',
    tech: 'ambiance tech moderne, lignes nettes, icones fonctionnelles, contrastes francs, composition plus structuree et innovative',
    fashion: 'ambiance mode editoriale, silhouettes affirmees, details de style, composition lookbook premium et expressive',
    health: 'ambiance sante bien-etre, visuels propres, icones rassurantes, sensation naturelle, composition claire et energique',
    home: 'ambiance maison chaleureuse, textures douces, icones pratiques, composition accueillante et concrete',
    general: 'ambiance e-commerce premium polyvalente, composition propre, visuels clairs, icones simples et universelles',
  };

  const selectedDirection = visualDirections[template] || visualDirections.general;
  const titleColorLine = titleColor
    ? `- Couleur des titres de description a respecter : ${titleColor}`
    : '- Couleur des titres de description : issue du theme de la boutique';
  const contentColorLine = contentColor
    ? `- Couleur du contenu de description a respecter : ${contentColor}`
    : '- Couleur du contenu de description : issue du theme de la boutique';

  return `
═══════════════════════════════════════════════
DIRECTION VISUELLE DU TEMPLATE
═══════════════════════════════════════════════
- Template choisi : ${template}
- Direction visuelle attendue : ${selectedDirection}
${titleColorLine}
${contentColorLine}

RÈGLE CRITIQUE : le template influence UNIQUEMENT le style general du contenu.
- Il peut guider le ton visuel global, les icones et la composition generale.
- Les couleurs de titres et de contenu ne s'appliquent qu'aux textes descriptifs rendus sur la page, jamais aux images generees.
- Le template ne doit jamais imposer l'arriere-plan final de la page publique, qui doit rester pilote par la configuration theme de la boutique.
- Il ne doit PAS changer la verite produit, la cible reelle, les promesses, la structure marketing, les objections, ni la logique copywriting.
- Si le template et le produit se contredisent, tu gardes la verite produit et tu adaptes seulement le langage visuel.
- INTERDICTION ABSOLUE : ne jamais reutiliser une maquette fixe, un layout rigide ou une structure identique d'un produit a l'autre.
- Pour chaque produit, la structure visuelle doit etre repensee de facon dynamique selon : la promesse du produit, le type d'objet, la cible, les couleurs, le niveau de premium, le contexte d'usage, et l'angle marketing.
- Les images de description ne doivent PAS donner l'impression d'utiliser toujours le meme template. Elles doivent sembler concues specifiquement pour ce produit.
- L'IA doit choisir elle-meme la meilleure composition, la meilleure hierarchie visuelle, le meilleur placement du produit, du texte, des badges et des elements graphiques en fonction du produit reel.
- Les differents visuels d'une MEME page produit doivent aussi varier entre eux : hero, preuve, benefices, reassurance et lifestyle ne doivent pas reprendre la meme grammaire visuelle.
- Alterne selon le produit entre des approches comme : editorial minimal, macro tactile, collage UGC, poster conversion, mise en scene lifestyle, composition preuve-scientifique ou mise en avant premium.
- La direction artistique doit etre decidee au cas par cas, pas seulement par categorie. Deux produits d'une meme categorie ne doivent pas automatiquement produire le meme style d'image.
- Tous les prompts images et toutes les indications de design doivent etre coherents avec ce template backend sans figer la structure.`;
}

function buildFashionInstruction(fashionConfig) {
  if (!fashionConfig) return '';
  const avatarMap = {
    female: 'une femme africaine naturelle (20-35 ans), silhouette realiste, expression assuree, peau noire, cheveux naturels ou styles modernes',
    male: 'un homme africain naturel (22-38 ans), silhouette realiste, expression confiante, peau noire, style moderne',
    both: 'un duo homme + femme africains (20-35 ans), attitude complice et editoriale, silhouettes credibles'
  };
  const avatarDesc = avatarMap[fashionConfig.avatar] || avatarMap.female;
  const minimalistLine = fashionConfig.minimalist
    ? 'PAGE MINIMALISTE MODE : garder uniquement hero, galerie silhouette, description matiere courte, guide tailles, temoignages, CTA. Pas de blocs "before/after", pas d\'infographies sante, pas de bullets longues. Typographie elegante, beaucoup de blanc, pas de badges criards.'
    : '';
  const sizesLine = (fashionConfig.sizes || []).length ? `- Tailles disponibles : ${fashionConfig.sizes.join(', ')}` : '';
  const colorsLine = (fashionConfig.colors || []).length ? `- Couleurs disponibles : ${fashionConfig.colors.map(c => `${c.name} (${c.hex})`).join(', ')}` : '';

  return `

═══════════════════════════════════════════════
MODE FASHION — HABILLAGE AVATAR
═══════════════════════════════════════════════
- Type de produit : vêtement ou accessoire de mode.
- Avatar/mannequin attendu dans TOUS les visuels hero, poster et lifestyle : ${avatarDesc}.
- OBLIGATION : les photos produit fournies doivent être PORTÉES par cet avatar, pas juste posées sur fond. L'IA d'image doit composer l'avatar avec le vêtement fourni comme référence (forme, couleur, motifs).
- Les visuels doivent ressembler à un lookbook studio : fond neutre doux (beige, blanc cassé, terracotta), lumière naturelle, pose éditoriale naturelle, zéro texte overlay.
- Les multi-photos fournies représentent des variantes de la MÊME pièce ou des angles — combine-les cohéremment sur l'avatar.
${sizesLine}
${colorsLine}
${minimalistLine}
- Les témoignages restent crédibles mais orientés mode : "tombé parfait", "coupe flatteuse", "tissu de qualité", "style qui attire les regards".
- Le copywriting doit éviter le vocabulaire santé/bien-être et privilégier : style, silhouette, coupe, matière, occasion, confiance, élégance.
`;
}

// ─── Parser JSON robuste pour réponses Groq/LLM ────────────────────
function parseGroqJSON(text) {
  // 1. Supprimer blocs markdown
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // 2. Isoler du premier { au dernier }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  cleaned = cleaned.slice(start, end + 1);

  // 3. Tentative directe
  try { return JSON.parse(cleaned); } catch (_) {}

  // 4. Échapper les newlines/tabs littéraux dans les valeurs de chaînes
  let fixed = cleaned.replace(/"((?:[^"\\]|\\.)*)"/gs, (match, inner) =>
    '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"'
  );
  try { return JSON.parse(fixed); } catch (_) {}

  // 5. Supprimer virgules traînantes
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch (_) {}

  return null;
}

const compactEbookText = (value = '', max = 900) => cleanScrapedText(String(value || '')).slice(0, max);

const asCleanArray = (value, limit = 6) => (Array.isArray(value) ? value : [])
  .map((item) => (typeof item === 'string' ? compactEbookText(item, 500) : item))
  .filter(Boolean)
  .slice(0, limit);

function buildFallbackBonusEbook({ productName = 'ce produit', storeName = '', productDescription = '', customerProblem = '', benefits = [] } = {}) {
  const safeProductName = compactEbookText(productName, 120) || 'ce produit';
  const brand = compactEbookText(storeName, 80) || 'Notre boutique';
  const mainBenefit = benefits[0] || `mieux utiliser ${safeProductName} au quotidien`;
  const shortDescription = productDescription
    ? `Un guide simple pour comprendre comment profiter de ${safeProductName} avec une routine claire et rassurante.`
    : `Un guide pratique offert pour profiter de ${safeProductName} avec plus de confiance.`;

  return {
    title: `Le guide pratique ${safeProductName}`,
    subtitle: `Conseils simples pour ${mainBenefit}`,
    short_description: shortDescription,
    target_reader: customerProblem || `Toute personne qui veut acheter ${safeProductName} et l'utiliser correctement.`,
    main_promise: `Vous aider à profiter de votre achat avec des conseils simples, crédibles et faciles à appliquer.`,
    estimated_value: 'Bonus offert inclus avec votre commande',
    cover: {
      cover_title: `Guide ${safeProductName}`,
      cover_subtitle: `Conseils pratiques pour bien l'utiliser`,
      badge_text: 'Bonus offert',
      author_or_brand: brand,
      visual_style: 'Couverture ebook moderne, premium, claire et professionnelle',
      color_palette: ['#0F766E', '#FFFFFF', '#111827'],
      cover_description: `Une couverture professionnelle qui présente ${safeProductName} comme une offre plus complète et plus rassurante.`,
      image_generation_prompt: `Modern professional ebook cover for "${safeProductName}", clean premium ecommerce style, readable French title "Guide ${safeProductName}", badge "Bonus offert", brand "${brand}", refined green and white palette, clear composition with clean text space, product-related visual background, high-end digital guide cover.`,
    },
    sales_section: {
      headline: `Bonus offert avec votre commande`,
      bonus_text: `Recevez gratuitement un guide pratique pour mieux utiliser ${safeProductName} et profiter d'une meilleure expérience au quotidien.`,
      value_text: `Un contenu bonus utile qui rend votre achat plus complet, plus rassurant et plus simple à utiliser.`,
      cta_text: `Commander et recevoir mon bonus`,
    },
    table_of_contents: [
      { chapter_number: 1, chapter_title: 'Bien démarrer', chapter_summary: `Comprendre à quoi sert ${safeProductName} et comment l'intégrer simplement.` },
      { chapter_number: 2, chapter_title: 'Les bons gestes', chapter_summary: 'Conseils pratiques pour utiliser le produit avec régularité et confiance.' },
      { chapter_number: 3, chapter_title: 'Erreurs à éviter', chapter_summary: 'Les habitudes qui peuvent réduire la qualité de l’expérience.' },
      { chapter_number: 4, chapter_title: 'Routine simple', chapter_summary: 'Un plan d’action facile à suivre après réception du produit.' },
      { chapter_number: 5, chapter_title: 'Profiter pleinement de son achat', chapter_summary: 'Recommandations finales pour une utilisation sereine.' },
    ],
    chapters: [
      { chapter_number: 1, chapter_title: 'Bien démarrer', chapter_content: `Avant d'utiliser ${safeProductName}, prenez le temps de lire les informations essentielles et d'identifier votre objectif principal. Une bonne première utilisation commence par une compréhension claire du produit, de ses limites et de la façon dont il peut s'intégrer dans votre quotidien.` },
      { chapter_number: 2, chapter_title: 'Les bons gestes', chapter_content: `Utilisez ${safeProductName} avec régularité, dans un contexte adapté, et suivez les recommandations fournies avec le produit. Gardez une routine simple : mieux vaut une utilisation claire et répétable qu'une approche compliquée difficile à tenir.` },
      { chapter_number: 3, chapter_title: 'Erreurs à éviter', chapter_content: `Évitez les attentes irréalistes, les utilisations excessives ou les comparaisons avec des résultats non vérifiés. Un bon achat se juge sur une expérience crédible, progressive et adaptée à votre besoin réel.` },
      { chapter_number: 4, chapter_title: 'Routine simple', chapter_content: `Définissez un moment précis pour utiliser le produit, préparez-le correctement et observez ce qui fonctionne le mieux pour vous. Cette routine vous aide à rester constant et à profiter d'une expérience plus fluide.` },
      { chapter_number: 5, chapter_title: 'Profiter pleinement de son achat', chapter_content: `Merci pour votre confiance. Utilisez ${safeProductName} correctement, conservez les informations utiles et contactez la boutique si vous avez une question avant ou après votre commande.` },
    ],
    final_page: {
      title: 'Merci pour votre confiance',
      message: `Nous espérons que ce guide vous aidera à profiter de ${safeProductName} avec plus de sérénité.`,
      cta: `Passez commande et recevez votre bonus offert.`,
    },
  };
}

function normalizeBonusEbook(payload = {}, fallback = {}) {
  const raw = payload?.ebook && typeof payload.ebook === 'object' ? payload.ebook : payload;
  const ebook = raw && typeof raw === 'object' ? raw : {};
  const normalized = {
    ...fallback,
    ...ebook,
    cover: {
      ...(fallback.cover || {}),
      ...(ebook.cover && typeof ebook.cover === 'object' ? ebook.cover : {}),
    },
    sales_section: {
      ...(fallback.sales_section || {}),
      ...(ebook.sales_section && typeof ebook.sales_section === 'object' ? ebook.sales_section : {}),
    },
    final_page: {
      ...(fallback.final_page || {}),
      ...(ebook.final_page && typeof ebook.final_page === 'object' ? ebook.final_page : {}),
    },
  };

  normalized.title = compactEbookText(normalized.title || fallback.title, 160);
  normalized.subtitle = compactEbookText(normalized.subtitle || fallback.subtitle, 220);
  normalized.short_description = compactEbookText(normalized.short_description || fallback.short_description, 420);
  normalized.target_reader = compactEbookText(normalized.target_reader || fallback.target_reader, 420);
  normalized.main_promise = compactEbookText(normalized.main_promise || fallback.main_promise, 420);
  normalized.estimated_value = compactEbookText(normalized.estimated_value || fallback.estimated_value, 120);
  normalized.cover.color_palette = asCleanArray(normalized.cover.color_palette || fallback.cover?.color_palette, 6);
  normalized.table_of_contents = asCleanArray(normalized.table_of_contents || fallback.table_of_contents, 7);
  normalized.chapters = asCleanArray(normalized.chapters || fallback.chapters, 7);
  normalized.generatedAt = new Date().toISOString();
  return normalized;
}

export async function generateProductBonusEbook(scrapedData = {}, productData = {}, storeContext = {}, context = {}) {
  const requestedChapterCount = [5, 6, 7].includes(Number(context.chapterCount)) ? Number(context.chapterCount) : 5;
  const requestedTheme = compactEbookText(context.ebookTheme || context.theme || '', 220);
  const requestedGoal = compactEbookText(context.ebookGoal || context.goal || '', 180);
  const requestedOfferAngle = compactEbookText(context.ebookOfferAngle || context.offerAngle || '', 420);
  const productDescription = compactEbookText(
    scrapedData.description
    || scrapedData.rawText
    || productData.hero_slogan
    || productData.description
    || '',
    1400
  );
  const rawProductName = compactEbookText(productData.title || scrapedData.title || context.productName || '', 140);
  const inferredProductName = normalizeLocaleKey(rawProductName) === 'produit'
    ? compactEbookText(productDescription.split(/[.\n:;|-]/)[0], 100)
    : rawProductName;
  const productName = compactEbookText(inferredProductName || 'Produit', 140);
  const benefits = asCleanArray(productData.benefits_bullets || productData.raisons_acheter || context.benefits, 6)
    .map((item) => (typeof item === 'string' ? item : compactEbookText(item?.text || item?.title || item?.description, 260)))
    .filter(Boolean);
  const customerProblem = compactEbookText(
    context.mainProblem
    || context.problem
    || productData.problem_section?.title
    || productData.problem_section?.pain_points?.[0]
    || '',
    360
  );
  const fallback = buildFallbackBonusEbook({
    productName,
    storeName: storeContext.shopName || storeContext.storeName || '',
    productDescription,
    customerProblem,
    benefits,
  });

  const prompt = `Tu es un expert en e-commerce, copywriting, creation de produits digitaux, design d'ebooks et offres irresistibles.

Ta mission est de creer automatiquement un ebook bonus associe a un produit physique vendu en ligne.
Objectif : augmenter la valeur percue de l'offre, rassurer le client, rendre le produit plus desirable et donner l'impression que le client achete une offre complete, pas seulement un simple produit.

Informations produit :
- Nom du produit : ${productName || 'Non disponible'}
- Description du produit : ${productDescription || 'Non disponible'}
- Categorie du produit : ${compactEbookText(context.productCategory || productData.category || scrapedData.category || 'A deduire du produit', 160)}
- Prix du produit : ${compactEbookText(context.productPrice || productData.price || 'Non fourni', 80)}
- Public cible : ${compactEbookText(context.targetAudience || context.targetAvatar || context.avatar || 'A deduire du produit', 320)}
- Probleme principal du client : ${customerProblem || 'A deduire du produit'}
- Benefices du produit : ${benefits.length ? benefits.join(' | ') : 'A deduire du produit'}
- Marque ou boutique : ${compactEbookText(storeContext.shopName || storeContext.storeName || 'La boutique', 100)}

Brief utilisateur pour ce produit digital :
- Theme ou titre souhaite : ${requestedTheme || 'A deduire intelligemment du produit'}
- Objectif principal de l'ebook : ${requestedGoal || 'Guide utile qui aide a utiliser et comprendre le produit'}
- Angle de vente a mettre en avant : ${requestedOfferAngle || 'Bonus offert qui augmente la valeur percue de la commande'}
- Nombre de chapitres attendu : ${requestedChapterCount}

Regles importantes :
- Si le brief utilisateur contient une information concrete, respecte-la en priorite.
- Ne fais jamais de promesses exagerees.
- Ne dis jamais qu'un produit guerit, soigne ou remplace un traitement medical.
- Pour les produits sante ou complements, utilise des formulations prudentes : "peut aider a", "contribue a", "accompagne", "favorise", "peut soutenir".
- Le contenu doit etre simple, utile, credible, professionnel, chaleureux, clair et rassurant.
- L'ebook doit donner envie d'acheter le produit sans fausse garantie de resultat.
- Ne mentionne jamais l'IA, les bases de donnees, le code ou la technique.
- Pour la couverture, cree une vraie direction de couverture premium et un image_generation_prompt complet.
- Genere exactement ${requestedChapterCount} chapitres utiles. Chaque chapitre doit contenir un contenu complet avec conseils pratiques, erreurs a eviter ou routine si pertinent.
- La section sales_section sera affichee sur la page produit pour presenter le bonus et donner envie de commander.

Reponds uniquement en JSON valide avec cette structure exacte :
{
  "ebook": {
    "title": "",
    "subtitle": "",
    "short_description": "",
    "target_reader": "",
    "main_promise": "",
    "estimated_value": "",
    "cover": {
      "cover_title": "",
      "cover_subtitle": "",
      "badge_text": "",
      "author_or_brand": "",
      "visual_style": "",
      "color_palette": [],
      "cover_description": "",
      "image_generation_prompt": ""
    },
    "sales_section": {
      "headline": "",
      "bonus_text": "",
      "value_text": "",
      "cta_text": ""
    },
    "table_of_contents": [
      {"chapter_number": 1, "chapter_title": "", "chapter_summary": ""}
    ],
    "chapters": [
      {"chapter_number": 1, "chapter_title": "", "chapter_content": ""}
    ],
    "final_page": {
      "title": "",
      "message": "",
      "cta": ""
    }
  }
}`;

  const messages = [
    {
      role: 'system',
      content: 'Tu generes uniquement un JSON valide. Tu crees un ebook bonus e-commerce utile, prudent, credible et vendeur, en francais naturel.',
    },
    { role: 'user', content: prompt },
  ];

  try {
    if (isKieConfigured()) {
      const kie = await callKieChatCompletion({
        messages,
        temperature: 0.62,
        maxTokens: 8000,
        reasoningEffort: process.env.KIE_REASONING_EFFORT || 'high',
        includeThoughts: false,
      });
      const parsed = parseGroqJSON(kie.content || '{}');
      if (parsed) return normalizeBonusEbook(parsed, fallback);
    }

    const groq = getGroq();
    if (groq) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      try {
        const response = await groq.chat.completions.create(
          {
            model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
            messages,
            max_tokens: 8000,
            temperature: 0.62,
            response_format: { type: 'json_object' },
          },
          { signal: controller.signal }
        );
        const parsed = parseGroqJSON(response.choices[0]?.message?.content || '{}');
        if (parsed) return normalizeBonusEbook(parsed, fallback);
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (error) {
    console.warn('⚠️ Génération ebook bonus échouée, fallback local utilisé:', error.message);
  }

  return normalizeBonusEbook(fallback, fallback);
}

function mergePremiumPage(fallbackPremiumPage = {}, generatedPremiumPage = {}) {
  const generated = generatedPremiumPage && typeof generatedPremiumPage === 'object' ? generatedPremiumPage : {};
  const mergeObject = (key) => ({
    ...(fallbackPremiumPage[key] || {}),
    ...(generated[key] && typeof generated[key] === 'object' && !Array.isArray(generated[key]) ? generated[key] : {}),
  });
  const preferArray = (key) => (Array.isArray(generated[key]) && generated[key].length ? generated[key] : fallbackPremiumPage[key]);

  return {
    ...fallbackPremiumPage,
    ...generated,
    template: 'premium_product_page',
    brandName: generated.brandName || fallbackPremiumPage.brandName,
    navContactLabel: generated.navContactLabel || fallbackPremiumPage.navContactLabel || 'Contact',
    rating: mergeObject('rating'),
    hero: mergeObject('hero'),
    authorityStrip: preferArray('authorityStrip'),
    testimonialGallery: {
      ...(fallbackPremiumPage.testimonialGallery || {}),
      ...(generated.testimonialGallery && typeof generated.testimonialGallery === 'object' ? generated.testimonialGallery : {}),
      items: Array.isArray(generated.testimonialGallery?.items) && generated.testimonialGallery.items.length
        ? generated.testimonialGallery.items
        : fallbackPremiumPage.testimonialGallery?.items || [],
    },
    problemSection: mergeObject('problemSection'),
    mechanismSection: mergeObject('mechanismSection'),
    scienceSection: {
      ...(fallbackPremiumPage.scienceSection || {}),
      ...(generated.scienceSection && typeof generated.scienceSection === 'object' ? generated.scienceSection : {}),
      items: Array.isArray(generated.scienceSection?.items) && generated.scienceSection.items.length
        ? generated.scienceSection.items
        : fallbackPremiumPage.scienceSection?.items || [],
    },
    ritualSection: {
      ...(fallbackPremiumPage.ritualSection || {}),
      ...(generated.ritualSection && typeof generated.ritualSection === 'object' ? generated.ritualSection : {}),
      resultsTimeline: Array.isArray(generated.ritualSection?.resultsTimeline) && generated.ritualSection.resultsTimeline.length
        ? generated.ritualSection.resultsTimeline
        : fallbackPremiumPage.ritualSection?.resultsTimeline || [],
      steps: Array.isArray(generated.ritualSection?.steps) && generated.ritualSection.steps.length
        ? generated.ritualSection.steps
        : fallbackPremiumPage.ritualSection?.steps || [],
    },
    comparisonSection: {
      ...(fallbackPremiumPage.comparisonSection || {}),
      ...(generated.comparisonSection && typeof generated.comparisonSection === 'object' ? generated.comparisonSection : {}),
      columns: Array.isArray(generated.comparisonSection?.columns) && generated.comparisonSection.columns.length
        ? generated.comparisonSection.columns
        : fallbackPremiumPage.comparisonSection?.columns || [],
      rows: Array.isArray(generated.comparisonSection?.rows) && generated.comparisonSection.rows.length
        ? generated.comparisonSection.rows
        : fallbackPremiumPage.comparisonSection?.rows || [],
    },
    closingSection: mergeObject('closingSection'),
    faq: {
      ...(fallbackPremiumPage.faq || {}),
      ...(generated.faq && typeof generated.faq === 'object' ? generated.faq : {}),
      items: Array.isArray(generated.faq?.items) && generated.faq.items.length
        ? generated.faq.items
        : fallbackPremiumPage.faq?.items || [],
    },
  };
}

function strengthenPremiumPageContent(premiumPage = {}, fallbackPremiumPage = {}, result = {}) {
  const productName = compactText(result.title || premiumPage.brandName || fallbackPremiumPage.brandName || 'Produit', 80);
  const fallbackHeroBenefits = uniqueMeaningfulStrings([
    ...(premiumPage.hero?.benefits || []),
    ...(fallbackPremiumPage.hero?.benefits || []),
    ...(result.benefits_bullets || []),
  ], 18);
  const benefitBase = fallbackHeroBenefits.length ? fallbackHeroBenefits : [
    `${productName} aide à traiter le besoin principal avec une routine simple et facile à suivre.`,
    `La solution s'intègre au quotidien sans multiplier les gestes compliqués.`,
    `L'expérience d'achat reste rassurante grâce au paiement à la livraison et au support WhatsApp.`,
    `Le produit est pensé pour retrouver plus de confort, d'assurance et de régularité.`,
  ];

  const fillStrings = (primary = [], fallback = [], defaults = [], minCount = 4, minLength = 20) => {
    const merged = uniqueMeaningfulStrings([...primary, ...fallback, ...defaults], minLength);
    return merged.slice(0, Math.max(minCount, merged.length));
  };

  const problemBullets = fillStrings(
    premiumPage.problemSection?.bullets,
    fallbackPremiumPage.problemSection?.bullets,
    [
      `Quand le problème revient malgré les solutions classiques, il finit par peser sur la confiance au quotidien.`,
      `Les moments de proximité, de travail ou de déplacement deviennent moins naturels quand on doute de soi.`,
      `Les produits de surface peuvent masquer temporairement, sans offrir une réponse régulière et rassurante.`,
      `Le vrai besoin est de retrouver une sensation de contrôle, sans routine compliquée ni promesse irréaliste.`,
    ],
    4,
    34,
  );

  const mechanismBody = isWeakPremiumText(premiumPage.mechanismSection?.body, 80)
    ? compactText(
      fallbackPremiumPage.mechanismSection?.body
      || `${productName} se distingue des solutions classiques parce qu'il s'intègre dans une routine régulière et cible le besoin réel décrit par le produit. L'objectif n'est pas de promettre un miracle, mais d'apporter une réponse plus simple, plus constante et plus rassurante dans les situations où le client veut se sentir à l'aise.`,
      1200,
    )
    : compactText(premiumPage.mechanismSection.body, 1200);

  const scienceDefaults = [
    {
      name: 'Action ciblée',
      description: `${productName} est présenté comme une solution orientée vers le besoin principal du client, avec une logique plus régulière que les alternatives utilisées seulement au dernier moment.`,
    },
    {
      name: 'Routine facile',
      description: `Le format et l'usage doivent rester simples à comprendre, pour que le client puisse l'intégrer sans changer complètement ses habitudes.`,
    },
    {
      name: 'Expérience rassurante',
      description: `La page met en avant une utilisation claire, un achat sans pression et un service client disponible pour répondre aux questions avant la commande.`,
    },
    {
      name: 'Résultat progressif',
      description: `Le bénéfice est formulé de façon crédible : une amélioration ressentie avec la régularité, sans promesse médicale ni chiffre inventé.`,
    },
  ];
  const scienceItems = [
    ...(Array.isArray(premiumPage.scienceSection?.items) ? premiumPage.scienceSection.items : []),
    ...(Array.isArray(fallbackPremiumPage.scienceSection?.items) ? fallbackPremiumPage.scienceSection.items : []),
    ...scienceDefaults,
  ].reduce((acc, item, index) => {
    const name = compactText(item?.name || '', 60);
    const description = compactText(item?.description || '', 420);
    if (isWeakPremiumText(name, 6) || isWeakPremiumText(description, 60)) return acc;
    const key = normalizeLocaleKey(name);
    if (acc.some((existing) => normalizeLocaleKey(existing.name) === key)) return acc;
    acc.push({
      ...item,
      name,
      description,
      imagePrompt: item?.imagePrompt || `premium ecommerce close-up visual for ${productName}, section ${index + 1}, clean product feature explanation, no text overlay`,
    });
    return acc;
  }, []).slice(0, 4);

  const timelineDefaults = [
    { label: 'Jour 1', description: `Le client découvre la routine ${productName} et commence à l'utiliser dans un moment simple de la journée.` },
    { label: 'Jour 7', description: `L'usage devient plus naturel, avec une sensation de contrôle et de régularité plus facile à maintenir.` },
    { label: 'Jour 15', description: `La routine s'installe et le client se sent plus à l'aise dans les situations où il hésitait auparavant.` },
    { label: 'Jour 30', description: `Le produit devient un réflexe pratique pour conserver une expérience plus stable et rassurante.` },
  ];
  const resultsTimeline = [
    ...(Array.isArray(premiumPage.ritualSection?.resultsTimeline) ? premiumPage.ritualSection.resultsTimeline : []),
    ...(Array.isArray(fallbackPremiumPage.ritualSection?.resultsTimeline) ? fallbackPremiumPage.ritualSection.resultsTimeline : []),
    ...timelineDefaults,
  ].reduce((acc, item) => {
    const label = compactText(item?.label || '', 32);
    const description = compactText(item?.description || '', 260);
    if (isWeakPremiumText(label, 4) || isWeakPremiumText(description, 45)) return acc;
    const key = normalizeLocaleKey(label);
    if (acc.some((existing) => normalizeLocaleKey(existing.label) === key)) return acc;
    acc.push({ ...item, label, description });
    return acc;
  }, []).slice(0, 4);

  const stepDefaults = [
    { label: 'Étape 1', title: `Utilisez ${productName} régulièrement`, description: `Suivez l'usage recommandé avec un verre d'eau ou selon les indications du produit.` },
    { label: 'Étape 2', title: 'Gardez une routine simple', description: `Placez le produit dans un moment facile à répéter : matin, repas ou préparation avant sortie.` },
    { label: 'Étape 3', title: 'Observez votre confort', description: `Notez les situations où vous vous sentez plus à l'aise et ajustez votre routine sans excès.` },
    { label: 'Étape 4', title: 'Maintenez la régularité', description: `La constance rend l'expérience plus fiable et évite de dépendre uniquement des solutions de dernière minute.` },
  ];
  const steps = [
    ...(Array.isArray(premiumPage.ritualSection?.steps) ? premiumPage.ritualSection.steps : []),
    ...(Array.isArray(fallbackPremiumPage.ritualSection?.steps) ? fallbackPremiumPage.ritualSection.steps : []),
    ...stepDefaults,
  ].reduce((acc, item, index) => {
    const label = compactText(item?.label || `Étape ${index + 1}`, 32);
    const title = compactText(item?.title || item?.action || '', 90);
    const description = compactText(item?.description || item?.detail || '', 260);
    if (isWeakPremiumText(title, 12) || isWeakPremiumText(description, 35)) return acc;
    const key = normalizeLocaleKey(title);
    if (acc.some((existing) => normalizeLocaleKey(existing.title) === key)) return acc;
    acc.push({ ...item, label, title, description });
    return acc;
  }, []).slice(0, 4);

  const comparisonColumns = (Array.isArray(premiumPage.comparisonSection?.columns) ? premiumPage.comparisonSection.columns : [])
    .map((column) => compactText(column, 40))
    .filter((column) => !isWeakPremiumText(column, 5));
  const columns = comparisonColumns.length >= 3
    ? comparisonColumns.slice(0, 3)
    : [productName, 'Solution classique', 'Alternative rapide'];
  const comparisonDefaults = [
    { label: 'Cible le besoin principal avec une routine claire', values: [true, false, false] },
    { label: 'Facile à intégrer dans la journée', values: [true, true, false] },
    { label: 'Pensé pour une expérience rassurante avant achat', values: [true, false, false] },
    { label: 'Convient aux moments où la confiance compte', values: [true, false, false] },
    { label: 'Support client disponible pour accompagner la commande', values: [true, false, false] },
  ];
  const comparisonRows = [
    ...(Array.isArray(premiumPage.comparisonSection?.rows) ? premiumPage.comparisonSection.rows : []),
    ...(Array.isArray(fallbackPremiumPage.comparisonSection?.rows) ? fallbackPremiumPage.comparisonSection.rows : []),
    ...comparisonDefaults,
  ].reduce((acc, row) => {
    const label = compactText(row?.label || '', 130);
    if (isWeakPremiumText(label, 28)) return acc;
    const key = normalizeLocaleKey(label);
    if (acc.some((existing) => normalizeLocaleKey(existing.label) === key)) return acc;
    const values = Array.isArray(row?.values) && row.values.length >= 3 ? row.values.slice(0, 3) : [true, false, false];
    acc.push({ ...row, label, values });
    return acc;
  }, []).slice(0, 6);

  const sanitizeTags = (tags = [], fallbackIndex = 0) => {
    const defaults = ['Confiance', 'Routine simple', 'Expérience réelle', 'Livraison rapide', 'Service réactif'];
    const clean = uniqueMeaningfulStrings(tags, 4).filter((tag) => !['verifie', 'acheteur verifie'].includes(normalizeLocaleKey(tag)));
    while (clean.length < 2) clean.push(defaults[(fallbackIndex + clean.length) % defaults.length]);
    return clean.slice(0, 2);
  };
  const testimonialFallbacks = Array.isArray(fallbackPremiumPage.testimonialGallery?.items) ? fallbackPremiumPage.testimonialGallery.items : [];
  const testimonials = [
    ...(Array.isArray(premiumPage.testimonialGallery?.items) ? premiumPage.testimonialGallery.items : []),
    ...testimonialFallbacks,
  ].reduce((acc, item, index) => {
    const text = compactText(item?.text || '', 520);
    if (isWeakPremiumText(text, 80)) return acc;
    const name = compactText(item?.name || `Client ${index + 1}`, 40);
    const key = normalizeLocaleKey(`${name}-${text.slice(0, 60)}`);
    if (acc.some((existing) => normalizeLocaleKey(`${existing.name}-${existing.text.slice(0, 60)}`) === key)) return acc;
    acc.push({
      ...item,
      name,
      text,
      tags: sanitizeTags(item?.tags, index),
      rating: Number(item?.rating) || 5,
      verified: item?.verified !== false,
    });
    return acc;
  }, []).slice(0, 6);

  return {
    ...premiumPage,
    hero: {
      ...(premiumPage.hero || {}),
      benefits: fillStrings(premiumPage.hero?.benefits, fallbackPremiumPage.hero?.benefits, benefitBase, 4, 22).slice(0, 4),
    },
    testimonialGallery: {
      ...(premiumPage.testimonialGallery || {}),
      headline: isWeakPremiumText(premiumPage.testimonialGallery?.headline, 24)
        ? `Ils utilisent ${productName} avec plus de confiance`
        : premiumPage.testimonialGallery.headline,
      subheadline: isWeakPremiumText(premiumPage.testimonialGallery?.subheadline, 45)
        ? `Des clients partagent des expériences concrètes autour de ${productName}, de la commande jusqu'à l'utilisation quotidienne.`
        : premiumPage.testimonialGallery.subheadline,
      items: testimonials.length >= 4 ? testimonials : testimonialFallbacks.slice(0, 4),
    },
    problemSection: {
      ...(premiumPage.problemSection || {}),
      headline: isWeakPremiumText(premiumPage.problemSection?.headline, 24)
        ? `Pourquoi ce problème revient souvent`
        : premiumPage.problemSection.headline,
      bullets: problemBullets.slice(0, 4),
    },
    mechanismSection: {
      ...(premiumPage.mechanismSection || {}),
      headline: isWeakPremiumText(premiumPage.mechanismSection?.headline, 24)
        ? `Pourquoi les solutions classiques ne suffisent pas toujours`
        : premiumPage.mechanismSection.headline,
      body: mechanismBody,
    },
    scienceSection: {
      ...(premiumPage.scienceSection || {}),
      headline: isWeakPremiumText(premiumPage.scienceSection?.headline, 24)
        ? `Ce qui rend ${productName} différent`
        : premiumPage.scienceSection.headline,
      subheadline: isWeakPremiumText(premiumPage.scienceSection?.subheadline, 45)
        ? `Une explication claire des éléments qui rendent le produit pratique, crédible et simple à utiliser.`
        : premiumPage.scienceSection.subheadline,
      items: scienceItems,
    },
    ritualSection: {
      ...(premiumPage.ritualSection || {}),
      headline: isWeakPremiumText(premiumPage.ritualSection?.headline, 22)
        ? `Votre rituel avec ${productName}`
        : premiumPage.ritualSection.headline,
      subheadline: isWeakPremiumText(premiumPage.ritualSection?.subheadline, 38)
        ? `Une routine courte, répétable et facile à garder dans la durée.`
        : premiumPage.ritualSection.subheadline,
      resultsTimeline,
      steps,
    },
    comparisonSection: {
      ...(premiumPage.comparisonSection || {}),
      headline: isWeakPremiumText(premiumPage.comparisonSection?.headline, 12)
        ? `Comparaison`
        : premiumPage.comparisonSection.headline,
      columns,
      rows: comparisonRows,
    },
    closingSection: {
      ...(premiumPage.closingSection || {}),
      bullets: fillStrings(premiumPage.closingSection?.bullets, fallbackPremiumPage.closingSection?.bullets, benefitBase, 3, 20).slice(0, 4),
    },
  };
}

function buildPremiumImagePrompts(result = {}) {
  const premium = result.premium_page || {};
  const productName = result.title || premium.brandName || 'product';
  const promptBase = 'photorealistic premium Shopify product page section image, modern African ecommerce campaign, authentic Black African people when people are present, clean bright composition, no fake logos, no long text overlay';
  const testimonialItems = Array.isArray(premium.testimonialGallery?.items) ? premium.testimonialGallery.items : [];

  return {
    hero: premium.hero?.imagePrompt || `large clean product hero packshot for ${productName}, product and packaging sharp on white premium ecommerce background, realistic scale, soft shadows, ${promptBase}`,
    problem: premium.problemSection?.imagePrompt || `lifestyle scene showing the concrete problem solved by ${productName}, emotional but realistic, modern home or workplace, ${promptBase}`,
    mechanism: premium.mechanismSection?.imagePrompt || `premium explanatory lifestyle image showing why ordinary solutions fail and how ${productName} addresses the root cause, product visible, ${promptBase}`,
    science: premium.scienceSection?.imagePrompt || `clean premium explainer board for ${productName}, ingredient or technology callouts, product visible, refined medical-free ecommerce style, ${promptBase}`,
    ritual: premium.ritualSection?.imagePrompt || `simple daily ritual scene using ${productName}, step-by-step premium lifestyle mood, modern interior, ${promptBase}`,
    closing: premium.closingSection?.imagePrompt || `large premium product callout image for ${productName}, product sharp with elegant feature lines and spacious white background, ${promptBase}`,
    testimonials: testimonialItems.slice(0, 4).map((item, index) => (
      item.imagePrompt || `realistic verified customer photo ${index + 1} for ${productName}, satisfied Black African ecommerce customer holding or using the product, natural light, ${promptBase}`
    )),
  };
}

export async function analyzePremiumProductPage(scrapedData, imageBuffers = [], storeContext = {}, premiumContext = {}) {
  const groq = getGroq();
  if (!groq) throw new Error('Clé du service API non configurée.');

  const title = cleanScrapedText(scrapedData.title || 'Produit');
  const description = cleanScrapedText(scrapedData.description || scrapedData.rawText || '');
  const storeCountry = cleanScrapedText(storeContext.country || '');
  const storeCity = cleanScrapedText(storeContext.city || '');
  const shopName = cleanScrapedText(storeContext.shopName || '');
  const language = premiumContext.language || 'français';
  const tone = premiumContext.tone || 'premium';
  const targetAvatar = cleanScrapedText(premiumContext.targetAvatar || '');
  const mainProblem = cleanScrapedText(premiumContext.mainProblem || '');
  const themeColor = cleanScrapedText(premiumContext.themeColor || '');
  const localeLine = buildStoreLocaleInstruction(storeCountry, storeCity);

  const premiumContract = `{
  "title": "Nom produit court",
  "hero_headline": "Titre hero principal",
  "hero_slogan": "Promesse courte",
  "hero_cta": "Commander",
  "urgency_badge": "Badge court si pertinent",
  "benefits_bullets": ["4 bénéfices directs"],
  "faq": [{"question": "Question", "answer": "Réponse"}],
  "testimonials": [{"name": "Prénom N.", "location": "Ville", "rating": 5, "text": "Avis crédible", "verified": true}],
  "reassurance": {"titre": "Achat rassuré", "texte": "Texte court", "points": ["Paiement à la livraison", "Livraison rapide", "Support WhatsApp"]},
  "guide_utilisation": {"applicable": true, "titre": "Utilisation", "etapes": [{"numero": 1, "action": "Action", "detail": "Détail"}]},
  "seo": {"meta_title": "max 60 caractères", "meta_description": "max 155 caractères", "slug": "kebab-case"},
  "premium_page": {
    "template": "premium_product_page",
    "brandName": "Nom court affiché en header",
    "navContactLabel": "Contact",
    "rating": {"score": "4,9/5", "count": "+1 000", "label": "clients satisfaits"},
    "hero": {
      "eyebrow": "Badge rond ou preuve courte",
      "headline": "Titre en majuscules, comme la capture",
      "subheadline": "Phrase claire sous le titre",
      "priceLabel": "",
      "benefits": ["4 bullets checkés"],
      "offerTitle": "OFFRE SPÉCIALE",
      "countdownLabel": "L'offre expire bientôt",
      "offerCards": [{"title": "Offre du moment", "badge": "Meilleur choix", "price": "", "oldPrice": ""}],
      "ctaLabel": "Commander",
      "reassurance": ["Paiement à la livraison", "Livraison rapide", "Support WhatsApp"],
      "imagePrompt": "English photorealistic product hero prompt"
    },
    "authorityStrip": [
      {"label": "Clients vérifiés", "quote": "Citation courte"},
      {"label": "Routine populaire", "quote": "Citation courte"},
      {"label": "Qualité contrôlée", "quote": "Citation courte"}
    ],
    "testimonialGallery": {
      "headline": "Titre émotionnel comme LEUR SECRET POUR...",
      "subheadline": "Phrase sociale",
      "items": [{"name": "Prénom N.", "text": "Avis détaillé de 90 à 160 mots, avec situation réelle, hésitation, résultat ressenti et détail de livraison/service", "tags": ["Bénéfice concret", "Usage réel"], "rating": 5, "verified": true, "imagePrompt": "English customer photo prompt"}]
    },
    "problemSection": {"headline": "Titre problème fort", "bullets": ["4 douleurs concrètes en phrases complètes de 16 à 28 mots"], "imagePrompt": "English problem scene prompt"},
    "mechanismSection": {"headline": "Titre cause/mécanisme", "body": "Paragraphe explicatif consistant de 90 à 150 mots, adapté au produit", "imagePrompt": "English mechanism image prompt"},
    "scienceSection": {"headline": "Titre science/formule/technologie", "subheadline": "Sous-titre de 35 à 70 mots", "items": [{"name": "Actif ou fonction spécifique", "description": "Rôle concret expliqué en 45 à 90 mots, sans promesse médicale", "imagePrompt": "English close-up prompt"}], "imagePrompt": "English explainer image prompt"},
    "ritualSection": {"headline": "Titre rituel", "subheadline": "Sous-titre de 30 à 60 mots", "resultsTimeline": [{"label": "Jour 1", "description": "Résultat crédible en phrase complète"}], "steps": [{"label": "Étape 1", "title": "Action courte", "description": "Détail de 25 à 55 mots"}], "imagePrompt": "English ritual image prompt"},
    "comparisonSection": {"columns": ["Nom du produit", "Solution classique", "Alternative rapide"], "rows": [{"label": "Critère concret en phrase complète", "values": [true, false, false]}]},
    "closingSection": {"headline": "Titre final", "subheadline": "Phrase finale de 35 à 70 mots", "bullets": ["3 à 4 bénéfices concrets"], "imagePrompt": "English product callout prompt"}
  }
}`;

  const userPrompt = `Tu es un système séparé de génération de PAGE PRODUIT PREMIUM / AVANCÉE. Tu ne dois pas générer l'ancien template classique, ni angles marketing, ni affiches classiques. Tu dois créer une vraie page produit longue qui respecte la structure visible dans les captures fournies par le client.

STRUCTURE PREMIUM OBLIGATOIRE :
1. Header simple : Contact à gauche, nom produit/marque centré, compte + panier à droite.
2. Hero split : image produit grande à gauche, rating, titre fort, sous-titre, prix, 4 bénéfices checkés, offre spéciale, compte à rebours, carte d'offre, bouton Commander, réassurance.
3. Bande de preuves/autorité horizontale : 3 à 5 blocs façon logos/citations. N'invente pas de vraies presses comme Vogue/People/Shape sauf si la source les mentionne clairement.
4. Galerie témoignages : titre émotionnel, sous-texte, 4 cartes avis avec photo prompt, tags, étoiles, acheteur vérifié.
5. Section problème : grand titre + 4 douleurs concrètes + image lifestyle.
6. Section cause/mécanisme : pourquoi les solutions classiques ne suffisent pas, adapté au produit.
7. Section science/formule/technologie : ingrédients, composants, matières ou fonctionnalités avec explication claire.
8. Section résultats + rituel : timeline réaliste + étapes d'utilisation.
9. Tableau comparaison : le produit vs deux alternatives logiques.
10. Closing : bénéfice émotionnel final + callouts produit + CTA.

RÈGLES :
- Chaque section doit être spécifique au produit et à ce qu'il fait.
- La page doit être consistante : pas de titres isolés sans paragraphe, pas de bullet d'un seul mot, pas de ligne "Illustration", "Ingrédient actif", "Produit A", "Produit B", "Vérifié" utilisée comme contenu.
- Minimums obligatoires : 4 avis détaillés, 4 douleurs problème, 4 items science/formule/fonctionnement, 4 étapes de rituel, 4 entrées de timeline, 5 lignes de comparaison.
- Les avis doivent varier : noms différents, situations différentes, structure de phrase différente. Ne répète pas le nom dans le texte de l'avis. Ne mets jamais "Vérifié" comme tag, car l'interface l'affiche déjà.
- Les textes doivent parler du produit réel : usage, contexte, hésitation avant achat, bénéfice ressenti, livraison, paiement à la livraison ou WhatsApp quand pertinent.
- Style premium Shopify, titres courts, spacing généreux, pas de wording générique.
- Langue principale : ${language}. Ton : ${tone}.
- Marché : ${storeCountry || 'Afrique francophone'}${storeCity ? `, ville référence ${storeCity}` : ''}. ${localeLine}
- Les prompts d'images sont en anglais, photoréalistes, modernes, avec personnes africaines authentiques si humains présents.
- Pas de diagnostic médical, pas de guérison, pas de chiffres impossibles. Promesses crédibles uniquement.
- Si le produit n'est pas santé/beauté, adapte science en technologie/matière/mécanisme/praticité.
- Couleur accent demandée : ${themeColor || 'à déduire du produit'}.

BOUTIQUE :
${shopName ? `- Nom boutique : ${shopName}` : '- Nom boutique non fourni'}

SOURCE PRODUIT :
Titre : ${title || 'Non disponible'}
Description : ${description || 'Non disponible'}
${targetAvatar ? `Avatar cible : ${targetAvatar}` : ''}
${mainProblem ? `Problème principal : ${mainProblem}` : ''}

Réponds uniquement avec un JSON valide suivant ce contrat :
${premiumContract}`;

  const messages = [
    {
      role: 'system',
      content: 'Tu es le générateur premium séparé. Ta sortie est uniquement JSON. Tu crées une structure premium_product_page complète, jamais l’ancien template classique. Français parfait. Promesses crédibles. Prompts images en anglais.',
    },
    { role: 'user', content: userPrompt },
  ];

  if (imageBuffers.length > 0) {
    const imageContent = imageBuffers.slice(0, 3).map((buf) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${buf.toString('base64')}`, detail: 'low' },
    }));
    messages[1].content = [{ type: 'text', text: userPrompt }, ...imageContent];
  }

  const callGroqWithTimeout = async (model, msgs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70000);
    try {
      return await groq.chat.completions.create(
        {
          model,
          messages: msgs,
          max_tokens: 7000,
          temperature: 0.62,
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }
  };

  let result;
  try {
    if (isKieConfigured()) {
      const kie = await callKieChatCompletion({
        messages: [
          messages[0],
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.62,
        maxTokens: 7000,
        reasoningEffort: process.env.KIE_REASONING_EFFORT || 'high',
        includeThoughts: false,
      });
      result = parseGroqJSON(kie.content || '{}');
      if (!result) throw new Error('GPT 5.4 premium JSON non parsable');
    } else {
      let response;
      if (imageBuffers.length > 0) {
        try {
          response = await callGroqWithTimeout(process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct', messages);
        } catch (visionError) {
          console.warn(`⚠️ Premium le service Vision échoué (${visionError.message}), fallback texte...`);
          response = await callGroqWithTimeout(process.env.GROQ_MODEL || 'openai/gpt-oss-20b', [
            messages[0],
            { role: 'user', content: userPrompt },
          ]);
        }
      } else {
        response = await callGroqWithTimeout(process.env.GROQ_MODEL || 'openai/gpt-oss-20b', messages);
      }
      result = parseGroqJSON(response.choices[0]?.message?.content || '{}');
      if (!result) throw new Error('Réponse premium JSON non parsable');
    }
  } catch (error) {
    const groq = getGroq();
    if (!groq) throw new Error(`Erreur IA premium: ${error.message}`);
    try {
      let response;
      if (imageBuffers.length > 0) {
        try {
          response = await callGroqWithTimeout(process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct', messages);
        } catch (_) {
          response = await callGroqWithTimeout(process.env.GROQ_MODEL || 'openai/gpt-oss-20b', [
            messages[0],
            { role: 'user', content: userPrompt },
          ]);
        }
      } else {
        response = await callGroqWithTimeout(process.env.GROQ_MODEL || 'openai/gpt-oss-20b', messages);
      }
      result = parseGroqJSON(response.choices[0]?.message?.content || '{}');
      if (!result) throw new Error('Groq fallback JSON non parsable');
    } catch (groqError) {
      throw new Error(`Erreur IA premium: GPT5.4=${error.message} | Groq=${groqError.message}`);
    }
  }

  result.title = cleanScrapedText(result.title || title || 'Produit', 100);
  result.hero_headline = cleanScrapedText(result.hero_headline || result.premium_page?.hero?.headline || result.title, 140);
  result.hero_slogan = cleanScrapedText(result.hero_slogan || result.premium_page?.hero?.subheadline || '', 220);
  result.hero_cta = cleanScrapedText(result.hero_cta || result.premium_page?.hero?.ctaLabel || 'Commander', 40);
  result.benefits_bullets = Array.isArray(result.benefits_bullets) && result.benefits_bullets.length
    ? result.benefits_bullets.slice(0, 6).map((item) => removeLeadingMarker(item)).filter(Boolean)
    : (Array.isArray(result.premium_page?.hero?.benefits) ? result.premium_page.hero.benefits.slice(0, 4) : []);
  result.testimonials = Array.isArray(result.testimonials) && result.testimonials.length
    ? result.testimonials.slice(0, 8)
    : buildDefaultTestimonials(result.title, storeCountry, storeCity);
  result.faq = Array.isArray(result.faq) ? result.faq.slice(0, 8) : [];
  result.raisons_acheter = Array.isArray(result.raisons_acheter) ? result.raisons_acheter.slice(0, 6) : result.benefits_bullets;
  result.conversion_blocks = Array.isArray(result.conversion_blocks) ? result.conversion_blocks : [];
  result.pageStyle = 'premium';
  result.layout = 'premium_product_page';
  result.theme = 'premium_product';

  const fallbackPremiumPage = buildFallbackPremiumPage(result, title, storeContext);
  result.premium_page = strengthenPremiumPageContent(
    mergePremiumPage(fallbackPremiumPage, result.premium_page),
    fallbackPremiumPage,
    result,
  );
  result.premium_image_prompts = buildPremiumImagePrompts(result);

  return result;
}

// ─── Étape 2 : Groq → JSON structuré ultra fiable ──────────────────

export async function analyzeWithVision(scrapedData, imageBuffers = [], marketingApproach = 'AIDA', storeContext = {}, copywritingContext = {}, visualContext = {}) {
  const groq = getGroq();
  if (!groq) throw new Error('Clé du service API non configurée.');

  const title = cleanScrapedText(scrapedData.title || '');
  const description = cleanScrapedText(scrapedData.description || scrapedData.rawText || '');
  const storeCountry = cleanScrapedText(storeContext.country || '');
  const storeCity = cleanScrapedText(storeContext.city || '');
  const shopName = cleanScrapedText(storeContext.shopName || '');
  const storeLocaleInstruction = buildStoreLocaleInstruction(storeCountry, storeCity);
  const testimonialLocationTemplate = storeCountry
    ? `${storeCity ? `${storeCity}, ` : 'Ville crédible, '}${storeCountry}`
    : 'Ville, Pays africain';
  
  // Contexte copywriting simplifié : méthode + avatar + problème
  const {
    method = 'PAS',
    avatar = '',
    problem = '',
    tone = 'urgence',
    language = 'français'
  } = copywritingContext;
  const {
    template = 'general',
    preferredColor = '',
    heroVisualDirection = '',
    decorationDirection = '',
    titleColor = '',
    contentColor = '',
    fashionConfig = null
  } = visualContext;
  const visualTemplateInstruction = buildVisualTemplateInstruction(template, preferredColor, heroVisualDirection, decorationDirection, titleColor, contentColor)
    + buildFashionInstruction(fashionConfig);

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

  };

  const approachGuide = approachGuides[marketingApproach] || approachGuides.PAS;
  
  // Contexte simplifié : avatar cible + problème principal
  let avatarAndProblemInfo = '';
  if (avatar) {
    avatarAndProblemInfo += `\n🎯 AVATAR CLIENT CIBLE :\n${avatar}\n`;
  }
  if (problem) {
    avatarAndProblemInfo += `\n💥 PROBLÈME PRINCIPAL À RÉSOUDRE :\n${problem}\n`;
  }

  const userPrompt = `Tu es expert e-commerce et copywriting SPÉCIALISTE du marché africain francophone (Cameroun, Côte d'Ivoire, Sénégal, etc.). Tu dois générer une page produit ULTRA PERSUASIVE, optimisée mobile-first, qui capte l'attention en moins de 3 secondes et pousse à l'achat sans friction.

═══════════════════════════════════════════════
DONNÉES DE LA BOUTIQUE
═══════════════════════════════════════════════
${shopName ? `- Nom de la boutique : ${shopName}` : ''}
${storeCountry ? `- Pays / Marché cible : ${storeCountry}` : ''}
${storeCity ? `- Ville principale : ${storeCity}` : ''}
- Langue : ${language}
- Ton de communication : ${tone} (urgent, fun, premium, sérieux)
- Méthode copywriting : ${marketingApproach}

═══════════════════════════════════════════════
SOURCE DE CONTENU DU PRODUIT
═══════════════════════════════════════════════
TITRE : ${title || 'Non disponible'}
DESCRIPTION : ${description || 'Non disponible'}
${avatarAndProblemInfo}

${visualTemplateInstruction}

🎯 OBJECTIF : Créer une page qui capte l'attention immédiatement, donne confiance, et pousse à l'achat sans friction en suivant la méthode ${marketingApproach}. TOUTE la page (texte, structure, images) doit être cohérente avec cette méthode.

RÈGLE ABSOLUE ANTI-GÉNÉRIQUE ET DÉPENDANCE VISUELLE :
- TOUTE LA GÉNÉRATION DE LA PAGE PRODUIT DOIT SE BASER EXCLUSIVEMENT SUR L'IMAGE FOURNIE.
- LES PROMPTS D'IMAGES (hero, avant/après, angles, témoignages) DOIVENT TOUJOURS SE RÉFÉRER AUX SPÉCIFICITÉS VISUELLES PRÉCISES DE L'IMAGE ANALYSÉE.
- La description, les arguments, les sections, les visuels et les titres ne doivent jamais ressembler à un template générique réutilisé.
- Chaque page doit sembler conçue spécifiquement pour CE produit, sa promesse, sa cible, son niveau de prix, son contexte d'usage et son identité visuelle telle qu'extraite de l'image.
- Interdiction d'utiliser des formulations passe-partout. Si l'image montre une caractéristique précise, elle doit être utilisée.
- Chaque angle marketing doit être spécifique, concret, visuel, crédible, et ancré dans le produit visuel réel.
- Les visuels de description doivent varier d'un produit à l'autre dans leur structure, leur hiérarchie, leur rythme visuel et leur mise en scène, basés sur l'image de référence.

═══ ÉTAPE 1 : ANALYSE INTELLIGENTE DU PRODUIT ═══
Avant de générer quoi que ce soit, réponds mentalement à ces questions :
- À quoi sert réellement ce produit ?
- Quel problème principal résout-il ?
- Qui est la cible idéale (homme, femme, âge, contexte) ?
- Pourquoi quelqu'un l'achèterait aujourd'hui ?
- Quelles sont les objections possibles ?
- Quel résultat concret et rapide peut-on promettre ?
- ⚠️ QUELLE ZONE CORPORELLE est ciblée par ce produit ? Détermine précisément : cheveux / scalp, visage / peau du visage, corps entier / peau du corps, ventre / minceur, poitrine, pieds / ongles, dents / bouche, déodorant / aisselles, intime, énergie / interne, ou objet / tech ?
Cette ZONE CORPORELLE est CRITIQUE — elle détermine ce que montrent TOUTES les images.
Utilise ces réponses pour personnaliser TOUT le contenu.

⚠️ RÈGLE ABSOLUE POUR TOUTES LES IMAGES — 2 critères à respecter toujours :

━━ CRITÈRE 1 : GENRE DE LA PERSONNE (adapte au produit, ne mets PAS toujours une femme) ━━
- Produit FEMME (crème féminité, soin intime féminin, rouge à lèvres, soin cheveux femme, minceur ventre femme, lingerie, etc.) → personne africaine FEMME
- Produit HOMME (gel rasage, soin barbe, parfum homme, déodorant homme, virilité, etc.) → personne africaine HOMME
- Produit MIXTE / UNISEXE (shampoing neutre, complément alimentaire, sport, tech, nettoyage, etc.) → homme OU femme africain(e) selon le contexte — varie entre les 5 images d'angles
- Produit ENFANT → enfant africain avec parent si nécessaire
- Si le produit est un OBJET (appareil, flacon, complément en gélules, etc.) sans usage corporel évident → montrer le PRODUIT LUI-MÊME au premier plan, très grand, net, dominant, avec la personne en arrière-plan ou absente

━━ CRITÈRE 2 : ZONE CORPORELLE (adapte le cadrage à la zone du produit) ━━
Identifie la zone corporelle exacte de ce produit et montre UNIQUEMENT cette zone dans les images.
- Produit CHEVEUX (shampoing, huile cheveux, masque capillaire, sérum cheveux, lissant, etc.) → cheveux, chevelure, application sur les cheveux ou résultat. JAMAIS le visage à la place.
- Produit VISAGE / PEAU VISAGE (crème visage, sérum anti-taches, contour des yeux, etc.) → visage, peau du visage, teint.
- Produit CORPS / PEAU CORPS (lait corps, lotion, beurre de karité, etc.) → bras, jambes, épaules, peau du corps. Pas uniquement le visage.
- Produit MINCEUR / VENTRE → ventre, silhouette, taille.
- Produit INTIME / DÉODORANT → zone concernée ou résultat figuré (fraîcheur, légèreté, confiance).
- Produit DENTS / BOUCHE → sourire, dents, bouche.
- Produit ÉNERGIE / SUPPLEMENT / MINCEUR INTERNE → personne entière dynamique, active, souriante. Pas de focus visage uniquement.
- Produit TECH / OBJET → l'objet très grand et net au premier plan, utilisé dans son contexte naturel.

═══ RÈGLES FONDAMENTALES ═══
1. 🇫🇷 100% ${language.toUpperCase()} SIMPLE ET NATUREL (comme une vendeuse WhatsApp) — sauf prompt_image en anglais
2. 🚫 PAS de ton médical ou compliqué — langage simple, direct, compréhensible localement
3. 🚫 PAS de promesses irréalistes — seulement des bénéfices concrets et crédibles
4. 🚫 PAS de généricité — chaque mot doit être spécifique à CE produit
4.bis ✅ Chaque section doit avoir une personnalité propre, pas une structure répétée d'un produit à l'autre
5. ✅ Focus sur RÉSULTATS CONCRETS et TRANSFORMATION visible
6. ✅ Adaptation au marché africain : contexte local, peaux noires, climat, culture
7. ✅ Témoignages localisés avec noms africains et villes du pays cible
8. ✅ ${tone === 'urgence' ? 'Urgence psychologique : stock limité, preuve sociale, résultats rapides' : tone === 'premium' ? 'Ton premium et exclusif : qualité exceptionnelle, attention aux détails' : tone === 'fun' ? 'Ton enjoué et dynamique : énergie positive, émojis, phrases courtes' : 'Ton sérieux et professionnel : crédibilité, faits, confiance'}
9. ✅ Le template choisi guide seulement le rendu visuel : style des images, icones, fonds, palette et ambiance
10. ✅ La copy, les bénéfices, la cible et les promesses doivent rester dictés par le produit réel et la méthode ${marketingApproach}, jamais par le template seul
11. ✅ Les consignes couleur des affiches, visuel hero, décorations, couleur des titres et couleur du contenu doivent être prises en compte réellement dans la génération visuelle

${storeLocaleInstruction}

${approachGuide}

⚠️ IMPORTANT : Suis STRICTEMENT cette structure pour les 5 angles. Chaque angle doit correspondre à l'étape de l'approche marketing sélectionnée.

═══ 12 ANGLES MARKETING PUISSANTS (UNIVERSELS) ═══
🎯 Un angle marketing = La façon stratégique de présenter le produit + La raison principale qui pousse à acheter
Ce n'est PAS la description technique. C'est le MESSAGE qui touche le client.

Choisis 5 angles parmi ces 12 selon le produit :

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

🧠 COMMENT CHOISIR LES 5 ANGLES ?
Pose-toi 3 questions :
1. Quel problème principal ça résout ?
2. Quel bénéfice est le plus visible ?
3. Qu'est-ce qui rassure le client ?

═══ TITRES DES ANGLES MARKETING — PHRASES COMPLÈTES ═══
✍️ RÈGLES ABSOLUES pour les titres des 5 angles :

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

═══ IMAGES D'ANGLES — VISUELS ILLUSTRATIFS AVEC PERSONNES AFRICAINES ═══
Les 5 images d'angles sont des visuels marketing illustratifs avec des personnes africaines et du texte qui illustre le bénéfice du produit.

🎯 OBJECTIF : Visuel percutant montrant une personne africaine RÉELLE qui bénéficie du produit, dans un environnement MODERNE et HAUT DE GAMME. L'image doit pouvoir convertir sur Facebook Ads / TikTok Ads auprès d'un public africain francophone.

✅ CE QU'IL FAUT :
- Personne africaine authentique : peau noire naturelle, traits RÉALISTES (pas caricaturaux), cheveux naturels africains (afro, tresses, locs, etc.)
- Vêtements modernes et stylés — clean, relatables, élégants
- Expression faciale SUBTILE — naturelle, confiante, PAS théâtrale ni exagérée
- Attitude naturelle comme dans la vraie vie — PAS de pose mannequin forcée
- Environnement MODERNE et HAUT DE GAMME : appartement moderne, studio contemporain, bureau élégant, quartier urbain chic — PAS de marché, PAS de village, PAS de décor traditionnel
- Lumière NATURELLE douce — PAS artificielle, PAS de filtres agressifs
- ⚠️ ADAPTE le cadrage à la ZONE DU PRODUIT : produit cheveux → cadre sur les cheveux et la chevelure ; produit corpo → cadre sur le corps ; produit visage → cadre sur le visage ; etc. Ne jamais montrer le visage par défaut si le produit n'est pas un produit visage.
- Le produit VISIBLE dans l'image ou son résultat clairement montré — TAILLE RÉELLE du produit (pas surdimensionné), placement naturel
- PAS de titre texte sur l'image. Uniquement éventuellement 1 courte phrase descriptive (8-10 mots max) si nécessaire
- ⚠️ ORTHOGRAPHE PARFAITE OBLIGATOIRE : texte vérifié à 100% — ZÉRO faute. Ton simple, direct, moderne
- Cadrage vertical 4:5 serré, fond net
- Style soft, propre, naturel — PAS flashy, PAS saturé
- PHOTORÉALISTE — doit ressembler à une VRAIE photo, PAS un rendu IA visible
- La personne doit sembler photographiée dans la vraie vie : texture de peau visible, légère asymétrie naturelle du visage, yeux réalistes, dents réalistes, mains anatomiquement correctes
- Interdiction du rendu trop IA : peau plastique, visage trop parfait, sourire figé, yeux vitreux, doigts déformés, cheveux peints, accessoires fondus, arrière-plan cassé
- Les éléments d'infographie doivent illustrer EXACTEMENT ce que dit le texte : si le texte parle d'un problème, ce problème doit se voir; si le texte parle d'un résultat, ce résultat doit se lire visuellement
- Les icones, badges, annotations et mini-scenes doivent correspondre au message de l'angle. Pas de decoration generique sans rapport avec la phrase marketing
- Même si un texte overlay est présent, l'image doit rester compréhensible sans le lire: la posture, le cadrage, la zone du corps, l'objet montré et l'environnement doivent deja raconter la situation

❌ CE QUI EST INTERDIT :
- Prix, CTA "Acheter maintenant", numéros de téléphone, URLs
- Texte long (plus de 2 éléments texte)
- Visage flou ou corps coupé de façon malvenue
- Style caricatural ou fake — aucune déformation du corps ou du produit
- Effets exagérés, filtres agressifs, rendu cartoon
- Espaces vides / marges inutiles autour du sujet

═══ VISUELS HÉRO — 2 IMAGES PRINCIPALES ═══
⚠️ Génère DEUX prompts hero différents et complémentaires pour ce produit :

**1. prompt_affiche_hero** = Photo lifestyle premium RÉALISTE : le produit réel + personne africaine authentique (peau noire naturelle, traits réalistes, vêtements modernes et stylés) qui l'utilise NATURELLEMENT dans un décor MODERNE HAUT DE GAMME (appartement contemporain, studio design, espace urbain chic). Expression subtile, pas théâtrale. Lumière naturelle douce. Style soft, propre, crédible — comme une VRAIE photo.

**2. prompt_hero_poster** = Affiche publicitaire graphique : le produit réel en grand au centre sur fond foncé dramatique (gradient profond) SANS TITRE TEXTE + EXACTEMENT 3 personnes africaines réelles et photographiques visibles dans un cadre MODERNE, avec le produit en main de manière naturelle. Ambiance lancement de marque premium.

☝️ Les deux prompts doivent être entièrement basés sur CE produit spécifique — jamais générique, jamais copié des exemples.

Le HERO doit être :
✅ Le produit réel visible au premier plan (EXACT, jamais recréé), grand, net, dominant — TAILLE RÉELLE (pas surdimensionné)
✅ ⚠️ PERSONNE AFRICAINE OBLIGATOIRE avec VISAGE VISIBLE : peau noire naturelle, traits réalistes (PAS caricaturaux), cheveux naturels africains. Expression SUBTILE et naturelle. La personne utilise ou tient le produit de manière naturelle
✅ Pour le HERO, la personne doit idealement TENIR le produit dans sa main ou ses mains. La main et le produit doivent etre clairement visibles dans le cadre, comme dans une vraie photo publicitaire
✅ RÈGLE GENRE : adapte le genre de la personne africaine au produit : produit femme → femme africaine ; produit homme → homme africain ; produit mixte → au choix selon ce qui est le plus naturel ; produit objet/tech → produit au premier plan + personne africaine visible en arrière-plan
✅ RÈGLE CRITIQUE DE ZONE : adapte le cadrage à la zone exacte du produit :
   - Produit CHEVEUX → chevelure soignée/brillante ou application sur les cheveux. Cadre sur les cheveux, pas sur le visage.
   - Produit VISAGE → application sur le visage, peau du visage, teint unifié.
   - Produit CORPS → application sur bras/jambes/corps, pas un close-up visage.
   - Produit MINCEUR → silhouette, ventre ou taille visible.
   - Produit DENTS → sourire éclatant, gros plan sur les dents.
   - Produit DOULEUR/SANTÉ → personne montrant soulagement naturel avec le produit.
   - Produit TECH/OBJET → produit dominant + personne africaine visible l'utilisant.
✅ Cadrage vertical 4:5 (1080×1250) tight crop, ZÉRO espace vide, lumière naturelle douce
✅ PHOTORÉALISTE — doit ressembler à une VRAIE photo, pas un rendu IA
✅ Au maximum un badge TRÈS court (3 mots max) OU absent

❌ PAS de template beauté imposé pour un produit tech ou homme
❌ PAS de femme systématique si le produit est pour homme ou mixte
❌ PAS de visage/personne non africain si des humains sont montrés
❌ PAS de cadrage trop large avec marges vides

═══ VISUEL AVANT/APRÈS — TRANSFORMATION RÉALISTE AVEC PERSONNE AFRICAINE ═══
⚠️ Le visuel avant/après est le second visuel fort. Il DOIT montrer une personne africaine authentique dans un cadre MODERNE et CONTEMPORAIN.

Le champ "prompt_avant_apres" doit décrire un AVANT/APRÈS SPÉCIFIQUE à CE produit :
✅ Split-screen : côté gauche = AVANT (le problème concret, visible mais NATUREL — pas exagéré, pas théâtral)
✅ Côté droit = APRÈS (le résultat CRÉDIBLE et réaliste après utilisation — amélioration visible mais pas magique)
✅ ⚠️ NE PAS utiliser juste "visage triste vs sourire" — montrer une VRAIE différence visuelle liée au produit
✅ Personne africaine OBLIGATOIRE : peau noire naturelle, traits réalistes africains (pas caricaturaux), cheveux naturels africains
✅ Apparence naturelle : vêtements modernes et stylés, expression SUBTILE (pas théâtrale)
✅ Décor = environnement MODERNE et CONTEMPORAIN (appartement moderne, salle de bain design, chambre contemporaine, salon élégant — PAS de marché, PAS de village, PAS de décor traditionnel)
✅ RÈGLE GENRE : FEMME africaine si produit féminin ; HOMME africain si produit masculin ; adapte si mixte
✅ Le PRODUIT LUI-MÊME visible sur le côté APRÈS — taille RÉELLE (pas surdimensionné), placement naturel
✅ Cadrage vertical 4:5 (1080×1250), serré, lumière naturelle douce, pas artificielle
✅ Style soft, propre, naturel — PAS flashy, PAS saturé, PAS de filtres agressifs
✅ PHOTOREALISTIC — doit ressembler à une VRAIE photo, PAS un rendu IA visible

⚠️ RÈGLE CRITIQUE : le cadrage de l'avant/après DOIT correspondre à la ZONE DU PRODUIT :
- Produit CHEVEUX → AVANT : cheveux secs/abîmés/crépus difficiles à coiffer (gros plan sur la chevelure) → APRÈS : cheveux brillants/hydratés/soyeux. JAMAIS faire un avant/après de la peau du visage pour un produit cheveux.
- Produit VISAGE / PEAU VISAGE → AVANT : peau terne/taches/boutons (close-up visage) → APRÈS : teint unifié/lumineux/net.
- Produit CORPS / LOTION → AVANT : peau sèche du corps (bras, jambes) → APRÈS : peau douce et éclairée.
- Produit MINCEUR → AVANT : silhouette africaine avec ventre prononcé → APRÈS : silhouette affinée avec taille marquée.
- Produit ÉNERGIE → AVANT : personne africaine fatiguée, molle → APRÈS : personne africaine dynamique, souriante.
- Produit DENTS → AVANT : dents jaunies (gros plan bouche) → APRÈS : dents blanches et sourire éclatant.
- Produit NETTOYAGE → AVANT : surface sale → APRÈS : surface propre et brillante.
- Produit DOULEUR/SANTÉ → AVANT : personne montrant inconfort naturel (pas exagéré) → APRÈS : personne soulagée, expression calme naturelle.

═══ FORMAT JSON STRICT ═══
{
  "title": "Titre produit TRÈS GRAND et dominant visuellement (8-15 mots) basé sur la promesse principale + bénéfice clé",
  "hero_headline": "PROMESSE PRINCIPALE ULTRA FORTE EN MAJUSCULES (4-6 mots max) — Ex: MOINS D'ODEURS, PLUS DE CONFIANCE",
  "hero_target_person": "Short English description of the target person showing the problem for the hero image — e.g. 'african woman with skin issues', 'african man with belly fat', 'african woman with dry damaged hair'. Match the product category and gender rule.",
  "hero_slogan": "Sous-titre orienté TRANSFORMATION + bénéfice émotionnel — Ex: Une vie intime libérée et sereine",
  "hero_baseline": "Phrase de réassurance courte avec résultat rapide — Ex: Résultats visibles en quelques jours",
  "benefits_bullets": [
    "💐 Bénéfice clé 1 avec emoji pertinent",
    "💖 Bénéfice clé 2 avec emoji pertinent",
    "✅ Bénéfice clé 3 avec emoji pertinent",
    "⚡ Bénéfice clé 4 avec emoji pertinent"
  ],
  "prompt_hero_poster": "[Generate in English: BOLD ADVERTISING POSTER for THIS SPECIFIC product (describe its exact name, type, color, packaging). Vertical 4:5 (1080×1250) graphic-design meets product photography. The product shown LARGE, dominant, perfectly sharp (min 50% of frame), exact same packaging/color/shape. Premium dark gradient background (deep midnight blue to black, OR deep forest green to charcoal, or deep burgundy — choose what contrasts best with product colors). Dramatic cinematic lighting with product glow. EXACTLY 3 authentic photographed Black African adults in MODERN UPSCALE setting (luxury apartment, modern studio, sleek office, high-end urban location — NOT a market, NOT a village, NOT a traditional setting). All looking real, all naturally posed, and at least 2 of them clearly holding the exact product in hand with believable grip and scale. NO title text, NO headline on the image. Optional thin accent line or minimal graphic element. NO price, NO phone, NO fake button, NO URL. Mood: aspirational, premium brand launch poster, scroll-stopping. Think Apple product launch.]",
  "prompt_avant_apres": "[Generate in English: Photorealistic split-screen before/after transformation image. MUST look like a real photograph, NOT AI-generated. LEFT (AVANT): the SPECIFIC problem this product solves — visible but NATURAL, not exaggerated or theatrical. RIGHT (APRÈS): CREDIBLE realistic improvement after using the product — visible but not magical. MANDATORY: Authentic Black African person (dark skin, natural African features, natural African hair). Modern stylish clothing, SUBTLE facial expressions — NOT theatrical. Setting: MODERN UPSCALE interior (modern bathroom, sleek bedroom, contemporary living room — NOT a traditional African home, NOT a market). The SAME person on both sides. Product visible at REAL SIZE on the AFTER side — natural placement. Small 'Avant'/'Après' labels in perfect French. NO title text on the image. Vertical 4:5 (1080×1250), tight crop. Soft natural lighting, clean style, NO aggressive filters, NO over-saturation. Match the EXACT body zone of the product. The transformation must be BELIEVABLE — not just sad face vs happy face but a real visual difference related to the product benefit.]",
  "angles": [
    {
      "titre_angle": "Phrase complète de 10-15 mots suivant l'étape de la méthode ${marketingApproach} — explique concrètement le bénéfice",
      "explication": "4-6 phrases concrètes, fluides et persuasives adaptées à l'étape de la méthode ${marketingApproach}. Le texte doit être un peu développé, crédible, factuel et vraiment spécifique au produit.",
      "message_principal": "1 phrase d'accroche mémorable spécifique à ce bénéfice, assez naturelle pour pouvoir être réutilisée dans la description",
      "promesse": "La transformation concrète que l'utilisateur va vivre, formulée en 1 phrase un peu plus précise et tangible",
      "poster_url": ""
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
      "name": "Prénom N. (nom africain)",
      "location": "${testimonialLocationTemplate}",
      "rating": 5,
      "text": "1er témoignage (problème précis avant → soulagement/résultat exceptionnel avec CE produit spécifique).",
      "verified": true,
      "date": "Il y a 2 jours",
      "image": "",
      "image_prompt": "realistic portrait photo of african woman/man, natural smile, casual setting"
    },
    {
      "name": "Autre Pronom (nom africain)",
      "location": "${testimonialLocationTemplate}",
      "rating": 5,
      "text": "2ème témoignage (insiste sur le bénéfice secondaire spécifique au produit, ex: texture, rapidité, confort).",
      "verified": true,
      "date": "Il y a 1 semaine",
      "image": "",
      "image_prompt": "realistic portrait photo of african person, professional yet casual, warm lighting"
    },
    {
      "name": "Prénom N. (nom africain)",
      "location": "${testimonialLocationTemplate}",
      "rating": 4,
      "text": "3ème témoignage (très factuel et authentique sur l'utilisation quotidienne de ce produit précis).",
      "verified": true,
      "date": "Il y a 3 semaines",
      "image": "",
      "image_prompt": "realistic portrait photo of african person, outdoor lighting, confident"
    },
    {
      "name": "Nom de Famille (africain)",
      "location": "${testimonialLocationTemplate}",
      "rating": 5,
      "text": "4ème témoignage (focus sur la confiance retrouvée ou la qualité supérieure du produit par rapport aux autres).",
      "verified": true,
      "date": "Il y a 1 mois",
      "image": "",
      "image_prompt": "realistic portrait photo of older african person, reassuring smile"
    }
  ],
  "conversion_blocks": [
    {"icon": "✅", "text": "Paiement à la livraison"},
    {"icon": "🚚", "text": "Livraison rapide"},
    {"icon": "📞", "text": "Support WhatsApp"},
    {"icon": "🔒", "text": "Garantie satisfaction"}
  ],
  "urgency_elements": {
    "stock_limited": true,
    "social_proof_count": "Nombre d'avis réels ou estimé",
    "quick_result": "Ex: 7 jours pour voir les premiers résultats"
  },
  "hero_cta": "Texte du bouton d'achat (ex: 'Je commande maintenant', 'Je veux ce produit')",
  "urgency_badge": "Badge d'urgence court (ex: '🔥 Plus que 12 en stock', '⚡ Offre valable aujourd'hui')",
  "problem_section": {
    "title": "Titre de la section problème (ex: Vous en avez assez de... ?)",
    "pain_points": [
      "Point de douleur 1 — frustration concrète que vit l'acheteur",
      "Point de douleur 2 — conséquence négative de ne rien faire",
      "Point de douleur 3 — objection ou doute courant"
    ]
  },
  "solution_section": {
    "title": "Titre de la section solution (ex: La solution simple et efficace)",
    "description": "3-4 phrases présentant CE produit comme LA solution évidente. Relier chaque point de douleur à un bénéfice concret. Ton naturel et persuasif, jamais exagéré."
  },
  "stats_bar": [
    "Stat sociale fort (ex: +5 000 clients satisfaits)",
    "Résultat rapide (ex: Résultats en 7 jours)",
    "Garantie (ex: Satisfait ou remboursé 30j)"
  ],
  "offer_block": {
    "offer_label": "Texte de l'offre (ex: 'Offre de lancement — 20% de réduction')",
    "guarantee_text": "Texte de garantie rassurant (ex: 'Paiement à la livraison, retour sans questions')",
    "countdown": true
  },
  "seo": {
    "meta_title": "Titre SEO optimisé max 60 caractères incluant le bénéfice principal et le pays",
    "meta_description": "Description SEO max 155 caractères — bénéfice + produit + action",
    "slug": "url-produit-optimisee-sans-accents"
  },
  "description_optimisee": ""
}

⚠️ EXACTEMENT 5 angles, 4 bénéfices avec emojis, 4 raisons, 7 questions FAQ (avec réponses VISIBLES directement), 8 témoignages.
⚠️ benefits_bullets : EXACTEMENT 4 bénéfices DIRECTS avec emojis pertinents — texte simple, compréhensible, sans jargon. Toujours 4, jamais plus, jamais moins.
⚠️ problem_section.pain_points : 3 points de douleur CONCRETS et SPÉCIFIQUES à CE produit — jamais génériques.
⚠️ solution_section.description : paragraphe persuasif 4-6 phrases, relie chaque douleur à un bénéfice du produit.
⚠️ stats_bar : 3 stats crédibles et adaptées au produit (clients, résultats, garantie).
⚠️ hero_cta : bouton d'achat percutant, actionnable, 3-5 mots.
⚠️ urgency_badge : badge court et percutant pour déclencher l'urgence psychologique.
⚠️ offer_block.guarantee_text : phrase de garantie rassurante et crédible pour CE marché.
⚠️ seo.meta_title : max 60 caractères, bénéfice principal + produit${storeCountry ? ` + ${storeCountry}` : ''}.
⚠️ seo.meta_description : max 155 caractères, accrocheur et informatif.
⚠️ seo.slug : URL en kebab-case, sans accents, max 6 mots, ex: "creme-eclaircissante-peau-noire".
⚠️ FAQ : Les questions doivent couvrir : Quand voir résultats ? Est-ce naturel ? Effets secondaires ? Peut-on combiner ? Livraison ? Paiement à la livraison ? + 1 question spécifique au produit. ⛔ NE PAS poser de question sur l'entretien du produit ni sur comment l'utiliser — ces infos sont déjà couvertes par d'autres sections de la page.
⚠️ FAQ : Les réponses doivent être SIMPLES, RASSURANTES, SANS JARGON — affichées directement (pas de dropdown fermé).
⚠️ guide_utilisation.applicable = false si le produit n'a pas besoin d'explication.
⚠️ Adapte prompt_avant_apres au PROBLÈME RÉEL que résout CE produit spécifique.
⚠️ description_optimisee doit toujours être une chaîne vide car la page commence directement par les angles marketing.
⚠️ ORTHOGRAPHE PARFAITE : zéro faute d'orthographe, zéro faute de grammaire, zéro faute de conjugaison dans TOUT le contenu français.
⚠️ TÉMOIGNAGES : 8 témoignages OBLIGATOIRES. Prénoms africains réalistes et villes (Douala, Yaoundé, Abidjan, Dakar, Lomé, Cotonou...) correspondant au pays (${storeCountry || 'Afrique de l\'Ouest'}). Chaque témoignage DOIT mentionner : le problème initial AVANT usage + le résultat APRÈS usage. Ton naturel humain comme un message WhatsApp. Ratings variés (4 ou 5). image_prompt en anglais décrivant un portrait réaliste adapté au genre et au produit.
⚠️ image_prompt des témoignages : décrire une vraie photo humaine credible, jamais un portrait trop retouche ou trop artificiel. Exiger texture de peau naturelle, mains normales si visibles, expression naturelle, lumiere reelle, zero look IA.
⚠️ URGENCE : Intégrer éléments psychologiques (stock limité, preuve sociale, résultats rapides).
⚠️ JSON uniquement. Pas d'explication. Pas de texte avant/après.`;

  const messages = [
    {
      role: "system",
      content: "Tu es expert e-commerce, copywriting et psychologie de l'acheteur, spécialiste marché africain. MISSION : générer une page produit complète et optimisée pour la conversion avec des visuels représentant des personnes africaines authentiques. RÈGLES ABSOLUES : 1) Analyse le produit en profondeur avant de rédiger quoi que ce soit. 2) 100% FRANÇAIS PARFAIT (sauf prompts images en anglais) — zéro faute d'orthographe, zéro faute de grammaire. 3) ZÉRO généricité. 4) ZÉRO exagération. 5) CRITIQUE problem_section : 3 vraies douleurs SPÉCIFIQUES. 6) CRITIQUE solution_section : paragraphe persuasif reliant chaque douleur au produit. 7) CRITIQUE hero_cta : bouton d'achat percutant 3-5 mots. 8) CRITIQUE stats_bar : 3 stats crédibles. 9) CRITIQUE seo : meta_title max 60 chars, meta_description max 155 chars, slug kebab-case. 10) RÈGLE GENRE OBLIGATOIRE pour toutes les images : produit FEMME → femme africaine ; produit HOMME → homme africain ; produit MIXTE → genre le plus naturel selon contexte — JAMAIS de femme par défaut pour un produit masculin ou neutre. 11) RÈGLE ZONE CORPORELLE pour toutes les images : identifier la zone exacte (cheveux, visage, corps, ventre, dents, etc.) et cadrer sur cette zone — JAMAIS le visage par défaut si le produit est pour les cheveux ou le corps. 12) LE PRODUIT LUI-MÊME (packaging, flacon, boîte) doit être visible et grand dans chaque image. 13) prompt_hero_poster = affiche graphique, produit grand sur fond sombre dramatique, SANS TITRE sur l'image, avec EXACTEMENT 3 personnes africaines réelles dans un cadre MODERNE et au moins 2 tenant le produit en main. 14) avant/après : zone correcte + genre correct + produit visible côté APRÈS. 15) angles : 4 visuels, produit visible (40%+) + zone et genre corrects. PAS de titre texte sur les images, uniquement éventuellement une courte phrase descriptive. Quand des humains sont présents dans ces visuels, privilégier EXACTEMENT 3 personnes africaines réelles avec le produit en main au lieu d'icônes ou de personnages génériques. 16) Témoignages : noms et villes adaptés au pays. 17) Le template choisi agit uniquement sur le design visuel des images, icones, fonds, ambiance et palette; il ne doit jamais inventer une promesse, une cible ou un usage produit. 18) Les consignes couleur des affiches, visuel hero, décorations, couleur des titres et couleur du contenu doivent être appliquées réellement aux visuels quand elles sont fournies. 19) Les personnes dans les images doivent ressembler a de vraies personnes photographiees: pores de peau visibles, micro-imperfections naturelles, legere asymetrie du visage, mains anatomiquement correctes, yeux avec texture d'iris reelle, dents legerement inegales et naturelles, cheveux avec variation de boucle/frisure, expression subtile et credible, eclairage avec ombres realistes — ZERO peau lisse comme du plastique, ZERO visage CGI symetrique parfait, ZERO retouche excessive, ZERO teint uniforme artificiel. 20) Chaque image doit illustrer exactement le texte marketing correspondant; aucun badge, icone ou scene ne doit etre decoratif sans lien direct avec le message. 21) Même si du texte est posé sur l'image, la scène doit rester explicite sans lire ce texte: le visuel seul doit raconter la situation. 22) description_optimisee = chaîne vide. 23) CONTEXTE MODERNE OBLIGATOIRE: les décors des images doivent toujours être MODERNES et HAUT DE GAMME (appartement contemporain, studio design, bureau élégant, espace urbain chic) — JAMAIS de marché, village, décor traditionnel ou rue de quartier populaire. Les personnes africaines sont dans des endroits beaux et modernes. 24) PAS DE TITRE TEXTE sur les images générées. Les prompts d'images ne doivent PAS inclure de headline/titre. 25) TOUS LES PROMPTS D'IMAGES ET TOUTE LA PAGE DOIVENT STRICTEMENT SE BASER SUR LES CARACTÉRISTIQUES IDENTIFIÉES DANS L'IMAGE FOURNIE. 26) JSON uniquement."
    },
    {
      role: "user",
      content: userPrompt
    }
  ];

  // Groq supporte la vision via Llama 4 Scout
  if (imageBuffers.length > 0) {
    console.log(`🖼️ ${imageBuffers.length} image(s) disponible(s) — analyse avec le service Vision`);
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

  // Helper: appel Groq avec timeout + retries
  const GROQ_TIMEOUT_MS = 60000; // 60s max par tentative (Groq est rapide)

  async function callGroqWithTimeout(model, msgs, withImages) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    try {
      const resp = await groq.chat.completions.create(
        {
          model,
          messages: msgs,
          max_tokens: 7000,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal }
      );
      return resp;
    } finally {
      clearTimeout(timer);
    }
  }

  let result;
  try {
    let response;
    // Tentative 1 : modèle vision si images disponibles
    if (imageBuffers.length > 0) {
      try {
        const groqVisionModel = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`🔍 Tentative le service Vision (${groqVisionModel})...`);
        response = await callGroqWithTimeout(groqVisionModel, messages, true);
      } catch (visionErr) {
        console.warn(`⚠️ le service Vision échoué (${visionErr.message}), fallback text-only...`);
        // Fallback text-only : remplacer le contenu image par du texte
        const textOnlyMessages = [
          messages[0],
          { role: 'user', content: typeof messages[1].content === 'string' ? messages[1].content : messages[1].content[0]?.text || userPrompt }
        ];
        response = await callGroqWithTimeout(process.env.GROQ_MODEL || 'openai/gpt-oss-20b', textOnlyMessages, false);
      }
    } else {
      response = await callGroqWithTimeout(process.env.GROQ_MODEL || 'openai/gpt-oss-20b', messages, false);
    }

    const raw = response.choices[0]?.message?.content || '{}';
    console.log('📝 le service raw response length:', raw.length);

    // Parse robuste : gère markdown, newlines littéraux, virgules traînantes
    result = parseGroqJSON(raw);
    if (!result) {
      console.warn('⚠️ le service raw (début):', raw.slice(0, 400));
      throw new Error('Réponse IA invalide — JSON non parsable');
    }
    console.log('✅ le service JSON parsé, clés:', Object.keys(result).join(', '));
  } catch (error) {
    console.error('❌ le service API error:', error.message);
    // Fallback KIE (texte) pour garantir la génération même si Groq échoue
    if (isKieConfigured()) {
      try {
        console.log('🔄 service de secours pour génération page produit...');
        const kie = await callKieChatCompletion({
          messages: [
            messages[0],
            {
              role: 'user',
              content: typeof messages[1].content === 'string'
                ? messages[1].content
                : messages[1].content?.[0]?.text || userPrompt,
            },
          ],
          temperature: 0.7,
          maxTokens: 7000,
          reasoningEffort: process.env.KIE_REASONING_EFFORT || 'low',
          includeThoughts: false,
        });

        result = parseGroqJSON(kie.content || '{}');
        if (!result) throw new Error('le service JSON non parsable');
        console.log('✅ le service JSON parsé, clés:', Object.keys(result).join(', '));
      } catch (kieErr) {
        console.error('❌ le service fallback error:', kieErr.message);
        throw new Error(`Erreur IA: le service=${error.message} | le service=${kieErr.message}`);
      }
    } else {
      throw new Error(`Erreur du service: ${error.message}`);
    }
  }

  if (!result) {
    throw new Error('Aucune structure générée par GPT');
  }

  // Validation de la structure - Fallbacks SPÉCIFIQUES au produit
  if (!result.angles || !Array.isArray(result.angles) || result.angles.length < 5) {
    console.warn('⚠️ Moins de 5 angles générés, padding avec angles spécifiques...');
    result.angles = result.angles || [];
    const fallbackAngles = [
      {
        titre_angle: `Ce ${title || 'produit'} mise sur une qualité sérieuse pour durer dans le temps`,
        explication: `Ce ${title || 'produit'} est fabriqué avec des matériaux premium pour garantir durabilité et performance. Une qualité professionnelle adaptée à un usage quotidien intensif.`,
        message_principal: "Investissez dans la qualité qui dure",
        promesse: "Un produit fiable pour vos besoins quotidiens",
        prompt_affiche: `Vertical 4:5 (1080×1250) lifestyle scene illustrating durability and confidence around the ${title || 'product'}. Tight crop, subject fills the frame, clean natural light, real everyday setting, no text overlay, no badges, no poster design.`
      },
      {
        titre_angle: `Ce ${title || 'produit'} apporte un bénéfice concret perceptible dès les premiers usages`,
        explication: `Conçu pour offrir des résultats concrets, ce ${title || 'produit'} s'intègre facilement dans votre routine quotidienne pour un impact mesurable dès les premières utilisations.`,
        message_principal: "Des résultats réels dès la première utilisation",
        promesse: "Une efficacité prouvée dans votre quotidien",
        prompt_affiche: `Vertical 4:5 (1080×1250) explanatory lifestyle image showing the immediate practical benefit of the ${title || 'product'}. Tight crop, authentic movement, natural light, everyday environment, no text overlay, no CTA, no marketing layout.`
      },
      {
        titre_angle: `Ce ${title || 'produit'} simplifie l'usage au quotidien avec un confort immédiat`,
        explication: `Alliant ergonomie et design intuitif, ce ${title || 'produit'} s'intègre naturellement dans votre style de vie. Simple à utiliser, il devient vite indispensable.`,
        message_principal: "La simplicité qui change tout",
        promesse: "Un quotidien plus confortable et agréable",
        prompt_affiche: `Vertical 4:5 (1080×1250) real-life scene showing comfort and ease of use with the ${title || 'product'}. Tight crop, calm authentic setting, no text, no promotional elements, clear visual storytelling.`
      },
      {
        titre_angle: `Ce ${title || 'produit'} rassure par sa fiabilité et sa conception bien pensée`,
        explication: `Ce ${title || 'produit'} est conçu pour durer et répondre aux standards de qualité les plus exigeants. Sa solidité et sa fiabilité en font un investissement judicieux sur le long terme.`,
        message_principal: "Un produit de confiance pour les années à venir",
        promesse: "La tranquillité d'esprit avec chaque utilisation",
        prompt_affiche: `Vertical 4:5 (1080×1250) close-up visual focused on reliability, finish and trust around the ${title || 'product'}. Tight crop, premium but simple, no text overlay, no promotional elements, no empty margins.`
      },
      {
        titre_angle: `Ce ${title || 'produit'} offre un rapport qualité-prix imbattable pour un usage quotidien`,
        explication: `Ce ${title || 'produit'} combine performance et accessibilité, offrant une solution premium sans compromis sur votre budget. Un investissement rentable sur le long terme.`,
        message_principal: "Le meilleur rapport qualité-prix du marché",
        promesse: "La qualité premium accessible à tous",
        prompt_affiche: `Vertical 4:5 (1080×1250) lifestyle scene showing satisfaction and value around the ${title || 'product'}. Person smiling, product visible and prominent, modern upscale setting (luxury apartment, contemporary studio, sleek urban backdrop), professional lighting, no text overlay, no promotional elements.`
      }
    ];
    while (result.angles.length < 5) {
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
      { question: `Quand vais-je voir les premiers résultats avec ce ${productName} ?`, reponse: `La plupart de nos clients constatent des résultats visibles dès les premières utilisations. Pour des résultats optimaux, une utilisation régulière est recommandée.` },
      { question: `Quelle est la durée de vie de ce ${productName} ?`, reponse: `Fabriqué avec des matériaux de haute qualité, ce ${productName} est conçu pour durer plusieurs années avec un usage normal.` },
      { question: `Ce ${productName} est-il naturel et sans danger ?`, reponse: `Oui, ce ${productName} est conçu avec des ingrédients soigneusement sélectionnés, sans composants nocifs. Adapté à un usage quotidien.` },
      { question: `Quelle est la politique de retour ?`, reponse: `Nous offrons une garantie satisfaction de 14 jours. Retour possible si le produit ne vous convient pas.` },
      { question: `Le paiement à la livraison est-il disponible ?`, reponse: `Oui ! Vous pouvez payer à la réception de votre commande. Aucun paiement en ligne requis.` }
    ];
    while (result.faq.length < 5) {
      result.faq.push(defaultFaq[result.faq.length % defaultFaq.length]);
    }
  }

  // Filter out empty/invalid testimonials
  if (Array.isArray(result.testimonials)) {
    result.testimonials = result.testimonials.filter(t =>
      t && typeof t.text === 'string' && t.text.trim().length > 10 &&
      typeof t.name === 'string' && t.name.trim().length > 1
    );
  }

  // Build product-aware fallback testimonials using generated content
  if (!result.testimonials || result.testimonials.length < 8) {
    const productName = title || 'produit';
    const locations = getLocalizedTestimonialLocations(storeCountry, storeCity);

    // Extract real product details from what Groq generated
    const benefit1 = (result.benefits_bullets?.[0] || '').replace(/^[^\w]*/,'').slice(0, 80);
    const benefit2 = (result.benefits_bullets?.[1] || '').replace(/^[^\w]*/,'').slice(0, 80);
    const problem = result.problem_section?.pain_points?.[0] || '';
    const quickResult = result.urgency_elements?.quick_result || '';
    const slogan = result.hero_slogan || '';

    const smartFallbacks = [
      {
        name: 'Mireille K.', location: locations[0], rating: 5, verified: true, date: 'Il y a 2 jours',
        text: problem
          ? `Avant j'avais vraiment ce problème : "${problem.slice(0,60)}". Depuis que j'utilise ${productName}, la différence est vraiment visible. Je suis contente de mon achat.`
          : `J'utilise ${productName} depuis quelques jours et je suis déjà satisfaite. La qualité est au rendez-vous et ça correspond exactement à ce que je voulais.`,
        image: '', image_prompt: 'realistic portrait photo of african woman 28-35, natural hair, warm smile, modern stylish interior setting'
      },
      {
        name: 'Armand T.', location: locations[1], rating: 5, verified: true, date: 'Il y a 5 jours',
        text: benefit1
          ? `Ce que j'apprécie le plus avec ${productName} c'est vraiment le côté "${benefit1}". Très facile à utiliser et la livraison s'est bien passée. Je recommande.`
          : `Très bon produit. ${productName} fait exactement ce qui est annoncé, sans mauvaise surprise. Je vais en recommander pour ma famille.`,
        image: '', image_prompt: 'realistic portrait photo of african man 30-40, casual shirt, confident satisfied expression, warm lighting'
      },
      {
        name: 'Awa D.', location: locations[2], rating: 4, verified: true, date: 'Il y a 1 semaine',
        text: quickResult
          ? `J'étais sceptique au départ mais après utilisation j'ai vraiment vu des résultats. ${quickResult}. ${productName} tient vraiment ses promesses.`
          : `Bonne surprise avec ${productName}. Je l'utilise au quotidien et le résultat est là. La qualité est sérieuse et le prix est correct par rapport à ce qu'on reçoit.`,
        image: '', image_prompt: 'realistic portrait photo of african woman 22-30, braided hair, happy expression, outdoor setting'
      },
      {
        name: 'Koffi A.', location: locations[3], rating: 5, verified: true, date: 'Il y a 2 semaines',
        text: benefit2
          ? `Ce qui m'a convaincu c'est "${benefit2}". ${productName} est vraiment bien pensé pour un usage quotidien. Franchement satisfait et je referai confiance à cette boutique.`
          : `Franchement satisfait de ${productName}. Le produit est conforme à la description, la livraison était rapide et le service client a répondu rapidement à mes questions.`,
        image: '', image_prompt: 'realistic portrait photo of african man 35-45, relaxed look, genuine smile, modern setting'
      },
      {
        name: 'Christelle B.', location: locations[0], rating: 5, verified: true, date: 'Il y a 3 jours',
        text: slogan
          ? `"${slogan.slice(0,60)}" — c'est exactement ça avec ${productName}. Je l'ai reçu rapidement, essayé tout de suite, et je ne suis pas déçue. Très bonne qualité.`
          : `Excellente qualité pour ${productName}. Je l'ai reçu rapidement, bien emballé, et il correspond parfaitement à ce que je cherchais. Je le recommande sans hésiter.`,
        image: '', image_prompt: 'realistic portrait photo of african woman 30-42, professional look, warm smile'
      },
      {
        name: 'Moussa S.', location: locations[1], rating: 5, verified: true, date: 'Il y a 4 jours',
        text: `${productName} est vraiment efficace. J'en avais entendu parler et j'ai finalement sauté le pas — bonne décision. La qualité dépasse ce que j'espérais pour ce prix.`,
        image: '', image_prompt: 'realistic portrait photo of african man 28-38, modern casual outfit, proud expression'
      },
      {
        name: 'Fatou N.', location: locations[2], rating: 5, verified: true, date: 'Il y a 1 semaine',
        text: problem
          ? `Je cherchais une solution pour "${problem.slice(0,50)}" et ${productName} a réglé ça. Simple à utiliser, résultats visibles, et la boutique est sérieuse. Très contente !`
          : `${productName} est top ! Ça fait exactement ce que la fiche produit décrit. Bonne qualité, bien livré, et ça s'utilise très facilement. Je rachèterai.`,
        image: '', image_prompt: 'realistic portrait photo of african woman 25-35, natural makeup, glowing skin, happy'
      },
      {
        name: 'Jean-Paul E.', location: locations[3], rating: 4, verified: true, date: 'Il y a 3 semaines',
        text: `Bon produit dans l'ensemble. ${productName} est solide, bien conçu et facile à utiliser. J'aurais aimé le recevoir un peu plus tôt mais la qualité est là. Je recommande.`,
        image: '', image_prompt: 'realistic portrait photo of african man 25-35, sporty style, energetic expression, casual setting'
      },
    ];

    result.testimonials = result.testimonials || [];
    while (result.testimonials.length < 8) {
      result.testimonials.push(smartFallbacks[result.testimonials.length % smartFallbacks.length]);
    }
  }

  return result;
}

// ─── Étape 3 : Génération d'AFFICHES PUBLICITAIRES avec NanoBanana ───────────

export async function generatePosterImage(promptAffiche, originalImageBuffer = null, options = {}) {
  try {
    const mode = options?.mode || 'scene';
    const aspectRatio = options?.aspectRatio || '4:5';
    const isSquare = aspectRatio === '1:1';
    const isThreeByFour = aspectRatio === '3:4';
    const formatLabel = isSquare
      ? 'SQUARE 1:1 (1080×1080)'
      : (isThreeByFour ? 'VERTICAL 3:4 (1080×1440)' : 'VERTICAL 4:5 (1080×1250)');
    const ratioPrompt = isSquare
      ? 'Square 1:1 (1080×1080) premium composition, balanced framing, full-bleed crop, ZERO empty margins.'
      : (isThreeByFour
        ? 'Vertical 3:4 (1080×1440) premium composition, tight crop, full-bleed framing, ZERO empty margins.'
        : 'Vertical 4:5 (1080×1250) premium composition, tight crop, full-bleed framing, ZERO empty margins.');
    const formatOverride = isSquare
      ? 'FORMAT OVERRIDE: Generate the final image in SQUARE 1:1 (1080×1080). Ignore any previous mention of 4:5, 3:4, portrait, or vertical-only framing elsewhere in the prompt.'
      : (isThreeByFour
        ? 'FORMAT OVERRIDE: Generate the final image in VERTICAL 3:4 (1080×1440). Ignore any previous mention of 4:5, 1:1, portrait variants, or other aspect ratios elsewhere in the prompt.'
        : 'FORMAT OVERRIDE: Generate the final image in VERTICAL 4:5 (1080×1250). Ignore any previous mention of 3:4, 1:1, or other aspect ratios elsewhere in the prompt.');
    console.log(`🎨 Generating ${mode} image with le service...`);

    if (!originalImageBuffer) {
      console.warn(`⚠️ Skipping ${mode} generation: missing base product image for image-to-image workflow.`);
      return null;
    }

    const heroRules = `
The layout and copy structure are fully described in the prompt above — follow them exactly.
USE EXACTLY the product appearance from the reference image provided — do NOT redraw, recreate, or redesign the product. Same shape, color, packaging, label. If you cannot reproduce the EXACT same product, show the scene WITHOUT the product rather than inventing one.
Quality: Ultra realistic, 4K sharpness, advertising photography standard. The lifestyle photo on the right must look like a real commercial photograph — natural skin texture, real hands, photorealistic quality.
${PHOTO_REALISM_RULES}`;

    const heroPosterRules = `
Create a bold, visually striking advertising poster for THIS specific product. Premium graphic design meets ultra-realistic product photography.
USE EXACTLY the product appearance from the reference image provided — do NOT redraw, recreate, or redesign the product. If you cannot reproduce the EXACT same product, generate the poster WITHOUT the product rather than inventing a different one.
${ratioPrompt}

PRODUCT PLACEMENT (CRITICAL): The product must be LARGE, DOMINANT, and PERFECTLY SHARP in the center or lower third. It should occupy at least 50% of the frame. Every detail of the product (color, texture, label, packaging) must be crystal clear and instantly recognizable.

Background: Premium solid or gradient background that CONTRASTS with the product and makes it POP. Possible choices:
- Deep gradient (dark to rich midnight blue / charcoal / deep forest green / rich burgundy) behind a warm product
- Clean white or light gray for a product with strong colors
- Contextual bokeh scene if the product is lifestyle-oriented
Dramatic studio lighting: strong key light from above, rim lights creating product depth, subtle reflection on surface.

Graphic design elements (SUBTLE, premium):
- A thin elegant colored line or frame accent at edges
- Optional small accent shape (circle, corner mark) in matching brand color
- Product shadow or glow effect for depth

Typography (NO TITLE ON IMAGE):
Do NOT put any headline or title text on the image. The image should be purely visual without text overlay.
Optional: 1 very short French descriptive phrase (6-8 words max) in lighter weight if needed for context, but NO title.

NO price, NO phone number, NO URL, NO fake CTA button.

Mood: Bold, aspirational, premium brand launch — think Apple product launch poster or Nike campaign. Scroll-stopping, impossible to ignore in a social media feed. Modern upscale setting — NOT a market, NOT a village, NOT traditional decor.`;

    const beforeAfterRules = `
Create a high-converting before/after product transformation image. Ultra realistic, 4K quality, sharp focus, advertising photography style.
  ${isSquare ? 'Square 1:1 (1080×1080) split-screen visual specific to this product.' : `${formatLabel} split-screen visual specific to this product.`}

MANDATORY: feature an authentic Black African person (dark brown skin, natural African hair, African facial features). Natural expression, realistic skin and features — not fake or plastic.
${PHOTO_REALISM_RULES}

Left side BEFORE: The African person clearly showing the PROBLEM or CONTEXT this product solves — visible frustration, discomfort, or issue.
Right side AFTER: The SAME African person showing the RESULT — improvement, satisfaction, confidence, glowing outcome.

Visual style: Clean, modern, premium. Professional lighting, soft shadows, studio quality. Clear visual storytelling: problem → product → result.
Tight crop, clear realistic transformation (not exaggerated). Small 'Avant'/'Après' label text in bold modern font if helpful for reading.
⚠️ CRITICAL SPELLING REQUIREMENT: The French labels 'Avant' and 'Après' MUST be spelled PERFECTLY with correct accents. NEVER write "Apres" without the accent grave (è). All French text must be 100% error-free.
NO arrows, NO heavy graphic overlays, NO empty margins, NO price, NO CTA.

Mood: Trustworthy, convincing, high-conversion, impossible to ignore in a Facebook or TikTok feed.`;

    const sceneRules = `
  QUALITY: Ultra HD 4K, razor-sharp, zero blur. ${isSquare ? 'Square 1:1 (1080×1080).' : `${formatLabel}.`}
PRODUCT REFERENCE (CRITICAL): The reference product image provided MUST be reproduced EXACTLY in the output — same packaging, same colors, same label, same shape, same size proportions. Use the EXACT visual appearance from the reference photo, do NOT recreate or redraw the product. If you cannot faithfully reproduce the EXACT same product, generate the scene WITHOUT the product rather than inventing a different one. A scene without the product is ALWAYS better than a scene with a wrong product.
PERSON: ALWAYS include authentic Black African person (dark skin, natural hair, confident expression) in a MODERN UPSCALE setting.
${PHOTO_REALISM_RULES}
PRODUCT: Large, dominant, sharp, 40-60% of frame. Must match the reference image exactly.
TEXT: NO title/headline on the image. French only if any short descriptive text is needed, 100% perfect spelling with accents. Max 2 short text elements (NO title).
NO price, NO phone, NO URL, NO CTA button, NO watermark.
SETTING: MODERN and UPSCALE — contemporary apartment, design studio, sleek office, chic urban area. NEVER a market, village, or traditional setting.
CRITICAL: Follow the SPECIFIC visual style described above — unique background, unique decorations, unique mood for THIS image.`;

    const socialProofRules = `
  Create a premium ecommerce testimonial collage poster for THIS exact product. Ultra realistic, polished graphic design, premium African-market beauty or wellness creative.
  USE EXACTLY the product appearance from the reference image provided — do NOT redraw, recreate, or redesign the product. If you cannot reproduce the EXACT same product, generate the poster WITHOUT the product rather than inventing a different one.
  ${ratioPrompt}

  MANDATORY LAYOUT TO FOLLOW CLOSELY:
  - huge condensed uppercase title across the top
  - small decorative accent marks near the title
  - one long rounded yellow or golden ribbon subtitle below the main title
  - one large exact product in the center, visually dominant and perfectly sharp
  - 4 to 6 rounded white testimonial cards around the product
  - each testimonial card contains one authentic African customer portrait, one first name, one city, five yellow stars, and one short quote
  - one bottom reassurance strip with 3 benefit icons or chips
  - optional bottom mini-brand zone if useful

  BACKGROUND AND COLORS:
  - warm cream, ivory or soft golden background
  - elegant yellow or golden accents
  - use the brand color only as a supporting accent when helpful, not as a dark full background
  - avoid dark green poster magazine style and avoid a single giant lifestyle scene

  TEXT RULES:
  - French only, perfect spelling, no gibberish
  - short readable words only
  - no CTA button, no price, no phone number, no URL, no fake widget UI

  COMPOSITION RULES:
  - the product must stay central and larger than all other elements
  - testimonial cards must feel like real designed modules, not chaotic floating boxes
  - faces must look like real premium commercial portraits, never like generic stock pasted randomly
  - the final result must look close to a structured review board for a product page, not a single lifestyle photo
  ${PHOTO_REALISM_RULES}
  `;

    const productRefRule = `
═══ PRODUCT REFERENCE — IMAGE-TO-IMAGE MANDATORY ═══
A reference image of the EXACT product is provided as input. Reproduce EXCLUSIVELY the product visible in this reference — same shape, color, packaging, label, design. Do NOT name, describe, or invent any product. The reference image is the ONLY source of truth for the product.
The product MUST appear in the generated visual. If it cannot be faithfully reproduced, generate the scene WITHOUT any product rather than inventing a different one.
`;

    let modeRules;
    if (mode === 'hero') modeRules = heroRules;
    else if (mode === 'hero_poster') modeRules = heroPosterRules;
    else if (mode === 'before_after') modeRules = beforeAfterRules;
    else if (mode === 'social_proof') modeRules = socialProofRules;
    else modeRules = sceneRules;

    // CRITICAL: product reference rule FIRST (survives any truncation),
    // then the unique design prompt, then the mode-specific quality rules.
    const posterPrompt = `${formatOverride}
  ${productRefRule}
${promptAffiche}
${modeRules}`;

    console.log('📸 Image-to-image poster generation (with product reference)...');
    const result = await generateGptImage2ImageToImage(
      posterPrompt,
      originalImageBuffer,
      aspectRatio
    );

    return result;
  } catch (err) {
    console.warn(`⚠️ Erreur génération affiche le service: ${err.message}`);
    // STRICT: throw so upstream generateAndUpload retry logic can retry
    throw err;
  }
}

// ─── Infographics 9:16 product page ─────────────────────────────────────────

// ─── Color presets for infographic generation ────────────────────────────────
const INFOGRAPHIC_COLOR_PRESETS = {
  bleu_royal:    { bg: '#EFF6FF', card: '#FFFFFF', text: '#1E3A8A', accent: '#F59E0B', highlight: '#3B82F6', description: 'clean white/light-blue background with royal blue headlines and amber accents' },
  vert_emeraude: { bg: '#F0FDF4', card: '#FFFFFF', text: '#064E3B', accent: '#F59E0B', highlight: '#10B981', description: 'soft mint-white background with deep green headlines and amber accents' },
  or_premium:    { bg: '#FFFBEB', card: '#FFFFFF', text: '#92400E', accent: '#D97706', highlight: '#F59E0B', description: 'warm ivory background with rich amber/gold headlines' },
  rose_feminin:  { bg: '#FFF1F2', card: '#FFFFFF', text: '#881337', accent: '#F43F5E', highlight: '#FB7185', description: 'soft blush-white background with deep rose headlines and pink accents' },
  violet_luxe:   { bg: '#FAF5FF', card: '#FFFFFF', text: '#581C87', accent: '#9333EA', highlight: '#C084FC', description: 'soft lavender-white background with deep violet headlines and purple accents' },
};

const PHOTO_REALISM_RULES = `
HUMAN REALISM — MANDATORY:
- Skin texture: visible natural pores, slight variation in tone, micro-imperfections — NEVER smooth porcelain, NEVER plastic-looking or airbrushed to oblivion
- Face: slight asymmetry, natural shadows under eyes and nose, real depth — NOT a perfectly symmetrical CGI face
- Eyes: natural iris pattern, slight moisture highlight, real eyelashes — NOT glassy doll eyes
- Teeth (if visible): slightly uneven, natural off-white — NOT uniform bright-white veneers
- Hands and fingers: correct anatomy, natural skin folds, realistic proportions
- Hair: individual strand variation, natural frizz or curl pattern — NOT a uniform plastic mass
- Expression: subtle, believable — NOT exaggerated happiness or theatrical emotion
- Lighting: realistic falloff and shadows on skin — NOT uniform flat illumination
- NO over-retouching: the image should look like a real-world photo, not a beauty filter rendering
`;

const INFOGRAPHIC_BASE_RULES = `
VERTICAL 9:16 (1080×1920) INFOGRAPHIC for a product landing page. Full-bleed, edge-to-edge, no empty margins.
USE EXACTLY the product appearance from the reference image — same shape, color, packaging, label, design. Do NOT redraw or redesign the product. If you cannot reproduce the EXACT same product, generate the scene WITHOUT the product rather than inventing one.

DESIGN STYLE — REFERENCE: This image must look like a premium Amazon/Shopify product listing infographic slide:
- BACKGROUND: warm ivory or light cream (#FFF8F0 to #FFFBF5) or very soft pastel matching the accent color — NEVER a dark background
- CARDS: white rounded-corner cards (border-radius ~16px) with soft drop shadows (shadow: 0 4px 16px rgba(0,0,0,0.08)) — clean, modern, airy
- PRODUCT: shown large, sharp, perfectly lit against the card or background — dominant visual anchor
- TYPOGRAPHY: bold condensed sans-serif (Montserrat/Poppins style), dark headline text, accent color highlights on 1–2 key words per headline — NOT all-white text on dark background
- ICONS: clean flat or outline icons (circle badges, checkmarks, small line-art) — NOT heavy solid emoji blobs
- LAYOUT: 2–4 distinct content sections stacked vertically with clear visual rhythm, generous whitespace, thin dividers or spacing
- ACCENT COLOR: warm amber/orange (#F59E0B) or the brand accent color — used for highlights, badges, underlines, key words, checkmark icons
- NO dark full-bleed poster aesthetic, NO neon, NO heavy gradients, NO cluttered collage

PERSONS (when present):
- Authentic Black African person, MODERN UPSCALE setting, real photograph feel
${PHOTO_REALISM_RULES}

TEXT RULES:
- 100% PERFECT FRENCH — zero spelling/grammar errors, every accent correct (é è ê à ù ç)
- Bold modern sans-serif, high contrast, mobile-readable
- NO fake CTA button, NO price, NO phone number, NO URL, NO watermark
`;

const INFOGRAPHIC_SMART_FUNNEL_STYLE = `
LAYOUT & DESIGN LANGUAGE:
- Think "premium Shopify/Amazon product listing image" — clean, bright, trustworthy, conversion-focused
- Warm cream or ivory base (NOT dark blue) with white rounded cards and soft shadows
- Strong headline hierarchy: large bold dark text, 1–2 accent-color words per line, short lines
- Product appears oversized, sharp, with clean studio lighting — placed on a white card or elevated pedestal feel
- Use clean icons or simple line-art symbols for feature bullets (circle icons with tick, leaf, shield, drop, star)
- Each content section should feel like a distinct card block: separated, breathable, scannable at a glance
- Avoid dense text, avoid dark poster aesthetics, avoid generic blue full-bleed funnels
- Prioritize: clarity → scannability → product prominence → trust signals
`;

const INFOGRAPHIC_SLIDE_PROMPTS = {

  problem: ({ productName, targetAudience, painPoint, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', highlightColor = '#EA580C', country = '', city = '' }) => `
SLIDE TYPE: PROBLÈME — accroche émotionnelle qui nomme la douleur du client et crée un lien fort avant de parler du produit.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor}) — propre, aéré, jamais sombre
ZONE HAUTE (30% de la slide) — bloc émotionnel fort:
  - Titre choc en 2 lignes, gras condensé, MAJUSCULES, texte sombre (${textColor}), 1 mot-clé en couleur vive (${highlightColor})
  - Exemple de formulation: "VOUS EN AVEZ ASSEZ DE [PROBLÈME] ?" — émotionnel, direct, personnel
  - Sous-titre court en italique ou texte normal : "Vous n'êtes pas seul(e). Des milliers de personnes vivent la même chose."

ZONE CENTRALE (45% de la slide) — carte blanche arrondie avec ombre douce:
  - Personne africaine authentique montrant clairement la SOUFFRANCE liée au problème (${painPoint || 'le problème principal du produit'}) — expression de frustration, fatigue ou inconfort réel et crédible
  - La zone affectée est visible et reconnaissable (cheveux, peau, corps, etc.)
  - Lumière naturelle, style photo réelle — PAS de mise en scène artificielle

ZONE BASSE (25% de la slide) — liste de symptômes/signes reconnaissables:
  - 3 lignes, chaque ligne: icône ronde (❌ ou ⚠️ dans cercle coloré) + texte court (4–6 mots)
    Exemples: "❌ Chute de cheveux visible" · "❌ Peau terne et fatiguée" · "❌ Résultats décevants après tout"
  - Fond blanc, coins arrondis, ombre légère — style carte infographie Shopify premium

${buildInfographicCastingInstruction({ name: productName, targetAudience, painPoint })}
${buildInfographicLocaleInstruction(country, city)}
${PHOTO_REALISM_RULES}

TEXTE — RÈGLES ABSOLUES:
- FRANÇAIS PARFAIT — zéro faute, tous les accents corrects (é è ê à ù ç)
- Ton: direct, empathique, "je comprends ce que vous vivez"
- PAS de nom de produit, PAS de CTA, PAS de prix — cette slide parle UNIQUEMENT du problème
- PAS de fond sombre, PAS de texte blanc sur fond coloré

AMBIANCE: Empathique, reconnaissable, émotionnellement fort. Le lecteur se dit "c'est exactement mon problème !".
`,

  hook: ({ productName, targetAudience, painPoint, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', highlightColor = '#EA580C', country = '', city = '' }) => `
SLIDE TYPE: SOLUTION HERO — le produit est présenté comme LA réponse au problème, avec une promesse de transformation claire.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor})

ZONE HAUTE (25%) — promesse de transformation:
  - Titre 2 lignes: "LA SOLUTION QUE VOUS ATTENDIEZ" suivi de la promesse principale en accent (${accentColor})
  - Exemple: "FINI [PROBLÈME]. PLACE À [RÉSULTAT]" — direct, affirmé, en gras condensé MAJUSCULES
  - Petit badge arrondi sous le titre: "✓ Prouvé · ✓ Naturel · ✓ Résultats rapides"

ZONE CENTRALE (50%) — le produit en héros:
  - Le produit ${productName || ''} GRAND (min 55% de hauteur), parfaitement net, sur carte blanche avec ombre douce
  - Lumière studio propre — chaque détail de l'emballage, étiquette, forme est fidèle à la référence
  - Effet "présentation produit premium" — pas de fond plein ni de poster sombre

ZONE BASSE (25%) — preuve sociale:
  - 3 petites pastilles horizontales en blanc sur fond clair: "⭐ 4.9/5 · 2 300 avis" + "✓ Stock limité" + "🚚 Livraison rapide"
  - Optionnel: petit bandeau de certification (Bio, Sans Parabène, Vegan, etc.) adapté au produit

${buildInfographicCastingInstruction({ name: productName, targetAudience, painPoint })}
${buildInfographicLocaleInstruction(country, city)}

TEXTE:
- FRANÇAIS PARFAIT, gras sans-serif condensé, contraste élevé mobile
- PAS de fond sombre, PAS de long texte, PAS de bouton CTA, PAS de prix

AMBIANCE: Révélation, soulagement, confiance. Le lecteur pense "c'est exactement ce qu'il me faut".
`,

  benefits: ({ productName, mainBenefit, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', highlightColor = '#EA580C', targetAudience = '', country = '', city = '' }) => `
SLIDE TYPE: BÉNÉFICES — liste des transformations concrètes que le produit apporte, en un coup d'œil.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor})

ZONE HAUTE (20%):
  - Titre court 1 ligne: "CE QUE ÇA CHANGE POUR VOUS" — (${textColor}) gras, 1 mot en (${accentColor})
  - Sous-titre 1 ligne: le bénéfice principal (${mainBenefit || 'résultats visibles rapidement'}) en italique clair

ZONE CENTRALE (50%) — grille 2×3 ou 3×2 de bénéfices:
  - Chaque case: icône ronde flat (cercle + pictogramme propre : feuille, bouclier, goutte, étoile, etc.) + label 2–3 mots en gras sombre
  - Exemples adaptés au produit: "Éclat naturel", "Hydratation intense", "Pousse accélérée", "Peau lisse", "Force & vitalité", "Protection totale"
  - Fond de chaque case: blanc, coins arrondis, légère ombre — style Shopify premium

ZONE BASSE (30%) — le produit:
  - Le produit ${productName || ''} net et grand sur carte blanche, centré
  - 1 ligne de réassurance très courte sous le produit: "100% Naturel · Sans Effets Secondaires · Livraison Gratuite"

${buildInfographicCastingInstruction({ name: productName, targetAudience, mainBenefit })}
${buildInfographicLocaleInstruction(country, city)}

TEXTE: Labels courts, FRANÇAIS PARFAIT, lisible sur mobile. PAS de fond sombre.
AMBIANCE: Clair, rapide à scanner, convaincant. Comme une fiche produit Amazon top-rated.
`,

  avant_apres: ({ productName, bodyZone, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', targetAudience = '', country = '', city = '' }) => `
SLIDE TYPE: AVANT / APRÈS — comparaison transformation choc, résultats concrets et crédibles.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor})

ZONE HAUTE (20%):
  - Titre fort 2 lignes: "AVANT vs APRÈS" en très gros, gras, MAJUSCULES — "AVANT" en gris-rouge doux, "APRÈS" en (${accentColor}) vif
  - Sous-titre court sous le titre: "Résultats visibles dès les premières semaines d'utilisation"

ZONE CENTRALE (55%) — carte blanche large, ombre douce, split vertical:
  - GAUCHE "AVANT": personne africaine authentique montrant le PROBLÈME sur (${bodyZone || 'la zone concernée du corps'}) — frustration visible, zone problématique nette et reconnaissable
    Petit badge arrondi "AVANT" dans le coin supérieur gauche de la carte — fond rouge-corail doux, texte blanc
  - SÉPARATEUR vertical: ligne fine sombre ou gradient léger entre les deux panels
  - DROITE "APRÈS": MÊME personne, MÊME angle, MÊME mise en scène — amélioration nette et crédible de la zone
    Petit badge arrondi "APRÈS" dans le coin supérieur droit — fond (${accentColor}), texte blanc
  - Les deux photos doivent paraître authentiques, photographiques, naturelles — PAS retouchées artificiellement

ZONE BASSE (25%):
  - Le produit ${productName || ''} centré, net, sur mini carte blanche
  - À côté: 3 pastilles résultats horizontales: "✓ Résultats en 3 semaines" · "✓ Testé et approuvé" · "✓ 100% Naturel"

${buildInfographicCastingInstruction({ name: productName, targetAudience, bodyZone })}
${buildInfographicLocaleInstruction(country, city)}
${PHOTO_REALISM_RULES}

TEXTE: "Avant" / "Après" parfaitement orthographiés, FRANÇAIS PARFAIT. PAS de fond sombre.
AMBIANCE: Choc visuel, preuve concrète. Le lecteur voit la différence immédiatement et y croit.
`,

  testimonials: ({ productName, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', highlightColor = '#F59E0B', targetAudience = '', country = '', city = '' }) => `
SLIDE TYPE: AVIS CLIENTS — témoignages authentiques de vraies personnes qui ont vu des résultats.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor})

ZONE HAUTE (15%):
  - Titre: "+2 300 PERSONNES ONT ESSAYÉ" en gras MAJUSCULES — chiffre en (${accentColor})
  - Sous-titre court: "Voici ce qu'ils disent"

ZONE CENTRALE (70%) — grille 2×2 de cartes avis, chacune en blanc, coins arrondis, ombre:
  CHAQUE CARTE CONTIENT:
  - Portrait rond en haut à gauche: personne africaine authentique, sourire naturel, fond dépouillé
  - Prénom + ville à droite du portrait (ex: "Fatima K. · Abidjan") — texte sombre petit
  - 5 étoiles ambrées alignées juste en dessous (${highlightColor})
  - Citation courte 12–20 mots, SPÉCIFIQUE à un résultat concret: "J'ai vu la différence en 2 semaines, mes cheveux repoussent !" — texte normal sombre
  - Optionnel: petit badge vert "✓ Achat vérifié" en bas de la carte

ZONE BASSE (15%):
  - Le produit ${productName || ''} centré, mini packshot net
  - "Rejoignez des milliers de clients satisfaits" en petit italique

${buildInfographicCastingInstruction({ name: productName, targetAudience })}
${buildInfographicLocaleInstruction(country, city)}
${PHOTO_REALISM_RULES}

TEXTE: Citations CRÉDIBLES et SPÉCIFIQUES, FRANÇAIS PARFAIT. Noms et villes du marché africain (${country || 'Côte d\'Ivoire, Sénégal, Cameroun'}). PAS de fond sombre.
AMBIANCE: Social proof abondant, chaleureux, authentique. Exactement comme une section avis Shopify premium.
`,

  reassurance: ({ productName, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', targetAudience = '', country = '', city = '' }) => `
SLIDE TYPE: CONFIANCE & FORMULE — garanties, ingrédients propres, preuves de sérieux.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor})

ZONE HAUTE (15%):
  - Titre: "POURQUOI NOUS FAIRE CONFIANCE ?" en gras (${textColor}), dernier mot en (${accentColor})

ZONE CENTRALE GAUCHE (50% largeur × 60% hauteur):
  - Le produit ${productName || ''} GRAND, net, sur carte blanche avec ombre douce
  - Lumière studio propre — tous les détails de l'emballage sont parfaitement visibles

ZONE CENTRALE DROITE (50% largeur × 60% hauteur) — checklist verticale:
  - 3 items ✓ (positif, ce que LE PRODUIT CONTIENT ou GARANTIT):
    ✓ en (${accentColor}) + texte 3–5 mots gras sombre (ex: "✓ Ingrédients 100% naturels", "✓ Formule sans danger", "✓ Testé dermatologiquement")
  - 2 items ✗ (ce que LE PRODUIT N'A PAS):
    ✗ en rouge-corail doux + texte 3–5 mots gras barré ou estompé (ex: "✗ Sans Parabène", "✗ Sans Alcool")
  - Séparation visuelle claire entre ✓ et ✗ sections

ZONE BASSE (25%):
  - Rangée horizontale de 3 mini sceaux / badges ronds: ex "🌿 Bio", "🛡 Certifié", "💧 Sans Sulfate"
  - 1 ligne de garantie: "Satisfait ou remboursé · Livraison garantie"

${buildInfographicCastingInstruction({ name: productName, targetAudience })}
${buildInfographicLocaleInstruction(country, city)}

TEXTE: Items 3–5 mots, FRANÇAIS PARFAIT. PAS de fond sombre.
AMBIANCE: Transparent, sérieux, premium. Le lecteur se sent en sécurité pour acheter.
`,

  how_to_use: ({ productName, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', targetAudience = '', country = '', city = '' }) => `
SLIDE TYPE: MODE D'EMPLOI — 3 étapes simples pour utiliser le produit et obtenir des résultats.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor})

ZONE HAUTE (15%):
  - Titre: "3 ÉTAPES SIMPLES" en gras MAJUSCULES — "3 ÉTAPES" en (${accentColor}), "SIMPLES" en (${textColor})

ZONE CENTRALE (55%) — 3 étapes verticales, chacune sur carte blanche arrondie:
  ÉTAPE 1: numéro cerclé "①" en (${accentColor}) + courte instruction (5–7 mots) + icône flat (ex: 🧴 ou 💧)
  ÉTAPE 2: numéro cerclé "②" + instruction + icône
  ÉTAPE 3: numéro cerclé "③" + instruction + icône
  - Flèche ou trait thin reliant chaque étape vers la suivante
  - Exemple adapté au produit: "① Nettoyez la zone · ② Appliquez le produit · ③ Observez les résultats"

ZONE BASSE (30%):
  - La personne africaine tenant le produit ${productName || ''} — geste naturel d'application — photo réelle
  - Sous la photo: "Usage quotidien · Résultats progressifs · Simple et efficace"

${buildInfographicCastingInstruction({ name: productName, targetAudience })}
${buildInfographicLocaleInstruction(country, city)}
${PHOTO_REALISM_RULES}

TEXTE: Instructions courtes, claires, FRANÇAIS PARFAIT. PAS de fond sombre.
AMBIANCE: Simple, actionnable, sans friction. Le lecteur sait exactement quoi faire.
`,

  cta_final: ({ productName, bgColor = '#FFF8F0', textColor = '#1C1917', accentColor = '#F59E0B', targetAudience = '', country = '', city = '' }) => `
SLIDE TYPE: CLÔTURE URGENCE — dernière slide qui crée l'urgence et synthétise la proposition de valeur.

═══ LAYOUT OBLIGATOIRE ═══
FOND: blanc cassé (${bgColor}) — propre, pas sombre

ZONE HAUTE (20%):
  - Titre 2 lignes CHOC: "NE LAISSEZ PLUS [PROBLÈME] GÂCHER VOTRE VIE" en gras MAJUSCULES — mots émotionnels en (${accentColor || '#EA580C'})
  - Sous-titre: "Des milliers de personnes ont déjà transformé leur quotidien avec ${productName || 'ce produit'}."

ZONE CENTRALE (40%) — produit en position de force:
  - Le produit ${productName || ''} GRAND, net, parfaitement centré sur carte blanche
  - Autour du produit: 4 petites pastilles rondes avec les 4 bénéfices clés (2–3 mots chacun)

ZONE BASSE (40%) — récapitulatif valeur + urgence:
  - 3 lignes de garanties / valeur avec icônes: "✓ Résultats visibles rapidement" · "🚚 Livraison rapide" · "💯 Satisfait ou Remboursé"
  - Bandeau d'urgence en bas: fond (${accentColor}) clair, texte sombre: "⚡ OFFRE LIMITÉE — COMMANDEZ MAINTENANT"
  - Petit compteur social: "🔥 127 personnes ont commandé ces 24 dernières heures"

${buildInfographicCastingInstruction({ name: productName, targetAudience })}
${buildInfographicLocaleInstruction(country, city)}

TEXTE: FRANÇAIS PARFAIT, ton urgent et émotionnel. PAS de bouton faux, PAS de prix, PAS d'URL.
AMBIANCE: Urgence, valeur, transformation. C'est la dernière image avant que le lecteur commande.
`,
};

const DEFAULT_INFOGRAPHIC_ORDER = ['problem', 'hook', 'avant_apres', 'benefits', 'testimonials', 'reassurance', 'how_to_use', 'cta_final'];

function buildInfographicPrompt(slideType, meta = {}) {
  const builder = INFOGRAPHIC_SLIDE_PROMPTS[slideType];
  if (!builder) return null;

  // Resolve color palette from preset + optional custom brand color
  const hasCustomBrandColor = meta.colorStyle === 'personnalise' && meta.brandColor && /^#[0-9a-fA-F]{6}$/i.test(meta.brandColor);
  const preset = hasCustomBrandColor
    ? buildCustomInfographicPalette(meta.brandColor)
    : (INFOGRAPHIC_COLOR_PRESETS[meta.colorStyle] || INFOGRAPHIC_COLOR_PRESETS.bleu_royal);
  const bgColor = preset.bg;
  const cardColor = preset.card || '#FFFFFF';
  const { text: textColor, accent: accentColor, highlight: highlightColor } = preset;

  const colorOverride = `COLOR PALETTE — MANDATORY:
Background: ${bgColor} (warm ivory/cream — NEVER dark) | Cards: ${cardColor} rounded with soft shadows | Headlines: ${textColor} | Accent/emphasis: ${accentColor} | Highlights: ${highlightColor}
This is a LIGHT background design. Do NOT use dark full-bleed backgrounds. Keep the look clean, bright, and airy.`;

  // Pass resolved colors to slide builder
  const enrichedMeta = { ...meta, bgColor, cardColor, textColor, accentColor, highlightColor };
  const slideBody = builder(enrichedMeta);

  return `FORMAT OVERRIDE: Generate the final image in VERTICAL 9:16 (1080×1920). Ignore any other aspect ratio mentioned.
${colorOverride}
${INFOGRAPHIC_BASE_RULES}
${INFOGRAPHIC_SMART_FUNNEL_STYLE}
${slideBody}`.trim();
}

/**
 * Generate a series of 9:16 infographic slides for a product.
 * Each slide is generated in parallel via NanoBanana image-to-image using the product reference.
 *
 * @param {object} params
 * @param {string[]} params.slideTypes - Ordered list of slide types from DEFAULT_INFOGRAPHIC_ORDER
 * @param {object} params.product - { name, description, targetAudience, painPoint, mainBenefit, bodyZone }
 * @param {Buffer} params.productImageBuffer - Reference product image buffer (required for image-to-image)
 * @param {(progress: { completed: number, total: number, type: string, order: number, ok: boolean, error?: string }) => void | Promise<void>} [params.onProgress]
 * @returns {Promise<{ infographics: Array<{ type, order, url, prompt }> }>}
 */
export async function generateInfographicsProductPage({ slideTypes, product = {}, productImageBuffer, onProgress }) {
  if (!Array.isArray(slideTypes) || slideTypes.length === 0) {
    throw new Error('slideTypes required (non-empty array)');
  }
  if (!productImageBuffer) {
    throw new Error('productImageBuffer required for image-to-image generation');
  }

  const validTypes = slideTypes.filter(t => INFOGRAPHIC_SLIDE_PROMPTS[t]);
  if (validTypes.length === 0) {
    throw new Error(`No valid slide types. Allowed: ${Object.keys(INFOGRAPHIC_SLIDE_PROMPTS).join(', ')}`);
  }

  console.log(`🎨 Generating ${validTypes.length} infographics 9:16 in parallel for product: ${product.name || '(unnamed)'}`);

  let completed = 0;
  const notifyProgress = async (payload) => {
    completed += 1;
    if (typeof onProgress === 'function') {
      await onProgress({
        completed,
        total: validTypes.length,
        ...payload,
      });
    }
  };

  const tasks = validTypes.map(async (type, index) => {
    const prompt = buildInfographicPrompt(type, product);
    try {
      const result = await generateGptImage2ImageToImage(prompt, productImageBuffer, '9:16');
      const url = Array.isArray(result?.images) ? result.images[0] : (result?.url || result);
      const slideResult = { type, order: index, url: url || null, prompt, ok: !!url };
      await notifyProgress({ type, order: index, ok: !!url, error: !url ? 'Aucune image retournée' : undefined });
      return slideResult;
    } catch (err) {
      console.warn(`⚠️ Infographic slide "${type}" failed: ${err.message}`);
      await notifyProgress({ type, order: index, ok: false, error: err.message });
      return { type, order: index, url: null, prompt, ok: false, error: err.message };
    }
  });

  const results = await Promise.all(tasks);
  const infographics = results.filter(r => r.ok).map(({ ok, error, ...rest }) => rest);
  const failed = results.filter(r => !r.ok);

  return { infographics, failed };
}

export const INFOGRAPHIC_SLIDE_TYPES = Object.keys(INFOGRAPHIC_SLIDE_PROMPTS);

export async function generateDescriptionGif(prompt, imageInput, options = {}) {
  try {
    return await generateKieImageToVideo(prompt, imageInput, {
      duration: options.duration || '6',
      resolution: options.resolution || '480p',
      aspectRatio: options.aspectRatio || '16:9',
      mode: options.mode || 'normal',
      maxWaitMs: options.maxWaitMs || 300000,
    });
  } catch (error) {
    console.error(`❌ GIF description generation failed: ${error.message}`);
    throw error;
  }
}

export async function generateDescriptionGifFromImages(imageInputs, options = {}) {
  try {
    return await generateAnimatedGifFromImages(imageInputs, {
      width: options.width || 768,
      height: options.height || 432,
      fps: options.fps || 8,
      frameDurationMs: options.frameDurationMs || 1200,
      filePrefix: options.filePrefix,
    });
  } catch (error) {
    console.error(`❌ GIF-from-images generation failed: ${error.message}`);
    throw error;
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
      mimeType: mimeType || 'image/jpeg',
      optimize: false,
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
    const rawBuffer = Buffer.from(resp.data);
    const originalKb = Math.round(rawBuffer.length / 1024);

    // Compress to WebP for fast loading — max 1080px wide, quality 80
    let compressedBuffer;
    let mimeType = 'image/webp';
    try {
      compressedBuffer = await sharp(rawBuffer)
        .resize(1080, null, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4, smartSubsample: true })
        .toBuffer();
      const compressedKb = Math.round(compressedBuffer.length / 1024);
      console.log(`🗜️ Infographic compressed: ${originalKb}KB → ${compressedKb}KB (WebP q80)`);
    } catch (compressErr) {
      console.warn(`⚠️ Compression failed, uploading original: ${compressErr.message}`);
      compressedBuffer = rawBuffer;
      mimeType = resp.headers['content-type'] || 'image/jpeg';
    }

    return await uploadBufferToR2(compressedBuffer, mimeType, workspaceId, userId);
  } catch (err) {
    console.warn(`⚠️ Download+R2 upload failed: ${err.message}`);
    return null;
  }
}
