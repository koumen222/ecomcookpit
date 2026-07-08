import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import EcomWorkspace from '../models/Workspace.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Prompt contextuel injecté dans Whisper pour maximiser la précision
// sur le vocabulaire e-commerce / builder de page
const WHISPER_PROMPT = `Builder de page e-commerce. Commandes vocales pour modifier une page produit : hero, section, couleur, bouton, titre, sous-titre, image, carousel, témoignage, FAQ, avantage, footer, police, fond, bannière, WhatsApp, timer, compte à rebours, animation, CSS, JavaScript, HTML. Noms de marques, noms de produits, termes marketing.`;

// Transcription haute précision — Groq whisper-large-v3-turbo si dispo, sinon OpenAI gpt-4o-transcribe
async function transcribeBuffer(buffer, mimetype) {
  const ext = mimetype.includes('webm') ? 'webm'
    : mimetype.includes('mp4') ? 'mp4'
    : mimetype.includes('mpeg') || mimetype.includes('mp3') ? 'mp3'
    : mimetype.includes('wav') ? 'wav' : 'webm';
  const filename = `voice.${ext}`;

  // Groq whisper-large-v3-turbo — précis + très rapide
  if (process.env.GROQ_API_KEY) {
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mimetype });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'fr');
    form.append('response_format', 'verbose_json');
    form.append('prompt', WHISPER_PROMPT);
    const res = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
      headers: { ...form.getHeaders(), 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 120000,
    });
    const raw = typeof res.data === 'string' ? res.data : (res.data?.text || '');
    return raw.trim();
  }

  // OpenAI gpt-4o-transcribe — le plus précis disponible
  if (process.env.OPENAI_API_KEY) {
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mimetype });
    form.append('model', 'gpt-4o-transcribe');
    form.append('language', 'fr');
    form.append('response_format', 'text');
    form.append('prompt', WHISPER_PROMPT);
    try {
      const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: { ...form.getHeaders(), 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 120000,
      });
      return (typeof res.data === 'string' ? res.data : res.data?.text || '').trim();
    } catch (e) {
      // fallback whisper-1 si gpt-4o-transcribe non dispo
      if (e?.response?.status === 404 || e?.response?.status === 400) {
        const form2 = new FormData();
        form2.append('file', buffer, { filename, contentType: mimetype });
        form2.append('model', 'whisper-1');
        form2.append('language', 'fr');
        form2.append('response_format', 'verbose_json');
        form2.append('prompt', WHISPER_PROMPT);
        const res2 = await axios.post('https://api.openai.com/v1/audio/transcriptions', form2, {
          headers: { ...form2.getHeaders(), 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
          timeout: 120000,
        });
        return (typeof res2.data === 'string' ? res2.data : res2.data?.text || '').trim();
      }
      throw e;
    }
  }

  throw new Error('Aucune clé de transcription configurée (GROQ_API_KEY ou OPENAI_API_KEY)');
}

const router = express.Router();

const KIE_API_KEY = process.env.KIE_API_KEY || '';
const KIE_CLAUDE_URL = 'https://api.kie.ai/claude/v1/messages';
const KIE_GPT_URL = 'https://api.kie.ai/v1/chat/completions';

// model identifiers sent from frontend:
// 'claude-sonnet' | 'claude-opus' | 'gpt-5.4'

