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
import { generateAnimatedGifFromImages, generateKieImageToVideo, generateNanoBananaImage, generateNanoBananaImageToImage } from './nanoBananaService.js';
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

// ─── Étape 2 : Groq → JSON structuré ultra fiable ──────────────────

export async function analyzeWithVision(scrapedData, imageBuffers = [], marketingApproach = 'AIDA', storeContext = {}, copywritingContext = {}, visualContext = {}) {
  const groq = getGroq();
  if (!groq) throw new Error('Clé Groq API non configurée.');

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
      content: "Tu es expert e-commerce, copywriting et psychologie de l'acheteur, spécialiste marché africain. MISSION : générer une page produit complète et optimisée pour la conversion avec des visuels représentant des personnes africaines authentiques. RÈGLES ABSOLUES : 1) Analyse le produit en profondeur avant de rédiger quoi que ce soit. 2) 100% FRANÇAIS PARFAIT (sauf prompts images en anglais) — zéro faute d'orthographe, zéro faute de grammaire. 3) ZÉRO généricité. 4) ZÉRO exagération. 5) CRITIQUE problem_section : 3 vraies douleurs SPÉCIFIQUES. 6) CRITIQUE solution_section : paragraphe persuasif reliant chaque douleur au produit. 7) CRITIQUE hero_cta : bouton d'achat percutant 3-5 mots. 8) CRITIQUE stats_bar : 3 stats crédibles. 9) CRITIQUE seo : meta_title max 60 chars, meta_description max 155 chars, slug kebab-case. 10) RÈGLE GENRE OBLIGATOIRE pour toutes les images : produit FEMME → femme africaine ; produit HOMME → homme africain ; produit MIXTE → genre le plus naturel selon contexte — JAMAIS de femme par défaut pour un produit masculin ou neutre. 11) RÈGLE ZONE CORPORELLE pour toutes les images : identifier la zone exacte (cheveux, visage, corps, ventre, dents, etc.) et cadrer sur cette zone — JAMAIS le visage par défaut si le produit est pour les cheveux ou le corps. 12) LE PRODUIT LUI-MÊME (packaging, flacon, boîte) doit être visible et grand dans chaque image. 13) prompt_hero_poster = affiche graphique, produit grand sur fond sombre dramatique, SANS TITRE sur l'image, avec EXACTEMENT 3 personnes africaines réelles dans un cadre MODERNE et au moins 2 tenant le produit en main. 14) avant/après : zone correcte + genre correct + produit visible côté APRÈS. 15) angles : 4 visuels, produit visible (40%+) + zone et genre corrects. PAS de titre texte sur les images, uniquement éventuellement une courte phrase descriptive. Quand des humains sont présents dans ces visuels, privilégier EXACTEMENT 3 personnes africaines réelles avec le produit en main au lieu d'icônes ou de personnages génériques. 16) Témoignages : noms et villes adaptés au pays. 17) Le template choisi agit uniquement sur le design visuel des images, icones, fonds, ambiance et palette; il ne doit jamais inventer une promesse, une cible ou un usage produit. 18) Les consignes couleur des affiches, visuel hero, décorations, couleur des titres et couleur du contenu doivent être appliquées réellement aux visuels quand elles sont fournies. 19) Les personnes dans les images doivent ressembler a de vraies personnes photographiees: texture de peau naturelle, legere asymetrie, mains correctes, yeux et dents realistes, zero rendu plastique ou uncanny. 20) Chaque image doit illustrer exactement le texte marketing correspondant; aucun badge, icone ou scene ne doit etre decoratif sans lien direct avec le message. 21) Même si du texte est posé sur l'image, la scène doit rester explicite sans lire ce texte: le visuel seul doit raconter la situation. 22) description_optimisee = chaîne vide. 23) CONTEXTE MODERNE OBLIGATOIRE: les décors des images doivent toujours être MODERNES et HAUT DE GAMME (appartement contemporain, studio design, bureau élégant, espace urbain chic) — JAMAIS de marché, village, décor traditionnel ou rue de quartier populaire. Les personnes africaines sont dans des endroits beaux et modernes. 24) PAS DE TITRE TEXTE sur les images générées. Les prompts d'images ne doivent PAS inclure de headline/titre. 25) TOUS LES PROMPTS D'IMAGES ET TOUTE LA PAGE DOIVENT STRICTEMENT SE BASER SUR LES CARACTÉRISTIQUES IDENTIFIÉES DANS L'IMAGE FOURNIE. 26) JSON uniquement."
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
        console.log(`🔍 Tentative Groq Vision (${groqVisionModel})...`);
        response = await callGroqWithTimeout(groqVisionModel, messages, true);
      } catch (visionErr) {
        console.warn(`⚠️ Groq Vision échoué (${visionErr.message}), fallback text-only...`);
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
    console.log('📝 Groq raw response length:', raw.length);

    // Parse robuste : gère markdown, newlines littéraux, virgules traînantes
    result = parseGroqJSON(raw);
    if (!result) {
      console.warn('⚠️ Groq raw (début):', raw.slice(0, 400));
      throw new Error('Réponse IA invalide — JSON non parsable');
    }
    console.log('✅ Groq JSON parsé, clés:', Object.keys(result).join(', '));
  } catch (error) {
    console.error('❌ Groq API error:', error.message);
    // Fallback KIE (texte) pour garantir la génération même si Groq échoue
    if (isKieConfigured()) {
      try {
        console.log('🔄 Fallback KIE pour génération page produit...');
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
        if (!result) throw new Error('KIE JSON non parsable');
        console.log('✅ KIE JSON parsé, clés:', Object.keys(result).join(', '));
      } catch (kieErr) {
        console.error('❌ KIE fallback error:', kieErr.message);
        throw new Error(`Erreur IA: Groq=${error.message} | KIE=${kieErr.message}`);
      }
    } else {
      throw new Error(`Erreur Groq: ${error.message}`);
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
    const ratioPrompt = aspectRatio === '1:1'
      ? 'Square 1:1 (1080×1080) premium composition, balanced framing, full-bleed crop, ZERO empty margins.'
      : 'Vertical 4:5 (1080×1250) premium composition, tight crop, full-bleed framing, ZERO empty margins.';
    const formatOverride = aspectRatio === '1:1'
      ? 'FORMAT OVERRIDE: Generate the final image in SQUARE 1:1 (1080×1080). Ignore any previous mention of 4:5, portrait, or vertical-only framing elsewhere in the prompt.'
      : 'FORMAT OVERRIDE: Generate the final image in VERTICAL 4:5 (1080×1250). Ignore any previous mention of other aspect ratios elsewhere in the prompt.';
    console.log(`🎨 Generating ${mode} image with NanoBanana...`);

    if (!originalImageBuffer) {
      console.warn(`⚠️ Skipping ${mode} generation: missing base product image for image-to-image workflow.`);
      return null;
    }

    const heroRules = `
Create a high-converting ecommerce product hero image showing the product IN ACTION. Ultra realistic, 4K quality, sharp focus, advertising photography style.
USE EXACTLY the product appearance from the reference image provided — do NOT redraw, recreate, or redesign the product. If you cannot reproduce the EXACT same product, generate the scene WITHOUT the product rather than inventing a different one.
${ratioPrompt}

Visual style: Clean, modern, premium. The product is shown in its REAL USAGE CONTEXT — being held IN THE PERSON'S HANDS, opened, applied, used, demonstrated. NOT a static cosmetic studio pose. Contextual background matching the product category (kitchen, desk, bathroom, outdoor, gym, home, etc.). Warm natural lighting, professional quality.

PRODUCT FOCUS (CRITICAL): The product must be the absolute hero of the image — large, sharp, dominant, IN ACTION. Every detail of the product (texture, color, label, shape) must be crystal clear. The product fills at least 50% of the frame and is being actively used or demonstrated.
HERO HAND RULE: show a real person actually holding the exact product in hand. The grip, fingers and scale must feel natural and photographic.

Composition: Product dominates center or bold foreground, shown in the moment of use. Supporting elements reinforce what the product DOES. Rich visual storytelling: how this product is used, what it does, the result it creates.

Text overlay: At most one very short French benefit badge (3 words max, bold modern font) OR no text at all.
⚠️ CRITICAL SPELLING REQUIREMENT: If there is any French text in the image, it MUST be 100% PERFECT — ZERO spelling errors, ZERO grammar mistakes, ZERO typos. Every single French word must be correctly written. Double-check all accents (é, è, ê, à, ù, etc.).
NO paragraphs, NO long text, NO button, NO price, NO phone number, NO CTA, NO clutter.

Mood: Premium ecommerce, trustworthy, high-conversion, scroll-stopping — the product in its moment of action.`;

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
${aspectRatio === '1:1' ? 'Square 1:1 (1080×1080) split-screen visual specific to this product.' : 'Vertical 4:5 (1080×1250) split-screen visual specific to this product.'}

MANDATORY: feature an authentic Black African person (dark brown skin, natural African hair, African facial features). Natural expression, realistic skin and features — not fake or plastic.

Left side BEFORE: The African person clearly showing the PROBLEM or CONTEXT this product solves — visible frustration, discomfort, or issue.
Right side AFTER: The SAME African person showing the RESULT — improvement, satisfaction, confidence, glowing outcome.

Visual style: Clean, modern, premium. Professional lighting, soft shadows, studio quality. Clear visual storytelling: problem → product → result.
Tight crop, clear realistic transformation (not exaggerated). Small 'Avant'/'Après' label text in bold modern font if helpful for reading.
⚠️ CRITICAL SPELLING REQUIREMENT: The French labels 'Avant' and 'Après' MUST be spelled PERFECTLY with correct accents. NEVER write "Apres" without the accent grave (è). All French text must be 100% error-free.
NO arrows, NO heavy graphic overlays, NO empty margins, NO price, NO CTA.

Mood: Trustworthy, convincing, high-conversion, impossible to ignore in a Facebook or TikTok feed.`;

    const sceneRules = `
QUALITY: Ultra HD 4K, razor-sharp, zero blur. ${aspectRatio === '1:1' ? 'Square 1:1 (1080×1080).' : 'Vertical 4:5 (1080×1250).'}
PRODUCT REFERENCE (CRITICAL): The reference product image provided MUST be reproduced EXACTLY in the output — same packaging, same colors, same label, same shape, same size proportions. Use the EXACT visual appearance from the reference photo, do NOT recreate or redraw the product. If you cannot faithfully reproduce the EXACT same product, generate the scene WITHOUT the product rather than inventing a different one. A scene without the product is ALWAYS better than a scene with a wrong product.
PERSON: ALWAYS include authentic Black African person (dark skin, natural hair, confident expression) in a MODERN UPSCALE setting.
PRODUCT: Large, dominant, sharp, 40-60% of frame. Must match the reference image exactly.
TEXT: NO title/headline on the image. French only if any short descriptive text is needed, 100% perfect spelling with accents. Max 2 short text elements (NO title).
NO price, NO phone, NO URL, NO CTA button, NO watermark.
SETTING: MODERN and UPSCALE — contemporary apartment, design studio, sleek office, chic urban area. NEVER a market, village, or traditional setting.
CRITICAL: Follow the SPECIFIC visual style described above — unique background, unique decorations, unique mood for THIS image.`;

    const productRefRule = `
═══ PRODUCT REFERENCE — IMAGE-TO-IMAGE MANDATORY ═══
A reference image of the EXACT product is provided as input. Reproduce EXCLUSIVELY the product visible in this reference — same shape, color, packaging, label, design. Do NOT name, describe, or invent any product. The reference image is the ONLY source of truth for the product.
The product MUST appear in the generated visual. If it cannot be faithfully reproduced, generate the scene WITHOUT any product rather than inventing a different one.
`;

    let modeRules;
    if (mode === 'hero') modeRules = heroRules;
    else if (mode === 'hero_poster') modeRules = heroPosterRules;
    else if (mode === 'before_after') modeRules = beforeAfterRules;
    else modeRules = sceneRules;

    // CRITICAL: product reference rule FIRST (survives any truncation),
    // then the unique design prompt, then the mode-specific quality rules.
    const posterPrompt = `${formatOverride}
  ${productRefRule}
${promptAffiche}
${modeRules}`;

    console.log('📸 Image-to-image poster generation (with product reference)...');
    const result = await generateNanoBananaImageToImage(
      posterPrompt,
      originalImageBuffer,
      aspectRatio,
      1
    );

    return result;
  } catch (err) {
    console.warn(`⚠️ Erreur génération affiche NanoBanana: ${err.message}`);
    // STRICT: throw so upstream generateAndUpload retry logic can retry
    throw err;
  }
}

// ─── Infographics 9:16 product page ─────────────────────────────────────────

const INFOGRAPHIC_BASE_RULES = `
VERTICAL 9:16 (1080×1920) INFOGRAPHIC IMAGE for a mobile product landing page. Full-bleed, edge-to-edge, no empty margins.
USE EXACTLY the product appearance from the reference image provided — same shape, color, packaging, label, design. Do NOT redraw, recreate, or redesign the product. If you cannot reproduce the EXACT same product, generate the scene WITHOUT the product rather than inventing a different one.

VISUAL RULES:
- Authentic Black African person (dark skin, natural African features), MODERN UPSCALE setting (modern apartment, studio, clean interior) — NEVER market, village, or traditional decor.
- Real photograph look: natural skin texture, correct hands, believable expressions, zero plastic or uncanny AI feel.
- The product is OPTIONAL in benefits, testimonial, or explanatory slides. Show it only if it improves clarity or trust. If the concept is stronger without the product, omit it.
- Clean bright layout with PLENTY of whitespace, soft shadows, modern design.
- Text overlays in 100% PERFECT FRENCH — zero spelling/grammar errors, every accent correct (é è ê à ù ç).
- Text in BOLD modern sans-serif font (Montserrat/Poppins style), high contrast, easy to read on mobile.
- Dominant accent color: deep blue (#1E3A8A) for headlines, green (#84CC16) for positive highlights, red for strikethrough.
- NO fake CTA button, NO price numbers, NO phone number, NO URL, NO watermark.

TEXT SPELLING CHECK — ZERO TOLERANCE:
Every French word on the image must be perfectly spelled. Double-check: accents, agreement, spaces. If unsure, prefer shorter simpler words.
`;

const INFOGRAPHIC_SLIDE_PROMPTS = {
  hook: ({ productName, targetAudience, painPoint }) => `
SLIDE TYPE: HOOK / PROBLEM — opening slide that stops the scroll by naming the viewer's pain.

SCENE:
Authentic Black African person (match product target: ${targetAudience || 'adult, gender appropriate for the product'}) showing subtle discomfort or frustration related to: ${painPoint || 'the problem this product solves'}. Natural expression — NOT theatrical. Modern upscale interior. Soft natural lighting.
The product ${productName || ''} visible in the lower third or background, serving as a visual promise of relief.

TEXT OVERLAY (top of image, large bold):
A punchy 2-line hook in French that calls out the pain directly. Format example: "[Problème 1], [problème 2], [problème 3]? Vous méritez mieux" or "[Symptôme] vous gâche la vie?". 8-12 words max. Bold blue #1E3A8A.
Optional small badge top-left: "Livraison Gratuite" or 5-star review badge.

MOOD: Empathic, scroll-stopping, targeted. The viewer must feel "that's me".
`,

  benefits: ({ productName, mainBenefit }) => `
SLIDE TYPE: BENEFITS — communicate what the product does in one glance.

SCENE:
Create a concept-led benefit poster or infographic for ${productName || 'the product'}.
Focus on the result, relief, benefit, ingredient logic, or emotional outcome first.
The product is OPTIONAL. Do not force it into the frame if that weakens the concept. Bright clean background.

TEXT OVERLAY:
Main headline centered in bold blue #1E3A8A (2 lines max): "${mainBenefit || 'Équilibrez votre [bénéfice], retrouvez votre [résultat]'}"
Support it with 2 or 3 concise visual cues: ingredients, result icons, before/after hints, or lifestyle outcome.
Optional short subline bottom in lighter weight: a 1-line reassurance.

MOOD: Confident, bright, benefit-first. Feels aspirational but reachable. No forced centered packshot.
`,

  avant_apres: ({ productName, bodyZone }) => `
SLIDE TYPE: AVANT / APRÈS — split-screen transformation.

SCENE:
Vertical split (top = AVANT, bottom = APRÈS) OR side-by-side depending on framing — choose what shows best on 9:16.
AVANT (top/left): authentic Black African person, visible problem on ${bodyZone || 'the relevant body zone'} — realistic, subtle, NOT exaggerated.
APRÈS (bottom/right): SAME person, believable improvement on the same zone. The product ${productName || ''} visible in hand or beside, natural scale.
Small perfectly-spelled French labels "Avant" and "Après" in white on blue rounded pill.
Modern upscale interior, soft natural light, no aggressive filters.

TEXT OVERLAY (optional, small, bottom):
A 1-line result promise in bold blue #1E3A8A — 6-8 words max.

MOOD: Credible real transformation, not magical. The change must be visibly tied to the product benefit.
`,

  testimonials: ({ productName }) => `
SLIDE TYPE: AVIS CLIENTS — single group social proof scene.

SCENE:
One single natural group scene showing several authentic Black African customers together in the same moment.
They can interact naturally with ${productName || 'the product'} if it feels believable, but do not force the product if the scene is stronger without it.
No collage grid, no separate avatar cards, no fake review layout, no isolated portraits.

TEXT OVERLAY:
Optional title at top: "Ils nous ont fait confiance" in bold blue #1E3A8A.
Optional short trust line or one subtle chip such as "Des milliers de clients satisfaits".
If you add review text, keep it minimal and integrated, not as a 2×2 card grid.

MOOD: Warm, trustworthy, abundant social proof through one believable collective scene.
`,

  how_to_use: ({ productName }) => `
SLIDE TYPE: COMMENT UTILISER — simple step demonstration.

SCENE:
Authentic Black African person naturally using the product ${productName || ''} in a clean modern setting (bathroom, kitchen, bedroom — whichever matches the product category). The hand grip, scale and motion must look real. Product fully visible, correct packaging.

TEXT OVERLAY:
Title top in bold blue #1E3A8A: "Comment utiliser"
Below in regular blue/gray, a 1-2 sentence natural French instruction (12-20 words). Perfect spelling.
Optional small numbered badges (1, 2, 3) if multi-step, otherwise single clean instruction.

MOOD: Practical, reassuring, friction-removing. The viewer should think "easy, I can do this".
`,

  cta_final: ({ productName }) => `
SLIDE TYPE: CTA FINAL — closing slide that pushes to order.

SCENE:
Authentic Black African person, confident positive posture, holding the product ${productName || ''} prominently (one or both hands). Modern upscale interior with soft branded background (subtle pattern or gradient, blue/white palette with subtle botanical or geometric decoration).

TEXT OVERLAY:
Huge headline top in bold blue #1E3A8A (2-3 lines): "VOTRE MEILLEUR CHOIX EST ENTRE VOS MAINS" or a punchy close line (6-10 words, ALL CAPS).
Sub-headline bottom in slightly lighter weight: a short promise (6-10 words, sentence case) — e.g. "Régulez votre [bénéfice] pour une vie saine".

NO button drawn on the image — the actual order form is below in the page.

MOOD: Triumphant, decisive, aspirational. Scroll-stopping closer.
`,
};

const DEFAULT_INFOGRAPHIC_ORDER = ['hook', 'benefits', 'avant_apres', 'testimonials', 'how_to_use', 'cta_final'];

function buildInfographicPrompt(slideType, meta = {}) {
  const builder = INFOGRAPHIC_SLIDE_PROMPTS[slideType];
  if (!builder) return null;
  const slideBody = builder(meta);
  return `FORMAT OVERRIDE: Generate the final image in VERTICAL 9:16 (1080×1920). Ignore any other aspect ratio mentioned.
${INFOGRAPHIC_BASE_RULES}
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
 * @returns {Promise<{ infographics: Array<{ type, order, url, prompt }> }>}
 */
export async function generateInfographicsProductPage({ slideTypes, product = {}, productImageBuffer }) {
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

  const tasks = validTypes.map(async (type, index) => {
    const prompt = buildInfographicPrompt(type, product);
    try {
      const result = await generateNanoBananaImageToImage(prompt, productImageBuffer, '9:16', 1);
      const url = Array.isArray(result?.images) ? result.images[0] : (result?.url || result);
      return { type, order: index, url: url || null, prompt, ok: !!url };
    } catch (err) {
      console.warn(`⚠️ Infographic slide "${type}" failed: ${err.message}`);
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
    const ct = resp.headers['content-type'] || 'image/jpeg';
    return await uploadBufferToR2(Buffer.from(resp.data), ct, workspaceId, userId);
  } catch (err) {
    console.warn(`⚠️ Download+R2 upload failed: ${err.message}`);
    return null;
  }
}