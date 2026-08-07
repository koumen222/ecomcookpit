import dns from 'node:dns';
import { marketingFrom } from '../core/notifications/mailer.js';
import EmailSendLog from '../models/EmailSendLog.js';
import EmailSuppression from '../models/EmailSuppression.js';

/**
 * État de délivrabilité du canal marketing PLATEFORME.
 *
 * Le domaine audité est celui de MARKETING_EMAIL_FROM, pas scalor.net :
 * l'intérêt d'un sous-domaine dédié est justement que sa réputation se mesure
 * séparément. Auditer le domaine racine ici donnerait une note rassurante
 * pendant que le sous-domaine d'envoi n'est pas configuré.
 *
 * Le sélecteur DKIM n'est pas deviné : on sonde une courte liste et on affiche
 * ce qui existe. Coder en dur le sélecteur d'un fournisseur donne un « DKIM
 * absent » faux le jour où l'on change de fournisseur.
 */

const DKIM_SELECTORS = String(process.env.MARKETING_DKIM_SELECTORS || 'resend,mail,default,s1,k1,scalor')
  .split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Le domaine réellement utilisé pour envoyer, lu depuis marketingFrom().
 *
 * Cette fonction recalculait l'adresse de son côté et auditait donc un domaine
 * que le mailer n'utilisait plus dès que le repli entrait en jeu : rapport vert
 * sur un domaine mort, ou rouge sur celui qui marche. L'expéditeur se décide à
 * UN endroit.
 */
export function marketingDomain() {
  const from = marketingFrom();
  const address = from.includes('<') ? from.split('<')[1].replace('>', '') : from;
  return (address.split('@')[1] || 'scalor.net').trim().toLowerCase();
}

// Résolveurs essayés dans l'ordre : celui du système d'abord — sur un serveur
// correctement configuré c'est le plus rapide et le plus fiable — puis des
// résolveurs publics si le premier ne répond pas.
function resolvers() {
  const list = [new dns.promises.Resolver()];
  const pub = new dns.promises.Resolver();
  pub.setServers(['1.1.1.1', '8.8.8.8']);
  list.push(pub);
  return list;
}

/**
 * Interroge le DNS en distinguant DEUX situations que la version précédente
 * confondait : « cet enregistrement n'existe pas » et « je n'ai pas pu
 * demander ». Les traiter pareil affichait un rapport rouge réclamant de
 * publier des enregistrements déjà en place dès que le résolveur était
 * injoignable — le conseil le plus coûteux possible, puisqu'il pousse à
 * toucher au DNS qui marche.
 */
async function ask(fn) {
  let lastError = '';
  for (const r of resolvers()) {
    try {
      return { state: 'ok', value: await fn(r) };
    } catch (error) {
      const code = error?.code || '';
      // Le nom répond mais n'a pas d'enregistrement de ce type : absence réelle.
      if (code === 'ENOTFOUND' || code === 'ENODATA') return { state: 'absent', value: null };
      lastError = code || String(error?.message || error);
    }
  }
  return { state: 'inconnu', value: null, error: lastError };
}

const flatten = (records) => (records || []).map((r) => (Array.isArray(r) ? r.join('') : String(r)));

