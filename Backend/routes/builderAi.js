import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import mongoose from 'mongoose';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import EcomWorkspace from '../models/Workspace.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Client from '../models/Client.js';
import Transaction from '../models/Transaction.js';
import StockLocation from '../models/StockLocation.js';
import StockOrder from '../models/StockOrder.js';
import Supplier from '../models/Supplier.js';
import { executeScalorAgentActions } from '../services/scalorAgentActionService.js';

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

// ─── DeepSeek — moteur IA unique du builder (format OpenAI-compatible) ───────
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-pro';

async function callDeepseek(messages) {
  const res = await axios.post(DEEPSEEK_URL, {
    model: DEEPSEEK_MODEL,
    messages,
    stream: false,
    max_tokens: 8000,
    // Réflexion désactivée : elle peut consommer tout le budget de tokens
    // et laisser content vide (la réponse doit être du JSON direct).
    thinking: { type: 'disabled' },
  }, {
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 180000,
  });
  return res.data?.choices?.[0]?.message?.content || '';
}

// Message d'erreur lisible selon le statut renvoyé par DeepSeek
function aiErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 402) return 'Solde DeepSeek insuffisant — rechargez le compte API sur platform.deepseek.com';
  if (status === 401) return 'Clé API DeepSeek invalide — vérifiez DEEPSEEK_API_KEY';
  if (status === 429) return 'Limite de requêtes DeepSeek atteinte — réessayez dans un instant';
  if (status === 400) return 'Requête refusée par DeepSeek (contexte trop long ?) — réessayez';
  return 'Erreur du service IA — réessayez';
}

