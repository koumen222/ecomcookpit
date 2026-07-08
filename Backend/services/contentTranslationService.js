// ─── Traduction du CONTENU produit selon la langue de la boutique ─────────────
// Architecture : traduction paresseuse + cache.
// 1. Le storefront demande un produit ; la boutique a une langue (storeSettings.language).
// 2. Si le contenu stocké n'est pas dans cette langue, on le traduit via LLM (Groq),
//    on met le résultat en cache sur le document (contentTranslations.{lang}),
//    et on sert la version traduite. Les visites suivantes lisent le cache.
// 3. Invalidation automatique : le cache porte un hash du contenu source ;
//    si le produit est modifié/régénéré, le hash change → retraduction.
// En cas d'échec LLM, on sert le contenu original (jamais de page cassée).

import crypto from 'crypto';
import Groq from 'groq-sdk';
import StoreProduct from '../models/StoreProduct.js';
import { callKieChatCompletion, extractKieContent, isKieConfigured } from './kieChatService.js';

let _groq = null;
function getGroq() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

const LANG_NAMES = { fr: 'French', en: 'English', es: 'Spanish' };

export function normalizeContentLang(value) {
  const raw = String(value || '').trim().toLowerCase().slice(0, 2);
  return ['fr', 'en', 'es'].includes(raw) ? raw : 'fr';
}

// Champs produit dont le texte est traduisible (subset servi au storefront)
const TRANSLATABLE_FIELDS = ['name', 'description', 'seoTitle', 'seoDescription', 'features', 'faq', 'testimonials', '_pageData'];

// Clés JSON à NE PAS traduire (données techniques, visuels, identifiants, prompts image en anglais)
const SKIP_KEY_PATTERN = /(url|urls|image|images|photo|photos|video|videos|gif|poster|href|link|slug|id$|_id|uuid|token|code|hex|color|colour|couleur|primary|accent|background|surface|icon|icons|emoji|font|phone|whatsapp|email|currency|price|prix|montant|date|prompt|style|theme|template|layout|mode|align|position|variant|animation|type|status|key|name$)/i;
// Exceptions : ces clés se terminent par des mots skippés mais SONT du contenu
const FORCE_TRANSLATE_KEYS = new Set(['name', 'productName', 'question', 'reponse', 'answer', 'text', 'title', 'label', 'description', 'content']);

const looksLikeUrl = (v) => /^(https?:\/\/|data:|\/|www\.)/i.test(v);
const looksLikeHexColor = (v) => /^#[0-9a-fA-F]{3,8}$/.test(v);
const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const looksLikeEnum = (v) => /^[a-z0-9_-]{1,24}$/.test(v); // identifiants techniques sans espaces
const hasLetters = (v) => /[A-Za-zÀ-ÿ]{2}/.test(v);

function isTranslatableString(key, value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 2 || v.length > 4000) return false;
  if (!hasLetters(v)) return false;
  if (looksLikeUrl(v) || looksLikeHexColor(v) || looksLikeEmail(v)) return false;
  if (looksLikeEnum(v) && !FORCE_TRANSLATE_KEYS.has(key)) return false;
  if (SKIP_KEY_PATTERN.test(key) && !FORCE_TRANSLATE_KEYS.has(key)) return false;
  return true;
}

/** Parcourt le JSON et collecte les chaînes traduisibles avec leur chemin. */
export function collectStrings(node, key = '', path = [], out = []) {
  if (typeof node === 'string') {
    if (isTranslatableString(key, node)) out.push({ path: [...path], value: node });
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectStrings(item, key, [...path, index], out));
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      collectStrings(v, k, [...path, k], out);
    }
  }
  return out;
}

function setAtPath(root, path, value) {
  let node = root;
  for (let i = 0; i < path.length - 1; i += 1) node = node[path[i]];
  node[path[path.length - 1]] = value;
}

/** Traduit un lot de chaînes via le LLM (KIE prioritaire, Groq en secours) — ordre préservé. */
async function translateBatch(strings, targetLang) {
  const langName = LANG_NAMES[targetLang] || 'English';
  const messages = [
    {
      role: 'system',
      content: `You are a professional e-commerce translator. Translate every item of the JSON array the user sends into ${langName}. Rules: return ONLY a valid JSON array of strings, same length and same order. Keep emojis, numbers, placeholders like {total} or {{name}}, brand names and product names' proper nouns. Natural, selling, culturally adapted ${langName}. No explanations.`,
    },
    { role: 'user', content: JSON.stringify(strings) },
  ];

  let raw = '';
  if (isKieConfigured()) {
    const data = await callKieChatCompletion({ messages, temperature: 0.2, maxTokens: 8000, reasoningEffort: 'low', timeoutMs: 60000 });
    raw = extractKieContent(data) || '[]';
  } else {
    const groq = getGroq();
    if (!groq) throw new Error('Aucun fournisseur LLM configuré (KIE_API_KEY ou GROQ_API_KEY)');
    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      temperature: 0.2,
      max_tokens: 8000,
      messages,
    });
    raw = response?.choices?.[0]?.message?.content || '[]';
  }
  const match = raw.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(match ? match[0] : raw);
  if (!Array.isArray(parsed) || parsed.length !== strings.length) {
    throw new Error(`Lot de traduction invalide (${Array.isArray(parsed) ? parsed.length : 'non-array'}/${strings.length})`);
  }
  return parsed.map((v, i) => (typeof v === 'string' && v.trim() ? v : strings[i]));
}