export async function checkDns(domain = marketingDomain()) {
  const [txt, dmarcTxt, mx] = await Promise.all([
    ask((r) => r.resolveTxt(domain)),
    ask((r) => r.resolveTxt(`_dmarc.${domain}`)),
    ask((r) => r.resolveMx(domain)),
  ]);

  const dkim = await Promise.all(DKIM_SELECTORS.map(async (selector) => {
    const name = `${selector}._domainkey.${domain}`;
    const t = await ask((r) => r.resolveTxt(name));
    const c = t.state === 'ok' ? null : await ask((r) => r.resolveCname(name));
    const value = flatten(t.value)[0] || (c?.value ? c.value[0] : '');
    return { selector, name, found: !!value, state: t.state, value: String(value).slice(0, 160) };
  }));

  // Un seul « inconnu » suffit à rendre tout le rapport non concluant : mieux
  // vaut dire « je n'ai pas pu vérifier » que noter 0 sur un domaine sain.
  const unreachable = [txt, dmarcTxt, mx].some((r) => r.state === 'inconnu')
    || dkim.some((d) => d.state === 'inconnu');

  const spfRecords = flatten(txt.value).filter((v) => v.toLowerCase().startsWith('v=spf1'));
  const dmarcRecords = flatten(dmarcTxt.value).filter((v) => v.toLowerCase().startsWith('v=dmarc1'));
  const dmarcPolicy = (dmarcRecords[0]?.match(/p=(none|quarantine|reject)/i) || [])[1] || null;

  const verdict = (state, ok, okDetail, koDetail) => ({
    state: state === 'inconnu' ? 'inconnu' : (ok ? 'ok' : 'absent'),
    ok: state !== 'inconnu' && ok,
    detail: state === 'inconnu'
      ? "Résolveur DNS injoignable depuis ce serveur — impossible de conclure. Ce n'est pas une absence d'enregistrement."
      : (ok ? okDetail : koDetail),
  });

  const checks = [
    {
      key: 'spf', label: 'SPF publié et unique',
      ...verdict(txt.state, spfRecords.length === 1, spfRecords[0] || '',
        spfRecords.length === 0
          ? `Aucun enregistrement SPF sur ${domain} — les serveurs receveurs n'ont aucun moyen d'autoriser l'expéditeur.`
          : `${spfRecords.length} enregistrements SPF : au-delà d'un seul, la vérification échoue systématiquement.`),
    },
    {
      key: 'dkim', label: 'DKIM publié',
      ...verdict(dkim.some((d) => d.state === 'inconnu') ? 'inconnu' : 'ok', dkim.some((d) => d.found),
        `Sélecteur trouvé : ${dkim.filter((d) => d.found).map((d) => d.selector).join(', ')}`,
        `Aucun sélecteur DKIM trouvé parmi ${DKIM_SELECTORS.join(', ')}. Ajoute celui de ton fournisseur dans MARKETING_DKIM_SELECTORS s'il diffère.`),
    },
    {
      key: 'dmarc', label: 'DMARC publié',
      ...verdict(dmarcTxt.state, !!dmarcPolicy,
        `Politique p=${dmarcPolicy}${dmarcPolicy === 'none' ? " — observation seule. Passe à quarantine une fois les rapports lus." : ''}`,
        `Aucun DMARC sur _dmarc.${domain}. Gmail et Yahoo l'exigent des expéditeurs de volume.`),
    },
    {
      key: 'subdomain', label: 'Sous-domaine dédié au marketing',
      state: domain.split('.').length > 2 ? 'ok' : 'absent',
      ok: domain.split('.').length > 2,
      detail: domain.split('.').length > 2
        ? `Envoi depuis ${domain} — la réputation marketing reste séparée du domaine racine.`
        : `Envoi depuis le domaine racine ${domain} : une campagne mal reçue dégradera aussi les emails de connexion et de facturation. Un sous-domaine dédié demande d'abord d'être vérifié chez Resend.`,
    },
  ];

  const conclusive = checks.filter((c) => c.state !== 'inconnu');
  return {
    domain,
    resolverAvailable: !unreachable,
    checks,
    spf: spfRecords,
    dkim,
    dmarc: dmarcRecords,
    mx: mx.value || [],
    // Sans DNS, il ne reste qu'un contrôle sur quatre : une note calculée
    // dessus afficherait 0 sur un domaine peut-être irréprochable. Pas de
    // note du tout vaut mieux qu'une note fausse.
    score: unreachable || !conclusive.length
      ? null
      : Math.round((conclusive.filter((c) => c.ok).length / conclusive.length) * 100),
  };
}

/** Volume et taux d'échec récents du canal marketing plateforme. */
export async function sendingVolume() {
  const now = Date.now();
  const windows = { h24: 86400000, d7: 7 * 86400000, d30: 30 * 86400000 };
  const out = {};

  for (const [key, ms] of Object.entries(windows)) {
    const since = new Date(now - ms);
    const [sent, failed] = await Promise.all([
      EmailSendLog.countDocuments({ source: 'platform_campaign', status: 'sent', createdAt: { $gte: since } }),
      EmailSendLog.countDocuments({ source: 'platform_campaign', status: 'failed', createdAt: { $gte: since } }),
    ]);
    const total = sent + failed;
    out[key] = { sent, failed, total, failureRate: total ? Math.round((failed / total) * 1000) / 10 : 0 };
  }
  return out;
}

/** Photo de la réputation : désinscriptions, plaintes, rebonds. */
export async function reputationSnapshot() {
  const byReason = await EmailSuppression.aggregate([{ $group: { _id: '$reason', count: { $sum: 1 } } }]);
  const counts = Object.fromEntries(byReason.map((r) => [r._id, r.count]));
  const volume = await sendingVolume();

  const sent30 = volume.d30.sent || 0;
  const complaints = counts.complaint || 0;
  const hardBounces = counts.hard_bounce || 0;

  // Seuils du secteur : au-delà de 0,3 % de plaintes ou 2 % de rebonds durs,
  // Gmail dégrade activement le placement. Ce ne sont pas des indicateurs de
  // confort — ce sont les valeurs à partir desquelles le domaine décroche.
  const complaintRate = sent30 ? Math.round((complaints / sent30) * 10000) / 100 : 0;
  const bounceRate = sent30 ? Math.round((hardBounces / sent30) * 10000) / 100 : 0;

  return {
    suppressions: counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    volume,
    rates: {
      complaint: { value: complaintRate, threshold: 0.3, ok: complaintRate < 0.3 },
      hardBounce: { value: bounceRate, threshold: 2, ok: bounceRate < 2 },
    },
  };
}

export async function fullReport() {
  const [dnsReport, reputation] = await Promise.all([checkDns(), reputationSnapshot()]);
  return { dns: dnsReport, reputation };
}

export default { checkDns, sendingVolume, reputationSnapshot, fullReport, marketingDomain };
