// ─────────────────────────────────────────────────────────────────────────────
// Clonage de page produit concurrent (Creative Center / Boutique).
//
// Coller une URL concurrente → 1) extraction de la structure et des infos
// (titre, prix, description, images, specs), 2) l'IA RÉÉCRIT une fiche
// ORIGINALE (nom, description, bénéfices, FAQ, avis — jamais du copier-coller :
// meilleur SEO et pas de contenu dupliqué), 3) régénération d'images produit
// SIMILAIRES mais neuves par IA (image-to-image sur les visuels concurrents →
// même produit, rendu studio original, sans texte/watermark repris).
//
// Le résultat est un APERÇU éditable ; la création du StoreProduct se fait
// ensuite via la route de sauvegarde (permissions/store gérés là).
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';
import { parseAiJson } from '../utils/aiJson.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Jobs de clonage en mémoire (TTL 30 min), comme les autres pipelines ──
const cloneJobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, j] of cloneJobs) { if (now - j.createdAt > JOB_TTL_MS) cloneJobs.delete(id); }
}, 5 * 60 * 1000).unref?.();

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

// Heuristique : écarte logos, icônes, sprites, pixels de tracking, SVG…
function isLikelyProductImage(url) {
  const u = String(url || '').split('?')[0].toLowerCase();
  if (!/^https?:\/\//.test(u)) return false;
  if (/\.svg($|\?)/.test(u)) return false;
  if (/(sprite|logo|icon|favicon|placeholder|loader|spinner|badge|payment|visa|mastercard|paypal|trustpilot|star|rating|flag|avatar|thumb_\d|1x1|pixel)/.test(u)) return false;
  return /\.(jpe?g|png|webp|avif)($|\?)/.test(u) || /\/(cdn|images?|media|products?|uploads?)\//.test(u);
}

function absolutize(src, base) {
  try { return new URL(src, base).href; } catch { return null; }
}

/**
 * Scraper GÉNÉRIQUE : node-fetch du HTML + parse JSDOM. Priorité au JSON-LD
 * schema.org/Product (fiable sur Shopify/WooCommerce/la plupart des boutiques),
 * repli sur les balises Open Graph, <h1>, meta, et une collecte d'images.
 */
export async function scrapeCompetitorPage(url) {
  const { JSDOM } = await import('jsdom');
  const res = await axios.get(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
    timeout: 15000,
    maxRedirects: 5,
    responseType: 'text',
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const html = String(res.data || '');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const base = url;

  const meta = (sel, attr = 'content') => doc.querySelector(sel)?.getAttribute(attr) || '';
  const out = { title: '', description: '', price: null, currency: '', images: [], specs: [], rawText: '' };

  // 1. JSON-LD Product (source la plus structurée)
  for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      let data = JSON.parse(node.textContent);
      const arr = Array.isArray(data) ? data : (Array.isArray(data['@graph']) ? data['@graph'] : [data]);
      const prod = arr.find((d) => {
        const t = d && d['@type'];
        return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
      });
      if (prod) {
        out.title = out.title || String(prod.name || '');
        out.description = out.description || String(prod.description || '');
        const imgs = Array.isArray(prod.image) ? prod.image : (prod.image ? [prod.image] : []);
        for (const im of imgs) { const u = absolutize(typeof im === 'string' ? im : im?.url, base); if (u) out.images.push(u); }
        const offers = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers;
        if (offers) { out.price = out.price ?? (Number(offers.price) || null); out.currency = out.currency || String(offers.priceCurrency || ''); }
      }
    } catch { /* bloc JSON-LD invalide ignoré */ }
  }

  // 2. Open Graph + fallbacks HTML
  out.title = out.title || meta('meta[property="og:title"]') || doc.querySelector('h1')?.textContent?.trim() || doc.title || '';
  out.description = out.description || meta('meta[property="og:description"]') || meta('meta[name="description"]') || '';
  const ogImg = meta('meta[property="og:image"]');
  if (ogImg) { const u = absolutize(ogImg, base); if (u) out.images.push(u); }

  // 3. Balises <img> du corps (les plus grandes / les plus probables)
  for (const img of doc.querySelectorAll('img')) {
    const raw = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
    const u = absolutize(raw, base);
    if (u && isLikelyProductImage(u)) out.images.push(u);
  }

  // 4. Prix : repli regex si absent du JSON-LD
  if (!out.price) {
    const m = html.match(/(?:price|prix)["'>\s:]{0,8}([\d][\d\s.,]{1,12})/i) || html.match(/([\d]{1,3}[\s.,]\d{3})\s*(?:fcfa|xof|xaf|€|eur|usd|\$|dh|mad)/i);
    if (m) { const n = Number(String(m[1]).replace(/[^\d]/g, '')); if (n > 0) out.price = n; }
  }

  // 5. CONTENU INTÉGRAL structuré par sections : le clone doit reproduire
  //    TOUTE la page (chaque section, dans l'ordre), pas un résumé. On retire
  //    la navigation/le pied de page, puis on regroupe les textes sous leur
  //    titre (h1-h4) en parcourant le document dans l'ordre.
  try {
    for (const n of doc.querySelectorAll('nav, header, footer, script, style, noscript, iframe, form, svg')) n.remove();
    const sections = [];
    let current = { heading: '', parts: [] };
    const flush = () => {
      const text = current.parts.join(' ').replace(/\s+/g, ' ').trim();
      if (text.length > 30 || current.heading) sections.push({ heading: current.heading, text: text.slice(0, 2400) });
    };
    for (const el of doc.body ? doc.body.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, dt, dd') : []) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (/^H[1-4]$/.test(el.tagName)) {
        flush();
        current = { heading: t.slice(0, 160), parts: [] };
      } else if (t.length > 2) {
        current.parts.push(el.tagName === 'LI' ? `• ${t}` : t);
      }
    }
    flush();
    out.sections = sections.slice(0, 40);
  } catch { out.sections = []; }

  // Texte brut long en secours (pages sans structure de titres).
  out.rawText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16000);

  // Dédoublonnage + plafond d'images
  out.images = [...new Set(out.images)].filter(isLikelyProductImage).slice(0, 8);
  if (!out.title && !out.rawText) throw new Error('Page illisible (contenu vide) — vérifie l’URL');
  return out;
}

