/**
 * Gabarit des emails marketing PLATEFORME + traçage.
 *
 * Écrit pour la boîte de réception, pas pour le navigateur. Ce qui fait
 * basculer un email en spam est presque toujours structurel, jamais le mot
 * « gratuit » : absence de version texte, absence de lien de désinscription,
 * image seule sans texte, domaine de lien différent du domaine expéditeur.
 * Chaque contrainte ci-dessous répond à l'un de ces points.
 */

const TRACKING_BASE_URL = process.env.TRACKING_BASE_URL
  || process.env.BACKEND_PUBLIC_URL
  || 'https://api.scalor.net';

// Les liens de suivi et de désinscription pointent vers TRACKING_BASE_URL, pas
// vers le serveur qui envoie. En développement, ils partent donc vers la
// production : le clic tombe sur un 404 tant que la route n'y est pas déployée,
// et rien dans l'email ne laisse deviner pourquoi. On le dit au démarrage.
{
  const local = String(process.env.BACKEND_URL || '');
  const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
  if (local && hostOf(local) && hostOf(local) !== hostOf(TRACKING_BASE_URL)) {
    console.warn(
      `[marketing] Liens de suivi émis vers ${hostOf(TRACKING_BASE_URL)} alors que ce serveur écoute sur ${hostOf(local)}. `
      + `Un clic depuis un email de test atteindra ${hostOf(TRACKING_BASE_URL)} — 404 si la route n'y est pas déployée. `
      + `Pour tester en local : TRACKING_BASE_URL=${local}`,
    );
  }
}
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://scalor.site';
// Identité postale : obligatoire pour CAN-SPAM, attendue par les filtres, et
// c'est aussi ce qui distingue un expéditeur réel d'un envoi anonyme.
const SENDER_IDENTITY = process.env.MARKETING_SENDER_IDENTITY || 'Scalor';
const SENDER_ADDRESS = process.env.MARKETING_SENDER_ADDRESS || '';

const escapeHtml = (v = '') => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function unsubscribeUrl(campaignId, token) {
  return `${TRACKING_BASE_URL}/api/ecom/super-admin/marketing/u/${campaignId}/${token}`;
}

export function openPixelUrl(campaignId, token) {
  return `${TRACKING_BASE_URL}/api/ecom/super-admin/marketing/t/open/${campaignId}/${token}`;
}

export function clickUrl(campaignId, token, target) {
  return `${TRACKING_BASE_URL}/api/ecom/super-admin/marketing/t/click/${campaignId}/${token}?url=${encodeURIComponent(target)}`;
}

/** Réécrit les href du corps pour passer par la redirection de comptage. */
function rewriteLinks(html, campaignId, token) {
  if (!token) return html;
  return String(html).replace(/href="([^"]+)"/gi, (match, url) => {
    // On ne touche ni aux ancres, ni au mailto, ni au lien de désinscription :
    // faire passer une désinscription par le compteur de clics la ferait
    // apparaître comme un engagement positif dans les statistiques.
    if (/^(#|mailto:|tel:)/i.test(url)) return match;
    if (url.includes('/marketing/u/')) return match;
    return `href="${clickUrl(campaignId, token, url)}"`;
  });
}

/** Convertit le corps HTML en texte lisible — jamais une simple copie du HTML. */
export function htmlToPlainText(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = String(label).replace(/<[^>]+>/g, '').trim();
      return text ? `${text} (${href})` : href;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {object} opts
 * @param {object} opts.campaign  PlatformCampaign
 * @param {object} opts.recipient { name, email, token }
 * @returns {{html: string, text: string, headers: object}}
 */
export function renderCampaignEmail({ campaign, recipient }) {
  const token = recipient?.token || '';
  const campaignId = String(campaign?._id || '');
  const email = campaign?.content?.email || {};
  const firstName = String(recipient?.name || '').trim().split(/\s+/)[0] || '';

  const fill = (v = '') => String(v)
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{name\}/g, recipient?.name || '')
    .replace(/\{email\}/g, recipient?.email || '');

  const bodyHtml = rewriteLinks(fill(email.html || ''), campaignId, token);
  const unsub = unsubscribeUrl(campaignId, token);
  const preheader = escapeHtml(fill(email.preheader || ''));

  const cta = email.ctaUrl && email.ctaLabel
    ? `<tr><td align="center" style="padding:8px 0 24px;">
         <a href="${clickUrl(campaignId, token, email.ctaUrl)}" style="display:inline-block;padding:13px 26px;background:#0D9488;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">${escapeHtml(email.ctaLabel)}</a>
       </td></tr>`
    : '';

  const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(fill(email.subject || ''))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2430;">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:26px 30px 6px;">
        <div style="font-size:17px;font-weight:800;color:#0D9488;">${escapeHtml(SENDER_IDENTITY)}</div>
      </td></tr>
      <tr><td style="padding:10px 30px 4px;font-size:15px;line-height:1.65;color:#1f2430;">
        ${bodyHtml}
      </td></tr>
      ${cta}
      <tr><td style="padding:18px 30px 26px;border-top:1px solid #eceef1;font-size:12px;line-height:1.6;color:#6b7280;">
        <p style="margin:0 0 6px;">Tu reçois cet email parce que tu as un compte ${escapeHtml(SENDER_IDENTITY)}.</p>
        <p style="margin:0 0 6px;"><a href="${unsub}" style="color:#6b7280;text-decoration:underline;">Se désinscrire des emails marketing</a> — les emails de service (connexion, facturation) continueront d'arriver.</p>
        ${SENDER_ADDRESS ? `<p style="margin:0;">${escapeHtml(SENDER_ADDRESS)}</p>` : ''}
      </td></tr>
    </table>
    <div style="max-width:600px;margin:14px auto 0;font-size:11px;color:#9aa1ac;text-align:center;">
      <a href="${FRONTEND_URL}" style="color:#9aa1ac;text-decoration:none;">${escapeHtml(String(FRONTEND_URL).replace(/^https?:\/\//, ''))}</a>
    </div>
  </td></tr>
</table>
${token ? `<img src="${openPixelUrl(campaignId, token)}" width="1" height="1" alt="" style="display:block;border:0;"/>` : ''}
</body></html>`;

  // Version texte construite depuis le corps AVANT réécriture des liens : un
  // lecteur en texte pur doit voir la vraie destination, pas une redirection.
  const text = [
    fill(email.text || '').trim() || htmlToPlainText(fill(email.html || '')),
    '',
    '—',
    `Se désinscrire : ${unsub}`,
    SENDER_ADDRESS || '',
  ].filter((l) => l !== null && l !== undefined).join('\n').trim();

  // List-Unsubscribe + One-Click : Gmail et Yahoo l'exigent pour tout
  // expéditeur de volume depuis 2024. Sans ces en-têtes, le seul recours du
  // destinataire est le bouton « spam », qui coûte bien plus cher.
  const headers = {
    'List-Unsubscribe': `<${unsub}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Campaign-Id': campaignId,
    'Precedence': 'bulk',
  };

  return { html, text, headers };
}

export default { renderCampaignEmail, htmlToPlainText, unsubscribeUrl, openPixelUrl, clickUrl };
