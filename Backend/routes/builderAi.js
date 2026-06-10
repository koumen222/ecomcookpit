import express from 'express';
import axios from 'axios';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

const KIE_API_KEY = process.env.KIE_API_KEY || '';
const KIE_CLAUDE_URL = 'https://api.kie.ai/claude/v1/messages';

async function callClaude(messages) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    stream: false,
    messages: chatMessages,
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const res = await axios.post(KIE_CLAUDE_URL, body, {
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  const content = res.data?.content;
  if (Array.isArray(content)) {
    return content
      .filter(b => b.type === 'text')
      .map(b => b.text || '')
      .join('');
  }
  return typeof content === 'string' ? content : '';
}

const SYSTEM_PROMPT = `Tu es un assistant IA tout-puissant intégré dans un builder de page produit e-commerce.
Tu peux TOUT modifier sur la page. Tu ne refuses JAMAIS une demande. Tu exécutes TOUJOURS.

Quand l'utilisateur demande une modification :
1. Tu l'appliques immédiatement via un patch JSON
2. Tu confirmes brièvement ce que tu as fait

STRUCTURE DE LA CONFIG (pageConfigPatch) :
{
  "design": { ... }, // couleurs, polices, styles visuels
  "general": { "sections": [...] }, // sections de la page
  "button": { ... }, // bouton CTA
  "conversion": { ... }, // offres, urgence
  "form": { ... }, // formulaire de commande
  "premiumPage": { ... }, // contenu premium (hero, testimonials, faq, etc.)
  "whatsapp": { "enabled": true, "number": "+221...", "position": "bottom-left" }, // bouton WhatsApp
  "floatingElements": { ... }, // éléments flottants (boutons, badges)
  "customHtml": "<div>...</div>", // HTML injecté EN HAUT de la page (bandeau promo, alerte, etc.)
  "customSections": [{ "html": "<section>...</section>" }] // nouvelles sections ajoutées à la fin de la page
}

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
- faq: { items: [{ question, answer }] }
- problemSection: { headline, bullets: [] }
- mechanismSection: { headline, body }
- closingSection: { headline, subheadline, bullets: [] }

BOUTON CTA (button) :
- text: texte du bouton
- subtext: sous-texte
- icon: icône (shopping-cart, zap, arrow-right, etc.)
- animation: animation (none, pulse, bounce, shake, glow)
- size: taille (sm, md, lg, xl)

RÈGLES ABSOLUES :
- Tu exécutes TOUJOURS. Ne dis JAMAIS "je ne peux pas".
- Si une clé n'existe pas encore, crée-la dans le patch.
- Pour les couleurs, utilise des hex (#XXXXXX). Si pas précisé, choisis une couleur adaptée.
- Réponds TOUJOURS en français.
- Sois bref : 1 phrase de confirmation max.
- Tu DOIS retourner du JSON valide.

FORMAT DE RÉPONSE — JSON UNIQUEMENT :
{
  "reply": "Fait ! J'ai [description courte].",
  "pageConfigPatch": { ... } ou null,
  "themePatch": { ... } ou null
}

EXEMPLES :
- "mets le bouton en orange" → themePatch: { "ctaButtonColor": "#F97316" }
- "ajoute un bouton WhatsApp en bas à gauche" → pageConfigPatch: { "whatsapp": { "enabled": true, "number": "", "position": "bottom-left", "message": "Bonjour, je suis intéressé par ce produit !" } }
- "cache la FAQ" → pageConfigPatch: { "sections": [{ "id": "faq", "enabled": false }] }
- "mets la police en Poppins" → themePatch: { "font": "poppins" }
- "rends le bouton plus gros avec une animation" → pageConfigPatch: { "button": { "size": "xl", "animation": "pulse" } }
- "change le titre hero" → pageConfigPatch: { "premiumPage": { "heroSlogan": "Nouveau titre accrocheur" } }
- "ajoute un témoignage" → pageConfigPatch: { "premiumPage": { "testimonials": [{ "name": "Marie D.", "rating": 5, "text": "Produit incroyable !", "avatar": "" }] } }
- "mets 10 avantages" → pageConfigPatch: { "premiumPage": { "hero": { "benefits": ["Avantage 1", "Avantage 2", "Avantage 3", "Avantage 4", "Avantage 5", "Avantage 6", "Avantage 7", "Avantage 8", "Avantage 9", "Avantage 10"] } } }
- "ajoute une bannière promo en haut" → pageConfigPatch: { "customHtml": "<div style='background:#F97316;color:white;text-align:center;padding:12px;font-weight:bold;font-size:14px;'>🔥 OFFRE LIMITÉE — Livraison GRATUITE aujourd'hui !</div>" }
- "ajoute une section vidéo" → pageConfigPatch: { "customSections": [{ "html": "<section style='padding:40px 20px;background:#000;text-align:center'><h2 style='color:white;margin-bottom:20px'>Découvrez le produit en action</h2><div style='position:relative;padding-bottom:56.25%;height:0'><iframe src='https://www.youtube.com/embed/VIDEO_ID' style='position:absolute;top:0;left:0;width:100%;height:100%;border:0' allowfullscreen></iframe></div></section>" }] }
- "ajoute un compteur de visiteurs" → pageConfigPatch: { "customSections": [{ "html": "<div style='background:#111;color:#fff;padding:10px 20px;text-align:center;font-size:13px;'>👁 47 personnes regardent ce produit en ce moment</div>" }] }`;

router.post('/chat', requireEcomAuth, async (req, res) => {
  try {
    const { message, productPageConfig, theme, productName, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    if (!KIE_API_KEY) {
      return res.status(503).json({ success: false, message: 'Service IA non disponible' });
    }

    const contextSummary = `
CONTEXTE ACTUEL:
- Produit: ${productName || 'Non spécifié'}
- Design: ${JSON.stringify(theme || {}).slice(0, 300)}
- Sections actives: ${productPageConfig?.general?.sections?.filter(s => s.enabled !== false).map(s => s.id).join(', ') || 'toutes'}
- Bouton: ${JSON.stringify(productPageConfig?.button || {}).slice(0, 200)}`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contextSummary },
    ];

    for (const msg of history.slice(-4)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: String(msg.content || '').slice(0, 500) });
      }
    }

    messages.push({ role: 'user', content: message.trim() });

    const rawContent = await callClaude(messages);

    let parsed;
    try {
      let cleaned = rawContent.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        cleaned = cleaned.slice(start, end + 1);
      }
      parsed = JSON.parse(cleaned);
    } catch (_) {
      parsed = { reply: rawContent || 'Modification appliquée.', pageConfigPatch: null, themePatch: null };
    }

    console.log('[BuilderAI] Parsed response:', JSON.stringify(parsed, null, 2));

    return res.json({
      success: true,
      reply: parsed.reply || 'Modification appliquée.',
      pageConfigPatch: parsed.pageConfigPatch || null,
      themePatch: parsed.themePatch || null,
    });
  } catch (error) {
    console.error('[BuilderAI] Chat error:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur du service IA' });
  }
});

export default router;