// Claude (Anthropic format via KIE) — system prompt séparé du tableau messages
async function callClaude(messages, claudeModel) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const body = {
    model: claudeModel,
    max_tokens: 8000,
    stream: false,
    messages: chatMessages,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await axios.post(KIE_CLAUDE_URL, body, {
    headers: { 'Authorization': `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 180000,
  });

  const content = res.data?.content;
  if (Array.isArray(content)) return content.filter(b => b.type === 'text').map(b => b.text || '').join('');
  return typeof content === 'string' ? content : '';
}

// GPT (OpenAI format via KIE) — system inclus dans le tableau messages avec role 'system'
async function callGpt(messages, gptModel) {
  const res = await axios.post(KIE_GPT_URL, {
    model: gptModel,
    max_tokens: 8000,
    messages,
  }, {
    headers: { 'Authorization': `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 180000,
  });

  return res.data?.choices?.[0]?.message?.content || '';
}

const MODEL_MAP = {
  'claude-sonnet': (msgs) => callClaude(msgs, 'claude-sonnet-4-6'),
  'claude-opus':   (msgs) => callClaude(msgs, 'claude-opus-4-8'),
  'gpt-5.4':       (msgs) => callGpt(msgs, 'gpt-5.4'),
};

async function callModel(messages, model = 'claude-sonnet') {
  const fn = MODEL_MAP[model] || MODEL_MAP['claude-sonnet'];
  return fn(messages);
}

const SYSTEM_PROMPT = `Tu es un assistant IA tout-puissant intégré dans un builder de page produit e-commerce.
Tu peux TOUT modifier sur la page : contenu, couleurs, polices, code HTML/CSS/JS, images, sections. Tu ne refuses JAMAIS une demande. Tu exécutes TOUJOURS.

Quand l'utilisateur demande une modification :
1. Tu l'appliques immédiatement via un patch JSON
2. Tu confirmes brièvement ce que tu as fait

STRUCTURE DE LA CONFIG (pageConfigPatch) :
{
  "design": { ... },
  "general": { "sections": [...] },
  "button": { ... },
  "conversion": { ... },
  "form": { ... },
  "premiumPage": { ... },
  "premiumImages": { ... },
  "whatsapp": { "enabled": true, "number": "+221...", "position": "bottom-left" },
  "floatingElements": { ... },
  "customHtml": "<div>...</div>",
  "customCss": "body { ... } .hero { ... }",
  "customJs": "setTimeout(() => { /* ton code ici — DOM déjà prêt */ }, 50);",
  "customSections": [{ "html": "<section>...</section>" }]
}

IMAGES (premiumImages) — URLs directes d'images :
- hero: URL image principale hero (string)
- heroGallery: [URL1, URL2, URL3, ...] tableau d'URLs pour le carousel hero
- problem: URL image section problème
- mechanism: URL image section mécanisme
- science: URL image section science/formule
- ritual: URL image section rituel/routine
- closing: URL image section finale
- testimonials: [URL1, URL2, ...] photos clients témoignages
IMPORTANT : quand l'utilisateur joint une image avec un emplacement (ex: "hero", "problem", "closing"), utilise pageConfigPatch.premiumImages avec l'URL fournie. Si l'emplacement est "hero" → premiumImages.hero. Si l'emplacement est "carousel" ou "heroGallery" → premiumImages.heroGallery = [URL]. Si l'emplacement correspond à une section → premiumImages[emplacement]. Ne mets une URL d'image QUE si l'utilisateur en fournit une explicitement.

CLÉS DESIGN (themePatch) — tout ce qui touche l'apparence visuelle :
- ctaButtonColor: couleur bouton + prix (hex)
- formButtonColor: couleur fond bouton (hex)
- buttonTextColor: couleur texte bouton (hex)
- backgroundColor: couleur fond page (hex)
- textColor: couleur texte principal (hex)
- accentColor: couleur accent (hex)
- buttonShadow: ombre bouton (true/false)
- font: police (inter, poppins, dm-sans, montserrat, playfair, space-grotesk)
- borderRadius: arrondi (none, sm, md, lg, xl, full)
- template: mise en page (classic, landing, magazine, minimal, bold)
- showStockCounter, showCountdown, showSecureBadge, showDeliveryInfo: (true/false)

SECTIONS DISPONIBLES (dans general.sections) :
hero, gallery, benefits, testimonials, faq, problem, solution, conversion, urgency, trust, description, social-proof, guarantee, bonus, comparison, video, cta-final, footer-cta, reviews, delivery

CONTENU PREMIUM (premiumPage) — STRUCTURE EXACTE :
- hero.benefits: ["avantage 1", "avantage 2", ...] ← liste des avantages affichés sur la page (AUCUNE LIMITE de nombre)
- hero.headline: titre principal hero
- hero.subheadline: sous-titre hero
- hero.ctaLabel: texte bouton commander
- testimonials: [{ name, rating, text, avatar }]
- testimonialGallery: { headline, subheadline, items: [{ name, text, rating, tags: [] }] }
- faq: { headline, subheadline, items: [{ question, answer }] }
- problemSection: { headline, bullets: [] }
- mechanismSection: { headline, body }
- scienceSection: { headline, subheadline, items: [{ name, description }] }
- ritualSection: { headline, subheadline, steps: [{ label, title, description }], resultsTimeline: [{ label, description }] }
  ← section "Votre rituel au quotidien" : les steps décrivent COMMENT utiliser le produit. Quand tu modifies les étapes, écris des étapes CONCRÈTES et SPÉCIFIQUES au produit (geste réel, moment, quantité/zone) — jamais génériques.
- comparisonSection: { headline, columns: ["Produit", "Alternative 1", "Alternative 2"], rows: [{ label, values: [true, false, false] }] }
- closingSection: { headline, subheadline, bullets: [] }
- rating: { score: "4,9/5", count: "+1 000", label: "clients satisfaits" }

BOUTON CTA (button) :
- text: texte du bouton
- subtext: sous-texte
- icon: icône (shopping-cart, zap, arrow-right, etc.)
- animation: animation (none, pulse, bounce, shake, glow)
- size: taille (sm, md, lg, xl)

CSS PERSONNALISÉ (customCss) :
- Injecté dans une balise <style> sur la page
- Peut cibler n'importe quel élément de la page
- Exemples : changer font-size, cacher des éléments, ajouter des animations, modifier le layout
- Cumule avec le CSS existant (append, pas remplacement)

JS PERSONNALISÉ (customJs) :
- Injecté dans une balise <script> en fin de page
- Peut manipuler le DOM, ajouter des événements, tracker, afficher des popups, déplacer des éléments
- Cumule avec le JS existant (append, pas remplacement)
- Pour déplacer un élément dans le DOM : utilise el.parentNode.insertBefore(el, ref) ou ref.insertAdjacentElement('afterend', el)
- IMPORTANT : N'utilise JAMAIS DOMContentLoaded ni window.onload — le DOM est déjà chargé. Exécute directement sans wrapper d'événement.
- Utilise setTimeout(fn, 50) si tu veux un léger délai pour t'assurer que React a rendu.

DÉPLACER / RÉORDONNER DES ÉLÉMENTS — CLASSES DOM EXACTES :
La zone droite du hero contient ces éléments dans l'ordre suivant (de haut en bas) :
  1. .premium-rating         — étoiles + avis
  2. h1                      — titre principal
  3. .premium-subtitle       — sous-titre
  4. .premium-price          — prix (+ barré)
  5. .premium-check-list     — liste des avantages (ul)
  6. .premium-offer-title    — titre offre (si activé)
  7. .premium-countdown      — compte à rebours texte (si activé)
  8. .premium-offer-card     — carte offre (si activée)
  9. .premium-cta            — bouton Commander (button)
  10. .premium-reassurance   — "Livraison rapide / Satisfait ou remboursé"
  11. .premium-hero-accordions — accordéons (détails, composition, etc.)
  12. #ai-timer-block        — timer injecté par IA (si présent)

Pour DÉPLACER un élément, utilise customJs avec insertAdjacentElement ou insertBefore :
- Mettre le timer AVANT le CTA :
  setTimeout(()=>{const cta=document.querySelector('.premium-cta');const timer=document.querySelector('#ai-timer-block');if(cta&&timer)cta.insertAdjacentElement('beforebegin',timer);},50);
- Mettre le prix APRÈS le CTA :
  setTimeout(()=>{const cta=document.querySelector('.premium-cta');const price=document.querySelector('.premium-price');if(cta&&price)cta.insertAdjacentElement('afterend',price);},50);
- Mettre les avantages AVANT le prix :
  setTimeout(()=>{const price=document.querySelector('.premium-price');const list=document.querySelector('.premium-check-list');if(price&&list)price.insertAdjacentElement('beforebegin',list);},50);

RÉORDONNER LES GRANDES SECTIONS (testimonials, problem, mechanism, science, ritual, comparison, faq, closing) :
→ pageConfigPatch.sectionOrder = ["testimonials","faq","problem","mechanism","science","ritual","comparison","closing"]
  (mettre les ids dans l'ordre voulu — les ids absents disparaissent de la page)

MASQUER / SUPPRIMER DES ÉLÉMENTS :
- Masquer via CSS : customCss avec "display:none !important"
  Ex: ".premium-reassurance { display: none !important; }"
- Masquer une grande section premium : pageConfigPatch.hiddenSections = ["faq","ritual"]
- Supprimer une grande section : retirer son id de pageConfigPatch.sectionOrder

SUPPRIMER / CACHER UNE SECTION :
- Sections premium ordonnables (testimonials, problem, mechanism, science, ritual, comparison, faq, closing) :
  → Pour SUPPRIMER : pageConfigPatch.sectionOrder = tableau sans cet id. Ex: ["testimonials","mechanism","faq"] (retirer "problem")
  → Pour CACHER : pageConfigPatch.hiddenSections = [...hiddenSections_existantes, "problem"]
- Sections classiques (dans general.sections) :
  → pageConfigPatch: { "general": { "sections": [{ "id": "description", "enabled": false }] } }
- customHtml, customCss, customJs, customSections : mettre à "" ou [] pour vider
- Si l'utilisateur dit "supprime", "cache", "enlève", "retire" une section → applique TOUJOURS l'un de ces mécanismes

RÈGLES ABSOLUES :
- Tu exécutes TOUJOURS. Ne dis JAMAIS "je ne peux pas".
- Si une clé n'existe pas encore, crée-la dans le patch.
- Pour les couleurs, utilise des hex (#XXXXXX). Si pas précisé, choisis une couleur adaptée.
- Réponds TOUJOURS en français.
- Sois bref : 1 phrase de confirmation max.
- Tu DOIS retourner du JSON valide.
- Pour customCss et customJs : génère du code propre et fonctionnel.
- INTERDIT : retourner plusieurs blocs JSON, du texte en dehors du JSON, des notes ou explications supplémentaires.

FORMAT DE RÉPONSE — UN SEUL OBJET JSON, RIEN D'AUTRE :
{
  "reply": "Fait ! J'ai [description courte].",
  "pageConfigPatch": { ... } ou null,
  "themePatch": { ... } ou null
}

EXEMPLES :
- "mets le bouton en orange" → themePatch: { "ctaButtonColor": "#F97316" }
- "ajoute un bouton WhatsApp en bas à gauche" → pageConfigPatch: { "whatsapp": { "enabled": true, "number": "", "position": "bottom-left", "message": "Bonjour, je suis intéressé par ce produit !" } }
- "cache la FAQ" → pageConfigPatch: { "hiddenSections": ["faq"] }
- "supprime la section problème" → pageConfigPatch: { "sectionOrder": ["testimonials","mechanism","science","ritual","comparison","faq","closing"] }
- "mets les témoignages en premier" → pageConfigPatch: { "sectionOrder": ["testimonials","problem","mechanism","science","ritual","comparison","faq","closing"] }
- "mets la FAQ avant les témoignages" → pageConfigPatch: { "sectionOrder": ["faq","testimonials","problem","mechanism","science","ritual","comparison","closing"] }
- "mets la police en Poppins" → themePatch: { "font": "poppins" }
- "rends le bouton plus gros avec une animation" → pageConfigPatch: { "button": { "size": "xl", "animation": "pulse" } }
- "change le titre hero" → pageConfigPatch: { "premiumPage": { "hero": { "headline": "Nouveau titre accrocheur" } } }
- "déplace le prix après le bouton" → pageConfigPatch: { "customJs": "setTimeout(()=>{const cta=document.querySelector('.premium-cta');const price=document.querySelector('.premium-price');if(cta&&price)cta.insertAdjacentElement('afterend',price);},50);" }
- "mets le timer avant le CTA" → pageConfigPatch: { "customJs": "setTimeout(()=>{const cta=document.querySelector('.premium-cta');const timer=document.querySelector('#ai-timer-block');if(cta&&timer)cta.insertAdjacentElement('beforebegin',timer);},50);" }
- "mets les avantages avant le prix" → pageConfigPatch: { "customJs": "setTimeout(()=>{const price=document.querySelector('.premium-price');const list=document.querySelector('.premium-check-list');if(price&&list)price.insertAdjacentElement('beforebegin',list);},50);" }
- "cache la zone de réassurance" → pageConfigPatch: { "customCss": ".premium-reassurance { display: none !important; }" }
- "ajoute une bannière promo en haut" → pageConfigPatch: { "customHtml": "<div style='background:#F97316;color:white;text-align:center;padding:12px;font-weight:bold;font-size:14px;'>🔥 OFFRE LIMITÉE — Livraison GRATUITE aujourd'hui !</div>" }
- "ajoute une section vidéo YouTube https://youtu.be/ABC123" → pageConfigPatch: { "customSections": [{ "html": "<section style='padding:40px 20px;background:#000;text-align:center'><h2 style='color:white;margin-bottom:20px'>Découvrez le produit en action</h2><div style='position:relative;padding-bottom:56.25%;height:0'><iframe src='https://www.youtube.com/embed/ABC123' style='position:absolute;top:0;left:0;width:100%;height:100%;border:0' allowfullscreen></iframe></div></section>" }] }
- "agrandis les titres de section" → pageConfigPatch: { "customCss": ".premium-section h2 { font-size: 2.2rem !important; }" }
- "affiche une popup après 5 secondes" → pageConfigPatch: { "customJs": "setTimeout(()=>{ const d=document.createElement('div'); d.innerHTML='<div style=\"position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center\"><div style=\"background:#fff;padding:32px;border-radius:16px;max-width:400px;text-align:center\"><h3>Offre spéciale !</h3><p>-20% sur votre commande</p><button onclick=\"this.closest(\\'.\\').parentElement.remove()\" style=\"background:#0F6B4F;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;margin-top:12px\">Profiter</button></div></div>'; document.body.appendChild(d); }, 5000);" }
- "change l'image hero avec cette URL https://..." → pageConfigPatch: { "premiumImages": { "hero": "https://..." } }
- "change les images du carousel hero" → pageConfigPatch: { "premiumImages": { "heroGallery": ["URL1", "URL2", "URL3"] } }
- "ajoute un témoignage" → pageConfigPatch: { "premiumPage": { "testimonials": [{ "name": "Marie D.", "rating": 5, "text": "Produit incroyable !", "avatar": "" }] } }
- "mets 10 avantages" → pageConfigPatch: { "premiumPage": { "hero": { "benefits": ["Avantage 1","Avantage 2","Avantage 3","Avantage 4","Avantage 5","Avantage 6","Avantage 7","Avantage 8","Avantage 9","Avantage 10"] } } }
- "adapte le rituel à mon savon éclaircissant" → pageConfigPatch: { "premiumPage": { "ritualSection": { "headline": "Votre rituel peau nette", "steps": [{ "label": "Étape 1", "title": "Faites mousser le savon", "description": "Sous l'eau tiède, frottez le savon entre vos mains jusqu'à obtenir une mousse riche." }, { "label": "Étape 2", "title": "Appliquez sur peau humide", "description": "Massez doucement le visage et le corps en évitant le contour des yeux." }, { "label": "Étape 3", "title": "Laissez agir 1 à 2 minutes", "description": "Le temps que les actifs pénètrent, puis rincez abondamment." }, { "label": "Étape 4", "title": "Répétez matin et soir", "description": "Une utilisation régulière révèle un teint plus uniforme au fil des semaines." }] } } }
- "change la timeline des résultats" → pageConfigPatch: { "premiumPage": { "ritualSection": { "resultsTimeline": [{ "label": "Jour 1", "description": "Sensation de fraîcheur immédiate." }, { "label": "Jour 7", "description": "Premiers changements visibles." }, { "label": "Jour 30", "description": "Résultat installé et durable." }] } } }`;

router.post('/chat', requireEcomAuth, async (req, res) => {
  try {
    const { message, productPageConfig, theme, productName, sections, model = 'claude', history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    if (!KIE_API_KEY) {
      return res.status(503).json({ success: false, message: 'Service IA non disponible' });
    }

    // Vérification plan Pro pour l'Assistant IA
    const workspace = await EcomWorkspace.findById(req.workspaceId).select('plan').lean();
    const plan = workspace?.plan || 'free';
    const proPlans = ['pro', 'ultra'];
    if (!proPlans.includes(plan)) {
      return res.status(403).json({
        success: false,
        requiresPro: true,
        message: '🔒 L\'Assistant IA est réservé aux comptes Pro et Ultra.\nPassez à un plan supérieur pour utiliser l\'IA (Claude et GPT).',
      });
    }

    // StorepageBuilder mode: sections array is provided instead of productPageConfig
    const isStorepageMode = Array.isArray(sections);

    let systemPrompt = SYSTEM_PROMPT;
    let contextSummary;

    if (isStorepageMode) {
      systemPrompt = `Tu es un développeur web expert intégré dans le Theme Builder d'une boutique e-commerce (homepage). Tu construis et modifies la page comme si tu codais le site toi-même : AUCUNE limite sur ce que tu peux créer.

Chaque section a: id (unique, format "sec_<timestamp>_<5 chars>"), type, visible (bool), et config (objet selon le type).

TYPES DE SECTIONS DISPONIBLES (catalogue complet et exact) :
- hero: { title, subtitle, ctaText, ctaLink, backgroundImage (URL), backgroundType ('color'|'image'), backgroundColor, overlay (bool), overlayOpacity (0-100), alignment ('left'|'center'|'right'), minHeight (px), textColor }
- products: { title, subtitle, layout, columns, showPrice, showAddToCart, limit, backgroundColor }
- featured_collection: { title, subtitle, category, limit, backgroundColor }
- text: { title, content, alignment, backgroundColor, textColor, padding ('sm'|'md'|'lg') }
- rich_text: { title, subtitle, content, alignment, backgroundColor, textColor }
- image_text: { title, content, image (URL), imageAlt, layout ('image-left'|'image-right'), backgroundColor, ctaText, ctaLink }
- gallery: { title, images: [{url, alt}], columns, backgroundColor }
- testimonials: { title, items: [{name, location, content, rating}], layout, showRating, backgroundColor }
- badges: { items: [{icon (emoji), title, desc}] }  ← bandeau de confiance défilant
- features: { title, subtitle, image (URL), items: [{icon (emoji), title, desc}] }  ← "Pourquoi nous choisir"
- multicolumn: { title, columns, backgroundColor, items: [{icon (emoji), title, text}] }
- icon_bar: { backgroundColor, textColor, items: [{icon (emoji), text}] }
- before_after: { title, imageBefore (URL), imageAfter (URL), labelBefore, labelAfter, backgroundColor }
- faq: { title, items: [{question, answer}], backgroundColor }
- contact: { title, subtitle, whatsapp, email, address, backgroundColor, textColor }
- banner: { text, ctaText, ctaLink, backgroundColor, textColor }
- announcement_bar: { text, backgroundColor, textColor, link, linkText }
- ticker: { items: [string], backgroundColor, textColor, speed }
- countdown: { title, endDate (ISO "2026-12-31T23:59"), expiredText, ctaText, ctaLink, backgroundColor, textColor }
- logo_list: { title, logos: [{url, alt}], marquee (bool), grayscale (bool), backgroundColor }
- newsletter: { title, subtitle, placeholder, buttonText, backgroundColor }
- video: { title, videoUrl (YouTube ou mp4), poster (URL), backgroundColor }
- pricing_table: { title, backgroundColor, items: [{name, price, currency, period, features: [string], cta, highlight (bool)}] }
- spacer: { height (px), backgroundColor }
- custom_code: { html, css, js }  ← TA SUPER-ARME (voir ci-dessous)

⚡ CUSTOM_CODE — LIBERTÉ TOTALE :
Si la demande ne rentre dans AUCUN type standard (layout original, animation, élément interactif, carte, tableau, popup, effet visuel, widget, quiz, calculateur, n'importe quoi), crée une section "custom_code" et ÉCRIS LE CODE TOI-MÊME comme si tu codais le site à la main :
- html : markup complet et sémantique
- css : styles complets, responsive mobile-first, design premium moderne
- js : interactivité (le JS s'exécute sur la boutique publiée)
Le CSS/HTML doit être autonome (classes préfixées uniques pour ne rien casser), beau, responsive. Ne refuse JAMAIS un élément au motif qu'il n'existe pas de type pour ça — code-le.

OPTIONS DE STYLE COMMUNES (chaque section peut avoir config._style) :
_style: { paddingTop (px|null), paddingBottom (px|null), backgroundColor, textColor, hideMobile (bool), hideDesktop (bool), anchorId (string), customCss (string, scoped à la section) }

IMAGES : quand l'utilisateur joint une image avec un emplacement (ex: "hero", "banner"), modifie le champ backgroundImage / image / logos de la section correspondante dans sectionsPatch.

FORMAT DE RÉPONSE — UN SEUL OBJET JSON :
{
  "reply": "Fait ! J'ai [description courte].",
  "sectionsPatch": [...tableau complet des sections mis à jour...] ou null
}

RÈGLES:
- Si tu modifies des sections, renvoie le tableau COMPLET (toutes les sections existantes + tes modifications, dans l'ordre voulu). NE PERDS JAMAIS une section existante.
- Ne modifie que ce que l'utilisateur demande, conserve le reste STRICTEMENT à l'identique (mêmes ids, mêmes configs).
- Pour ajouter: nouvel objet { id: "sec_" + timestamp + "_xxxxx", type, visible: true, config: {...} } placé à l'endroit logique.
- Pour supprimer: retire la section du tableau. Pour cacher: visible: false.
- Pour réordonner: change l'ordre du tableau.
- Tu peux ajouter AUTANT de sections que nécessaire en une seule réponse.
- Contenu toujours vendeur, crédible, adapté au e-commerce africain (FCFA, paiement à la livraison, WhatsApp) sauf indication contraire.
- Réponds TOUJOURS en français. "reply" bref (1-2 phrases).
- Retourne UNIQUEMENT du JSON valide, rien d'autre.`;

      // Contexte compact : JSON minifié, data-URLs tronquées (l'IA doit voir TOUTES
      // les sections pour pouvoir renvoyer le tableau complet sans perte).
      const compactSections = JSON.stringify(sections || [], (key, val) => {
        if (typeof val === 'string' && val.startsWith('data:') && val.length > 120) return `${val.slice(0, 80)}…[base64 tronqué]`;
        if (typeof val === 'string' && val.length > 900) return `${val.slice(0, 880)}…[tronqué]`;
        return val;
      });
      contextSummary = `SECTIONS ACTUELLES (JSON complet):
${compactSections.slice(0, 24000)}`;
    } else {
      const PREMIUM_SECTIONS = ['testimonials', 'problem', 'mechanism', 'science', 'ritual', 'comparison', 'faq', 'closing'];
      const currentSectionOrder = productPageConfig?.sectionOrder || PREMIUM_SECTIONS;
      const hiddenSections = productPageConfig?.hiddenSections || [];

      contextSummary = `CONTEXTE ACTUEL:
- Produit: ${productName || 'Non spécifié'}
- Design: ${JSON.stringify(theme || {}).slice(0, 300)}
- Sections premium (ordre actuel): ${currentSectionOrder.join(', ')}
- Sections cachées: ${hiddenSections.join(', ') || 'aucune'}
- Bouton: ${JSON.stringify(productPageConfig?.button || {}).slice(0, 200)}
- Images actuelles: ${JSON.stringify(productPageConfig?.premiumImages || {}).slice(0, 400)}
- CSS personnalisé existant: ${(productPageConfig?.customCss || '').slice(0, 200) || 'aucun'}
- JS personnalisé existant: ${(productPageConfig?.customJs || '').slice(0, 200) || 'aucun'}`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextSummary },
    ];

    for (const msg of history.slice(-4)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: String(msg.content || '').slice(0, 500) });
      }
    }

    messages.push({ role: 'user', content: message.trim() });

    const rawContent = await callModel(messages, model);

    let parsed;
    try {
      // Strip markdown code fences then extract the FIRST complete JSON object
      let cleaned = rawContent.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      if (start !== -1) {
        // Walk forward to find the matching closing brace
        let depth = 0, end = -1;
        for (let i = start; i < cleaned.length; i++) {
          if (cleaned[i] === '{') depth++;
          else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) cleaned = cleaned.slice(start, end + 1);
      }
      parsed = JSON.parse(cleaned);
    } catch (_) {
      parsed = { reply: 'Modification appliquée.', pageConfigPatch: null, themePatch: null };
    }

    console.log('[BuilderAI] Parsed response:', JSON.stringify(parsed, null, 2));

    return res.json({
      success: true,
      reply: parsed.reply || 'Modification appliquée.',
      pageConfigPatch: parsed.pageConfigPatch || null,
      themePatch: parsed.themePatch || null,
      sectionsPatch: parsed.sectionsPatch || null,
    });
  } catch (error) {
    console.error('[BuilderAI] Chat error:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur du service IA' });
  }
});

// ─── Voice transcription (Groq Whisper → fallback OpenAI Whisper) ──────────
router.post('/transcribe', requireEcomAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fichier audio requis' });

    const { buffer, mimetype } = req.file;
    const text = await transcribeBuffer(buffer, mimetype || 'audio/webm');

    if (!text) return res.status(500).json({ success: false, message: 'Transcription vide' });
    return res.json({ success: true, text });
  } catch (err) {
    console.error('[BuilderAI] Transcription error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Erreur transcription' });
  }
});

export default router;