/**
 * RÉPLIQUE INTÉGRALE de la page source : structure, design et contenu tels
 * quels — pas la structure des boutiques Scalor. Les scripts/trackers/forms
 * sont retirés (le CTA Scalor prend le relais côté rendu), toutes les URLs
 * (images, srcset, fonds CSS) sont absolutisées vers le site source (AUCUNE
 * régénération d'images), et les feuilles de style sont inlinées pour que le
 * design tienne debout hors du site d'origine.
 */
export async function replicateFullPage(url) {
  const { JSDOM } = await import('jsdom');
  const res = await axios.get(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
    timeout: 20000, maxRedirects: 5, responseType: 'text',
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const dom = new JSDOM(String(res.data || ''));
  const doc = dom.window.document;
  const abs = (v) => { try { return new URL(v, url).href; } catch { return v; } };
  const absSrcset = (ss) => String(ss).split(',').map((p) => {
    const [u, d] = p.trim().split(/\s+/);
    return [abs(u), d].filter(Boolean).join(' ');
  }).join(', ');

  // 1. Purge : scripts, trackers, iframes
  for (const n of doc.querySelectorAll('script, noscript, iframe, link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"]')) n.remove();

  // 1b. Formulaires : DÉBALLÉS (pas supprimés) — leurs boutons « Ajouter au
  //     panier » restent visibles dans la réplique ; côté boutique, chaque
  //     clic ouvre le formulaire de commande Scalor.
  for (const f of [...doc.querySelectorAll('form')]) {
    const parent = f.parentNode;
    if (!parent) { f.remove(); continue; }
    while (f.firstChild) parent.insertBefore(f.firstChild, f);
    f.remove();
  }

  // 1c. CHROME du site source HORS périmètre : on clone la PAGE PRODUIT,
  //     pas l'en-tête, la navigation ni le pied de page de la boutique.
  for (const n of doc.querySelectorAll('nav')) n.remove();
  for (const n of [...doc.querySelectorAll('header, footer')]) {
    // On préserve les <header>/<footer> internes au contenu (cartes, articles).
    if (!n.closest('main, article, [class*="product" i]')) n.remove();
  }
  for (const n of doc.querySelectorAll(
    '.site-header, .site-footer, #header, #footer, #site-header, #site-footer, '
    + '[id^="shopify-section-header"], [id^="shopify-section-footer"], '
    + '[class*="announcement-bar" i], .breadcrumb, .breadcrumbs, '
    + '.cart-drawer, .menu-drawer, [class*="cookie-banner" i], [class*="cookie-consent" i], '
    + '[class*="newsletter-popup" i], [class*="back-to-top" i]'
  )) n.remove();

  // 2. URLs absolues — images (lazy-load inclus), sources, fonds inline
  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('src') || '';
    if (src) img.setAttribute('src', abs(src));
    const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset');
    if (srcset) img.setAttribute('srcset', absSrcset(srcset));
    img.removeAttribute('loading');
  }
  for (const s of doc.querySelectorAll('source')) {
    const ss = s.getAttribute('data-srcset') || s.getAttribute('srcset');
    if (ss) s.setAttribute('srcset', absSrcset(ss));
  }
  for (const el of doc.querySelectorAll('[style*="url("]')) {
    el.setAttribute('style', String(el.getAttribute('style')).replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => (/^(data:|https?:)/i.test(u) ? m : `url(${q}${abs(u)}${q})`)));
  }

  // 2b. Widgets DYNAMIQUES morts sans leur JS (disponibilité retrait,
  //     sélecteurs de livraison, avis embarqués…) : purgés — ils n'affichent
  //     que des erreurs (« Couldn't load pickup availability »).
  for (const n of doc.querySelectorAll(
    '[class*="pickup" i], [id*="pickup" i], pickup-availability, '
    + '[class*="shopify-installments" i], [id*="shop-pay" i], shop-pay-wallet-button, '
    + '[class*="judgeme" i], [class*="loox" i], [class*="yotpo" i], [class*="stamped" i]'
  )) n.remove();

  // 2c. DÉTECTION DES BOUTONS D'ACHAT : tout élément dont le texte, les
  //     attributs ou les classes signalent un CTA (multi-langue) est marqué
  //     data-scalor-cta — le rendu boutique le branche sur le formulaire de
  //     commande Scalor.
  const CTA_TEXT_RE = /(add\s*to\s*cart|buy\s*now|buy\s*it|order\s*now|shop\s*now|checkout|purchase|commander|commandez|acheter|achetez|ajouter\s*au\s*panier|panier|j['’]en\s*profite|profiter|comprar|añadir|kaufen|acquista)/i;
  const CTA_CLASS_RE = /(add-to-cart|addtocart|buy|checkout|cart|order|cta|product-form__submit|shopify-payment-button)/i;
  let ctaCount = 0;
  for (const el of doc.querySelectorAll('button, a, input[type="submit"], [role="button"]')) {
    const txt = (el.textContent || el.getAttribute('value') || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const cls = `${el.getAttribute('class') || ''} ${el.getAttribute('id') || ''} ${el.getAttribute('name') || ''}`;
    const href = el.getAttribute('href') || '';
    const isCta = CTA_TEXT_RE.test(txt) || CTA_CLASS_RE.test(cls) || el.getAttribute('name') === 'add'
      || /(\/cart|\/checkout|\/panier|\/commande)/i.test(href);
    if (isCta) { el.setAttribute('data-scalor-cta', '1'); ctaCount += 1; }
  }
  // Aucun CTA détecté (page atypique) : les <button>/<a> proéminents du haut
  // de page servent de secours — le rendu intercepte de toute façon tout clic
  // sur lien/bouton.
  void ctaCount;
  // Liens : jamais vers le site source. Seuls les CTA gardent une ancre
  // (#commander → formulaire). Les AUTRES liens perdent leur href — sinon un
  // titre-lien s'affiche souligné bleu (style lien par défaut) et le clone ne
  // ressemble plus à l'original.
  for (const a of doc.querySelectorAll('a')) {
    a.removeAttribute('target');
    if (a.hasAttribute('data-scalor-cta')) a.setAttribute('href', '#commander');
    else a.removeAttribute('href');
  }

  // 2d. DÉTECTION DES PRIX : les montants du site SOURCE sont marqués
  //     data-scalor-price ('1' = prix courant, 'compare' = prix barré) — le
  //     rendu boutique les remplace par le prix RÉEL de la fiche produit.
  //     Le clone n'affiche ainsi jamais un prix figé étranger.
  const PRICE_CLASS_RE = /(price|prix|amount|money|cost|tarif)/i;
  const COMPARE_CLASS_RE = /(compare|old|was|before|barr|regular|original)/i;
  const CURRENCY_HINT_RE = /([$€£₦₵]|FCFA|F\s?CFA|XOF|XAF|GNF|CDF|USD|EUR|MAD|DHS?|KES|NGN|GHS|RWF)/i;
  const PRICE_TEXT_RE = /^[^\d]{0,6}[\d][\d\s.,  ]{0,14}[^\d]{0,8}$/;
  let priceCount = 0;
  for (const el of doc.querySelectorAll('span, div, p, b, strong, ins, del, s, bdi, h1, h2, h3, h4')) {
    if (priceCount >= 24) break;
    if (el.children.length > 1) continue; // quasi-feuilles uniquement
    if (el.closest('[data-scalor-price]')) continue; // pas d'imbrication
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!txt || txt.length > 32 || !/\d/.test(txt)) continue;
    const cls = `${el.getAttribute('class') || ''} ${el.getAttribute('id') || ''}`;
    const classHit = PRICE_CLASS_RE.test(cls);
    const looksLikePrice = PRICE_TEXT_RE.test(txt) && (classHit || CURRENCY_HINT_RE.test(txt));
    if (!looksLikePrice) continue;
    const isCompare = COMPARE_CLASS_RE.test(cls)
      || el.tagName === 'DEL' || el.tagName === 'S'
      || /line-through/i.test(el.getAttribute('style') || '');
    el.setAttribute('data-scalor-price', isCompare ? 'compare' : '1');
    priceCount += 1;
  }

  // 3. CSS : inline des feuilles de style (urls internes réécrites), plafonné.
  //    Les thèmes modernes (Shopify Dawn…) chargent des DIZAINES de petites
  //    feuilles par composant (component-slider.css, component-media-gallery…)
  //    — tronquer la liste CASSE le rendu (boutons de slider et loupes de zoom
  //    empilés en vrac, doublons desktop/mobile visibles). On prend jusqu'à 40
  //    feuilles (stylesheet + preload as=style), téléchargées en PARALLÈLE et
  //    concaténées dans l'ORDRE du document (la cascade CSS en dépend).
  const seenHref = new Set();
  const links = [...doc.querySelectorAll('link[rel="stylesheet"][href], link[rel="preload"][as="style"][href]')]
    .filter((l) => { const h = abs(l.getAttribute('href')); if (!h || seenHref.has(h)) return false; seenHref.add(h); return true; })
    .slice(0, 40);
  const sheets = await Promise.allSettled(links.map(async (l) => {
    const href = abs(l.getAttribute('href'));
    const r = await axios.get(href, { headers: { 'User-Agent': BROWSER_UA }, timeout: 10000, responseType: 'text', maxContentLength: 900000 });
    const text = String(r.data || '').replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => {
      if (/^(data:|https?:|#)/i.test(u)) return m;
      try { return `url(${q}${new URL(u, href).href}${q})`; } catch { return m; }
    });
    return { href, text };
  }));
  let css = '';
  for (const res of sheets) {
    if (res.status !== 'fulfilled') continue; // feuille inaccessible : best-effort
    if (css.length > 480000) break;
    css += `\n/* ${res.value.href} */\n${res.value.text}`;
  }
  for (const l of doc.querySelectorAll('link')) l.remove();
  for (const st of doc.querySelectorAll('style')) { css += `\n${st.textContent || ''}`; st.remove(); }

  const html = (doc.body?.innerHTML || '').trim();
  if (!html || html.length < 200) throw new Error('Page illisible — réplique impossible');
  return { html: html.slice(0, 900000), css: css.slice(0, 480000) };
}

// Réécriture ORIGINALE de la fiche via DeepSeek.
async function rewriteListing(scraped, ctx) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  if (!DEEPSEEK_API_KEY && !GROQ_API_KEY) {
    throw new Error('Service IA non configuré (DEEPSEEK_API_KEY ou GROQ_API_KEY)');
  }
  const system = `Tu es un copywriter e-commerce senior pour le marché africain francophone (paiement à la livraison).
On te donne le CONTENU INTÉGRAL d'une page produit concurrente, section par section. Tu produis un CLONE COMPLET de la page : TOUT le contenu est repris — chaque section, chaque argument, chaque information — mais RÉÉCRIT avec tes mots (jamais de copier-coller mot à mot : meilleur SEO, pas de contenu dupliqué), amélioré et adapté au COD africain. Réponds UNIQUEMENT avec ce JSON :
{"name":"…","description":"… (HTML riche — voir règles)","category":"…","tags":["…"],"seoTitle":"… (max 60 car.)","seoDescription":"… (max 155 car.)","suggestedPrice":<nombre en FCFA, prix psychologique ex. 14900>,"features":[{"icon":"Check","text":"… (max 40 car.)"}],"faq":[{"question":"…","answer":"…"}],"testimonials":[{"name":"Prénom","text":"…","rating":5,"location":"Ville"}]}
RÈGLES DU CLONE INTÉGRAL :
- "description" = du HTML riche (balises <h2>, <h3>, <p>, <ul><li>, <strong> uniquement) qui REPREND TOUTES les sections de contenu de la page source, DANS LE MÊME ORDRE : présentation, bénéfices, mode d'emploi, composition/caractéristiques, garanties, comparatifs, histoires — AUCUNE section de contenu produit n'est omise, aucune information n'est perdue. Réécris chaque section entièrement (pas de résumé qui coupe du contenu). Ignore uniquement le menu, le panier, le pied de page et les mentions légales du site source.
- "features" : TOUTES les caractéristiques/bénéfices mis en avant par la page (4 à 12) — icônes Lucide : Check, Truck, Shield, Star, Heart, Zap, Clock, Gift, ThumbsUp.
- "faq" : TOUTES les questions présentes sur la page source (réécrites), jusqu'à 12 ; s'il y en a moins de 3, complète pour atteindre 3.
- "testimonials" : reprends les avis clients présents sur la page (reformulés, prénoms africains, villes d'Afrique francophone), jusqu'à 10 ; s'il n'y en a pas, crée 3 avis crédibles et variés.
- N'invente pas de fausses certifications médicales.`;
  const sectionsBlock = Array.isArray(scraped.sections) && scraped.sections.length
    ? scraped.sections.map((s, i) => `[Section ${i + 1}] ${s.heading ? `« ${s.heading} » — ` : ''}${s.text}`).join('\n')
    : '';
  const user = `URL : ${ctx.url}
Titre concurrent : ${scraped.title || '—'}
Prix repéré : ${scraped.price ? `${scraped.price} ${scraped.currency || ''}` : '—'}
Description concurrente : ${(scraped.description || '').slice(0, 1500) || '—'}
CONTENU INTÉGRAL DE LA PAGE (section par section, à reprendre EN ENTIER) :
${(sectionsBlock || scraped.rawText).slice(0, 11000)}`;

  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  const providers = [
    ...(DEEPSEEK_API_KEY ? [{
      name: 'DeepSeek',
      url: 'https://api.deepseek.com/chat/completions',
      key: DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
      extra: { thinking: { type: 'disabled' } },
    }] : []),
    ...(GROQ_API_KEY ? [{
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      extra: { temperature: 0.35 },
    }] : []),
  ];

  let lastStatus = null;
  let lastMessage = '';
  for (const provider of providers) {
    // Une réponse JSON tronquée ou un 429 transitoire mérite une seconde
    // tentative. Si DeepSeek reste saturé, Groq prend automatiquement le relais.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const resp = await axios.post(provider.url, {
          model: provider.model,
          messages,
          stream: false,
          max_tokens: 8000,
          response_format: { type: 'json_object' },
          ...provider.extra,
        }, {
          headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
          timeout: 150000,
        });
        const raw = resp.data?.choices?.[0]?.message?.content || '';
        const parsed = parseAiJson(raw);
        if (parsed) {
          console.log(`[Clone] réécriture réussie via ${provider.name} (${provider.model})`);
          return parsed;
        }
        const finish = resp.data?.choices?.[0]?.finish_reason || '?';
        lastMessage = `réponse JSON invalide (finish=${finish})`;
        console.warn(`[Clone] ${provider.name} imparsable (tentative ${attempt}/2, finish=${finish}, ${raw.length} car.) — fin : …${raw.slice(-400)}`);
      } catch (err) {
        lastStatus = err?.response?.status || null;
        lastMessage = err?.response?.data?.error?.message || err?.message || 'erreur inconnue';
        console.warn(`[Clone] ${provider.name} en échec (tentative ${attempt}/2, HTTP ${lastStatus || 'réseau'}): ${lastMessage}`);
      }

      if (attempt < 2) {
        // Retry-After DeepSeek est souvent proche d'une minute. On ne bloque
        // pas le job aussi longtemps : petit backoff puis fournisseur suivant.
        await wait(lastStatus === 429 ? 2500 : 750);
      }
    }
  }

  if (lastStatus === 429) {
    throw new Error('Service IA temporairement saturé — réessayez dans quelques instants.');
  }
  console.error(`[Clone] tous les fournisseurs de texte ont échoué : ${lastMessage}`);
  throw new Error('Réécriture IA indisponible — réessayez dans quelques instants.');
}