/** Traduit toutes les chaînes d'un objet JSON (par lots), renvoie une copie profonde. */
export async function translateJson(source, targetLang, { batchSize = 60 } = {}) {
  const clone = JSON.parse(JSON.stringify(source));
  const entries = collectStrings(clone);
  if (entries.length === 0) return clone;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const translated = await translateBatch(batch.map((e) => e.value), targetLang);
    batch.forEach((entry, j) => setAtPath(clone, entry.path, translated[j]));
  }
  return clone;
}

function buildTranslatableSubset(product) {
  const subset = {};
  for (const field of TRANSLATABLE_FIELDS) {
    if (product[field] !== undefined && product[field] !== null) subset[field] = product[field];
  }
  return subset;
}

const hashOf = (obj) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');

// ── Détection de la langue du contenu (produits sans `locale` — ex: générés avant le patch) ──
const LANG_MARKERS = {
  fr: /\b(le|la|les|des|une|pour|avec|votre|vos|est|dans|plus|qui|sans|chez|dès)\b/g,
  en: /\b(the|your|for|with|and|this|that|are|from|our|you|of|to|is)\b/g,
  es: /\b(el|los|las|para|con|una|este|esta|tu|sus|más|del|es|en)\b/g,
};

export function detectContentLang(subset) {
  const text = collectStrings(JSON.parse(JSON.stringify(subset)))
    .map((e) => e.value).join(' ').toLowerCase().slice(0, 8000);
  if (!text.trim()) return 'fr';
  let best = 'fr';
  let bestScore = -1;
  for (const [lang, rx] of Object.entries(LANG_MARKERS)) {
    const score = (text.match(rx) || []).length;
    if (score > bestScore) { best = lang; bestScore = score; }
  }
  return best;
}

/**
 * Point d'entrée : renvoie le produit avec son contenu dans la langue cible.
 * - langue de base du contenu : product.locale (défaut fr)
 * - cache : product.contentTranslations[lang] = { hash, data, updatedAt }
 * - échec LLM → contenu original (log en console)
 */
export async function applyProductTranslation(product, targetLangRaw) {
  if (!product) return product;
  const targetLang = normalizeContentLang(targetLangRaw);

  const subset = buildTranslatableSubset(product);
  if (Object.keys(subset).length === 0) return product;

  // Langue de base : locale explicite, sinon détection sur le contenu (persistée — auto-réparation
  // des produits générés avant l'enregistrement de la locale).
  let baseLang;
  if (product.locale) {
    baseLang = normalizeContentLang(product.locale);
  } else {
    baseLang = detectContentLang(subset);
    StoreProduct.updateOne({ _id: product._id }, { $set: { locale: baseLang } })
      .catch(() => {});
    console.log(`🔎 [content-i18n] locale détectée pour ${product.slug || product._id}: ${baseLang}`);
  }
  if (targetLang === baseLang) return product;
  const sourceHash = hashOf(subset);

  const cached = product.contentTranslations?.[targetLang];
  if (cached?.hash === sourceHash && cached.data) {
    return { ...product, ...cached.data };
  }

  try {
    const started = Date.now();
    const translated = await translateJson(subset, targetLang);
    console.log(`🌍 [content-i18n] ${product.slug || product._id} → ${targetLang} (${collectStrings(JSON.parse(JSON.stringify(subset))).length} chaînes, ${Date.now() - started}ms)`);

    // Cache non bloquant sur le document
    StoreProduct.updateOne(
      { _id: product._id },
      { $set: { [`contentTranslations.${targetLang}`]: { hash: sourceHash, data: translated, updatedAt: new Date() } } }
    ).catch((err) => console.warn('[content-i18n] cache non sauvegardé:', err.message));

    return { ...product, ...translated };
  } catch (err) {
    console.warn(`⚠️ [content-i18n] traduction ${targetLang} échouée pour ${product.slug || product._id}: ${err.message} — contenu original servi`);
    return product;
  }
}
