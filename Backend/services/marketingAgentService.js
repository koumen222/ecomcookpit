import PlatformCampaign from '../models/PlatformCampaign.js';
import { callTextCompletion } from './textProviderService.js';
import { previewAudience } from './platformAudienceService.js';
import { spamAudit, applyFixes } from './marketingAiService.js';
import dispatch from './platformDispatchService.js';

/**
 * Agent de campagne — il pose des questions, écrit, mesure, corrige et prépare
 * l'envoi. La campagne en base est son plan de travail : chaque outil la
 * modifie, donc l'écran reflète l'avancement sans que le modèle ait à répéter
 * tout l'état à chaque tour.
 *
 * UNE action reste hors de sa portée : déclencher l'envoi. Il peut tout
 * préparer et le proposer, le départ appartient à un clic humain. Un envoi de
 * masse ne se rattrape pas, et l'agent lit une intention dans une phrase —
 * « ok » en réponse à autre chose suffirait à partir. Le reste du parcours est
 * à lui : ce n'est pas un rédacteur, c'est lui qui mène.
 */

const MAX_TURNS = 8;

const SYSTEM = `Tu es l'assistant de campagne de Scalor, une plateforme e-commerce africaine. Tu t'adresses au fondateur, en super admin, qui veut prévenir SES marchands d'une nouveauté ou lancer une campagne vers eux.

TA MÉTHODE
1. Si le brief est vague, pose UNE question à la fois — la plus utile en premier. Jamais de questionnaire.
2. Dès que tu sais quoi dire et à qui, écris les contenus avec definir_contenu (un appel par canal).
3. Définis l'audience avec definir_audience, puis compte-la avec compter_audience. Annonce le chiffre.
4. Lance verifier_spam. Sous 85, appelle corriger_spam puis revérifie.
5. Propose un envoi de test avec envoyer_test si le fondateur donne une adresse.
6. Quand tout est prêt, appelle proposer_envoi et résume : combien de destinataires, quels canaux, quel score.

CE QUE TU N'INVENTES JAMAIS
Une fonctionnalité, un chiffre, une date, un prix qu'on ne t'a pas donnés. Si une information te manque pour écrire, demande-la.

TON ÉCRITURE
Français, tutoiement, phrases courtes. Le bénéfice concret dans la première phrase. Zéro superlatif creux. Objet d'email entre 35 et 55 caractères, sans majuscules intégrales ni exclamations multiples. HTML limité à p, strong, em, ul, li, a. WhatsApp sous 300 caractères. Push : titre 40, corps 90. Utilise {firstName} pour le prénom.

TES RÉPONSES AU FONDATEUR
Courtes. Tu dis ce que tu viens de faire et ce qu'il te faut ensuite. Pas de récapitulatif de tout le contenu que tu viens d'écrire : il le voit à l'écran.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'definir_canaux',
      description: 'Choisit les canaux de la campagne.',
      parameters: {
        type: 'object',
        properties: {
          channels: { type: 'array', items: { type: 'string', enum: ['email', 'whatsapp', 'push'] } },
          name: { type: 'string', description: 'Nom interne de la campagne, jamais lu par le destinataire.' },
        },
        required: ['channels'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'definir_contenu',
      description: "Écrit le contenu d'UN canal. Un appel par canal.",
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['email', 'whatsapp', 'push'] },
          subject: { type: 'string' }, preheader: { type: 'string' },
          html: { type: 'string' }, text: { type: 'string' },
          ctaLabel: { type: 'string' }, ctaUrl: { type: 'string' },
          title: { type: 'string' }, body: { type: 'string' }, url: { type: 'string' },
        },
        required: ['channel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'definir_audience',
      description: 'Définit le segment qui recevra la campagne.',
      parameters: {
        type: 'object',
        properties: {
          sources: { type: 'array', items: { type: 'string', enum: ['users', 'subscribers'] } },
          plans: { type: 'array', items: { type: 'string' } },
          hasStore: { type: 'boolean', description: 'true = a une boutique, false = aucune' },
          activeWithinDays: { type: 'number' },
          inactiveSinceDays: { type: 'number' },
          signedUpAfter: { type: 'string', description: 'Date ISO' },
          maxSparks: { type: 'number' },
        },
      },
    },
  },
  { type: 'function', function: { name: 'compter_audience', description: "Compte les destinataires du segment actuel et dit combien sont joignables par canal.", parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'verifier_spam', description: "Analyse l'email et renvoie un score sur 100 avec les problèmes.", parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'corriger_spam', description: "Corrige automatiquement les problèmes détectés par verifier_spam.", parameters: { type: 'object', properties: {} } } },
  {
    type: 'function',
    function: {
      name: 'envoyer_test',
      description: "Envoie un exemplaire de test. N'affecte aucune statistique.",
      parameters: { type: 'object', properties: { emails: { type: 'array', items: { type: 'string' } } }, required: ['emails'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proposer_envoi',
      description: "À appeler quand tout est prêt. Affiche au fondateur le bouton de lancement. Ne déclenche PAS l'envoi.",
      parameters: { type: 'object', properties: { resume: { type: 'string', description: 'Une phrase : destinataires, canaux, score.' } }, required: ['resume'] },
    },
  },
];

// ─── Exécution des outils ────────────────────────────────────────────────────

async function runTool(name, args, campaign) {
  switch (name) {
    case 'definir_canaux': {
      campaign.channels = (args.channels || []).filter((c) => ['email', 'whatsapp', 'push'].includes(c));
      if (args.name) campaign.name = String(args.name).slice(0, 120);
      await campaign.save();
      return { ok: true, channels: campaign.channels, name: campaign.name };
    }

    case 'definir_contenu': {
      const ch = args.channel;
      if (!['email', 'whatsapp', 'push'].includes(ch)) return { ok: false, error: 'Canal inconnu' };
      const cur = campaign.content[ch]?.toObject?.() || campaign.content[ch] || {};
      const next = { ...cur };
      for (const k of ['subject', 'preheader', 'html', 'text', 'ctaLabel', 'ctaUrl', 'title', 'body', 'url']) {
        if (typeof args[k] === 'string' && args[k]) next[k] = args[k];
      }
      campaign.content[ch] = next;
      if (!campaign.channels?.includes(ch)) campaign.channels = [...(campaign.channels || []), ch];
      campaign.markModified('content');
      await campaign.save();
      return { ok: true, channel: ch };
    }

    case 'definir_audience': {
      const { sources, ...filters } = args || {};
      campaign.audience = {
        ...(campaign.audience?.toObject?.() || campaign.audience || {}),
        sources: sources?.length ? sources : (campaign.audience?.sources || ['users']),
        filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null)),
      };
      campaign.markModified('audience');
      await campaign.save();
      const p = await previewAudience(campaign.audience);
      return { ok: true, total: p.total, joignables: p.reachable };
    }

    case 'compter_audience': {
      const p = await previewAudience(campaign.audience);
      return { total: p.total, joignables: p.reachable, ecartes: p.counts };
    }

    case 'verifier_spam': {
      const e = campaign.content?.email || {};
      const a = await spamAudit({ subject: e.subject, html: e.html, text: e.text, ctaUrl: e.ctaUrl });
      return { score: a.score, problemes: (a.issues || []).map((i) => `${i.severity}: ${i.message}`), avis: a.editorial?.verdict || '' };
    }

    case 'corriger_spam': {
      const e = campaign.content?.email?.toObject?.() || campaign.content?.email || {};
      const audit = await spamAudit({ subject: e.subject, html: e.html, text: e.text, ctaUrl: e.ctaUrl });
      const fixed = await applyFixes({ ...e, audit });
      campaign.content.email = { ...e, ...fixed.fields };
      campaign.markModified('content');
      await campaign.save();
      const after = await spamAudit({ ...fixed.fields });
      return { corrections: fixed.changes.map((c) => c.why), nouveauScore: after.score };
    }

    case 'envoyer_test': {
      const results = await dispatch.sendTest(campaign, { emails: args.emails || [] });
      return { resultats: results };
    }

    case 'proposer_envoi': {
      const p = await previewAudience(campaign.audience);
      return { pret: true, resume: args.resume || '', destinataires: p.total, canaux: campaign.channels };
    }

    default:
      return { ok: false, error: `Outil inconnu : ${name}` };
  }
}

// ─── Boucle ──────────────────────────────────────────────────────────────────

/**
 * @param {object} opts { campaignId, history: [{role, content}] }
 * @returns {Promise<{reply, actions, readyToSend, campaign}>}
 */
export async function runAgent({ campaignId, history = [] } = {}) {
  const campaign = await PlatformCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campagne introuvable');

  // L'état courant est injecté à chaque tour plutôt que reconstitué par le
  // modèle : il ne peut donc pas croire avoir déjà écrit un canal qu'il a en
  // réalité oublié entre deux messages.
  const snapshot = {
    nom: campaign.name || '(sans nom)',
    type: campaign.kind,
    canaux: campaign.channels || [],
    email_ecrit: !!campaign.content?.email?.subject,
    whatsapp_ecrit: !!campaign.content?.whatsapp?.text,
    push_ecrit: !!campaign.content?.push?.title,
    audience: campaign.audience?.filters || {},
  };

  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'system', content: `État actuel de la campagne : ${JSON.stringify(snapshot)}` },
    ...history.filter((m) => ['user', 'assistant'].includes(m.role) && m.content)
      .map((m) => ({ role: m.role, content: String(m.content) })),
  ];

  const actions = [];
  let readyToSend = false;
  let reply = '';

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const res = await callTextCompletion({
      messages, tools: TOOLS, temperature: 0.5, maxTokens: 3000, contextLabel: 'AGENT-MARKETING',
    });

    const calls = res.toolCalls || res.raw?.choices?.[0]?.message?.tool_calls || [];
    if (!calls.length) { reply = res.content || ''; break; }

    messages.push({ role: 'assistant', content: res.content || '', tool_calls: calls });

    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      let result;
      try { result = await runTool(call.function?.name, args, campaign); }
      catch (error) { result = { ok: false, error: String(error.message || error) }; }

      if (call.function?.name === 'proposer_envoi' && result?.pret) readyToSend = true;
      actions.push({ tool: call.function?.name, args, result });

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function?.name,
        content: JSON.stringify(result).slice(0, 4000),
      });
    }

    // Dernier tour consommé sans réponse écrite : on le dit plutôt que de
    // renvoyer une bulle vide.
    if (turn === MAX_TURNS - 1) reply = reply || "J'ai avancé sur plusieurs points. Dis-moi ce que tu veux ajuster.";
  }

  const fresh = await PlatformCampaign.findById(campaignId).lean();
  return { reply, actions, readyToSend, campaign: fresh };
}

export default { runAgent };