// Signature conservée pour compatibilité — le paramètre model est ignoré,
// tout passe par DeepSeek v4-pro.
async function callModel(messages, _model) {
  return callDeepseek(messages);
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
  "customCss": "body { ... } .hero { ... }",
  "customJs": "setTimeout(() => { /* ton code ici — DOM déjà prêt */ }, 50);",
  "customSections": [{ "id": "cs_1712345678", "label": "Barre d'annonce", "placement": "top", "enabled": true, "html": "<style>…</style><div>…</div><script>…</script>" }]
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

SECTIONS DE LA PAGE (general.sections) — CATALOGUE EXACT :
Chaque entrée : { "id", "enabled" (bool), "content" (objet selon l'id) }. L'ordre du tableau = ordre d'affichage sur la page (thème classique). Patch partiel accepté : renvoie UNIQUEMENT les sections modifiées/ajoutées — elles sont fusionnées par id, les ids inconnus sont ajoutés à la page.
- heroSlogan { text } · heroBaseline { text } · reviews { rating, reviewCount }
- orderForm (bouton/formulaire de commande) · productGallery { title, subtitle, images: [{url, alt}] }
- statsBar { stats: [{value, label}] } · stockCounter { text } · urgencyBadge { text }
- urgencyElements { stockLimited (bool), socialProofCount (nombre), quickResult (texte) }
- benefitsBullets { items: [string] } · comparison { productLabel, note, rows: [{label, product, others}] }
- conversionBlocks { items: [{icon (emoji), text}] } · offerBlock { offerLabel, guaranteeText }
- description { text — HTML accepté } · problemSection { title, painPoints: [string] }
- solutionSection { title, description } · faq { faqItems: [{question, answer}] }
- testimonials { items: [{name, location, rating (1-5), text, verified (bool), date}] }
- relatedProducts · stickyOrderBar · upsell · orderBump
- customCode { html } ← SECTION CODE PERSONNALISÉ (règle ci-dessous)

⚡ AJOUTER UN NOUVEL ÉLÉMENT = TOUJOURS CRÉER UNE VRAIE SECTION (customSections) :
Quand l'utilisateur demande d'AJOUTER quelque chose qui ne correspond à AUCUNE section du catalogue (barre d'annonce, bannière, section vidéo, tableau custom, widget, timer custom, badge, carte, quiz, calculateur, n'importe quoi), tu crées UNE NOUVELLE ENTRÉE dans customSections :
pageConfigPatch: { "customSections": [{ "id": "cs_<timestamp>", "label": "Nom court et clair (affiché dans la liste des sections du builder)", "placement": "top" ou "bottom", "enabled": true, "html": "<style>/* classes préfixées .scx-… */</style><div class=\\"scx-bloc\\">…</div><script>/* optionnel */</script>" }] }
- placement "top" = au-dessus du hero (barres d'annonce, bannières promo, alertes)
- placement "bottom" = après le contenu principal (sections vidéo, tableaux, widgets…)
- "style" (optionnel) : mise en page du conteneur — { "marginTop", "marginBottom", "paddingTop", "paddingBottom", "paddingX", "maxWidth", "borderRadius" (nombres en px), "textAlign" ("left"|"center"|"right"), "backgroundColor" (hex) }
- Chaque entrée devient une VRAIE section du builder : listée, masquable, éditable, supprimable par l'utilisateur. Le <style> s'applique et le <script> s'exécute sur la page publiée.
- Chaque nouvel ajout = une NOUVELLE entrée avec un id unique (n'écrase jamais les entrées existantes listées dans le contexte). Pour MODIFIER une section existante, renvoie une entrée avec le MÊME id.
- Code autonome, responsive mobile-first, classes préfixées uniques.
INTERDIT : customHtml (déprécié — ne l'utilise JAMAIS, même pour une bannière : utilise customSections placement "top").
customCss / customJs = réservés aux retouches globales (styles d'éléments existants, déplacements DOM).
THÈME CLASSIQUE : pour ajouter une nouvelle section sur la page classique, crée une entrée dans general.sections avec un id "ccs_<timestamp>" :
{ "id": "ccs_1712345678", "label": "Nom court", "enabled": true, "content": { "html": "<style>…</style><section>…</section><script>…</script>" } }
→ Elle apparaît dans la liste des sections du builder classique (réordonnable, masquable, éditable, supprimable) et se rend à sa position dans la page. L'ordre du tableau general.sections = ordre d'affichage.

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

CONVERSATION & MESSAGES DE SUIVI :
- Salutation ou question sans demande de modification ("bonjour", "tu peux faire quoi ?") → réponds naturellement et brièvement dans "reply" (propose 2-3 exemples d'actions), patches à null. N'écris JAMAIS "Modification appliquée" dans ce cas.
- Message court de PRÉCISION ("à droite", "plus grand", "en rouge", "plus haut", "non l'autre") → il s'applique à TA DERNIÈRE modification (relis l'historique de la conversation). Modifie le MÊME élément avec la nouvelle valeur. Ex : tu viens d'ajouter le bouton WhatsApp → "à droite" = whatsapp.position: "bottom-right".
- whatsapp.position accepte UNIQUEMENT "bottom-left" ou "bottom-right".
- HONNÊTETÉ ABSOLUE : ne confirme JAMAIS une modification sans patch correspondant. Si tu ne renvoies aucun patch, "reply" doit poser une question ou expliquer — jamais prétendre avoir agi.
- Si la demande est ambiguë (plusieurs éléments possibles), choisis le plus probable, applique-le, et précise dans "reply" ce que tu as ciblé.

FORMAT DE RÉPONSE — UN SEUL OBJET JSON, RIEN D'AUTRE :
{
  "reply": "Fait ! J'ai [description courte].",
  "pageConfigPatch": { ... } ou null,
  "themePatch": { ... } ou null
}

EXEMPLES :
- "mets le bouton en orange" → themePatch: { "ctaButtonColor": "#F97316" }
- "ajoute un bouton WhatsApp en bas à gauche" → pageConfigPatch: { "whatsapp": { "enabled": true, "number": "", "position": "bottom-left", "message": "Bonjour, je suis intéressé par ce produit !" } }
- "à droite" (juste après avoir ajouté le bouton WhatsApp) → pageConfigPatch: { "whatsapp": { "position": "bottom-right" } }
- "bonjour" → reply: "Salut ! Dis-moi ce que tu veux modifier : couleurs, textes, sections, images… Par exemple : « mets le bouton en orange »." (patches null)
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
- "crée une barre d'annonce animée" → pageConfigPatch: { "customSections": [{ "id": "cs_1712345001", "label": "Barre d'annonce", "placement": "top", "enabled": true, "html": "<style>.scx-annonce{background:#dc2626;color:#fff;overflow:hidden;padding:10px 0;font-weight:700;font-size:14px;white-space:nowrap}.scx-annonce-track{display:inline-block;animation:scx-defile 15s linear infinite}@keyframes scx-defile{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}</style><div class='scx-annonce'><div class='scx-annonce-track'><span style='padding:0 40px'>🔥 Livraison gratuite aujourd'hui !</span><span style='padding:0 40px'>🔥 Livraison gratuite aujourd'hui !</span></div></div>" }] }
- "ajoute une section vidéo YouTube https://youtu.be/ABC123" → pageConfigPatch: { "customSections": [{ "id": "cs_1712345002", "label": "Vidéo produit", "placement": "bottom", "enabled": true, "html": "<section style='padding:40px 20px;background:#000;text-align:center'><h2 style='color:white;margin-bottom:20px'>Découvrez le produit en action</h2><div style='position:relative;padding-bottom:56.25%;height:0'><iframe src='https://www.youtube.com/embed/ABC123' style='position:absolute;top:0;left:0;width:100%;height:100%;border:0' allowfullscreen></iframe></div></section>" }] }
- "ajoute 3 avis clients" → pageConfigPatch: { "general": { "sections": [{ "id": "testimonials", "enabled": true, "content": { "items": [{ "name": "Aïcha K.", "location": "Abidjan", "rating": 5, "text": "…", "verified": true, "date": "Il y a 3 jours" }] } }] } }
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

    if (!DEEPSEEK_API_KEY) {
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
    // Theme Builder mode: themeDesign object is provided (design tokens des pages produit)
    const themeDesign = req.body.themeDesign;
    const isThemeMode = !isStorepageMode && themeDesign && typeof themeDesign === 'object';

    let systemPrompt = SYSTEM_PROMPT;
    let contextSummary;

    if (isThemeMode) {
      systemPrompt = `Tu es le designer expert intégré au Theme Builder de Scalor — le thème des pages produit d'une boutique e-commerce COD (paiement à la livraison) en Afrique francophone. Tu appliques les demandes de design en renvoyant un patch JSON, comme si tu réglais le thème toi-même.

CHAMPS MODIFIABLES (designPatch — n'inclus QUE les champs à changer) :
- Couleurs hex (#RRGGBB) : buttonColor (bouton principal), ctaButtonColor (bouton CTA), formButtonColor (bouton formulaire), backgroundColor (fond de page), textColor (texte principal), badgeColor (badge promo)
- fontFamily : 'system'|'inter'|'poppins'|'montserrat'|'nunito'|'roboto'|'raleway'|'oswald'|'open-sans'|'geist'|'plus-jakarta'|'urbanist'|'lora'|'merriweather'|'cormorant'|'dm-sans'|'satoshi'|'outfit'|'space-grotesk'|'bebas'|'archivo'
- fontBase : nombre 12 à 18 (px) · fontWeight : '400'|'500'|'600'|'700'
- borderRadius : '0px'|'4px'|'8px'|'12px'|'999px' · shadow : booléen
- buttonStyle : 'filled'|'outline'|'soft'|'gradient' · badgeStyle : 'filled'|'outline'|'soft'|'ribbon'
- imageRatio : 'square'|'portrait'|'landscape'|'wide' · spacing : 'compact'|'normal'|'relaxed'
- Booléens d'affichage : showReviews, showTrustBadges, showShareButtons, showRelatedProducts, showProductGallery, showQuantitySelector, showDeliveryInfo, showSecureBadge, showCountdown, showStockIndicator, stickyAddToCart, imageZoom

sectionColorsPatch (couleurs d'accent des sections premium, hex) : socialProof, benefits, trust, problem, solution, faq

themeTemplate : 'classic' (standard galerie+infos) ou 'magazine' (premium longue page) — UNIQUEMENT si l'utilisateur demande explicitement de changer de template.

FORMAT DE RÉPONSE — UN SEUL OBJET JSON :
{
  "reply": "Fait ! …" (1-2 phrases, français),
  "designPatch": { … } | null,
  "sectionColorsPatch": { … } | null,
  "themeTemplate": "classic" | "magazine" | null
}

RÈGLES :
- Palette harmonieuse et CONTRASTÉE : le texte doit rester lisible sur le fond, les boutons doivent ressortir.
- Demande floue (« plus moderne », « plus luxueux ») → propose un ensemble cohérent : couleurs + police + radius + styles.
- « Boutons plus visibles » → couleur vive contrastée + buttonStyle 'filled'.
- Ne mets dans les patchs QUE ce qui doit changer. Valeurs STRICTEMENT dans les listes ci-dessus.
- Question sans modification demandée → réponds dans "reply", patchs à null.
- Conseils adaptés au e-commerce africain COD quand pertinent (couleurs de confiance, CTA visibles, lisibilité mobile).
- Retourne UNIQUEMENT du JSON valide, rien d'autre.`;

      contextSummary = `ÉTAT ACTUEL DU THÈME (comprends tout avant d'agir) :
- Template actif : ${req.body.themeTemplate || 'classic'}
- Design actuel (JSON) : ${JSON.stringify(themeDesign).slice(0, 2500)}
- Couleurs des sections premium : ${JSON.stringify(req.body.sectionColors || {}).slice(0, 600)}
- Boutique : ${String(req.body.storeName || '').slice(0, 120) || 'Non spécifié'}`;
    } else if (isStorepageMode) {
      systemPrompt = `Tu es un développeur web expert intégré dans le Theme Builder d'une boutique e-commerce (homepage). Tu construis et modifies la page comme si tu codais le site toi-même : AUCUNE limite sur ce que tu peux créer.

Chaque section a: id (unique, format "sec_<timestamp>_<5 chars>"), type, visible (bool), et config (objet selon le type).

TYPES DE SECTIONS DISPONIBLES (catalogue complet et exact) :
- hero: { title, subtitle, ctaText, ctaLink, backgroundImage (URL), backgroundType ('color'|'image'), backgroundColor, overlay (bool), overlayOpacity (0-100), alignment ('left'|'center'|'right'), minHeight (px), textColor }
- products: { title, subtitle, layout, columns, mobileColumns (1|2|4 — colonnes sur mobile), showPrice, showAddToCart, limit, backgroundColor }
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

      // État complet des sections classiques (id, enabled, aperçu du contenu).
      // customCode garde un cap large : l'IA doit pouvoir ajouter à la suite du code existant sans l'écraser.
      const classicSections = (productPageConfig?.general?.sections || []).map((s) => {
        const cap = s.id === 'customCode' ? 6000 : 400;
        return {
          id: s.id,
          enabled: s.enabled !== false,
          ...(s.content && Object.keys(s.content).length > 0
            ? { content: JSON.parse(JSON.stringify(s.content, (k, v) => (typeof v === 'string' && v.length > cap ? `${v.slice(0, cap - 20)}…[tronqué]` : v))) }
            : {}),
        };
      });

      contextSummary = `CONTEXTE ACTUEL (comprends TOUT l'écosystème de la page avant d'agir):
- Produit: ${productName || 'Non spécifié'}
- Design: ${JSON.stringify(theme || {}).slice(0, 300)}
- Sections premium (ordre actuel): ${currentSectionOrder.join(', ')}
- Sections cachées: ${hiddenSections.join(', ') || 'aucune'}
- Sections classiques (general.sections — ordre = ordre page): ${JSON.stringify(classicSections).slice(0, 4000) || 'défauts (aucune personnalisation)'}
- Sections personnalisées existantes (customSections — pour modifier, réutilise le même id): ${JSON.stringify((productPageConfig?.customSections || []).map((s, i) => ({ id: s.id || `cs_${i}`, label: s.label || 'Section IA', placement: s.placement === 'top' ? 'top' : 'bottom', enabled: s.enabled !== false, html: String(s.html || '').slice(0, 800) }))).slice(0, 4000)}
- Contenu premium (premiumPage): ${JSON.stringify(productPageConfig?.premiumPage || {}, (k, v) => (typeof v === 'string' && v.length > 300 ? `${v.slice(0, 280)}…` : v)).slice(0, 3000)}
- Bouton: ${JSON.stringify(productPageConfig?.button || {}).slice(0, 200)}
- Images actuelles: ${JSON.stringify(productPageConfig?.premiumImages || {}).slice(0, 400)}
- CSS personnalisé existant: ${(productPageConfig?.customCss || '').slice(0, 200) || 'aucun'}
- JS personnalisé existant: ${(productPageConfig?.customJs || '').slice(0, 200) || 'aucun'}`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextSummary },
    ];

    for (const msg of history.slice(-6)) {
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
      // Réponse non-JSON (salutation, question, explication) → texte brut tel quel
      const textReply = String(rawContent || '').replace(/```(?:json)?/gi, '').trim().slice(0, 1500);
      parsed = { reply: textReply || "Je n'ai pas compris — reformulez votre demande.", pageConfigPatch: null, themePatch: null };
    }

    console.log('[BuilderAI] Parsed response:', JSON.stringify(parsed, null, 2));

    const hasAnyPatch = Boolean(
      parsed.pageConfigPatch || parsed.themePatch || parsed.sectionsPatch
      || parsed.designPatch || parsed.sectionColorsPatch || parsed.themeTemplate
    );
    return res.json({
      success: true,
      reply: parsed.reply || (hasAnyPatch ? 'Fait !' : 'Précisez ce que vous souhaitez modifier.'),
      pageConfigPatch: parsed.pageConfigPatch || null,
      themePatch: parsed.themePatch || null,
      sectionsPatch: parsed.sectionsPatch || null,
      designPatch: parsed.designPatch || null,
      sectionColorsPatch: parsed.sectionColorsPatch || null,
      themeTemplate: parsed.themeTemplate || null,
    });
  } catch (error) {
    console.error('[BuilderAI] Chat error:', error?.response?.status, error?.response?.data?.error?.message || error.message);
    return res.status(500).json({ success: false, message: aiErrorMessage(error) });
  }
});

// ─── Génération de code (section « Code personnalisé ») ────────────────────
// Body: { prompt, productName?, existingCode?, model? }
// Réponse: { success, code } — un seul bloc autonome HTML + <style> + <script>
const GENERATE_CODE_PROMPT = `Tu es un développeur front-end expert intégré dans le builder de page produit d'une boutique e-commerce (marché africain francophone : FCFA, paiement à la livraison, WhatsApp).

L'utilisateur décrit une section à insérer dans sa page produit. Tu génères UN SEUL bloc de code autonome, prêt à être injecté tel quel dans la page :
- <style> en tête avec des classes préfixées uniques (ex: .scx-…) pour ne rien casser sur la page
- puis le HTML sémantique
- puis <script> UNIQUEMENT si de l'interactivité est nécessaire (le JS s'exécute sur la page publiée, DOM prêt)

EXIGENCES :
- Design moderne et premium, responsive mobile-first (la majorité du trafic est mobile)
- Contenu en français, vendeur et crédible ; textes d'exemple réalistes si l'utilisateur n'en fournit pas
- Aucune dépendance externe (pas de CDN, pas de framework), pas d'attributs on* inline
- Si un code existant est fourni et que la demande est une modification, renvoie le bloc COMPLET mis à jour

RÉPONDS UNIQUEMENT AVEC LE CODE BRUT. Pas de markdown, pas de \`\`\`, pas d'explication.`;

router.post('/generate-code', requireEcomAuth, async (req, res) => {
  try {
    const { prompt, productName = '', existingCode = '', model = 'claude-sonnet' } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Description requise' });
    }
    if (!DEEPSEEK_API_KEY) {
      return res.status(503).json({ success: false, message: 'Service IA non disponible' });
    }

    // Même règle que le chat : Assistant IA réservé aux plans Pro/Ultra
    const workspace = await EcomWorkspace.findById(req.workspaceId).select('plan').lean();
    const plan = workspace?.plan || 'free';
    if (!['pro', 'ultra'].includes(plan)) {
      return res.status(403).json({
        success: false,
        requiresPro: true,
        message: '🔒 L\'Assistant IA est réservé aux comptes Pro et Ultra.',
      });
    }

    const userParts = [
      productName ? `Produit : ${String(productName).slice(0, 200)}` : '',
      existingCode ? `CODE EXISTANT À MODIFIER :\n${String(existingCode).slice(0, 12000)}` : '',
      `DEMANDE : ${prompt.trim().slice(0, 2000)}`,
    ].filter(Boolean).join('\n\n');

    const rawContent = await callModel([
      { role: 'system', content: GENERATE_CODE_PROMPT },
      { role: 'user', content: userParts },
    ], model);

    // Retirer d'éventuelles clôtures markdown malgré la consigne
    const code = String(rawContent || '')
      .replace(/^\s*```(?:html)?\s*/i, '')
      .replace(/```\s*$/g, '')
      .trim();

    if (!code) return res.status(502).json({ success: false, message: 'Réponse IA vide, réessayez' });

    return res.json({ success: true, code });
  } catch (error) {
    console.error('[BuilderAI] generate-code error:', error?.response?.status, error?.response?.data?.error?.message || error.message);
    return res.status(500).json({ success: false, message: aiErrorMessage(error) });
  }
});

// ─── Assistant général boutique (aide à la création et gestion) ─────────────
const STORE_ASSISTANT_PROMPT = `Tu es l'assistant Scalor — expert e-commerce COD (paiement à la livraison) en Afrique francophone, intégré au tableau de bord de la boutique du marchand.

Tu aides à créer et gérer la boutique : produits, pages produit, design, livraison, formulaires, upsells, créas publicitaires, campagnes WhatsApp, statistiques.

FONCTIONNALITÉS ET OÙ LES TROUVER (chemins du menu Boutique) :
- Produits : Boutique → Produits — créer manuellement, importer depuis Alibaba, ou générer la fiche par IA
- Page produit : Produits → ouvrir un produit → Page Builder — sections réordonnables, sections prédéfinies (Ajouter une section), section code personnalisé, Assistant IA intégré (barre de chat en bas)
- Thème & design : Boutique → Thème / Paramètres — couleurs, polices, template classique ou magazine (premium)
- Livraison : Boutique → Livraison — pays, zones, tarifs par ville, forfait, seuil livraison gratuite
- Upsells : Boutique → Upsells — offre post-achat, order bump dans le formulaire, offre de sortie (déclencheur fermeture/intention de sortie), design de chaque offre
- Créas publicitaires : Boutique → Générateur de créas — visuels IA depuis une photo produit, univers visuels, qualité Brouillon/Standard/Premium, galerie « Mes visuels »
- Campagnes & WhatsApp : sections dédiées du menu
- Statistiques : Tableau de bord et Rapports (analyse IA disponible)

RÈGLES :
- Réponds en français simple, direct, orienté ACTION.
- Parcours = étapes numérotées courtes avec le chemin de menu exact.
- Donne des conseils e-commerce concrets adaptés au marché africain COD : prix psychologiques en FCFA, réassurance paiement à la livraison, WhatsApp, créas Facebook/TikTok.
- Tu ne modifies rien toi-même : tu guides. Pour modifier une page produit par IA, renvoie vers l'Assistant IA du Page Builder.
- Hors sujet boutique/e-commerce → ramène poliment au sujet.
- Réponse courte (≤ 200 mots) sauf nécessité réelle.

BOUTONS D'ACTION (obligatoire) :
Chaque fois que ta réponse mentionne un écran de Scalor, ajoute à la TOUTE FIN de la réponse un marqueur par écran cité (4 maximum, pas de doublon), au format EXACT :
[[action:Libellé court|/chemin]]
Exemple : [[action:Ouvrir Produits|/ecom/boutique/products]]
Ces marqueurs deviennent des boutons cliquables dans l'interface — n'écris jamais le chemin brut dans le texte.
Chemins AUTORISÉS (uniquement ceux-ci, ne jamais en inventer) :
- /ecom/boutique — Tableau de bord boutique
- /ecom/boutique/products — Produits (liste, Importer depuis Alibaba, Générer par IA)
- /ecom/boutique/products/new — Créer un produit manuellement
- /ecom/boutique/orders — Commandes
- /ecom/boutique/analyses — Statistiques & analyses
- /ecom/boutique/page-builder — Page Builder (pages produit)
- /ecom/boutique/theme — Thème & design
- /ecom/boutique/delivery-zones — Livraison (zones et tarifs)
- /ecom/boutique/payments — Paiements
- /ecom/boutique/form-builder — Créateur de formulaire
- /ecom/boutique/form-builder/upsells — Upsells, bumps & offres de sortie
- /ecom/boutique/form-builder/quantity-offers — Offres de quantité
- /ecom/boutique/pixel — Pixels & tracking
- /ecom/boutique/domains — Domaines
- /ecom/boutique/settings — Paramètres de la boutique
- /ecom/creatives — Générateur de créas publicitaires`;

const BACKOFFICE_ASSISTANT_PROMPT = `Tu es l'Assistant Scalor, copilote opérationnel d'un back-office e-commerce COD en Afrique francophone.

Tu aides l'équipe à piloter : commandes, clients, produits, rentabilité, sourcing, stock, fournisseurs, transactions, rapports, équipe, marketing, créatives, WhatsApp et Rita IA.

RÈGLES :
- Réponds en français simple, précis et orienté action.
- Tiens compte de la page actuellement ouverte lorsqu'elle est fournie.
- Pour un processus, donne 3 à 6 étapes courtes.
- Ne prétends jamais avoir modifié ou analysé des données auxquelles le message ne donne pas accès.
- Pour les calculs COD, rappelle si nécessaire que le bénéfice réel doit inclure produit, transport, publicité et taux de livraison.
- Réponse courte (≤ 220 mots), sauf nécessité réelle.

BOUTONS D'ACTION :
Quand tu recommandes un écran Scalor, termine avec 1 à 4 marqueurs au format EXACT [[action:Libellé|/chemin]].
N'utilise que ces chemins :
- /ecom/dashboard/admin — Tableau de bord
- /ecom/orders — Commandes
- /ecom/products — Produits
- /ecom/products/new — Nouveau produit
- /ecom/clients — Clients
- /ecom/sourcing — Sourcing
- /ecom/stock — Stock
- /ecom/transactions — Finances
- /ecom/reports — Rapports
- /ecom/marketing — Marketing
- /ecom/creatives — Créatives
- /ecom/whatsapp/service — Service WhatsApp
- /ecom/whatsapp/agent-config — Rita IA
- /ecom/users — Équipe
- /ecom/settings — Paramètres
- /ecom/boutique — Boutique

MODE ACTION AUTONOME :
Si et seulement si l'utilisateur demande explicitement d'effectuer une action, ajoute à la toute fin :
<scalor_actions>[{"type":"...","payload":{...}}]</scalor_actions>
Actions autorisées :
- order.create : clientName, clientPhone, city?, address?, product, quantity, price, status?
- order.update_status : orderId, status
- order.delete : orderId (uniquement demande de suppression définitive explicitement confirmée)
- product.create : name, sellingPrice, productCost, deliveryCost, avgAdsCost?, stock?, status?
- product.update_price : name, sellingPrice
- product.update_status : name, status (test|stable|winner|pause|stop)
- product.update_stock : name, et stock (valeur absolue) OU delta (ajustement, ex. -5, +20)
- product.delete : name (uniquement demande de suppression définitive explicitement confirmée)
- sourcing.create : productName, sourcing(local|chine), quantity, weightKg, pricePerKg, purchasePrice, sellingPrice, transportCost?, supplierName?, expectedArrival?
- whatsapp.send : orderId ou to, et message
- report.generate : génère les rapports quotidiens par produit (à partir des commandes livrées/reçues). Champs : date? (YYYY-MM-DD, défaut = aujourd'hui) OU startDate?+endDate? pour une période. Utilise-la dès qu'on te demande de « créer / générer un rapport ».
- orders.relance : relance EN MASSE les clients par WhatsApp selon un statut de commande. Champs : status (ex. "shipped", "reported", "postponed"), message? (avec les variables {prenom} et {produit}), limit? (défaut 30, max 100). Le serveur récupère lui-même les commandes ET les numéros et envoie les messages — tu n'as PAS besoin de la liste des contacts ni des numéros pour émettre cette action. Utilise-la dès qu'on te demande de « relancer les clients (non livrés / expédiés / reportés) ».
N'invente aucun champ manquant : pose une question au lieu d'émettre l'action. N'annonce jamais qu'une action est réussie avant son résultat serveur. Maximum 3 actions.

EXÉCUTE, NE DÉCLINE PAS : si la demande correspond à une action ci-dessus (ex. « génère le rapport d'aujourd'hui »), tu DOIS l'exécuter en émettant le bloc d'action — n'affirme JAMAIS que tu « ne peux pas le faire dans Scalor » et ne remplace pas l'action par une liste d'étapes manuelles. Les étapes manuelles ne servent que pour ce qui n'a PAS d'action disponible.`;

const AI_DATA_STOP_WORDS = new Set(['avec', 'dans', 'pour', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'combien', 'sont', 'plus', 'moins', 'cette', 'produit', 'produits', 'commande', 'commandes', 'scalor']);
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function buildBackofficeDataContext(req, question = '') {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return { available: false, reason: 'workspace_absent' };
  const workspaceObjectId = mongoose.Types.ObjectId.isValid(String(workspaceId)) ? new mongoose.Types.ObjectId(String(workspaceId)) : workspaceId;

  const role = req.ecomUser?.role;
  const userId = req.ecomUser?._id;
  const isAdmin = ['super_admin', 'ecom_admin'].includes(role);
  const canSeeFinance = isAdmin || role === 'ecom_compta';
  const canSeeSourcing = canSeeFinance;
  const canSeeClients = isAdmin || ['ecom_closeuse', 'service_client'].includes(role);

  const orderScope = { workspaceId: workspaceObjectId };
  if (role === 'ecom_closeuse') orderScope.closerId = userId;
  if (role === 'ecom_livreur') orderScope.assignedLivreur = userId;

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const keywords = String(question).toLocaleLowerCase('fr').split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= 4 && !AI_DATA_STOP_WORDS.has(word)).slice(0, 6);
  const productSearch = keywords.length ? { name: { $regex: keywords.map(escapeRegex).join('|'), $options: 'i' } } : {};

  const tasks = {
    orderStatuses: Order.aggregate([{ $match: orderScope }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } } } }, { $sort: { count: -1 } }]),
    ordersToday: Order.countDocuments({ ...orderScope, $or: [{ date: { $gte: startToday } }, { createdAt: { $gte: startToday } }] }),
    orders30d: Order.aggregate([{ $match: { ...orderScope, $or: [{ date: { $gte: since30d } }, { createdAt: { $gte: since30d } }] } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } } } }]),
    recentOrders: Order.find(orderScope).select('-_id orderId date createdAt product quantity price currency status city source').sort({ createdAt: -1 }).limit(12).lean(),
    products: Product.find({ workspaceId: workspaceObjectId, ...productSearch }).select(canSeeFinance ? '-_id name status sellingPrice productCost deliveryCost avgAdsCost stock reorderThreshold isActive' : '-_id name status sellingPrice stock reorderThreshold isActive').sort({ updatedAt: -1 }).limit(30).lean(),
    productTotals: Product.aggregate([{ $match: { workspaceId: workspaceObjectId } }, { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } }, stock: { $sum: '$stock' } } }]),
    stock: StockLocation.aggregate([{ $match: { workspaceId: workspaceObjectId } }, { $group: { _id: '$city', quantity: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } }, { $sort: { quantity: -1 } }, { $limit: 12 }]),
  };

  if (canSeeClients) {
    tasks.clientCount = Client.countDocuments({ workspaceId: workspaceObjectId });
    tasks.clientCities = Client.aggregate([{ $match: { workspaceId: workspaceObjectId } }, { $group: { _id: '$city', count: { $sum: 1 }, spent: { $sum: '$totalSpent' } } }, { $sort: { count: -1 } }, { $limit: 10 }]);
  }
  if (canSeeFinance) {
    tasks.transactions30d = Transaction.aggregate([{ $match: { workspaceId: workspaceObjectId, date: { $gte: since30d } } }, { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  }
  if (canSeeSourcing) {
    tasks.sourcing = StockOrder.find({ workspaceId: workspaceObjectId }).select('-_id productName sourcing quantity purchasePrice transportCost sellingPrice status paid paidPurchase paidTransport expectedArrival supplierName').sort({ orderDate: -1 }).limit(30).lean();
    tasks.supplierCount = Supplier.countDocuments({ workspaceId: workspaceObjectId, isActive: true });
  }

  const entries = Object.entries(tasks);
  const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
  const data = {};
  settled.forEach((result, index) => { if (result.status === 'fulfilled') data[entries[index][0]] = result.value; });

  if (Array.isArray(data.products) && canSeeFinance) {
    data.products = data.products.map(product => ({
      ...product,
      estimatedProfitPerUnit: Number(product.sellingPrice || 0) - Number(product.productCost || 0) - Number(product.deliveryCost || 0) - Number(product.avgAdsCost || 0),
    }));
  }
  if (Array.isArray(data.sourcing)) {
    data.sourcing = data.sourcing.map(order => {
      const purchaseTotal = Number(order.purchasePrice || 0) * Number(order.quantity || 0);
      const total = purchaseTotal + Number(order.transportCost || 0);
      const unpaid = order.sourcing === 'chine' ? (!order.paidPurchase ? purchaseTotal : 0) + (!order.paidTransport ? Number(order.transportCost || 0) : 0) : (!order.paid ? total : 0);
      return { ...order, total, unpaid };
    });
  }

  return {
    available: true,
    generatedAt: new Date().toISOString(),
    scope: { workspaceId: String(workspaceId), role, personalOrderScope: ['ecom_closeuse', 'ecom_livreur'].includes(role) },
    data,
  };
}

router.post('/store-assistant', requireEcomAuth, async (req, res) => {
  try {
    const { message, history = [], storeName = '', context = 'store', pageTitle = '', workspaceName = '' } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    if (!DEEPSEEK_API_KEY) {
      return res.status(503).json({ success: false, message: 'Service IA non disponible' });
    }

    const isBackoffice = context === 'backoffice';
    const contextDetails = isBackoffice
      ? `\n\nPage actuellement ouverte : « ${String(pageTitle || 'Scalor').slice(0, 120)} ».${workspaceName ? ` Espace de travail : « ${String(workspaceName).slice(0, 120)} ».` : ''}`
      : (storeName ? `\n\nBoutique du marchand : « ${String(storeName).slice(0, 120)} ».` : '');

    const scalorContext = isBackoffice ? await buildBackofficeDataContext(req, message) : null;
    const dataInstructions = scalorContext
      ? `\n\nDONNÉES SCALOR EN LECTURE SEULE (JSON, générées maintenant) :\n${JSON.stringify(scalorContext)}\n\nUtilise ces données pour répondre factuellement. Cite la période et le périmètre quand c'est utile. Si une information n'est pas dans ce JSON, dis clairement qu'elle n'est pas disponible. Ne révèle jamais workspaceId ni détails techniques du JSON.`
      : '';

    const messages = [
      { role: 'system', content: (isBackoffice ? BACKOFFICE_ASSISTANT_PROMPT : STORE_ASSISTANT_PROMPT) + contextDetails + dataInstructions },
      ...(Array.isArray(history) ? history : [])
        .slice(-8)
        .filter((m) => ['user', 'assistant'].includes(m?.role))
        .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 800) })),
      { role: 'user', content: message.trim().slice(0, 2000) },
    ];

    const rawReply = await callDeepseek(messages);
    if (!rawReply) return res.status(502).json({ success: false, message: 'Réponse IA vide, réessayez' });

    let proposedActions = [];
    const actionBlock = String(rawReply).match(/<scalor_actions>([\s\S]*?)<\/scalor_actions>/i);
    if (actionBlock) {
      try {
        const parsed = JSON.parse(actionBlock[1]);
        if (Array.isArray(parsed)) proposedActions = parsed;
      } catch { /* bloc invalide ignoré */ }
    }
    const reply = String(rawReply).replace(/<scalor_actions>[\s\S]*?<\/scalor_actions>/gi, '').trim();
    const explicitActionIntent = /\b(crée|créer|ajoute|ajouter|modifie|modifier|change|changer|mets|mettre|passe|passer|marque|marquer|supprime|supprimer|envoie|envoyer|commande|commander|génère|génere|générer|generer|génération|generation|lance|lancer|rapport|rapports|relance|relancer|relances|relanc)\b/i.test(message);
    const actionResults = isBackoffice && explicitActionIntent && proposedActions.length
      ? await executeScalorAgentActions(proposedActions, {
          workspaceId: req.workspaceId,
          user: req.ecomUser,
          sourceMessage: message,
        })
      : [];

    return res.json({
      success: true,
      reply,
      grounded: Boolean(scalorContext?.available),
      dataGeneratedAt: scalorContext?.generatedAt || null,
      actions: actionResults,
    });
  } catch (error) {
    console.error('[StoreAssistant] error:', error?.response?.status, error?.response?.data?.error?.message || error.message);
    return res.status(500).json({ success: false, message: aiErrorMessage(error) });
  }
});

