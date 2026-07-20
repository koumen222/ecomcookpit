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

  // 5. Texte brut nettoyé (pour l'IA de réécriture)
  out.rawText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);

  // Dédoublonnage + plafond d'images
  out.images = [...new Set(out.images)].filter(isLikelyProductImage).slice(0, 8);
  if (!out.title && !out.rawText) throw new Error('Page illisible (contenu vide) — vérifie l’URL');
  return out;
}

// Réécriture ORIGINALE de la fiche via DeepSeek.
async function rewriteListing(scraped, ctx) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
  if (!DEEPSEEK_API_KEY) throw new Error('Service IA non configuré (DEEPSEEK_API_KEY)');
  const system = `Tu es un copywriter e-commerce senior pour le marché africain francophone (paiement à la livraison).
On te donne les infos BRUTES d'une page produit concurrente. Tu écris une fiche ORIGINALE et vendeuse — PAS une copie : reformule tout avec tes mots, améliore, adapte au COD africain. Réponds UNIQUEMENT avec ce JSON :
{"name":"…","description":"… (3-5 paragraphes courts, bénéfices concrets, réassurance paiement à la livraison)","category":"…","tags":["…"],"seoTitle":"… (max 60 car.)","seoDescription":"… (max 155 car.)","suggestedPrice":<nombre en FCFA, prix psychologique ex. 14900>,"features":[{"icon":"Check","text":"… (max 40 car.)"}],"faq":[{"question":"…","answer":"…"}],"testimonials":[{"name":"Prénom","text":"…","rating":5,"location":"Ville"}]}
Règles : 4 à 6 features (icônes Lucide : Check, Truck, Shield, Star, Heart, Zap, Clock, Gift, ThumbsUp), 3 à 5 FAQ, 3 avis crédibles et variés (prénoms africains, villes d'Afrique francophone). N'invente pas de fausses certifications médicales.`;
  const user = `URL : ${ctx.url}
Titre concurrent : ${scraped.title || '—'}
Prix repéré : ${scraped.price ? `${scraped.price} ${scraped.currency || ''}` : '—'}
Description concurrente : ${(scraped.description || '').slice(0, 1500) || '—'}
Contenu de la page (brut) : ${scraped.rawText.slice(0, 3500)}`;

  const resp = await axios.post('https://api.deepseek.com/chat/completions', {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    stream: false, max_tokens: 3000, thinking: { type: 'disabled' },
  }, { headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 120000 });
  const raw = resp.data?.choices?.[0]?.message?.content || '';
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réécriture IA invalide');
  return JSON.parse(m[0]);
}

// Régénère UN visuel similaire mais original à partir d'une image concurrente.
async function regenerateImage(competitorUrl) {
  const { analyzeProductImageForVideo } = await import('./openaiImageService.js');
  const { generateGptImage2ImageToImage } = await import('./nanoBananaService.js');
  const desc = await analyzeProductImageForVideo(competitorUrl).catch(() => '');
  const prompt = `Recreate THIS EXACT product as a fresh, original professional e-commerce studio photo. ${desc ? `The product: ${desc}. ` : ''}Keep the same product identity (shape, colors, packaging, labels) but a NEW clean composition and lighting on a tasteful neutral or lifestyle background. Absolutely NO text, NO watermark, NO logo overlay copied from the source, no borders. Photorealistic, sharp, high-end advertising look.`;
  // image-to-image : l'URL concurrente sert de RÉFÉRENCE, le rendu est neuf.
  return generateGptImage2ImageToImage(prompt, String(competitorUrl), '4:5', null, {});
}

async function runCloneJob(job) {
  try {
    job.step = 'scrape'; job.progress = 10;
    const scraped = await scrapeCompetitorPage(job.url);

    job.step = 'rewrite'; job.progress = 30;
    const listing = await rewriteListing(scraped, { url: job.url });

    // Images : régénération par lots de 2 (best-effort — une image ratée
    // n'échoue pas le clone). Plafonné par job.maxImages (défaut 4).
    job.step = 'images'; job.progress = 45;
    const sources = scraped.images.slice(0, Math.max(1, Math.min(6, job.maxImages || 4)));
    const generated = [];
    for (let i = 0; i < sources.length; i += 2) {
      const batch = sources.slice(i, i + 2);
      const settled = await Promise.allSettled(batch.map((u) => regenerateImage(u)));
      for (const r of settled) { if (r.status === 'fulfilled' && r.value) generated.push(r.value); }
      job.progress = 45 + Math.round(((i + batch.length) / sources.length) * 45);
      job.imagesDone = generated.length;
    }

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
      features: Array.isArray(listing.features) ? listing.features.slice(0, 6).map((f) => ({ icon: String(f.icon || 'Check').slice(0, 30), text: String(f.text || '').slice(0, 50) })).filter((f) => f.text) : [],
      faq: Array.isArray(listing.faq) ? listing.faq.slice(0, 6).map((q) => ({ question: String(q.question || '').slice(0, 200), answer: String(q.answer || '').slice(0, 1000) })).filter((q) => q.question && q.answer) : [],
      testimonials: Array.isArray(listing.testimonials) ? listing.testimonials.slice(0, 4).map((t) => ({ name: String(t.name || 'Client').slice(0, 60), text: String(t.text || '').slice(0, 2000), rating: Math.max(1, Math.min(5, Number(t.rating) || 5)), location: String(t.location || '').slice(0, 60), source: 'ai' })).filter((t) => t.text) : [],
      images: generated.map((url, k) => ({ url, alt: '', order: k })),
      sourceImagesFound: scraped.images.length,
    };
    if (!job.result.images.length) job.warning = 'Aucune image régénérée (visuels concurrents inaccessibles) — ajoute des photos manuellement.';
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
