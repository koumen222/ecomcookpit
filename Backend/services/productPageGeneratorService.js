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

export async function analyzeWithVision(scrapedData, imageBuffers = [], marketingApproach = 'AIDA', storeContext = {}, copywritingContext = {}) {
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
  
  // Extraction du contexte copywriting avancé
  const {
    angle = 'PROBLEME_SOLUTION',
    audience = '',
    reviews = '',
    socialProof = '',
    offer = '',
    objections = '',
    benefits = '',
    tone = 'urgence',
    language = 'français'
  } = copywritingContext;

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
  
  // Définition des angles copywriting avancés
  const copywritingAngles = {
    PROBLEME_SOLUTION: {
      nom: 'PROBLÈME → SOLUTION',
      description: 'Empathie avec la douleur du client, puis présentation du produit comme LA solution évidente',
      structure: 'Identifier le problème → Aggraver la douleur → Présenter la solution → Preuves et garanties'
    },
    PREUVE_SOCIALE: {
      nom: 'PREUVE SOCIALE',
      description: 'Mise en avant des résultats, avis clients, mentions virales pour créer la confiance FOMO',
      structure: 'Résultats clients → Témoignages détaillés → Stats impressionnantes → Rejoindre la communauté'
    },
    URGENCE: {
      nom: 'URGENCE / RARETÉ',
      description: 'Stock limité, offre temporaire, effet de rareté pour déclencher l\'achat immédiat',
      structure: 'Offre limitée → Compteur urgence → Bénéfices clés → Appel à l\'action immédiat'
    },
    TRANSFORMATION: {
      nom: 'TRANSFORMATION',
      description: 'Avant/après émotionnel et visuel, projection dans un nouveau style de vie',
      structure: 'Vie avant (frustration) → Découverte produit → Résultats obtenus → Nouvelle vie transformée'
    },
    AUTORITE: {
      nom: 'AUTORITÉ',
      description: 'Expertise, certifications, études, recommandations d\'experts pour établir la crédibilité',
      structure: 'Expertise prouvée → Certifications/études → Recommandations pros → Pourquoi nous faire confiance'
    }
  };
  
  const selectedAngle = copywritingAngles[angle] || copywritingAngles.PROBLEME_SOLUTION;
  
  // Construction des sections d\'informations supplémentaires
  let additionalInfo = '';
  
  if (audience) {
    additionalInfo += `\n\n🎯 CIBLE CLIENT PRIORITAIRE :\n${audience}\n`;
  }
  
  if (reviews) {
    additionalInfo += `\n\n⭐ AVIS CLIENTS À INTÉGRER :\n${reviews}\nFormate et optimise ces avis pour les rendre encore plus persuasifs.\n`;
  }
  
  if (socialProof) {
    additionalInfo += `\n\n🔗 PREUVES SOCIALES / LIENS DE RÉASSURANCE :\n${socialProof}\nUtilise ces éléments pour renforcer la crédibilité.\n`;
  }
  
  if (offer) {
    additionalInfo += `\n\n🎁 OFFRE PRINCIPALE :\n${offer}\nMets en avant cette offre de manière stratégique dans toute la page.\n`;
  }
  
  if (objections) {
    additionalInfo += `\n\n🚫 OBJECTIONS À LEVER :\n${objections}\nChaque objection doit être adressée dans la FAQ ou dans les sections de réassurance.\n`;
  }
  
  if (benefits) {
    additionalInfo += `\n\n✨ POINTS FORTS À METTRE EN AVANT :\n${benefits}\nIntègre ces bénéfices de manière naturelle dans les angles et sections.\n`;
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
- Approche marketing : ${marketingApproach}
- Angle copywriting choisi : ${selectedAngle.nom}

═══════════════════════════════════════════════
SOURCE DE CONTENU DU PRODUIT
═══════════════════════════════════════════════
TITRE : ${title || 'Non disponible'}
DESCRIPTION : ${description || 'Non disponible'}
${additionalInfo}

═══════════════════════════════════════════════
ANGLE COPYWRITING PRINCIPAL
═══════════════════════════════════════════════
🎯 ${selectedAngle.nom}
📖 ${selectedAngle.description}
📋 Structure à suivre : ${selectedAngle.structure}

🎯 OBJECTIF : Créer une page qui capte l'attention immédiatement, donne confiance, et pousse à l'achat sans friction en suivant l'angle copywriting "${selectedAngle.nom}".

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
5. ✅ Focus sur RÉSULTATS CONCRETS et TRANSFORMATION visible
6. ✅ Adaptation au marché africain : contexte local, peaux noires, climat, culture
7. ✅ Témoignages localisés avec noms africains et villes du pays cible
8. ✅ ${tone === 'urgence' ? 'Urgence psychologique : stock limité, preuve sociale, résultats rapides' : tone === 'premium' ? 'Ton premium et exclusif : qualité exceptionnelle, attention aux détails' : tone === 'fun' ? 'Ton enjoué et dynamique : énergie positive, émojis, phrases courtes' : 'Ton sérieux et professionnel : crédibilité, faits, confiance'}

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

═══ IMAGES D'ANGLES — VISUELS ILLUSTRATIFS AVEC PERSONNES AFRICAINES ═══
Les 5 images d'angles sont des visuels marketing illustratifs avec des personnes africaines et du texte qui illustre le bénéfice du produit.

🎯 OBJECTIF : Visuel percutant montrant une personne africaine qui bénéficie du produit, avec un court texte overlay qui illustre le bénéfice clé de l'angle.

✅ CE QU'IL FAUT :
- Personne africaine authentique (peau noire/marron, cheveux naturels, visage africain) en situation d'utilisation réelle du produit
- ⚠️ ADAPTE le cadrage à la ZONE DU PRODUIT : produit cheveux → cadre sur les cheveux et la chevelure ; produit corpo → cadre sur le corps ; produit visage → cadre sur le visage ; etc. Ne jamais montrer le visage par défaut si le produit n'est pas un produit visage.
- Le produit VISIBLE dans l'image ou son résultat clairement montré
- Court texte overlay en français : 1 titre court (4-6 mots max) + éventuellement 1 courte phrase (8-10 mots max)
- ⚠️ ORTHOGRAPHE PARFAITE OBLIGATOIRE : Le texte overlay doit être vérifié à 100% — ZÉRO faute d'orthographe, ZÉRO faute de grammaire, ZÉRO faute d'accord. Chaque mot doit être correctement écrit en français.
- Cadrage 1:1 serré, lumière naturelle propre, fond net
- Ambiance africaine ou universelle — jamais de contexte occidental artificiel

❌ CE QUI EST INTERDIT :
- Prix, CTA "Acheter maintenant", numéros de téléphone, URLs
- Texte long (plus de 2 éléments texte)
- Visage flou ou corps coupé de façon malvenue
- Espaces vides / marges inutiles autour du sujet

═══ VISUELS HÉRO — 2 IMAGES PRINCIPALES ═══
⚠️ Génère DEUX prompts hero différents et complémentaires pour ce produit :

**1. prompt_affiche_hero** = Photo lifestyle premium : le produit réel + personne africaine qui l'utilise ou en bénéficie. Image propre, lumineuse, fond minimaliste.

**2. prompt_hero_poster** = Affiche publicitaire graphique : le produit réel en grand au centre sur fond foncé dramatique (gradient profond) avec un titre français gras en haut ou en bas. Ambiance lancement de marque premium (style Apple/Nike adapté marché africain).

☝️ Les deux prompts doivent être entièrement basés sur CE produit spécifique — jamais générique, jamais copié des exemples.

Le HERO doit être :
✅ Le produit réel visible au premier plan (EXACT, jamais recréé), grand, net, dominant — le produit doit occuper minimum 50% du cadre
✅ RÈGLE GENRE : adapte le genre de la personne africaine au produit : produit femme → femme africaine ; produit homme → homme africain ; produit mixte → au choix selon ce qui est le plus naturel ; produit objet/tech → produit seul au premier plan sans obligation de personne
✅ RÈGLE CRITIQUE DE ZONE : adapte le cadrage à la zone exacte du produit :
   - Produit CHEVEUX → chevelure soignée/brillante ou application sur les cheveux. Cadre sur les cheveux, pas sur le visage.
   - Produit VISAGE → application sur le visage, peau du visage, teint unifié.
   - Produit CORPS → application sur bras/jambes/corps, pas un close-up visage.
   - Produit MINCEUR → silhouette, ventre ou taille visible.
   - Produit DENTS → sourire éclatant, gros plan sur les dents.
   - Produit TECH/OBJET → produit SEUL, très grand, net, dominant, fond africain ou fond épuré.
✅ Cadrage carré 1:1 tight crop, ZÉRO espace vide, lumière propre
✅ Au maximum un badge TRÈS court (3 mots max) OU absent

❌ PAS de template beauté imposé pour un produit tech ou homme
❌ PAS de femme systématique si le produit est pour homme ou mixte
❌ PAS de visage/personne non africain si des humains sont montrés
❌ PAS de cadrage trop large avec marges vides

═══ VISUEL AVANT/APRÈS — TRANSFORMATION RÉALISTE AVEC PERSONNE AFRICAINE ═══
⚠️ Le visuel avant/après est le second visuel fort. Il DOIT montrer une personne africaine authentique.

Le champ "prompt_avant_apres" doit décrire un AVANT/APRÈS SPÉCIFIQUE à CE produit :
✅ Split-screen : côté gauche = AVANT (le problème concret que CE produit résout, personne africaine)
✅ Côté droit = APRÈS (le résultat réel et crédible après utilisation, même personne africaine)
✅ Personne africaine OBLIGATOIRE : peau noire/marron, traits africains authentiques
✅ RÈGLE GENRE : FEMME africaine si produit féminin ; HOMME africain si produit masculin ; adapte si mixte
✅ Le PRODUIT LUI-MÊME doit être clairement visible sur le côté APRÈS (flacon, boîte, packaging exact)
✅ Cadrage carré 1:1, serré, transformation réaliste (pas exagérée)
✅ Petit label "Avant" / "Après" accepté si utile à la lecture

⚠️ RÈGLE CRITIQUE : le cadrage de l'avant/après DOIT correspondre à la ZONE DU PRODUIT :
- Produit CHEVEUX → AVANT : cheveux secs/abîmés/crépus difficiles à coiffer (gros plan sur la chevelure) → APRÈS : cheveux brillants/hydratés/soyeux. JAMAIS faire un avant/après de la peau du visage pour un produit cheveux.
- Produit VISAGE / PEAU VISAGE → AVANT : peau terne/taches/boutons (close-up visage) → APRÈS : teint unifié/lumineux/net.
- Produit CORPS / LOTION → AVANT : peau sèche du corps (bras, jambes) → APRÈS : peau douce et éclairée.
- Produit MINCEUR → AVANT : silhouette africaine avec ventre prononcé → APRÈS : silhouette affinée avec taille marquée.
- Produit ÉNERGIE → AVANT : personne africaine fatiguée, molle → APRÈS : personne africaine dynamique, souriante.
- Produit DENTS → AVANT : dents jaunies (gros plan bouche) → APRÈS : dents blanches et sourire éclatant.
- Produit NETTOYAGE → AVANT : surface sale → APRÈS : surface propre et brillante.

═══ FORMAT JSON STRICT ═══
{
  "title": "Titre produit TRÈS GRAND et dominant visuellement (8-15 mots) basé sur la promesse principale + bénéfice clé",
  "hero_headline": "PROMESSE PRINCIPALE ULTRA FORTE EN MAJUSCULES (4-6 mots max) — Ex: MOINS D'ODEURS, PLUS DE CONFIANCE",
  "hero_slogan": "Sous-titre orienté TRANSFORMATION + bénéfice émotionnel — Ex: Une vie intime libérée et sereine",
  "hero_baseline": "Phrase de réassurance courte avec résultat rapide — Ex: Résultats visibles en quelques jours",
  "benefits_bullets": [
    "💐 Bénéfice concret 1 avec emoji pertinent",
    "💖 Bénéfice concret 2 avec emoji pertinent",
    "👩‍⚕️ Bénéfice concret 3 avec emoji pertinent",
    "💧 Bénéfice concret 4 avec emoji pertinent",
    "🛡️ Bénéfice concret 5 avec emoji pertinent",
    "⏱️ Bénéfice concret 6 avec emoji pertinent",
    "✅ Bénéfice concret 7 avec emoji pertinent"
  ],
  "prompt_affiche_hero": "[Generate in English: HIGH-IMPACT ecommerce hero image for THIS SPECIFIC product (describe its exact name, type, color, packaging). Ultra realistic, 4K, advertising photography. The product is the STAR — show it LARGE, sharp, dominant in the frame (minimum 60% of the frame). GENDER RULE: if this is a women's product → authentic Black AFRICAN WOMAN; if men's product → authentic Black AFRICAN MAN; if unisex → choose the most natural fit; if it's an object/tech → product alone as hero, no person required. ZONE RULE: HAIR product → frame on hair/scalp being treated or showing great results — NEVER face-focused; FACE product → face/skin close-up; BODY LOTION → arms/legs/body; SLIMMING → waist/silhouette; TEETH → bright smile. The product packaging MUST be clearly visible and recognizable. Clean premium background (pure white or soft beige). Professional softbox lighting, depth of field. Optional short French benefit badge (3 words max) — CRITICAL: PERFECT French spelling with all accents. No CTA, no price. Scroll-stopping catalog quality.]",
  "prompt_hero_poster": "[Generate in English: BOLD ADVERTISING POSTER for THIS SPECIFIC product (describe its exact name, type, color, packaging). Square 1:1 graphic-design meets product photography. The product shown LARGE, dominant, perfectly sharp (min 50% of frame), exact same packaging/color/shape. Premium dark gradient background (deep midnight blue to black, OR deep forest green to charcoal, or deep burgundy — choose what contrasts best with product colors). Dramatic cinematic lighting with product glow. MANDATORY: 1 bold French headline in large modern sans-serif font at top or bottom — CRITICAL: French text MUST be 100% perfectly spelled with all accents. Optional thin accent line or minimal graphic element. NO price, NO phone, NO fake button, NO URL. Mood: aspirational, premium brand launch poster, scroll-stopping. Think Apple product launch. Adapted for African market.]",
  "prompt_avant_apres": "[Generate in English: Square 1:1 split-screen before/after transformation for THIS SPECIFIC product (name it exactly, describe what it does). GENDER RULE: use an African WOMAN for women's products, an African MAN for men's products, or the most fitting gender for unisex. MANDATORY: authentic Black African person (dark brown skin, natural African hair, African features, realistic skin). ZONE RULE — focus on the CORRECT body zone: HAIR product → LEFT = dry/damaged/dull African hair (close-up on hair), RIGHT = same African hair healthy, shiny, well-styled — NEVER a face skincare concept; FACE/SKIN product → close-up face before/after; BODY LOTION → arms or legs before/after; SLIMMING → belly/waist silhouette before/after; ENERGY → full body tired vs energetic. The PRODUCT (exact packaging, bottle, box) MUST be clearly visible on the RIGHT side (AFTER). Professional lighting, 4K quality. Small bold 'Avant'/'Après' labels if helpful — CRITICAL: 'Après' with accent always. No arrows, no heavy overlays. High-conversion, scroll-stopping.]",
  "angles": [
    {
      "titre_angle": "Phrase complète de 10-15 mots expliquant concrètement le bénéfice (PAS de titre court, PAS de slogan de 2-3 mots)",
      "explication": "3-4 phrases concrètes et persuasives. Décris comment ce bénéfice spécifique se manifeste dans la vie réelle. Reste crédible et factuel, sans exagération.",
      "message_principal": "1 phrase d'accroche mémorable spécifique à ce bénéfice",
      "promesse": "La transformation concrète que l'utilisateur va vivre",
      "prompt_affiche": "Scroll-stopping ecommerce ad image, square 1:1, ultra realistic, 4K: [Describe in English: GENDER RULE — authentic Black African WOMAN if women's product, authentic Black African MAN if men's product, or most natural fit if unisex; if object/tech product show the product alone without person. The person (if present) ACTIVELY using or directly benefiting from THIS specific product. ZONE RULE: HAIR product → frame on hair/scalp — NEVER face scene; FACE/SKIN → close-up face; BODY LOTION → arms/legs/body; SLIMMING → waist/silhouette; TEETH → smile. THE PRODUCT itself (exact packaging/bottle/box) MUST be clearly visible and large in the frame (at least 40% of the image). Clean premium African studio setting, professional lighting, soft shadows, depth of field. Bold French headline (4-5 words max) at top or bottom — CRITICAL: PERFECT French spelling with all accents. ZERO spelling errors. No price, no phone, no CTA, no URL. Premium, high-conversion mood.]"
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
      "name": "Prénom N. (nom africain crédible)",
      "location": "${testimonialLocationTemplate}",
      "rating": 5,
      "text": "Témoignage réaliste et spécifique (2-3 phrases). Bénéfice concret ressenti. Langage local naturel (comme WhatsApp). Résultat concret mentionné.",
      "verified": true,
      "date": "Il y a X jours/semaines",
      "image": ""
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

⚠️ EXACTEMENT 5 angles, 7 bénéfices avec emojis, 4 raisons, 7 questions FAQ (avec réponses VISIBLES directement), 4 témoignages.
⚠️ benefits_bullets : 7 bénéfices DIRECTS avec emojis pertinents — texte simple, compréhensible, sans jargon.
⚠️ problem_section.pain_points : 3 points de douleur CONCRETS et SPÉCIFIQUES à CE produit — jamais génériques.
⚠️ solution_section.description : paragraphe persuasif 3-4 phrases, relie chaque douleur à un bénéfice du produit.
⚠️ stats_bar : 3 stats crédibles et adaptées au produit (clients, résultats, garantie).
⚠️ hero_cta : bouton d'achat percutant, actionnable, 3-5 mots.
⚠️ urgency_badge : badge court et percutant pour déclencher l'urgence psychologique.
⚠️ offer_block.guarantee_text : phrase de garantie rassurante et crédible pour CE marché.
⚠️ seo.meta_title : max 60 caractères, bénéfice principal + produit${storeCountry ? ` + ${storeCountry}` : ''}.
⚠️ seo.meta_description : max 155 caractères, accrocheur et informatif.
⚠️ seo.slug : URL en kebab-case, sans accents, max 6 mots, ex: "creme-eclaircissante-peau-noire".
⚠️ FAQ : Les questions doivent couvrir : Quand voir résultats ? Est-ce naturel ? Effets secondaires ? Peut-on combiner ? Livraison ? Paiement à la livraison ? + 1 question spécifique au produit.
⚠️ FAQ : Les réponses doivent être SIMPLES, RASSURANTES, SANS JARGON — affichées directement (pas de dropdown fermé).
⚠️ guide_utilisation.applicable = false si le produit n'a pas besoin d'explication.
⚠️ Adapte prompt_avant_apres au PROBLÈME RÉEL que résout CE produit spécifique.
⚠️ description_optimisee doit toujours être une chaîne vide car la page commence directement par les angles marketing.
⚠️ ORTHOGRAPHE PARFAITE : zéro faute d'orthographe, zéro faute de grammaire, zéro faute de conjugaison dans TOUT le contenu français.
⚠️ TÉMOIGNAGES : prénoms africains et villes doivent correspondre au pays de la boutique (${storeCountry || 'Afrique de l\'Ouest'}). Langage naturel local.
⚠️ URGENCE : Intégrer éléments psychologiques (stock limité, preuve sociale, résultats rapides).
⚠️ JSON uniquement. Pas d'explication. Pas de texte avant/après.`;

  const messages = [
    {
      role: "system",
      content: "Tu es expert e-commerce, copywriting et psychologie de l'acheteur, spécialiste marché africain. MISSION : générer une page produit complète et optimisée pour la conversion avec des visuels représentant des personnes africaines authentiques. RÈGLES ABSOLUES : 1) Analyse le produit en profondeur avant de rédiger quoi que ce soit. 2) 100% FRANÇAIS PARFAIT (sauf prompts images en anglais) — zéro faute d'orthographe, zéro faute de grammaire. 3) ZÉRO généricité. 4) ZÉRO exagération. 5) CRITIQUE problem_section : 3 vraies douleurs SPÉCIFIQUES. 6) CRITIQUE solution_section : paragraphe persuasif reliant chaque douleur au produit. 7) CRITIQUE hero_cta : bouton d'achat percutant 3-5 mots. 8) CRITIQUE stats_bar : 3 stats crédibles. 9) CRITIQUE seo : meta_title max 60 chars, meta_description max 155 chars, slug kebab-case. 10) RÈGLE GENRE OBLIGATOIRE pour toutes les images : produit FEMME → femme africaine ; produit HOMME → homme africain ; produit MIXTE → genre le plus naturel selon contexte — JAMAIS de femme par défaut pour un produit masculin ou neutre. 11) RÈGLE ZONE CORPORELLE pour toutes les images : identifier la zone exacte (cheveux, visage, corps, ventre, dents, etc.) et cadrer sur cette zone — JAMAIS le visage par défaut si le produit est pour les cheveux ou le corps. 12) LE PRODUIT LUI-MÊME (packaging, flacon, boîte) doit être visible et grand dans chaque image. 13) prompt_hero_poster = affiche graphique, produit grand sur fond sombre dramatique, titre français gras. 14) avant/après : zone correcte + genre correct + produit visible côté APRÈS. 15) angles : 4 visuels, produit visible (40%+) + texte overlay français + zone et genre corrects. 16) Témoignages : noms et villes adaptés au pays. 17) description_optimisee = chaîne vide. 18) JSON uniquement."
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
  const GROQ_TIMEOUT_MS = 120000; // 2 minutes max par tentative

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
        console.log('🔍 Tentative Groq Vision (meta-llama/llama-4-scout-17b-16e-instruct)...');
        response = await callGroqWithTimeout('meta-llama/llama-4-scout-17b-16e-instruct', messages, true);
      } catch (visionErr) {
        console.warn(`⚠️ Groq Vision échoué (${visionErr.message}), fallback text-only...`);
        // Fallback text-only : remplacer le contenu image par du texte
        const textOnlyMessages = [
          messages[0],
          { role: 'user', content: typeof messages[1].content === 'string' ? messages[1].content : messages[1].content[0]?.text || userPrompt }
        ];
        response = await callGroqWithTimeout('llama-3.3-70b-versatile', textOnlyMessages, false);
      }
    } else {
      response = await callGroqWithTimeout('llama-3.3-70b-versatile', messages, false);
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
    throw new Error(`Erreur Groq: ${error.message}`);
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
      },
      {
        titre_angle: `Ce ${title || 'produit'} offre un rapport qualité-prix imbattable pour un usage quotidien`,
        explication: `Ce ${title || 'produit'} combine performance et accessibilité, offrant une solution premium sans compromis sur votre budget. Un investissement rentable sur le long terme.`,
        message_principal: "Le meilleur rapport qualité-prix du marché",
        promesse: "La qualité premium accessible à tous",
        prompt_affiche: `Square 1:1 lifestyle scene showing satisfaction and value around the ${title || 'product'}. Person smiling, product visible and prominent, everyday authentic African setting, professional lighting, no text overlay, no promotional elements.`
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
Create a high-converting ecommerce product hero image. Ultra realistic, 4K quality, sharp focus, advertising photography style.
USE THE EXACT REAL PRODUCT IMAGE PROVIDED — NEVER invent, recreate or redesign the product.
Square 1:1 premium composition, tight crop, full-bleed framing, ZERO empty margins.

Visual style: Clean, modern, premium brand aesthetic. Minimalist background (pure white, soft beige, or warm pastel contextual). Strong product spotlight. Professional lighting setup: softbox overhead + two rim lights creating product depth. Studio quality, sharp textures, vivid yet accurate colors.

PRODUCT FOCUS (CRITICAL): The product must be the absolute hero of the image — large, sharp, dominant. Every detail of the product (texture, color, label, shape) must be crystal clear. The product fills at least 60% of the frame.

Human element (MANDATORY if the product is used by a person — beauty, health, wellness, fitness, food):
Include an authentic Black African model (dark brown skin, natural African hair, African facial features). Natural expression showing confidence and satisfaction. Realistic skin and features — not fake or plastic. The model INTERACTS with the product — holding it, applying it, using it — so both are clearly visible.

Composition: Product dominates center or bold foreground. Supporting elements reinforce the product context. Rich visual storytelling: what this product does, who uses it, what result it creates.

Text overlay: At most one very short French benefit badge (3 words max, bold modern font) OR no text at all. Optional small "BEST SELLER" or "NOUVEAU" badge.
⚠️ CRITICAL SPELLING REQUIREMENT: If there is any French text in the image, it MUST be 100% PERFECT — ZERO spelling errors, ZERO grammar mistakes, ZERO typos. Every single French word must be correctly written. Double-check all accents (é, è, ê, à, ù, etc.).
NO paragraphs, NO long text, NO button, NO price, NO phone number, NO CTA, NO clutter.

Mood: Premium ecommerce catalog, trustworthy, high-conversion, scroll-stopping, impossible to ignore.`;

    const heroPosterRules = `
Create a bold, visually striking advertising poster for THIS specific product. Premium graphic design meets ultra-realistic product photography.
USE THE EXACT REAL PRODUCT IMAGE PROVIDED — NEVER invent, recreate or redesign the product.
Square 1:1, dramatic full-bleed composition, ZERO empty margins.

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

Typography (MANDATORY — 1 headline only):
1 bold French headline (4-6 words MAX) in modern graphic sans-serif font, positioned prominently at top or bottom.
The text must be in high contrast to background (white text on dark, or dark text on light).
CRITICAL SPELLING: French text MUST be 100% perfectly spelled — every accent, every letter. NEVER misspell a French word.
Optional: 1 short French subline (6-8 words max) in lighter weight.

NO price, NO phone number, NO URL, NO fake CTA button.

Mood: Bold, aspirational, premium brand launch — think Apple product launch poster or Nike campaign, adapted for the African market. Scroll-stopping, impossible to ignore in a social media feed.`;

    const beforeAfterRules = `
Create a high-converting before/after product transformation image. Ultra realistic, 4K quality, sharp focus, advertising photography style.
Square 1:1 split-screen visual specific to this product.

MANDATORY: feature an authentic Black African person (dark brown skin, natural African hair, African facial features). Natural expression, realistic skin and features — not fake or plastic.

Left side BEFORE: The African person clearly showing the PROBLEM or CONTEXT this product solves — visible frustration, discomfort, or issue.
Right side AFTER: The SAME African person showing the RESULT — improvement, satisfaction, confidence, glowing outcome.

Visual style: Clean, modern, premium. Professional lighting, soft shadows, studio quality. Clear visual storytelling: problem → product → result.
Tight crop, clear realistic transformation (not exaggerated). Small 'Avant'/'Après' label text in bold modern font if helpful for reading.
⚠️ CRITICAL SPELLING REQUIREMENT: The French labels 'Avant' and 'Après' MUST be spelled PERFECTLY with correct accents. NEVER write "Apres" without the accent grave (è). All French text must be 100% error-free.
NO arrows, NO heavy graphic overlays, NO empty margins, NO price, NO CTA.

Mood: Trustworthy, convincing, high-conversion, impossible to ignore in a Facebook or TikTok feed.`;

    const sceneRules = `
Create a scroll-stopping ecommerce ad image. Ultra realistic, 4K quality, sharp focus, advertising photography style.
Square 1:1 illustrative marketing visual, tight crop, subject fills the entire frame, ZERO empty space.

Visual style: Clean, modern, premium brand aesthetic. Minimalist or contextual African environment. Professional lighting with soft shadows. Depth of field for a premium look.

PRODUCT VISIBILITY (CRITICAL): The product MUST be clearly visible, large, and sharp in the image. It should be recognizable, prominent, and take up significant space in the frame. Every detail — color, texture, label — must be visible.

Human element (MANDATORY): Include an authentic Black African model (dark brown skin, natural African hair, African facial features). Natural expression showing confidence, satisfaction, or the benefit of the product. Realistic skin and features — not fake or plastic. The person is ACTIVELY interacting with or benefiting from the product.

Composition: Rich visual storytelling — show the CONTEXT (problem or need) → PRODUCT as clear solution → visible RESULT on the person. Product and person together in the same tight frame, both clearly visible.

Text overlay (modern bold font): 1 bold French headline (4-5 words max) capturing the key benefit at the top or bottom. Optional supporting line (8 words max). Optional small badge: "BEST SELLER" or "NOUVEAU".
⚠️ CRITICAL SPELLING REQUIREMENT: All French text in the image MUST be 100% PERFECT — ZERO spelling errors, ZERO grammar mistakes, ZERO missing accents (é, è, ê, à, ç, ù, etc.). Every French word must be correctly written and properly accented. This is MANDATORY and NON-NEGOTIABLE.
NO price, NO phone number, NO CTA button, NO URL. Keep it clean.

Mood: Trustworthy, premium, high-conversion ecommerce ad, clean and attractive, impossible to ignore in a Facebook or TikTok feed.
Strong emotional impact. Eye-catching composition. Clear problem → solution → result.`;

    const productRefRule = originalImageBuffer
      ? `\nCRITICAL: A reference image of the EXACT real product is provided. You MUST include THIS SPECIFIC product (same shape, color, packaging, design) in the generated image. NEVER invent, replace, or redesign the product. The product in the output MUST be recognizably the same as the reference.\n`
      : `\nIMPORTANT: No product reference image is provided. Do NOT invent or hallucinate any product, packaging, bottle or box. If the scene directive does not explicitly ask for a product, generate the scene WITHOUT any product visible.\n`;

    let modeRules;
    if (mode === 'hero') modeRules = heroRules;
    else if (mode === 'hero_poster') modeRules = heroPosterRules;
    else if (mode === 'before_after') modeRules = beforeAfterRules;
    else if (mode === 'scene' && !originalImageBuffer) {
      // Pas d'image de référence : supprimer l'injonction de montrer le produit
      modeRules = sceneRules
        .replace(/PRODUCT VISIBILITY \(CRITICAL\):.*?\n\n/s, '')
        .replace(/The person is ACTIVELY interacting with or benefiting from the product\./,
          'The person shows confidence, satisfaction or the benefit associated with the product category.');
    } else modeRules = sceneRules;

    const posterPrompt = `${promptAffiche}
${productRefRule}
${modeRules}`;

    let result;

    if (originalImageBuffer) {
      console.log('📸 Image-to-image poster generation (with product reference)...');
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