// ─── Génération / édition d'image (GPT Image → R2) pour les builders ────────
// Body: { prompt, sourceUrl?, aspectRatio? } → { success, url }
// sourceUrl fourni = édition de l'image existante (image-to-image), sinon création.
router.post('/generate-image', requireEcomAuth, async (req, res) => {
  try {
    const { prompt, sourceUrl = null, aspectRatio = '4:3' } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ success: false, message: 'Décrivez l\'image souhaitée' });
    }
    const { isOpenAiImageConfigured, generateOpenAiImage, generateOpenAiImageEdit } = await import('../services/openaiImageService.js');
    if (!isOpenAiImageConfigured()) {
      return res.status(503).json({ success: false, message: 'Génération d\'images non configurée' });
    }

    const cleanPrompt = String(prompt).trim().slice(0, 2000);
    const fullPrompt = `${cleanPrompt}\n\nStyle: photo produit e-commerce professionnelle, éclairage soigné, rendu réaliste haute qualité. Aucun texte incrusté sauf demande explicite.`;
    const ar = ['1:1', '4:3', '3:4', '16:9', '9:16', '4:5'].includes(aspectRatio) ? aspectRatio : '4:3';

    const url = sourceUrl && /^https?:\/\//.test(String(sourceUrl))
      ? await generateOpenAiImageEdit(cleanPrompt, [String(sourceUrl)], 'auto', {})
      : await generateOpenAiImage(fullPrompt, ar, {});

    // Médiathèque (best-effort)
    (await import('../models/GeneratedMedia.js')).default.record({
      workspaceId: req.workspaceId, storeId: req.activeStoreId, userId: req.ecomUser?._id,
      type: 'image', url, kind: 'builder-image', prompt, sourceUrl: sourceUrl || '',
    });

    return res.json({ success: true, url });
  } catch (error) {
    console.error('[BuilderAI] generate-image error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Génération impossible, réessayez' });
  }
});