async function runCloneJob(job) {
  try {
    job.step = 'scrape'; job.progress = 10;
    const scraped = await scrapeCompetitorPage(job.url);

    // RÉPLIQUE INTÉGRALE de la page (design + structure + contenu tels quels).
    job.step = 'replicate'; job.progress = 30;
    let clonedPage = null;
    try { clonedPage = await replicateFullPage(job.url); }
    catch (e) { job.warning = `Réplique visuelle partielle : ${e.message}`; }

    job.step = 'rewrite'; job.progress = 55;
    const listing = await rewriteListing(scraped, { url: job.url });

    // Images : celles du site SOURCE, telles quelles — AUCUNE régénération IA.
    job.step = 'images'; job.progress = 85;
    const generated = scraped.images.slice(0, Math.max(1, Math.min(10, job.maxImages || 6)));
    job.imagesDone = generated.length;

    job.result = {
      sourceUrl: job.url,
      name: String(listing.name || scraped.title || 'Produit').slice(0, 200),
      description: String(listing.description || scraped.description || '').slice(0, 50000),
      category: String(listing.category || '').slice(0, 100),
      tags: Array.isArray(listing.tags) ? listing.tags.slice(0, 10).map((t) => String(t).slice(0, 40)) : [],
      seoTitle: String(listing.seoTitle || '').slice(0, 60),
      seoDescription: String(listing.seoDescription || '').slice(0, 160),
      price: Number(listing.suggestedPrice) || scraped.price || 0,
      currency: scraped.currency || 'XOF',
      features: Array.isArray(listing.features) ? listing.features.slice(0, 12).map((f) => ({ icon: String(f.icon || 'Check').slice(0, 30), text: String(f.text || '').slice(0, 50) })).filter((f) => f.text) : [],
      faq: Array.isArray(listing.faq) ? listing.faq.slice(0, 12).map((q) => ({ question: String(q.question || '').slice(0, 200), answer: String(q.answer || '').slice(0, 1200) })).filter((q) => q.question && q.answer) : [],
      testimonials: Array.isArray(listing.testimonials) ? listing.testimonials.slice(0, 10).map((t) => ({ name: String(t.name || 'Client').slice(0, 60), text: String(t.text || '').slice(0, 2000), rating: Math.max(1, Math.min(5, Number(t.rating) || 5)), location: String(t.location || '').slice(0, 60), source: 'ai' })).filter((t) => t.text) : [],
      images: generated.map((url, k) => ({ url, alt: '', order: k })),
      sourceImagesFound: scraped.images.length,
      // Réplique complète de la page source (rendue telle quelle côté boutique).
      clonedPage: clonedPage ? { ...clonedPage, sourceUrl: job.url } : null,
    };
    if (!job.result.images.length) job.warning = job.warning || 'Aucune image trouvée sur la page source — ajoute des photos manuellement.';
    job.step = 'done'; job.progress = 100; job.status = 'done';
  } catch (e) {
    job.status = 'error';
    job.error = e?.message || 'Clonage impossible';
  }
}

/** Lance un job de clonage → jobId.
 *  onDone(status, job) : appelé à la fin du job (done|error) — utilisé par la
 *  route pour rembourser les crédits Creative Center si le clonage échoue. */
export function createCloneJob({ url, maxImages = 4, onDone = null }) {
  const id = `clone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = { id, createdAt: Date.now(), status: 'running', step: 'start', progress: 3, url, maxImages, imagesDone: 0, result: null, warning: '', error: '' };
  cloneJobs.set(id, job);
  setImmediate(() => runCloneJob(job).finally(() => {
    try { onDone?.(job.status, job); } catch (e) { console.warn('[clone] onDone hook failed:', e.message); }
  }));
  return id;
}

export function getCloneJob(id) {
  const j = cloneJobs.get(String(id || ''));
  if (!j) return null;
  return { id: j.id, status: j.status, step: j.step, progress: j.progress, imagesDone: j.imagesDone, result: j.result, warning: j.warning, error: j.error };
}
