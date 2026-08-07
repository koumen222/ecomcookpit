import { callTextCompletion } from './textProviderService.js';
import { htmlToPlainText } from './platformEmailTemplate.js';

/**
 * Assistant de rédaction des campagnes plateforme.
 *
 * Passe par la cascade texte centrale — DeepSeek en tête. Aucun appel direct à
 * un fournisseur ici : le jour où la cascade change, ce fichier n'a pas à le
 * savoir.
 *
 * L'audit anti-spam mélange volontairement deux natures de contrôle. Les
 * règles déterministes en bas de fichier attrapent ce qui fait réellement
 * classer un email — absence de version texte, email tout en image, objet en
 * majuscules — et elles sont gratuites, reproductibles et sans latence. Le
 * modèle ne sert qu'au jugement éditorial, là où une règle ne suffit pas.
 */

const parseJson = (raw = '') => {
  const text = String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try { return JSON.parse(text); } catch { /* suite */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
};

const SYSTEM = `Tu écris les campagnes d'une plateforme SaaS e-commerce africaine (Scalor) vers SES marchands utilisateurs.
Règles :
- Français correct, tutoiement, phrases courtes, zéro anglicisme inutile.
- Zéro superlatif creux ("révolutionnaire", "incroyable", "game changer").
- Une seule idée par message, un seul appel à l'action.
- Tu parles à des vendeurs occupés : le bénéfice concret arrive dans la première phrase.
- Objet d'email : 35 à 55 caractères, aucune majuscule intégrale, aucun point d'exclamation multiple, aucun emoji en première position.
- HTML d'email : uniquement <p>, <strong>, <em>, <ul>, <li>, <a>. Aucun style inline, aucune image, aucun tableau — le gabarit s'en charge.
- WhatsApp : 300 caractères maximum, ton direct, aucun lien raccourci.
- Push : titre 40 caractères maximum, corps 90 maximum.
Tu réponds UNIQUEMENT par du JSON valide, sans texte autour.`;

/** Rédige une campagne complète à partir d'un brief libre. */
export async function draftCampaign({ brief, channels = ['email'], tone = 'direct', audienceSummary = '', kind = 'campaign' } = {}) {
  const wanted = channels.filter((c) => ['email', 'whatsapp', 'push'].includes(c));
  const shape = {
    ...(wanted.includes('email') ? { email: { subject: '', preheader: '', html: '', ctaLabel: '', ctaUrl: '' } } : {}),
    ...(wanted.includes('whatsapp') ? { whatsapp: { text: '' } } : {}),
    ...(wanted.includes('push') ? { push: { title: '', body: '' } } : {}),
    name: '',
  };

  const prompt = `${kind === 'announcement' ? "Annonce d'une nouveauté produit" : 'Campagne marketing'} à rédiger.

BRIEF : ${brief}
TON : ${tone}
AUDIENCE : ${audienceSummary || 'marchands inscrits sur la plateforme'}
CANAUX : ${wanted.join(', ')}

Utilise {firstName} là où le prénom du destinataire doit apparaître, jamais ailleurs.
"name" est le nom interne de la campagne, jamais lu par le destinataire.

Réponds avec exactement cette structure JSON :
${JSON.stringify(shape, null, 2)}`;

  const { content, provider, modelUsed } = await callTextCompletion({
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    temperature: 0.7,
    maxTokens: 2500,
    responseFormat: { type: 'json_object' },
    contextLabel: 'MARKETING-IA',
  });

  const parsed = parseJson(content);
  if (!parsed) throw new Error("L'assistant n'a pas renvoyé de JSON exploitable");
  return { draft: parsed, provider, modelUsed };
}

/** Variantes d'objet d'email, pour test A/B ou simple choix. */
export async function subjectVariants({ subject, brief = '', count = 5 } = {}) {
  const { content } = await callTextCompletion({
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Propose ${count} objets d'email alternatifs.
OBJET ACTUEL : ${subject}
CONTEXTE : ${brief || '—'}

Varie les angles : bénéfice, curiosité, nouveauté, question, chiffre.
Réponds : {"variants":[{"subject":"...","angle":"..."}]}`,
      },
    ],
    temperature: 0.9,
    maxTokens: 900,
    responseFormat: { type: 'json_object' },
    contextLabel: 'MARKETING-IA',
  });
  const parsed = parseJson(content);
  return parsed?.variants || [];
}

// ─── Audit anti-spam ─────────────────────────────────────────────────────────

// Mots qui font réellement monter un score de filtrage en français comme en
// anglais. La liste reste courte volontairement : un mot seul ne fait jamais
// basculer un email, c'est leur accumulation qui compte.
const TRIGGERS = [
  'gratuit', '100% gratuit', 'argent facile', 'gagnez', 'gagner de l\'argent',
  'cliquez ici', 'urgent', 'offre limitée', 'agissez maintenant', 'félicitations',
  'sans engagement', 'garanti', 'promotion exceptionnelle', 'revenu', 'cash',
  'free', 'winner', 'click here', 'act now', 'risk free', 'guarantee',
];

/** Contrôles déterministes — pas d'appel réseau, pas d'aléa. */
export function structuralSpamCheck({ subject = '', html = '', text = '', ctaUrl = '' } = {}) {
  const issues = [];
  const s = String(subject);
  const h = String(html);
  const plain = String(text || '').trim();

  if (!s.trim()) issues.push({ severity: 'high', field: 'subject', message: "Objet vide — l'email sera rejeté avant même le filtre." });
  if (s.length > 70) issues.push({ severity: 'low', field: 'subject', message: `Objet de ${s.length} caractères : tronqué sur mobile au-delà de ~55.` });
  if (s && s === s.toUpperCase() && /[A-ZÀ-Ý]{4,}/.test(s)) issues.push({ severity: 'high', field: 'subject', message: 'Objet entièrement en majuscules — signal de spam classique.', fixable: true });
  if ((s.match(/!/g) || []).length > 1) issues.push({ severity: 'medium', field: 'subject', message: "Plusieurs points d'exclamation dans l'objet.", fixable: true });
  if (/^[\u{1F300}-\u{1FAFF}]/u.test(s)) issues.push({ severity: 'low', field: 'subject', message: "Emoji en première position de l'objet : mal rendu chez plusieurs clients.", fixable: true });

  if (!plain) {
    issues.push({
      severity: 'low',
      field: 'text',
      message: "Aucune version texte écrite. Elle sera déduite du HTML à l'envoi, donc l'email en aura une — mais une version rédigée à la main se lit mieux et convertit mieux.",
      fixable: true,
    });
  }

  const visibleText = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const imageCount = (h.match(/<img/gi) || []).length;
  if (imageCount > 0 && visibleText.length < 200) {
    issues.push({ severity: 'high', field: 'html', message: 'Email quasi entièrement en image : les filtres ne peuvent rien lire.' });
  }
  if (visibleText.length < 120) {
    issues.push({ severity: 'medium', field: 'html', message: `Corps très court (${visibleText.length} caractères) — peu de matière pour établir la légitimité.` });
  }

  const links = [...h.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
  const shorteners = links.filter((u) => /(bit\.ly|tinyurl|t\.co|goo\.gl|cutt\.ly|is\.gd|ow\.ly)/i.test(u));
  if (shorteners.length) issues.push({ severity: 'high', field: 'html', message: `Lien raccourci détecté (${shorteners[0]}) — très fortement pénalisé.` });
  if (links.length > 12) issues.push({ severity: 'medium', field: 'html', message: `${links.length} liens dans le corps : au-delà d'une dizaine le ratio devient suspect.` });
  if (ctaUrl && !/^https:\/\//i.test(ctaUrl)) issues.push({ severity: 'medium', field: 'ctaUrl', message: 'Le bouton principal pointe en HTTP et non HTTPS.', fixable: true });

  const haystack = `${s} ${visibleText}`.toLowerCase();
  const found = TRIGGERS.filter((w) => haystack.includes(w));
  if (found.length >= 3) {
    issues.push({ severity: 'medium', field: 'content', message: `Accumulation de termes à risque : ${found.slice(0, 6).join(', ')}.` });
  }

  const weight = { high: 25, medium: 10, low: 4 };
  const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + weight[i.severity], 0));
  return { score, issues, stats: { subjectLength: s.length, bodyTextLength: visibleText.length, linkCount: links.length, imageCount } };
}

/** Audit complet : règles d'abord, relecture éditoriale par le modèle ensuite. */
export async function spamAudit({ subject = '', html = '', text = '', ctaUrl = '' } = {}) {
  const structural = structuralSpamCheck({ subject, html, text, ctaUrl });

  let editorial = { verdict: '', suggestions: [] };
  try {
    const { content } = await callTextCompletion({
      messages: [
        { role: 'system', content: 'Tu es expert en délivrabilité email. Tu réponds uniquement en JSON valide.' },
        {
          role: 'user',
          content: `Relis cet email marketing et dis ce qui, dans le TON et la FORMULATION, risque de le faire percevoir comme du spam par un humain ou par un filtre.
Ignore les aspects techniques (SPF, DKIM, en-têtes) : ils sont traités ailleurs.

OBJET : ${subject}
CORPS : ${String(html).replace(/<[^>]+>/g, ' ').slice(0, 2000)}

Réponds : {"verdict":"une phrase","suggestions":[{"probleme":"...","correction":"..."}]}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 900,
      responseFormat: { type: 'json_object' },
      contextLabel: 'MARKETING-IA',
    });
    editorial = parseJson(content) || editorial;
  } catch (error) {
    // L'audit structurel seul reste utile : on ne bloque pas l'utilisateur
    // parce que le modèle est indisponible.
    editorial = { verdict: `Relecture éditoriale indisponible (${error.message})`, suggestions: [] };
  }

  return { ...structural, editorial };
}

// ─── Correction ──────────────────────────────────────────────────────────────
// Signaler sans réparer laisse le travail entier à faire, et la moitié des
// signalements sont mécaniques. On sépare donc ce qui se corrige SANS modèle —
// une casse, une ponctuation, un http — de ce qui demande de réécrire.

/**
 * Remet un titre tout en majuscules en casse de phrase.
 *
 * Aucune tentative de préserver les sigles : quand la chaîne ENTIÈRE est en
 * majuscules, rien ne distingue « UGC » de « PRET ». La première version
 * restaurait tous les mots de trois lettres et plus — c'est-à-dire tous les
 * mots — et l'objet ressortait identique, avec un journal annonçant une
 * correction qui n'avait pas eu lieu.
 */
function sentenceCase(text = '') {
  const lowered = String(text).toLowerCase();
  // Majuscule sur la première LETTRE, pas sur le premier caractère : un objet
  // ouvert par un emoji ou un guillemet restait en minuscule.
  return lowered.replace(/\p{L}/u, (c) => c.toUpperCase());
}

/** Corrections mécaniques, sans appel modèle. */
export function structuralAutoFix({ subject = '', preheader = '', html = '', text = '', ctaLabel = '', ctaUrl = '' } = {}) {
  const changes = [];
  let s = String(subject);
  let t = String(text);
  let u = String(ctaUrl);

  const note = (field, from, to, why) => {
    if (from === to) return; // ne jamais consigner une correction qui n'a rien changé
    changes.push({ field, from, to, why });
  };

  // L'emoji de tête part EN PREMIER : le retirer après la mise en casse
  // aurait laissé la majuscule sur le mot qui le suivait, puis l'aurait
  // perdue en supprimant le caractère.
  if (/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)) {
    const before = s;
    s = s.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/u, '');
    note('subject', before, s, "Emoji retiré du début de l'objet");
  }

  if ((s.match(/!/g) || []).length > 1) {
    const before = s;
    s = s.replace(/!+/g, '!');
    const total = (s.match(/!/g) || []).length;
    if (total > 1) {
      let seen = 0;
      // On garde le DERNIER : c'est celui qui ponctue la phrase.
      s = s.replace(/!/g, () => { seen += 1; return seen === total ? '!' : ''; });
    }
    // Typographie française : espace avant « ! » et « ? », aucune avant
    // « , » et « . ». La règle anglaise collait le point d'exclamation au mot.
    const tidy = (v) => v.replace(/\s+([,.])/g, '$1').replace(/\s*([!?])/g, ' $1').trim();
    note('subject', before, tidy(s), "Un seul point d'exclamation conservé");
    s = tidy(s);
  }

  if (s && s === s.toUpperCase() && /\p{Lu}{4,}/u.test(s)) {
    const before = s; s = sentenceCase(s);
    note('subject', before, s, 'Objet remis en casse normale');
  }

  if (!t.trim() && html) {
    t = htmlToPlainText(html);
    if (t) changes.push({ field: 'text', from: '', to: `${t.slice(0, 60)}…`, why: 'Version texte écrite depuis le HTML' });
  }

  if (u && /^http:\/\//i.test(u)) {
    const before = u; u = u.replace(/^http:/i, 'https:');
    note('ctaUrl', before, u, 'Lien du bouton passé en HTTPS');
  }

  return { fields: { subject: s, preheader, html, text: t, ctaLabel, ctaUrl: u }, changes };
}

/**
 * Correction complète : mécanique d'abord, réécriture ensuite.
 * @returns {Promise<{fields: object, changes: Array, rewritten: boolean}>}
 */
export async function applyFixes({ subject = '', preheader = '', html = '', text = '', ctaLabel = '', ctaUrl = '', audit = null, rewrite = true } = {}) {
  const mech = structuralAutoFix({ subject, preheader, html, text, ctaLabel, ctaUrl });
  if (!rewrite) return { ...mech, rewritten: false };

  const notes = [
    ...(audit?.issues || []).filter((i) => !i.fixable).map((i) => `- ${i.message}`),
    ...(audit?.editorial?.suggestions || []).map((sg) => `- ${sg.probleme} → ${sg.correction}`),
  ].join('\n');

  // Rien de rédactionnel à traiter : inutile de dépenser un appel modèle.
  if (!notes.trim()) return { ...mech, rewritten: false };

  try {
    const { content } = await callTextCompletion({
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Réécris cet email en corrigeant les points listés. Garde le MÊME message et la MÊME offre — tu corriges la formulation, tu n'inventes ni promesse ni fonctionnalité absente du texte d'origine.
Conserve les variables {firstName} telles quelles. Le HTML reste limité à p, strong, em, ul, li, a.

OBJET : ${mech.fields.subject}
APERÇU : ${mech.fields.preheader}
CORPS : ${mech.fields.html}
BOUTON : ${mech.fields.ctaLabel || '(aucun)'}

À CORRIGER :
${notes}

Réponds : {"subject":"...","preheader":"...","html":"...","text":"...","ctaLabel":"...","changes":[{"field":"...","why":"..."}]}`,
        },
      ],
      temperature: 0.5,
      maxTokens: 2500,
      responseFormat: { type: 'json_object' },
      contextLabel: 'MARKETING-FIX',
    });

    const parsed = parseJson(content);
    if (!parsed) return { ...mech, rewritten: false };

    return {
      fields: {
        subject: parsed.subject || mech.fields.subject,
        preheader: parsed.preheader || mech.fields.preheader,
        html: parsed.html || mech.fields.html,
        // La version texte suit le nouveau corps : garder l'ancienne ferait
        // partir deux contenus différents dans le même email.
        text: parsed.text || (parsed.html ? htmlToPlainText(parsed.html) : mech.fields.text),
        ctaLabel: parsed.ctaLabel || mech.fields.ctaLabel,
        ctaUrl: mech.fields.ctaUrl,
      },
      changes: [...mech.changes, ...(parsed.changes || []).map((c) => ({ field: c.field || 'html', why: c.why || '' }))],
      rewritten: true,
    };
  } catch (error) {
    // La correction mécanique reste acquise même si le modèle est indisponible.
    return { ...mech, rewritten: false, error: String(error.message || error) };
  }
}

export default { draftCampaign, subjectVariants, spamAudit, structuralSpamCheck, applyFixes, structuralAutoFix };