// ─── GIF d'illustration produit — deux modes ─────────────────────────────────
// mode 'steps' (défaut) : frames GPT Image (mode d'emploi 1-2-3) → GIF (gifenc)
// mode 'scene'          : vraie vidéo (fal.ai image-to-video, Kling 2.5 Turbo
//                         Pro par défaut) → GIF optimisé (ffmpeg). Sans photo
//                         source, GPT Image crée d'abord la scène de départ.
// Body scene : { mode:'scene', prompt, sourceUrl?, subject?, durationSec? }
// Body steps : { steps: [string 2..5], sourceUrl?, subject?, aspectRatio?, frameDelayMs? }
// → { success, url (gif), videoUrl? (mp4), frames?: [urls] }
router.post('/generate-gif', requireEcomAuth, async (req, res) => {
  try {
    const { steps, sourceUrl = null, subject = '', aspectRatio = '1:1', frameDelayMs = 1300, mode = 'steps', prompt = '', durationSec = 5 } = req.body || {};

    // ── Mode scène animée (image-to-video) ──
    if (mode === 'scene') {
      const { scenario = '', productContext = '', voiceoverText = '', stage = 'complete', preparedImageUrl = '', preparedVideoUrl = '' } = req.body || {};
      if (stage === 'voice') {
        if (!/^https?:\/\//.test(String(preparedVideoUrl))) {
          return res.status(400).json({ success: false, message: 'La vidéo à sonoriser est requise' });
        }
        const spokenText = String(voiceoverText || '').trim().slice(0, 300)
          || `Découvrez ${String(subject || '').trim() || 'ce produit'}, pensé pour simplifier votre quotidien.`;
        const { textToSpeech } = await import('../services/ritaAgentService.js');
        const { addVoiceoverToVideo } = await import('../services/falVideoService.js');
        const audioBuffer = await textToSpeech(spokenText, { language: 'fr' });
        if (!audioBuffer) throw new Error('Génération de la voix impossible');
        const finalBuffer = await addVoiceoverToVideo(String(preparedVideoUrl), audioBuffer, { maxSeconds: Math.max(2, Math.min(6, Math.round(Number(durationSec) || 6))) });
        const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
        const finalUp = await uploadToR2(finalBuffer, `ai-scene-final-${Date.now()}.mp4`, 'video/mp4');
        if (!finalUp?.success) throw new Error(finalUp?.error || 'Publication de la vidéo finale impossible');
        return res.json({ success: true, videoUrl: finalUp.url });
      }
      const SCENARIOS = ['ugc_testimonial', 'before_after', 'action', 'worn', 'lifestyle', 'unboxing', 'product_spot', 'rotation'];
      const scenarioId = SCENARIOS.includes(scenario) ? scenario : '';
      const sceneTxt = String(prompt || '').trim();
      if (!scenarioId && sceneTxt.length < 8) {
        return res.status(400).json({ success: false, message: 'Choisissez un scénario ou décrivez la situation à illustrer' });
      }
      const { isFalConfigured, isKieVideoConfigured, isXaiConfigured, falImageToVideo, grokImageToVideo, xaiImageToVideo, mp4UrlToGifBuffer, addVoiceoverToVideo } = await import('../services/falVideoService.js');
      // Providers par ordre de priorité : xAI officiel (grok-imagine-video-1.5,
      // 480p) → Grok via kie.ai → fal.ai. GIF_VIDEO_PROVIDER=xai|grok|fal force
      // le premier essayé ; les suivants servent de bascule automatique.
      const forced = String(process.env.GIF_VIDEO_PROVIDER || '').toLowerCase();
      const available = [
        ['xai', isXaiConfigured()],
        ['grok', isKieVideoConfigured()],
        ['fal', isFalConfigured()],
      ].filter(([, ok]) => ok).map(([id]) => id);
      const providerOrder = forced && available.includes(forced)
        ? [forced, ...available.filter((p) => p !== forced)]
        : available;
      if (!providerOrder.length) {
        return res.status(503).json({ success: false, message: 'Vidéo IA non configurée — ajoutez XAI_API_KEY, KIE_API_KEY ou FAL_KEY dans le .env' });
      }
      const provider = providerOrder[0];

      const subjTxt = String(subject || '').trim();
      const ctxTxt = String(productContext || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
      const hasSourcePhoto = Boolean(sourceUrl && /^https?:\/\//.test(String(sourceUrl)));
      // Plan SANS produit : quand la génération est demandée sans produit visible,
      // on n'injecte pas le nom/la ref du produit et on interdit tout produit à l'écran.
      const noProduct = req.body?.showProduct === false;
      const subjForPrompt = noProduct ? '' : subjTxt;
      // Durée = besoin réel du script, jamais gonflée, plafond dur à 6 s.
      const gifSeconds = Math.max(2, Math.min(6, Math.round(Number(durationSec) || 6)));

      // 0. Analyse visuelle de la photo produit (vision) : fiche d'inventaire
      //    ultra précise (type exact, matériaux, packaging, gestes d'usage) —
      //    le réalisateur ne dépend plus de la qualité de la description
      //    marchande. Best-effort : '' si échec.
      let visualAnalysis = '';
      if (hasSourcePhoto) {
        const { analyzeProductImageForVideo } = await import('../services/openaiImageService.js');
        visualAnalysis = await analyzeProductImageForVideo(String(sourceUrl));
      }

      // 1. « Réalisateur » : DeepSeek croise l'analyse visuelle, la description
      //    et le scénario, puis écrit l'image de départ + une TIMELINE d'actions
      //    chronométrées. Règles dures : GIF e-com muet, AUCUN texte incrusté.
      let startFramePrompt = '';
      // Phrase de voix off du plan : le réalisateur doit l'ILLUSTRER visuellement
      // (plante citée → la plante à l'écran, processus → les gestes, etc.).
      const voiceLine = String(voiceoverText || '').trim().slice(0, 300);
      let motionPrompt = `${sceneTxt || scenarioId}${subjForPrompt ? ` (product: ${subjForPrompt})` : ''}${noProduct ? '. NO product anywhere in the frame — lifestyle/emotional shot only' : ''}${voiceLine ? `. The visuals must illustrate: "${voiceLine}"` : ''}. Smooth realistic physically consistent motion, professional lighting. Absolutely no on-screen text, no captions, no logos.`;
      if (DEEPSEEK_API_KEY) {
        try {
          const directorRaw = await callDeepseek([
            {
              role: 'system',
              content: `You are an e-commerce video director creating short SILENT product GIFs (the visuals must contain NO text).
Scenario rules — always deduce specifics from the ACTUAL product (use the visual analysis as ground truth over the merchant description if they conflict):
- ugc_testimonial: an authentic African UGC creator speaking enthusiastically to the camera while naturally holding and showing this exact product; handheld smartphone framing, believable gestures and expressions, creator-style setting. The clip is silent, so communicate conviction visually without relying on audible dialogue.
- before_after: a person who visibly HAS the specific problem this product solves (deduce it), looking bothered at first; the motion shows the transition to the SAME person delighted, problem visibly solved, product in frame.
- action: a person actively using or consuming the product EXACTLY the way this specific product is used (deduce the exact gesture from the visual analysis: drink → lifts it and drinks, cream → opens jar, scoops, applies in circles...).
- worn: a person wearing/carrying the product naturally in daily life.
- lifestyle: the product in a warm, real-life scene, slow camera glide.
- unboxing: hands opening this exact packaging and revealing the product, premium feel.
- product_spot: a polished commercial product spot with this exact product as the hero, premium studio lighting, purposeful camera movement, elegant highlights and a strong advertising composition.
- rotation: the product ALONE rotating slowly on a clean studio background (no person).
- free: follow the merchant's description faithfully.
ILLUSTRATE THE MESSAGE — applies to EVERY scenario and is CRITICAL for 'free' storyboard plans. The visuals must SHOW what the words say (spoken line + merchant text are the brief):
- A plant or ingredient is named (aloe, ginger, shea, turmeric, moringa, collagen…) → put it PHYSICALLY in frame: fresh leaves, roots, butter, powder or extract styled on set next to the action, or make it the macro hero of the shot (water droplets, rich texture). A named ingredient must NEVER stay invisible.
- Composition / formula / "made with…" → the actual ingredients artfully arranged around the product, a texture close-up, powder or a drop falling, liquid infusing or swirling.
- A process is described (how it's made, how it works, steps of use) → stage the process itself as concrete filmed actions the camera follows (hands performing each step in order, the mechanism visibly operating) — never people vaguely smiling instead of the process.
- An INTERNAL body effect is described (lungs clearing, mucus dissolving, digestion, hair regrowth, skin repairing…) → make the WHOLE shot a premium 3D medical-animation style visualization of that organ/process in action (clean, realistic anatomy, no text) — like the anatomy inserts of top-performing TikTok health ads.
- The product produces a visible effect in use (vapor, steam, foam, lather, texture, glow) → show that effect clearly on camera during the action; it is the proof.
- A problem or a result is mentioned → make it VISIBLE on screen (the problem state, then the visible improvement).
Everything must fit ONE continuous shot: bring the evoked elements INTO the set as props, textures and gestures rather than imagining a second shot.
PRECISION RULES for motion_prompt — this is the most important part:
- Write it as a chronological TIMELINE covering exactly ${gifSeconds} seconds (never more than 6), in 2-second beats: "0-2s: ... 2-4s: ... 4-6s: ...".
- ONE atomic, physically plausible action per beat (which hand, exact gesture, where eyes look, what the product does). No vague verbs like "uses" or "enjoys" — name the concrete gesture.
- Actions must be specific to THIS product (its cap, pump, strap, texture...), never generic.
- Camera: prefer DYNAMIC, energetic movement — a confident push-in, a quick reveal pan, a punchy dolly or lively handheld energy — to feel scroll-stopping (reserve a locked-off shot only for a clean product spot). State one clear camera behavior for the whole shot.
- ENERGY (crucial): the clip must feel DYNAMIC and lively — purposeful, visible motion in EVERY beat, snappy pacing, engaging body language and expressions; never a static, slow or sleepy shot. Think TikTok/Reels ad energy.
- PHYSICAL CONSISTENCY: no morphing, no objects appearing or vanishing mid-shot, hands keep five natural fingers, and the product's geometry, colors and label never change during the shot.
QUALITY BAR for start_frame_prompt: a photorealistic, professionally lit commercial frame — one clear subject, clean composition, flattering key light coherent with the setting, sharp focus, natural skin, premium appetizing styling of any ingredients (fresh, glistening, precisely arranged); it must read as a high-end ad still, never a casual snapshot.
HARD CONSTRAINTS for BOTH prompts: absolutely NO on-screen text, NO captions, NO subtitles, NO watermarks, NO logo overlays, and no visual storytelling that depends on audible dialogue; realistic people and lighting; modern African urban setting whenever people appear; the product must stay EXACTLY as provided — same shape, colors, packaging and labels, never invent readable text on it; one single continuous shot with smooth motion.
Reply ONLY with JSON: {"start_frame_prompt":"...","motion_prompt":"..."} — start_frame_prompt (English, max 100 words) describes the FIRST still frame and must already place everything needed for beat 0-2s (including any ingredients/props the message requires); motion_prompt (English, max 130 words) is the timeline starting from exactly that frame.${noProduct ? '\n\nABSOLUTE OVERRIDE — NO PRODUCT: this scene must contain NO product at all. Do NOT show, hold, place, reveal or reference any product, package, bottle, box, jar, tube or label anywhere. It is a lifestyle / emotional / contextual shot of the person and setting ONLY. Ignore every instruction above about featuring or preserving the product.' : ''}`,
            },
            {
              role: 'user',
              content: `Produit : ${noProduct ? 'AUCUN — plan lifestyle SANS produit' : (subjTxt || 'non précisé')}\nDescription (contexte only) : ${ctxTxt || '—'}\nAnalyse visuelle de la photo (vérité terrain) : ${noProduct ? '—' : (visualAnalysis || '—')}\nScénario : ${scenarioId || 'free'}\nPrécisions du marchand : ${sceneTxt || '—'}\nTexte prononcé pendant ce plan — la vidéo doit l'ILLUSTRER littéralement : ${voiceLine || '—'}\nDurée du GIF : ${gifSeconds} secondes\nPhoto du produit fournie : ${noProduct ? 'non (plan sans produit)' : (hasSourcePhoto ? 'oui (référence exacte)' : 'non')}`,
            },
          ]);
          const jsonMatch = String(directorRaw || '').match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.start_frame_prompt) startFramePrompt = String(parsed.start_frame_prompt);
            if (parsed.motion_prompt) motionPrompt = `${String(parsed.motion_prompt)} Strictly no on-screen text, no captions, no logos.`;
          }
        } catch (e) {
          console.warn('[BuilderAI] director step failed, using fallback prompts:', e.message);
        }
      }
      if (!startFramePrompt) {
        startFramePrompt = `First frame of a short silent e-commerce clip: ${sceneTxt || scenarioId}${subjForPrompt ? ` — product: ${subjForPrompt}` : ''}${noProduct ? ' — absolutely NO product visible, lifestyle/emotional shot only' : ''}${voiceLine ? `. The frame must illustrate: "${voiceLine}" (show the named ingredients/process physically)` : ''}. Photorealistic, professionally lit commercial photo, sharp focus, no text anywhere, composition ready to be animated.`;
      }

      // 2. Image de départ. Scénarios avec personnage : même si la photo produit
      //    est fournie, GPT Image (édition) installe la scène AUTOUR du produit
      //    exact — l'i2v n'a plus qu'à animer. Rotation : photo produit telle
      //    quelle. Sans photo : création pure.
      // Image de départ via le MÊME pipeline résilient que les affiches
      // (OpenAI → KIE.ai gpt-image-2 → Gemini). Si toute la génération échoue, on
      // anime la photo produit brute : un clip est produit dans tous les cas.
      const { generateGptImage2ImageToImage, generateNanoBananaImage } = await import('../services/nanoBananaService.js');
      let startImage = /^https?:\/\//.test(String(preparedImageUrl)) ? String(preparedImageUrl) : (hasSourcePhoto ? String(sourceUrl) : null);
      const keepRawPhoto = scenarioId === 'rotation' && hasSourcePhoto;
      if (!preparedImageUrl && !keepRawPhoto) {
        try {
          startImage = hasSourcePhoto
            ? await generateGptImage2ImageToImage(`${startFramePrompt}\nUse the provided photo as the EXACT product reference: same product, same packaging, same colors and labels. No added text.`, String(sourceUrl), 'auto', null, {})
            : await generateNanoBananaImage(startFramePrompt, '1:1', 1);
        } catch (imgErr) {
          console.warn('[BuilderAI] scene start-image failed, fallback to raw photo:', imgErr.message);
          if (!startImage) {
            return res.status(503).json({ success: false, message: 'Génération de l\'image de départ impossible — ajoutez une photo du produit et réessayez' });
          }
          // sinon : on conserve la photo produit brute, l'i2v (Grok) fera le reste
        }
      }

      if (stage === 'character') {
        return res.json({ success: true, startImage });
      }

      // 3. Vidéo → GIF → R2 (le mp4 est aussi republié pour un usage <video>)
      // Résilience : les providers configurés sont essayés DANS L'ORDRE
      // (xAI officiel → kie.ai → fal.ai) ; chaque échec bascule sur le suivant
      // et l'erreur finale nomme chaque provider avec sa cause.
      const runProvider = (p) => (p === 'xai'
        ? xaiImageToVideo(motionPrompt, startImage, { durationSec: gifSeconds })
        : p === 'grok'
          ? grokImageToVideo(motionPrompt, startImage, { durationSec: gifSeconds })
          : falImageToVideo(motionPrompt, startImage, { durationSec: gifSeconds }));
      let videoUrl;
      {
        const failures = [];
        for (const p of providerOrder) {
          try {
            videoUrl = await runProvider(p);
            break;
          } catch (provErr) {
            failures.push(`${p} : ${provErr.message}`);
            console.warn(`[BuilderAI] i2v ${p} a échoué (${provErr.message})${providerOrder[providerOrder.indexOf(p) + 1] ? ' — bascule sur le suivant' : ''}`);
          }
        }
        if (!videoUrl) throw new Error(`Génération vidéo impossible — ${failures.join(' ; ')}`);
      }
      if (stage === 'video') {
        const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
        const rawVideo = Buffer.from((await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 })).data);
        const rawUp = await uploadToR2(rawVideo, `ai-scene-preview-${Date.now()}.mp4`, 'video/mp4');
        if (!rawUp?.success) throw new Error(rawUp?.error || 'Publication de l’aperçu vidéo impossible');
        return res.json({ success: true, videoUrl: rawUp.url, startImage });
      }
      let voicedVideoBuffer = null;
      const requestedVoice = String(voiceoverText || '').trim().slice(0, 300);
      const spokenText = requestedVoice || `Découvrez ${subjTxt || 'ce produit'}, pensé pour simplifier votre quotidien.`;
      try {
        const { textToSpeech } = await import('../services/ritaAgentService.js');
        const audioBuffer = await textToSpeech(spokenText, { language: 'fr' });
        if (audioBuffer) voicedVideoBuffer = await addVoiceoverToVideo(videoUrl, audioBuffer, { maxSeconds: gifSeconds });
      } catch (voiceErr) {
        console.warn('[BuilderAI] voiceover failed, keeping provider audio:', voiceErr.message);
      }
      // GIF final : tronqué par ffmpeg à la durée exacte demandée (≤ 10 s).
      const gifBuffer = await mp4UrlToGifBuffer(videoUrl, { maxSeconds: gifSeconds });
      const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
      const gifUp = await uploadToR2(gifBuffer, `ai-scene-gif-${Date.now()}.gif`, 'image/gif');
      if (!gifUp?.success || typeof gifUp.url !== 'string') {
        throw new Error(gifUp?.error || 'Publication du GIF impossible');
      }
      let mp4Url = videoUrl;
      try {
        const videoBuffer = voicedVideoBuffer || Buffer.from((await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 })).data);
        const vUp = await uploadToR2(videoBuffer, `ai-scene-video-${Date.now()}.mp4`, 'video/mp4');
        if (vUp?.success && typeof vUp.url === 'string') mp4Url = vUp.url;
      } catch { /* on garde l'URL fal */ }

      // Médiathèque (best-effort) : le GIF et sa vidéo source
      const GeneratedMedia = (await import('../models/GeneratedMedia.js')).default;
      const mediaBase = {
        workspaceId: req.workspaceId, storeId: req.activeStoreId, userId: req.ecomUser?._id,
        prompt: sceneTxt || scenarioId, sourceUrl: hasSourcePhoto ? String(sourceUrl) : '',
        meta: { scenario: scenarioId, durationSec: gifSeconds, subject: subjTxt },
      };
      GeneratedMedia.record({ ...mediaBase, type: 'gif', url: gifUp.url, kind: 'scene-gif' });
      GeneratedMedia.record({ ...mediaBase, type: 'video', url: mp4Url, kind: 'scene-video' });

      return res.json({ success: true, url: gifUp.url, videoUrl: mp4Url, startImage });
    }

    // ── Mode étapes (mode d'emploi) ──
    const cleanSteps = (Array.isArray(steps) ? steps : [])
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 5);
    if (cleanSteps.length < 2) {
      return res.status(400).json({ success: false, message: 'Décrivez au moins 2 étapes' });
    }

    const { isOpenAiImageConfigured, generateOpenAiImage, generateOpenAiImageEdit } = await import('../services/openaiImageService.js');
    if (!isOpenAiImageConfigured()) {
      return res.status(503).json({ success: false, message: 'Génération d\'images non configurée' });
    }

    const subjectTxt = String(subject || '').trim();
    const hasSource = sourceUrl && /^https?:\/\//.test(String(sourceUrl));
    const ar = ['1:1', '4:3', '3:4', '16:9', '9:16', '4:5'].includes(aspectRatio) ? aspectRatio : '1:1';

    // 1. Générer chaque frame (séquentiel — cohérence + douceur sur l'API)
    const frameUrls = [];
    for (let i = 0; i < cleanSteps.length; i++) {
      const prompt = `Étape ${i + 1} sur ${cleanSteps.length} du mode d'emploi${subjectTxt ? ` de ${subjectTxt}` : ' du produit'} : ${cleanSteps[i]}.
Style CONSTANT sur toutes les étapes : même produit, même décor, même éclairage, même cadrage, photo réaliste lumineuse. Petit badge rond en haut à gauche avec le numéro « ${i + 1} ».`;
      // eslint-disable-next-line no-await-in-loop
      const url = hasSource
        ? await generateOpenAiImageEdit(prompt, [String(sourceUrl)], 'auto', {})
        : await generateOpenAiImage(prompt, ar, {});
      frameUrls.push(url);
    }

    // 2. Télécharger + normaliser les frames (mêmes dimensions, RGBA brut)
    // NB : sharp 0.33 ne sait pas assembler plusieurs images en GIF animé
    // (l'entrée tableau + join n'existe qu'à partir de 0.34) — l'encodage
    // GIF est donc fait avec gifenc (pur JS, aucune dépendance native).
    const sharp = (await import('sharp')).default;
    const W = 640;
    const H = ar === '9:16' ? 1136 : ar === '16:9' ? 360 : ar === '4:5' ? 800 : ar === '3:4' ? 853 : ar === '4:3' ? 480 : 640;
    const rawFrames = [];
    for (const fUrl of frameUrls) {
      // eslint-disable-next-line no-await-in-loop
      const resp = await axios.get(fUrl, { responseType: 'arraybuffer', timeout: 60000 });
      // eslint-disable-next-line no-await-in-loop
      const rgba = await sharp(Buffer.from(resp.data))
        .resize(W, H, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer();
      rawFrames.push(rgba);
    }

    // 3. Assembler en GIF animé (gifenc) puis publier sur R2
    const delay = Math.min(4000, Math.max(400, Number(frameDelayMs) || 1300));
    const gifencMod = await import('gifenc');
    const { GIFEncoder, quantize, applyPalette } = gifencMod.default || gifencMod;
    const gif = GIFEncoder();
    for (const rgba of rawFrames) {
      const pixels = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
      const palette = quantize(pixels, 256);
      const index = applyPalette(pixels, palette);
      gif.writeFrame(index, W, H, { palette, delay, repeat: 0 });
    }
    gif.finish();
    const gifBuffer = Buffer.from(gif.bytes());

    const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
    // uploadToR2 retourne { success, url } (objet), pas une chaîne
    const uploadRes = await uploadToR2(gifBuffer, `ai-usage-gif-${Date.now()}.gif`, 'image/gif');
    if (!uploadRes?.success || typeof uploadRes.url !== 'string') {
      throw new Error(uploadRes?.error || 'Publication du GIF impossible');
    }

    // Médiathèque (best-effort)
    (await import('../models/GeneratedMedia.js')).default.record({
      workspaceId: req.workspaceId, storeId: req.activeStoreId, userId: req.ecomUser?._id,
      type: 'gif', url: uploadRes.url, kind: 'steps-gif',
      prompt: cleanSteps.join(' → '), sourceUrl: hasSource ? String(sourceUrl) : '',
      meta: { steps: cleanSteps.length, subject: subjectTxt },
    });

    return res.json({ success: true, url: uploadRes.url, frames: frameUrls });
  } catch (error) {
    // Stack complète en log : indispensable pour diagnostiquer les 500 en prod.
    console.error('[BuilderAI] generate-gif error:', error.message, '\n', error.stack);
    return res.status(500).json({ success: false, message: error.message || 'Génération du GIF impossible, réessayez' });
  }
});

// ─── Génération de texte court (DeepSeek) pour les formulaires admin ────────
// Body: { purpose, context?, instruction?, maxWords? } → { success, text }
// purpose ex: 'collection-description', 'product-title', 'section-title'…
router.post('/generate-text', requireEcomAuth, async (req, res) => {
  try {
    const { purpose = 'texte', context = {}, instruction = '', maxWords = 45, format = 'plain' } = req.body || {};
    if (!DEEPSEEK_API_KEY) {
      return res.status(503).json({ success: false, message: 'Service IA non disponible' });
    }

    const isHtml = format === 'html';
    const words = Math.min(isHtml ? 300 : 150, Math.max(10, Number(maxWords) || 45));
    const systemContent = isHtml
      ? `Tu es un copywriter e-commerce senior pour le marché africain francophone (COD, WhatsApp).
Tu rédiges une description produit STRUCTURÉE en HTML, prête pour un éditeur riche.
Structure attendue : un titre accrocheur en <h2>, puis 2 à 4 segments — chacun avec un sous-titre <h3> et un paragraphe <p> ; une liste <ul><li> quand c'est pertinent (bénéfices, contenu du pack) ; <strong> pour les mots clés vendeurs.
Balises AUTORISÉES uniquement : <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. RIEN d'autre : pas de <html>, <div>, style, class, markdown ou \`\`\`.
Commence directement par le <h2>. Pas de préambule, pas d'options multiples.
Objet du texte : ${String(purpose).slice(0, 80)}.
Longueur maximum : ${words} mots. Langue : français (sauf indication contraire dans le contexte).`
      : `Tu es un copywriter e-commerce senior pour le marché africain francophone (COD, WhatsApp).
Tu rédiges UN SEUL texte court, vendeur et naturel — pas de guillemets, pas de markdown, pas d'options multiples, pas de préambule.
Objet du texte : ${String(purpose).slice(0, 80)}.
Longueur maximum : ${words} mots. Langue : français (sauf indication contraire dans le contexte).`;

    const messages = [
      { role: 'system', content: systemContent },
      {
        role: 'user',
        content: `Contexte (JSON) : ${JSON.stringify(context).slice(0, 2000)}\n${instruction ? `Consigne du marchand : ${String(instruction).slice(0, 600)}` : 'Rédige le texte le plus efficace possible.'}`,
      },
    ];

    const raw = await callDeepseek(messages);
    let text = String(raw || '').trim();
    if (isHtml) {
      // Nettoyage : fences markdown, balises dangereuses, attributs événements
      text = text
        .replace(/```(?:html)?/gi, '')
        .replace(/<\/(?:html|body|head)>/gi, '')
        .replace(/<(?:html|body|head|script|style|iframe)[^>]*>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .trim();
      if (!/<h2|<p/i.test(text)) {
        // Le modèle a répondu en texte plat → conversion minimale
        text = text.split(/\n{2,}|\n/).map((l) => l.trim()).filter(Boolean).map((l) => `<p>${l}</p>`).join('');
      }
    } else {
      text = text.replace(/^["'«\s]+|["'»\s]+$/g, '');
    }
    if (!text) return res.status(502).json({ success: false, message: 'Réponse IA vide, réessayez' });
    return res.json({ success: true, text, format: isHtml ? 'html' : 'plain' });
  } catch (error) {
    console.error('[BuilderAI] generate-text error:', error?.response?.status, error.message);
    return res.status(500).json({ success: false, message: aiErrorMessage(error) });
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

// ─── POST /builder-ai/launch-kit — Kit marketing de lancement (DeepSeek) ─────
// Body: { productName, description?, url?, language?, tone?, angleCount?, scriptCount? }
// → { success, kit: { angles[], videoScripts[], facebookAds{} } }
router.post('/launch-kit', requireEcomAuth, async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) return res.status(503).json({ success: false, message: 'DeepSeek non configuré' });
    const { productName = '', description = '', url = '', language = 'fr', tone = 'direct', part = 'all', angleCount = 3, scriptCount = 5, angleTitles = [], selectedAngle = null, marketingAngles = [], marketInputs = {} } = req.body || {};
    const ctx = String(description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
    const langName = { fr: 'français', en: 'anglais', es: 'espagnol' }[language] || 'français';
    const nAngles = Math.min(10, Math.max(1, Number(angleCount) || 3));
    const titles = Array.isArray(angleTitles) ? angleTitles.filter(Boolean).map(String).slice(0, 10) : [];
    const adsAngles = Array.isArray(marketingAngles) ? marketingAngles.slice(0, 10).map(a => ({
      title: String(a?.title || '').slice(0, 120),
      audience: String(a?.audience || '').slice(0, 220),
      description: String(a?.description || '').slice(0, 500),
      hooks: Array.isArray(a?.hooks) ? a.hooks.slice(0, 3).map(h => String(h).slice(0, 240)) : [],
    })).filter(a => a.title) : [];
    const dailyBudgetUsd = Math.max(1, Number(marketInputs?.dailyBudgetUsd) || 10);
    const calculatedAdSetCount = Math.min(8, Math.max(1, Math.ceil(dailyBudgetUsd / 10)));
    const requestedAdSetCount = Math.min(8, Math.max(1, Number(marketInputs?.adSetCount) || calculatedAdSetCount));
    const adsPerAdSet = 5;
    const safeMarketInputs = {
      country: String(marketInputs?.country || '').slice(0, 100),
      currency: String(marketInputs?.currency || 'XAF').slice(0, 8),
      purchaseCost: Math.max(0, Number(marketInputs?.purchaseCost) || 0),
      sellingPrice: Math.max(0, Number(marketInputs?.sellingPrice) || 0),
      variableCosts: Math.max(0, Number(marketInputs?.variableCosts) || 0),
      failedDeliveryCost: Math.max(0, Number(marketInputs?.failedDeliveryCost) || 0),
      deliveryRate: Math.min(60, Math.max(30, Number(marketInputs?.deliveryRate) || 45)),
      unitMargin: Math.max(0, Number(marketInputs?.unitMargin) || 0),
      expectedProfitPerOrder: Math.max(0, Number(marketInputs?.expectedProfitPerOrder) || 0),
      targetCpa: Math.max(0, Number(marketInputs?.targetCpa) || 0),
      recommendedLocalDailyBudget: Math.max(0, Number(marketInputs?.recommendedLocalDailyBudget) || 0),
      dailyBudgetUsd,
      adSetCount: requestedAdSetCount,
      adsPerAdSet,
    };
    // 2 scripts par angle (une version 30 s + une version 60 s).
    const nScripts = titles.length ? titles.length * 2 : Math.min(20, Math.max(1, Number(scriptCount) || 6));

    // Schéma JSON par partie — permet une génération ÉTAPE PAR ÉTAPE (un appel par section).
    const schemas = {
      angles: `"angles":[{"title":"nom court de l'angle","audience":"cible visée","description":"2 à 3 phrases","hooks":["hook 1 qui stoppe le scroll","hook 2","hook 3"]}] (exactement ${nAngles} angles, CHACUN avec exactement 3 hooks publicitaires courts et distincts)`,
      scripts: selectedAngle && typeof selectedAngle === 'object'
        ? `"videoScripts":[{"title":"titre du script","hookIndex":0,"hook":"hook exact","durationSec":45,"framework":"AIDA ou PAS","script":"script UGC complet prêt à lire","scenes":[{"voiceover":"phrase exacte prononcée sur ce plan","visual":"description visuelle PRÉCISE du plan à filmer : lieu, sujet, action, cadrage, ambiance","product":true,"media":"video ou image","role":"hook|probleme|benefice|preuve|demo|cta","highlight":false}]}] (génère exactement TROIS scripts distincts, un pour chacun des 3 hooks de l'angle sélectionné. Chaque script commence mot pour mot par son hook, puis suit STRICTEMENT une structure de copywriting professionnelle — choisis pour chaque script le framework le plus adapté à l'angle : AIDA (Attention → Intérêt → Désir → Preuve → Action) ou PAS (Problème → Agitation qui remue la douleur → Solution produit → Preuve → Action) — et renseigne "framework":"AIDA" ou "PAS". Aligne les "role" des plans sur les étapes (attention/problème → hook ou probleme ; intérêt/agitation → probleme ou benefice ; désir/solution → benefice ou demo ; preuve → preuve ; action → cta). Durée 35 à 50 secondes (90 à 125 mots), JAMAIS moins de 30 secondes ; narration parlée naturelle, sans didascalies. Copywriting pro : bénéfices concrets et spécifiques (zéro superlatif creux), une objection levée, une preuve crédible, un CTA urgent et précis ; chaque phrase ENCHAÎNE sur la précédente avec des connecteurs parlés (« et le pire… », « résultat… », « c'est là que… ») — la vidéo doit se dérouler comme une histoire, pas une liste. Utilise "hookIndex":0, puis 1, puis 2. Découpe AUSSI chaque script en 6 à 9 plans "scenes" dont les "voiceover" mis bout à bout reproduisent EXACTEMENT le "script". Chaque "visual" doit ILLUSTRER LITTÉRALEMENT sa phrase "voiceover" : plante ou ingrédient cité → plan macro de cette plante/cet ingrédient réel (frais, texture, gouttes) ; composition ou formule → ingrédients disposés autour du produit, texture en gros plan, poudre ou goutte en mouvement ; processus, fabrication ou étapes d'utilisation → gestes concrets filmés étape par étape ; effet INTERNE au corps (poumons, digestion, peau, cheveux…) → plan façon animation 3D médicale réaliste de l'organe/du processus en action ; effet visible du produit à l'usage (vapeur, mousse, texture) → montré clairement à l'écran ; problème ou résultat → rendu VISIBLE à l'écran. Varie les types de plans (macro ingrédient, gros plan produit, démonstration, animation 3D, plan personne) — jamais une suite de plans génériques de personnes qui sourient. Structure gagnante style UGC TikTok : hook selfie percutant → révélation du produit avec ses ingrédients en scène → bénéfices en plans COURTS → démonstration réelle avec effet visible → CTA final face caméra. CONTRAINTE DURE : chaque "voiceover" est une PHRASE COMPLÈTE et grammaticale, avec articles et verbes conjugués, naturelle à l'oral — par exemple « La fatigue oculaire constante, les picotements qui gâchent vos soirées, ça vous parle ? » et JAMAIS le style télégraphique « Fatigue oculaire constante, picotements qui gâchent vos soirées ». Chaque phrase a un sens complet toute seule. RYTHME PRO (la longueur de la phrase fait la durée du plan) : hook et bénéfices en phrases COURTES et percutantes de 7 à 10 mots (plans de 3-4 s) ; problème et agitation en 10 à 13 mots (4-5 s) ; démonstration, preuve et CTA en 12 à 16 mots (5-6 s) — c'est cette alternance court/long qui rend le montage dynamique. STRATÉGIE DE COÛT — champ "media" de chaque plan : mets "video" UNIQUEMENT quand le mouvement est indispensable (hook avec personne qui parle/agit, démonstration ou geste d'utilisation, effet interne 3D, CTA final face caméra) ; mets "image" pour les plans illustratifs qui vivent très bien en photo animée au montage (macro plante/ingrédient, composition autour du produit, packshot, texture, décor, problème statique). Vise ENVIRON LA MOITIÉ des plans en "image". MONTEUR EXPERT — champs obligatoires par plan : "role" = fonction narrative exacte du plan (hook, probleme, benefice, preuve, demo, cta) — le montage choisit ses transitions avec ; "highlight":true UNIQUEMENT sur le ou les 1-2 plans (démo/preuve) où un détail précis du produit mérite un cercle d'accent à l'écran, false partout ailleurs. Mets "product":true UNIQUEMENT quand le produit apparaît réellement dans le plan, et "product":false pour les plans lifestyle/émotion/personne — NE montre PAS le produit dans chaque plan. Angle sélectionné : ${JSON.stringify(selectedAngle).slice(0, 1800)})`
        : titles.length
        ? `"videoScripts":[{"title":"titre : angle + durée","durationSec":40,"framework":"AIDA ou PAS","script":"narration continue prête à lire à voix haute, sans didascalies","scenes":[{"voiceover":"phrase exacte de ce plan","visual":"description visuelle PRÉCISE du plan : lieu, sujet, action, cadrage, ambiance","product":true,"media":"video ou image","role":"hook|probleme|benefice|preuve|demo|cta","highlight":false}]}] (pour CHAQUE angle ci-dessous, génère DEUX scripts : d'abord une version de 40 secondes (~100 mots, "durationSec":40), puis une version de 60 secondes (~150 mots, "durationSec":60) — AUCUN script sous 30 secondes. Chaque script suit STRICTEMENT un framework de copywriting — AIDA (Attention → Intérêt → Désir → Preuve → Action) ou PAS (Problème → Agitation → Solution → Preuve → Action), renseigné dans "framework" — avec les "role" des plans alignés sur les étapes, des connecteurs parlés entre les phrases (la narration s'enchaîne comme une histoire), des bénéfices concrets, une preuve crédible et un CTA urgent. Découpe CHAQUE script en 6 à 9 plans "scenes" dont les "voiceover" bout à bout reproduisent EXACTEMENT le "script". Chaque "visual" doit ILLUSTRER LITTÉRALEMENT sa phrase "voiceover" : plante ou ingrédient cité → plan macro de cette plante/cet ingrédient réel (frais, texture, gouttes) ; composition ou formule → ingrédients disposés autour du produit, texture en gros plan, poudre ou goutte en mouvement ; processus, fabrication ou étapes d'utilisation → gestes concrets filmés étape par étape ; effet INTERNE au corps (poumons, digestion, peau, cheveux…) → plan façon animation 3D médicale réaliste de l'organe/du processus en action ; effet visible du produit à l'usage (vapeur, mousse, texture) → montré clairement à l'écran ; problème ou résultat → rendu VISIBLE à l'écran. Varie les types de plans (macro ingrédient, gros plan produit, démonstration, animation 3D, plan personne) — jamais une suite de plans génériques de personnes qui sourient. Structure gagnante style UGC TikTok : hook selfie percutant → révélation du produit avec ses ingrédients en scène → bénéfices en plans COURTS → démonstration réelle avec effet visible → CTA final face caméra. CONTRAINTE DURE : chaque "voiceover" est une PHRASE COMPLÈTE et grammaticale, avec articles et verbes conjugués, naturelle à l'oral — par exemple « La fatigue oculaire constante, les picotements qui gâchent vos soirées, ça vous parle ? » et JAMAIS le style télégraphique « Fatigue oculaire constante, picotements qui gâchent vos soirées ». Chaque phrase a un sens complet toute seule. RYTHME PRO (la longueur de la phrase fait la durée du plan) : hook et bénéfices en phrases COURTES et percutantes de 7 à 10 mots (plans de 3-4 s) ; problème et agitation en 10 à 13 mots (4-5 s) ; démonstration, preuve et CTA en 12 à 16 mots (5-6 s) — c'est cette alternance court/long qui rend le montage dynamique. STRATÉGIE DE COÛT — champ "media" de chaque plan : mets "video" UNIQUEMENT quand le mouvement est indispensable (hook avec personne qui parle/agit, démonstration ou geste d'utilisation, effet interne 3D, CTA final face caméra) ; mets "image" pour les plans illustratifs qui vivent très bien en photo animée au montage (macro plante/ingrédient, composition autour du produit, packshot, texture, décor, problème statique). Vise ENVIRON LA MOITIÉ des plans en "image". MONTEUR EXPERT — champs obligatoires par plan : "role" = fonction narrative exacte du plan (hook, probleme, benefice, preuve, demo, cta) — le montage choisit ses transitions avec ; "highlight":true UNIQUEMENT sur le ou les 1-2 plans (démo/preuve) où un détail précis du produit mérite un cercle d'accent à l'écran, false partout ailleurs. Mets "product":true seulement si le produit apparaît dans le plan, "product":false pour les plans lifestyle/personne — pas de produit à chaque plan. Angles dans l'ordre : ${titles.map((t, i) => `${i + 1}) ${t}`).join(' ; ')})`
        : `"videoScripts":[{"title":"titre","durationSec":40,"framework":"AIDA ou PAS","script":"narration continue prête à lire à voix haute, sans didascalies","scenes":[{"voiceover":"phrase exacte de ce plan","visual":"description visuelle PRÉCISE du plan : lieu, sujet, action, cadrage, ambiance","product":true,"media":"video ou image","role":"hook|probleme|benefice|preuve|demo|cta","highlight":false}]}] (${nScripts} scripts, en alternant des durées de 40 et 60 secondes ("durationSec":40 ou 60), ~100 mots pour 40 s et ~150 mots pour 60 s — AUCUN script sous 30 secondes. Chaque script suit STRICTEMENT AIDA (Attention → Intérêt → Désir → Preuve → Action) ou PAS (Problème → Agitation → Solution → Preuve → Action), renseigné dans "framework", avec les "role" des plans alignés sur les étapes, des connecteurs parlés entre les phrases, des bénéfices concrets, une preuve crédible et un CTA urgent. Découpe CHAQUE script en 6 à 9 plans "scenes" dont les "voiceover" bout à bout reproduisent EXACTEMENT le "script". Chaque "visual" doit ILLUSTRER LITTÉRALEMENT sa phrase "voiceover" : plante ou ingrédient cité → plan macro de cette plante/cet ingrédient réel (frais, texture, gouttes) ; composition ou formule → ingrédients disposés autour du produit, texture en gros plan, poudre ou goutte en mouvement ; processus, fabrication ou étapes d'utilisation → gestes concrets filmés étape par étape ; effet INTERNE au corps (poumons, digestion, peau, cheveux…) → plan façon animation 3D médicale réaliste de l'organe/du processus en action ; effet visible du produit à l'usage (vapeur, mousse, texture) → montré clairement à l'écran ; problème ou résultat → rendu VISIBLE à l'écran. Varie les types de plans (macro ingrédient, gros plan produit, démonstration, animation 3D, plan personne) — jamais une suite de plans génériques de personnes qui sourient. Structure gagnante style UGC TikTok : hook selfie percutant → révélation du produit avec ses ingrédients en scène → bénéfices en plans COURTS → démonstration réelle avec effet visible → CTA final face caméra. CONTRAINTE DURE : chaque "voiceover" est une PHRASE COMPLÈTE et grammaticale, avec articles et verbes conjugués, naturelle à l'oral — par exemple « La fatigue oculaire constante, les picotements qui gâchent vos soirées, ça vous parle ? » et JAMAIS le style télégraphique « Fatigue oculaire constante, picotements qui gâchent vos soirées ». Chaque phrase a un sens complet toute seule. RYTHME PRO (la longueur de la phrase fait la durée du plan) : hook et bénéfices en phrases COURTES et percutantes de 7 à 10 mots (plans de 3-4 s) ; problème et agitation en 10 à 13 mots (4-5 s) ; démonstration, preuve et CTA en 12 à 16 mots (5-6 s) — c'est cette alternance court/long qui rend le montage dynamique. STRATÉGIE DE COÛT — champ "media" de chaque plan : mets "video" UNIQUEMENT quand le mouvement est indispensable (hook avec personne qui parle/agit, démonstration ou geste d'utilisation, effet interne 3D, CTA final face caméra) ; mets "image" pour les plans illustratifs qui vivent très bien en photo animée au montage (macro plante/ingrédient, composition autour du produit, packshot, texture, décor, problème statique). Vise ENVIRON LA MOITIÉ des plans en "image". MONTEUR EXPERT — champs obligatoires par plan : "role" = fonction narrative exacte du plan (hook, probleme, benefice, preuve, demo, cta) — le montage choisit ses transitions avec ; "highlight":true UNIQUEMENT sur le ou les 1-2 plans (démo/preuve) où un détail précis du produit mérite un cercle d'accent à l'écran, false partout ailleurs. Mets "product":true seulement si le produit apparaît dans le plan, "product":false pour les plans lifestyle/personne — pas de produit à chaque plan)`,
      ads: `"facebookAds":{"strategyOverview":"analyse de rentabilité adaptée au moteur ANDROMEDA de Meta et au cash on delivery africain","campaignType":"type de campagne recommandé avec justification","objective":"objectif ventes/conversions","audience":"ciblage du pays fourni, large Advantage+","budget":"budget calculé, CPA cible et scaling","adSets":"logique exacte de structure selon le budget","creatives":"volume, diversité et formats","placements":"placements automatiques","testingPlan":"plan de test adapté à la marge et au taux de livraison","kpis":"KPIs incluant CPA commande, CPA livré, taux de confirmation et taux de livraison","andromedaTips":["astuce 1","astuce 2","astuce 3"],"campaignStructure":{"campaign":{"name":"nom professionnel de campagne incluant produit et pays","objective":"Ventes","buyingType":"Enchères","budgetMode":"ABO si petit budget, sinon CBO/Advantage+","dailyBudget":"${dailyBudgetUsd} USD/jour"},"adSets":[{"name":"AS 01 — angle ou groupe d'angles","angle":"angle marketing principal","audience":"audience du pays fourni","optimization":"Achat","placements":"Advantage+","dailyBudget":"part du budget quotidien","ads":[{"name":"AD 01 — nom court","hook":"hook exact ou variante fidèle","format":"UGC 9:16, statique 1:1 ou autre","creativeDirection":"scène concrète","primaryText":"texte principal","headline":"titre court","cta":"Acheter"}]}]} } (CONTRAINTES ABSOLUES : génère exactement ${requestedAdSetCount} ad set(s) et exactement ${adsPerAdSet} publicités par ad set. Répartis les angles marketing entre ces ad sets selon leur complémentarité. Dans chaque ad set, utilise d'abord les hooks exacts disponibles, puis crée des variantes fidèles pour atteindre 5 publicités. Tous les calculs et seuils doivent utiliser le bénéfice MOYEN PAR COMMANDE après application du taux de livraison COD de ${safeMarketInputs.deliveryRate}% et du coût d'échec de livraison, jamais la marge brute d'une commande livrée seule. Respecte le pays, les prix, la marge, le CPA et le budget fournis. Données marché : ${JSON.stringify(safeMarketInputs)}. Angles imposés : ${JSON.stringify(adsAngles).slice(0, 9000)})`,
    };
    const wanted = part === 'all' ? ['angles', 'scripts', 'ads'] : String(part).split(',').map(p => p.trim()).filter(p => schemas[p]);
    if (!wanted.length) return res.status(400).json({ success: false, message: 'Paramètre "part" invalide' });

    const system = 'Tu es un stratège e-commerce (Afrique francophone, vente cash on delivery, Facebook/TikTok Ads, WhatsApp). Déduis le public cible (hommes, femmes ou mixte) UNIQUEMENT à partir de la nature du produit — n\'assume JAMAIS un public féminin par défaut. Adapte le vocabulaire, les accroches, les hooks, les scripts et le ciblage au public réellement pertinent ; si le produit est unisexe, reste neutre en genre (évite les accords genrés type "épuisé(e)" et les formulations qui ne s\'adressent qu\'aux femmes). Tu réponds UNIQUEMENT en JSON valide, sans texte autour, sans balises markdown.';
    const userMsg = `Produit : ${productName || '(non précisé)'}\nDescription : ${ctx || '—'}\nLien : ${url || '—'}\nLangue de rédaction : ${langName}\nTon : ${tone}\nDonnées commerciales : ${JSON.stringify(safeMarketInputs)}\nAngles marketing à respecter : ${adsAngles.length ? JSON.stringify(adsAngles) : '—'}\n\nGénère uniquement : ${wanted.join(', ')}. Réponds EXACTEMENT avec ce JSON :\n{${wanted.map(p => schemas[p]).join(',')}}\nÉcris tout en ${langName}.`;

    const raw = await callDeepseek([{ role: 'system', content: system }, { role: 'user', content: userMsg }]);
    const match = String(raw || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Réponse IA invalide');
    let parsed;
    try { parsed = JSON.parse(match[0]); } catch { throw new Error('JSON IA invalide'); }

    const kit = {};
    if (wanted.includes('angles')) kit.angles = Array.isArray(parsed.angles) ? parsed.angles.slice(0, nAngles).map(a => ({ ...a, hooks: Array.isArray(a.hooks) ? a.hooks.slice(0, 3) : [] })) : [];
    if (wanted.includes('scripts')) kit.videoScripts = Array.isArray(parsed.videoScripts)
      ? parsed.videoScripts.slice(0, selectedAngle ? 3 : nScripts).map((s, index) => ({
          ...s,
          angleTitle: selectedAngle?.title || s.angleTitle || '',
          hookIndex: selectedAngle ? index : s.hookIndex,
          hook: selectedAngle?.hooks?.[index] || s.hook || '',
          scenes: Array.isArray(s.scenes)
            ? s.scenes.slice(0, 8).map(sc => ({ voiceover: String(sc?.voiceover || '').slice(0, 400), visual: String(sc?.visual || '').slice(0, 400), product: sc?.product !== false })).filter(sc => sc.voiceover || sc.visual)
            : [],
        }))
      : [];
    if (wanted.includes('ads')) kit.facebookAds = parsed.facebookAds && typeof parsed.facebookAds === 'object' ? parsed.facebookAds : {};
    return res.json({ success: true, kit });
  } catch (err) {
    console.error('[BuilderAI] launch-kit error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Génération du kit impossible' });
  }
});

// ─── POST /builder-ai/voiceover — Voix-off via Fish Audio ────────────────────
// Body: { text, referenceId? } → { success, url } (mp3 hébergé sur R2)
router.post('/voiceover', requireEcomAuth, async (req, res) => {
  try {
    const FISH_API_KEY = process.env.FISH_API_KEY || process.env.FISHAUDIO_API_KEY || '';
    if (!FISH_API_KEY) return res.status(503).json({ success: false, message: 'Voix-off non configurée — ajoutez FISH_API_KEY dans le .env backend' });
    const { text = '', referenceId = '' } = req.body || {};
    const clean = String(text || '').trim();
    if (clean.length < 2) return res.status(400).json({ success: false, message: 'Texte de narration requis' });
    if (clean.length > 5000) return res.status(400).json({ success: false, message: 'Texte trop long (max 5000 caractères)' });

    const body = { text: clean, format: 'mp3', mp3_bitrate: 128, normalize: true, latency: 'normal' };
    if (referenceId) body.reference_id = String(referenceId);

    const fishRes = await axios.post('https://api.fish.audio/v1/tts', body, {
      headers: {
        Authorization: `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json',
        model: process.env.FISH_MODEL || 's2.1-pro-free',
      },
      responseType: 'arraybuffer',
      timeout: 120000,
    });

    const audioBuffer = Buffer.from(fishRes.data);
    if (!audioBuffer?.length) throw new Error('Réponse audio vide');
    const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
    const up = await uploadToR2(audioBuffer, `voiceover-${Date.now()}.mp3`, 'audio/mpeg');
    if (!up?.success || !up.url) throw new Error(up?.error || 'Publication audio impossible');
    return res.json({ success: true, url: up.url });
  } catch (err) {
    const status = err?.response?.status;
    let msg = err.message;
    if (err?.response?.data) { try { msg = Buffer.from(err.response.data).toString('utf8').slice(0, 300) || msg; } catch { /* noop */ } }
    console.error('[BuilderAI] voiceover error:', status || '', msg);
    if (status === 401 || status === 403) return res.status(502).json({ success: false, message: 'Clé Fish Audio invalide' });
    return res.status(500).json({ success: false, message: msg || 'Voix-off impossible' });
  }
});

// ─── POST /builder-ai/upload-media — upload générique clip/voix/musique → R2 ──
router.post('/upload-media', requireEcomAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
    const mime = req.file.mimetype || 'application/octet-stream';
    const ext = mime.includes('mp4') ? 'mp4'
      : mime.includes('webm') ? 'webm'
      : mime.includes('quicktime') || mime.includes('mov') ? 'mov'
      : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
      : mime.includes('wav') ? 'wav'
      : mime.includes('aac') || mime.includes('m4a') ? 'm4a'
      : mime.includes('png') ? 'png'
      : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg'
      : 'bin';
    const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
    const up = await uploadToR2(req.file.buffer, `creative-upload-${Date.now()}.${ext}`, mime);
    if (!up?.success || !up.url) throw new Error(up?.error || 'Upload impossible');
    return res.json({ success: true, url: up.url, mime });
  } catch (err) {
    console.error('[BuilderAI] upload-media error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Upload impossible' });
  }
});

// ─── Fonds sonores prédéfinis (générés + hébergés sur R2, mis en cache) ──────
router.get('/music-presets', requireEcomAuth, async (req, res) => {
  try {
    const { listPresets, getPresetUrl } = await import('../services/musicPresetsService.js');
    const items = await Promise.all(listPresets().map(async (p) => {
      try { return { ...p, url: await getPresetUrl(p.id) }; }
      catch (e) { console.warn('[MusicPreset]', p.id, e.message); return { ...p, url: null }; }
    }));
    return res.json({ success: true, presets: items.filter((p) => p.url) });
  } catch (err) {
    console.error('[BuilderAI] music-presets error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Fonds sonores indisponibles' });
  }
});

// ─── POST /builder-ai/montage-director — l'IA orchestre le montage ───────────
// Reçoit le storyboard complet et rend TOUTES les décisions de monteur expert :
// transitions par jonction, habillage des sous-titres, musique, Ken Burns,
// médaillon produit, cercles d'accent. Sortie STRICTEMENT validée (whitelists).
router.post('/montage-director', requireEcomAuth, async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) return res.status(503).json({ success: false, message: 'Service IA non disponible' });
    const { productName = '', productContext = '', scenes = [], musicPresets = [] } = req.body || {};
    const sc = (Array.isArray(scenes) ? scenes : []).slice(0, 12).map((s, i) => ({
      i,
      texte: String(s.voiceText || s.subtitleText || '').slice(0, 200),
      visuel: String(s.clipPrompt || '').slice(0, 200),
      role: String(s.role || ''),
      produitVisible: s.showProduct !== false,
      type: s.genMode === 'image' ? 'image' : 'video',
      duree: Number(s.durationSec) || 4,
    }));
    if (!sc.length) return res.status(400).json({ success: false, message: 'Scènes requises' });
    const TR = ['fade', 'fadeblack', 'fadewhite', 'slideleft', 'slideright', 'slideup', 'slidedown', 'wipeleft', 'wiperight', 'circleopen', 'circleclose', 'radial', 'dissolve', 'pixelize', 'smoothleft', 'none'];
    const KB = ['zoomin', 'zoomout', 'panleft', 'panright'];
    const STYLES = ['classic', 'yellow', 'duo_yellow', 'cyan', 'pink', 'green', 'boxed', 'boxed_yellow', 'neon', 'neon_pink', 'neon_violet', 'box_black', 'box_white', 'box_red'];
    const ANIMS = ['pop', 'fade', 'zoom', 'bounce', 'typewriter', 'reveal'];
    const POS = ['top', 'middle', 'bottom'];
    const FONTS = ['sans', 'condensed', 'serif', 'serif2', 'mono'];
    const ACCENTS = ['ring', 'arrow', 'check', 'cross', 'star', 'warning', 'heart'];
    const presetIds = (Array.isArray(musicPresets) ? musicPresets : []).map((p) => String(p)).slice(0, 20);

    const system = `Tu es un directeur de montage publicitaire TikTok/Reels senior. On te donne le storyboard d'une pub e-commerce ; tu rends TOUTES les décisions de montage, comme sur un plateau : rythme, transition à chaque jonction, habillage des sous-titres, musique, médaillon produit, cercles d'accent, mouvements de caméra des plans image.
Règles du métier :
- Transitions : impact (fadewhite) après le hook et juste avant le CTA ; dissolve sur le malaise du problème puis circleopen pour la révélation de la solution ; glissés rythmés (slideleft/slideup) entre bénéfices ; wipe sur les preuves ; JAMAIS deux fois la même transition d'affilée.
- Sous-titres : UN style cohérent pour toute la vidéo, choisi selon le ton du script (énergique/promo → duo_yellow ou box_black avec captionCase "upper" ; premium/élégant → classic ou serif ; tech/moderne → neon). Position "middle" par défaut.
- overlayProduct:true UNIQUEMENT sur les plans de vente (benefice, preuve, cta) où le produit n'est PAS visible à l'écran.
- accent : annotation visuelle ADAPTÉE À LA SITUATION, 3 MAXIMUM sur toute la vidéo, jamais deux sur le même plan. Types : "cross" ou "warning" sur le plan problème (pointer la douleur/l'erreur) ; "check" sur un bénéfice validé ou une promesse tenue ; "star" sur la preuve sociale (avis, note) ; "ring" pour encercler un détail précis du produit ; "arrow" pour pointer un élément (la flèche pointe vers la DROITE → place-la à GAUCHE de l'élément visé) ; "heart" sur l'émotion/le désir. Coordonnées x,y et largeur w en % (w entre 18 et 40).
- kenBurns UNIQUEMENT pour les plans "type":"image" : zoomin sur le produit, panleft/panright sur les décors, zoomout pour une révélation.
- media : pour CHAQUE plan, décide "video" ou "image" selon la PERTINENCE — "video" UNIQUEMENT quand le mouvement est indispensable (personne qui parle/agit, démonstration, geste d'utilisation, effet 3D, CTA face caméra) ; "image" pour les plans illustratifs qui vivent très bien en photo animée (macro ingrédient, composition, packshot, texture, décor, problème statique). Vise environ la MOITIÉ des plans en "image".
- musicPreset : choisis l'id le plus adapté au ton dans la liste fournie ; musicVolume entre 0.35 et 0.6.
Réponds UNIQUEMENT avec ce JSON (aucun texte autour) :
{"musicPreset":"id","musicVolume":0.45,"captionStyle":"…","captionAnim":"…","captionPosition":"…","captionFont":"…","captionCase":"none","scenes":[{"transitionOut":"…","kenBurns":null,"media":"video","overlayProduct":false,"accent":{"type":"ring","x":50,"y":45,"w":30}}]}
("accent" vaut null quand le plan n'en a pas besoin.)
Valeurs autorisées — transitions: ${TR.join(',')} ; kenBurns: ${KB.join(',')} ou null ; styles: ${STYLES.join(',')} ; animations: ${ANIMS.join(',')} ; positions: ${POS.join(',')} ; polices: ${FONTS.join(',')} ; captionCase: none ou upper ; accents: ${ACCENTS.join(',')} ou null ; musiques: ${presetIds.join(',') || 'aucune'}. Le tableau "scenes" contient EXACTEMENT ${sc.length} éléments, dans l'ordre du storyboard.`;
    const user = `Produit : ${String(productName).slice(0, 120) || '—'}\nContexte : ${String(productContext).replace(/<[^>]+>/g, ' ').slice(0, 600) || '—'}\nStoryboard : ${JSON.stringify(sc)}`;

    const raw = await callDeepseek([{ role: 'system', content: system }, { role: 'user', content: user }]);
    const match = String(raw || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Réponse IA invalide');
    const d = JSON.parse(match[0]);
    const pick = (v, list, fb) => (list.includes(v) ? v : fb);
    let accentCount = 0;
    const plan = {
      musicPreset: presetIds.includes(d.musicPreset) ? d.musicPreset : null,
      musicVolume: Math.max(0.25, Math.min(0.8, Number(d.musicVolume) || 0.45)),
      captionStyle: pick(d.captionStyle, STYLES, 'classic'),
      captionAnim: pick(d.captionAnim, ANIMS, 'pop'),
      captionPosition: pick(d.captionPosition, POS, 'middle'),
      captionFont: pick(d.captionFont, FONTS, 'sans'),
      captionCase: d.captionCase === 'upper' ? 'upper' : 'none',
      scenes: sc.map((s, i) => {
        const ds = Array.isArray(d.scenes) ? (d.scenes[i] || {}) : {};
        // Accent situationnel (rétro-compat : un ancien champ "ring" devient un accent cercle).
        const rawAccent = ds.accent || (ds.ring ? { type: 'ring', ...ds.ring } : null);
        let accent = null;
        if (rawAccent && ACCENTS.includes(rawAccent.type) && Number.isFinite(Number(rawAccent.x)) && accentCount < 3) {
          accentCount += 1;
          accent = {
            type: rawAccent.type,
            xPct: Math.max(5, Math.min(95, Number(rawAccent.x))),
            yPct: Math.max(5, Math.min(95, Number(rawAccent.y) || 45)),
            wPct: Math.max(15, Math.min(45, Number(rawAccent.w) || 26)),
          };
        }
        return {
          transitionOut: pick(ds.transitionOut, TR, ''),
          kenBurns: pick(ds.kenBurns, KB, '') || null,
          media: pick(ds.media, ['video', 'image'], null),
          overlayProduct: ds.overlayProduct === true,
          accent,
        };
      }),
    };
    return res.json({ success: true, plan });
  } catch (err) {
    console.error('[BuilderAI] montage-director error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Directeur de montage indisponible' });
  }
});

// ─── Montage vidéo créatif (timeline) — job async ────────────────────────────
// POST /builder-ai/montage  { format, subtitles, musicUrl?, musicVolume?, scenes:[...] } → { jobId }
// GET  /builder-ai/montage/jobs/:id → { status, progress, url, durationSec, format, error }
const montageJobs = new Map();
const MONTAGE_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of montageJobs) { if (now - job.createdAt > MONTAGE_TTL_MS) montageJobs.delete(id); }
}, 5 * 60 * 1000).unref?.();

router.post('/montage', requireEcomAuth, async (req, res) => {
  try {
    const spec = req.body || {};
    const scenes = Array.isArray(spec.scenes) ? spec.scenes.filter((s) => s && (s.videoUrl || s.imageUrl)) : [];
    if (!scenes.length) return res.status(400).json({ success: false, message: 'Ajoute au moins une scène avec un clip ou une image.' });

    const id = `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = { id, status: 'processing', progress: 3, url: null, durationSec: 0, format: spec.format || '9:16', error: null, warning: null, createdAt: Date.now() };
    montageJobs.set(id, job);
    // Suivi AUSSI en base : en cluster/multi-instances, le poll GET peut taper
    // une autre instance que celle qui rend — la Map locale ne suffit pas.
    const MontageJob = (await import('../models/MontageJob.js')).default;
    const pushJob = (patch) => MontageJob.push(id, patch);
    pushJob({ workspaceId: req.workspaceId || null, status: 'processing', progress: 3, format: job.format });

    (async () => {
      try {
        const { renderMontage } = await import('../services/videoMontageService.js');
        const { buffer, durationSec, format, warnings, musicApplied } = await renderMontage(
          {
            format: spec.format,
            subtitles: !!spec.subtitles,
            captionMode: spec.captionMode === 'block' ? 'block' : 'dynamic',
            captionStyle: spec.captionStyle || 'classic',
            captionAnim: spec.captionAnim || 'pop',
            captionPosition: ['top', 'middle', 'bottom'].includes(spec.captionPosition) ? spec.captionPosition : 'bottom',
            // Position libre (drag CapCut) : % de hauteur, prioritaire sur captionPosition.
            captionOffsetPct: Number.isFinite(Number(spec.captionOffsetPct)) && spec.captionOffsetPct !== null && spec.captionOffsetPct !== ''
              ? Math.max(5, Math.min(95, Number(spec.captionOffsetPct))) : null,
            // Taille (50-200 %) et nombre de lignes max (1-3) des sous-titres.
            captionScale: Math.max(0.5, Math.min(2, Number(spec.captionScale) || 1)),
            captionMaxLines: Math.max(1, Math.min(3, Math.round(Number(spec.captionMaxLines) || 1))),
            // Police embarquée + casse du texte.
            captionFont: ['sans', 'condensed', 'serif', 'serif2', 'mono'].includes(spec.captionFont) ? spec.captionFont : 'sans',
            captionCase: spec.captionCase === 'upper' ? 'upper' : 'none',
            // 'dynamic' (défaut) : transitions variées choisies par le moteur à chaque jonction.
            transition: spec.transition || 'dynamic',
            transitions: Array.isArray(spec.transitions) ? spec.transitions : undefined,
            musicUrl: spec.musicUrl || null,
            musicVolume: spec.musicVolume,
            narrationUrl: spec.narrationUrl || null,
            scenes,
          },
          (pct) => {
            const next = Math.max(job.progress, Math.min(97, pct));
            if (next !== job.progress) { job.progress = next; pushJob({ progress: next }); }
          },
        );
        const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
        const up = await uploadToR2(buffer, `creative-montage-${Date.now()}.mp4`, 'video/mp4');
        if (!up?.success || !up.url) throw new Error(up?.error || 'Upload du montage échoué');
        job.url = up.url;
        job.durationSec = durationSec;
        job.format = format;
        job.warning = Array.isArray(warnings) && warnings.length ? warnings.join(' · ') : null;
        // Musique demandée mais absente du mix sans warning explicite : on prévient quand même.
        if (spec.musicUrl && !musicApplied && !job.warning) job.warning = 'Musique de fond non appliquée';
        job.musicApplied = !!musicApplied;
        job.progress = 100;
        job.status = 'done';
        pushJob({ status: 'done', progress: 100, url: job.url, durationSec, format, warning: job.warning, musicApplied: job.musicApplied });
      } catch (e) {
        console.error('[BuilderAI] montage error:', e.message);
        job.status = 'error';
        job.error = e.message || 'Montage échoué';
        pushJob({ status: 'error', error: job.error });
      }
    })();

    return res.json({ success: true, jobId: id });
  } catch (err) {
    console.error('[BuilderAI] montage submit error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Montage impossible' });
  }
});

router.get('/montage/jobs/:id', requireEcomAuth, async (req, res) => {
  // 1. Instance qui rend le montage : réponse mémoire (fraîche, gratuite).
  let job = montageJobs.get(req.params.id);
  // 2. Autre instance (cluster) ou process redémarré : lecture en base.
  if (!job) {
    try {
      const MontageJob = (await import('../models/MontageJob.js')).default;
      const doc = await MontageJob.findOne({ jobId: req.params.id }).lean();
      if (doc) {
        // Job "processing" sans battement depuis 3 min : le worker a été tué
        // (redémarrage/crash) — inutile de laisser le client poller à l'infini.
        const stale = doc.status === 'processing' && Date.now() - new Date(doc.heartbeatAt || doc.createdAt).getTime() > 3 * 60 * 1000;
        job = stale
          ? { status: 'error', progress: doc.progress, url: null, durationSec: 0, format: doc.format, error: 'Montage interrompu (redémarrage du serveur) — relance le montage.', warning: null }
          : { status: doc.status, progress: doc.progress, url: doc.url, durationSec: doc.durationSec, format: doc.format, error: doc.error, warning: doc.warning, musicApplied: doc.musicApplied };
      }
    } catch (e) {
      console.warn('[BuilderAI] montage job DB lookup failed:', e.message);
    }
  }
  if (!job) return res.status(404).json({ success: false, message: 'Job de montage introuvable' });
  return res.json({
    success: true,
    status: job.status,
    progress: job.progress,
    url: job.url,
    durationSec: job.durationSec,
    format: job.format,
    error: job.error,
    warning: job.warning || null,
    musicApplied: !!job.musicApplied,
  });
});

export default router;
