import { Resend } from 'resend';
import NotificationLog from '../../models/NotificationLog.js';

let resend = null;

const getResend = () => {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY non configuré');
    resend = new Resend(key);
  }
  return resend;
};

const FROM = `Ecom Cockpit <${process.env.EMAIL_FROM || 'contact@infomania.store'}>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ecomcookpit.site';
const BRAND_COLOR = '#4f46e5';
const BRAND_NAME = 'Ecom Cockpit';

// ─── Templates HTML ───────────────────────────────────────────────────────────

const baseLayout = (content, previewText = '') => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${BRAND_NAME}</title>
  <style>
    body{margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrapper{max-width:600px;margin:0 auto;padding:32px 16px}
    .card{background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:${BRAND_COLOR};padding:28px 32px;text-align:center}
    .header h1{color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px}
    .header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px}
    .body{padding:32px}
    .body h2{color:#1a1a2e;font-size:20px;margin:0 0 12px;font-weight:700}
    .body p{color:#4a4a68;font-size:15px;line-height:1.7;margin:0 0 16px}
    .btn{display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;margin:8px 0}
    .btn-danger{background:#ef4444}
    .btn-success{background:#10b981}
    .divider{border:none;border-top:1px solid #eee;margin:24px 0}
    .badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600}
    .badge-red{background:#fee2e2;color:#dc2626}
    .badge-orange{background:#ffedd5;color:#ea580c}
    .badge-green{background:#d1fae5;color:#059669}
    .badge-blue{background:#dbeafe;color:#2563eb}
    .kpi-row{display:flex;gap:12px;margin:16px 0}
    .kpi{flex:1;background:#f8f9ff;border-radius:8px;padding:14px;text-align:center}
    .kpi-value{font-size:22px;font-weight:700;color:${BRAND_COLOR};margin:0}
    .kpi-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin:4px 0 0}
    .alert-box{border-radius:8px;padding:14px 16px;margin:16px 0;font-size:14px}
    .alert-red{background:#fef2f2;border-left:4px solid #ef4444;color:#991b1b}
    .alert-orange{background:#fff7ed;border-left:4px solid #f97316;color:#9a3412}
    .alert-green{background:#f0fdf4;border-left:4px solid #22c55e;color:#166534}
    .alert-blue{background:#eff6ff;border-left:4px solid #3b82f6;color:#1e40af}
    .footer{padding:20px 32px;text-align:center;background:#f8f9ff;border-top:1px solid #eee}
    .footer p{color:#aaa;font-size:12px;margin:4px 0;line-height:1.6}
    .footer a{color:#888;text-decoration:none}
    @media(max-width:600px){.body{padding:20px}.kpi-row{flex-direction:column}}
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#fff">${previewText}</div>` : ''}
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>${BRAND_NAME}</h1>
        <p>Plateforme e-commerce intelligente</p>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} ${BRAND_NAME} · Tous droits réservés</p>
        <p><a href="https://ecomcookpit.site/" style="color:#888;text-decoration:none">Accéder à la plateforme</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

// ─── Catalogue de templates ────────────────────────────────────────────────────

export const TEMPLATES = {

  // AUTH
  welcome: ({ name, workspaceName }) => ({
    subject: `Bienvenue sur ${BRAND_NAME} 🎉`,
    preview: `Votre compte est prêt, ${name || 'bienvenue'} !`,
    html: baseLayout(`
      <h2>Bienvenue, ${name || 'nouvel utilisateur'} ! 👋</h2>
      <p>Votre compte <strong>${BRAND_NAME}</strong> est maintenant actif${workspaceName ? ` dans l'espace <strong>${workspaceName}</strong>` : ''}.</p>
      <p>Vous pouvez dès maintenant gérer vos commandes, produits, équipes et finances depuis une seule interface.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom" class="btn">Accéder à mon espace →</a>
      </div>
      <hr class="divider"/>
      <p style="font-size:13px;color:#888">Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>
    `, `Bienvenue sur ${BRAND_NAME} !`)
  }),

  forgot_password: ({ name, resetUrl, expiresIn = '1 heure' }) => ({
    subject: `Réinitialisation de votre mot de passe`,
    preview: 'Vous avez demandé à réinitialiser votre mot de passe.',
    html: baseLayout(`
      <h2>Réinitialisation du mot de passe 🔑</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${resetUrl}" class="btn">Réinitialiser mon mot de passe</a>
      </div>
      <div class="alert-box alert-orange">
        ⏱ Ce lien est valable <strong>${expiresIn}</strong>. Après expiration, vous devrez faire une nouvelle demande.
      </div>
      <hr class="divider"/>
      <p style="font-size:13px;color:#888">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
    `, 'Réinitialisez votre mot de passe')
  }),

  password_changed: ({ name }) => ({
    subject: `Votre mot de passe a été modifié`,
    preview: 'Votre mot de passe vient d\'être changé.',
    html: baseLayout(`
      <h2>Mot de passe modifié ✅</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Votre mot de passe a été modifié avec succès le <strong>${new Date().toLocaleString('fr-FR')}</strong>.</p>
      <div class="alert-box alert-red">
        🚨 Si vous n'êtes pas à l'origine de ce changement, <strong>contactez-nous immédiatement</strong> et sécurisez votre compte.
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom" class="btn btn-danger">Sécuriser mon compte</a>
      </div>
    `, 'Votre mot de passe a été modifié')
  }),

  suspicious_login: ({ name, ip, device, location, time }) => ({
    subject: `⚠️ Connexion suspecte détectée sur votre compte`,
    preview: 'Une connexion inhabituelle a été détectée.',
    html: baseLayout(`
      <h2>Connexion suspecte détectée ⚠️</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Une connexion à votre compte a été détectée depuis un appareil ou une localisation inhabituelle.</p>
      <div class="alert-box alert-red">
        <strong>Détails :</strong><br/>
        📍 Localisation : ${location || 'Inconnue'}<br/>
        💻 Appareil : ${device || 'Inconnu'}<br/>
        🌐 IP : ${ip || 'Inconnue'}<br/>
        🕐 Heure : ${time || new Date().toLocaleString('fr-FR')}
      </div>
      <p>Si c'était bien vous, aucune action n'est requise. Sinon, sécurisez votre compte immédiatement.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/settings" class="btn btn-danger">Sécuriser mon compte</a>
      </div>
    `, 'Connexion suspecte sur votre compte')
  }),

  // ÉQUIPE
  team_invitation: ({ inviterName, workspaceName, role, inviteUrl, expiresIn = '7 jours' }) => ({
    subject: `${inviterName} vous invite à rejoindre ${workspaceName}`,
    preview: `Vous avez été invité à rejoindre ${workspaceName} sur ${BRAND_NAME}`,
    html: baseLayout(`
      <h2>Vous êtes invité ! 🎉</h2>
      <p><strong>${inviterName}</strong> vous invite à rejoindre l'espace <strong>${workspaceName}</strong> en tant que <span class="badge badge-blue">${role}</span>.</p>
      <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation et accéder à la plateforme.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${inviteUrl}" class="btn btn-success">Accepter l'invitation →</a>
      </div>
      <div class="alert-box alert-blue">
        ⏱ Cette invitation expire dans <strong>${expiresIn}</strong>.
      </div>
      <hr class="divider"/>
      <p style="font-size:13px;color:#888">Si vous ne connaissez pas ${inviterName}, ignorez cet email.</p>
    `, `Invitation à rejoindre ${workspaceName}`)
  }),

  role_changed: ({ name, workspaceName, oldRole, newRole, changedBy }) => ({
    subject: `Votre rôle a été modifié dans ${workspaceName}`,
    preview: `Votre rôle est maintenant ${newRole}`,
    html: baseLayout(`
      <h2>Changement de rôle 🔄</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Votre rôle dans l'espace <strong>${workspaceName}</strong> a été modifié par <strong>${changedBy || 'un administrateur'}</strong>.</p>
      <div class="kpi-row">
        <div class="kpi"><p class="kpi-value">${oldRole}</p><p class="kpi-label">Ancien rôle</p></div>
        <div class="kpi" style="background:#f0fdf4"><p class="kpi-value" style="color:#059669">${newRole}</p><p class="kpi-label">Nouveau rôle</p></div>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom" class="btn">Voir mon espace →</a>
      </div>
    `, `Votre rôle est maintenant ${newRole}`)
  }),

  member_removed: ({ name, workspaceName, removedBy }) => ({
    subject: `Vous avez été retiré de ${workspaceName}`,
    preview: `Votre accès à ${workspaceName} a été révoqué`,
    html: baseLayout(`
      <h2>Accès révoqué</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Votre accès à l'espace <strong>${workspaceName}</strong> a été révoqué par <strong>${removedBy || 'un administrateur'}</strong>.</p>
      <p>Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.</p>
    `, `Accès révoqué sur ${workspaceName}`)
  }),

  // FINANCE
  budget_warning: ({ budgetName, category, spent, limit, percentage, workspaceName }) => ({
    subject: `⚠️ Budget "${budgetName}" à ${percentage}% — ${workspaceName}`,
    preview: `Votre budget ${budgetName} approche de sa limite`,
    html: baseLayout(`
      <h2>Alerte budget ⚠️</h2>
      <p>Le budget <strong>${budgetName}</strong> (${category}) dans <strong>${workspaceName}</strong> a atteint <strong>${percentage}%</strong> de sa limite.</p>
      <div class="kpi-row">
        <div class="kpi"><p class="kpi-value">${spent}</p><p class="kpi-label">Dépensé</p></div>
        <div class="kpi"><p class="kpi-value">${limit}</p><p class="kpi-label">Limite</p></div>
        <div class="kpi" style="background:#fff7ed"><p class="kpi-value" style="color:#ea580c">${percentage}%</p><p class="kpi-label">Utilisé</p></div>
      </div>
      <div class="alert-box alert-orange">
        ⚠️ À ce rythme, le budget sera épuisé avant la fin de la période. Pensez à ajuster vos dépenses.
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/transactions" class="btn">Voir les finances →</a>
      </div>
    `, `Budget ${budgetName} à ${percentage}%`)
  }),

  budget_exceeded: ({ budgetName, category, spent, limit, overage, workspaceName }) => ({
    subject: `🚨 Budget "${budgetName}" DÉPASSÉ — ${workspaceName}`,
    preview: `Le budget ${budgetName} a été dépassé de ${overage}`,
    html: baseLayout(`
      <h2>Budget dépassé 🚨</h2>
      <p>Le budget <strong>${budgetName}</strong> (${category}) dans <strong>${workspaceName}</strong> a été <strong>dépassé</strong>.</p>
      <div class="kpi-row">
        <div class="kpi"><p class="kpi-value">${spent}</p><p class="kpi-label">Dépensé</p></div>
        <div class="kpi"><p class="kpi-value">${limit}</p><p class="kpi-label">Limite</p></div>
        <div class="kpi" style="background:#fef2f2"><p class="kpi-value" style="color:#dc2626">+${overage}</p><p class="kpi-label">Dépassement</p></div>
      </div>
      <div class="alert-box alert-red">
        🚨 Action requise : ce budget est en dépassement. Revoyez vos dépenses ou augmentez la limite.
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/transactions" class="btn btn-danger">Gérer les budgets →</a>
      </div>
    `, `Budget ${budgetName} dépassé !`)
  }),

  critical_transaction: ({ amount, description, category, type, workspaceName }) => ({
    subject: `💸 Transaction critique enregistrée — ${workspaceName}`,
    preview: `Une transaction importante vient d'être enregistrée`,
    html: baseLayout(`
      <h2>Transaction critique 💸</h2>
      <p>Une transaction d'un montant important vient d'être enregistrée dans <strong>${workspaceName}</strong>.</p>
      <div class="kpi-row">
        <div class="kpi"><p class="kpi-value">${amount}</p><p class="kpi-label">Montant</p></div>
        <div class="kpi"><p class="kpi-value">${type === 'expense' ? '📤 Dépense' : '📥 Entrée'}</p><p class="kpi-label">Type</p></div>
      </div>
      <p><strong>Catégorie :</strong> ${category}<br/><strong>Description :</strong> ${description || '—'}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/transactions" class="btn">Voir les transactions →</a>
      </div>
    `, `Transaction critique : ${amount}`)
  }),

  weekly_report: ({ workspaceName, period, income, expenses, balance, topCategory, ordersCount }) => ({
    subject: `📊 Rapport hebdomadaire — ${workspaceName} — ${period}`,
    preview: `Votre bilan de la semaine est disponible`,
    html: baseLayout(`
      <h2>Rapport hebdomadaire 📊</h2>
      <p>Voici le bilan financier de <strong>${workspaceName}</strong> pour la semaine du <strong>${period}</strong>.</p>
      <div class="kpi-row">
        <div class="kpi" style="background:#f0fdf4"><p class="kpi-value" style="color:#059669">${income}</p><p class="kpi-label">Entrées</p></div>
        <div class="kpi" style="background:#fef2f2"><p class="kpi-value" style="color:#dc2626">${expenses}</p><p class="kpi-label">Dépenses</p></div>
        <div class="kpi"><p class="kpi-value">${balance}</p><p class="kpi-label">Solde net</p></div>
      </div>
      ${ordersCount !== undefined ? `<p>📦 <strong>${ordersCount}</strong> commandes traitées cette semaine.</p>` : ''}
      ${topCategory ? `<p>🏆 Catégorie principale : <strong>${topCategory}</strong></p>` : ''}
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/transactions" class="btn">Voir le détail →</a>
      </div>
    `, `Rapport hebdo ${workspaceName}`)
  }),

  monthly_report: ({ workspaceName, month, income, expenses, balance, growth, budgetUsage }) => ({
    subject: `📈 Rapport mensuel — ${workspaceName} — ${month}`,
    preview: `Votre bilan du mois de ${month} est disponible`,
    html: baseLayout(`
      <h2>Rapport mensuel 📈</h2>
      <p>Voici le bilan de <strong>${workspaceName}</strong> pour le mois de <strong>${month}</strong>.</p>
      <div class="kpi-row">
        <div class="kpi" style="background:#f0fdf4"><p class="kpi-value" style="color:#059669">${income}</p><p class="kpi-label">Entrées</p></div>
        <div class="kpi" style="background:#fef2f2"><p class="kpi-value" style="color:#dc2626">${expenses}</p><p class="kpi-label">Dépenses</p></div>
        <div class="kpi"><p class="kpi-value">${balance}</p><p class="kpi-label">Solde net</p></div>
      </div>
      ${growth !== undefined ? `<div class="alert-box ${growth >= 0 ? 'alert-green' : 'alert-red'}">${growth >= 0 ? '📈' : '📉'} Évolution vs mois précédent : <strong>${growth >= 0 ? '+' : ''}${growth}%</strong></div>` : ''}
      ${budgetUsage !== undefined ? `<p>💰 Utilisation des budgets : <strong>${budgetUsage}%</strong></p>` : ''}
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/transactions" class="btn">Voir le rapport complet →</a>
      </div>
    `, `Rapport mensuel ${month}`)
  }),

  // PRODUITS
  stock_low: ({ productName, stock, threshold, workspaceName }) => ({
    subject: `📦 Stock bas : "${productName}" — ${workspaceName}`,
    preview: `Le stock de ${productName} est faible`,
    html: baseLayout(`
      <h2>Stock bas ⚠️</h2>
      <p>Le produit <strong>${productName}</strong> dans <strong>${workspaceName}</strong> approche du seuil critique.</p>
      <div class="kpi-row">
        <div class="kpi" style="background:#fff7ed"><p class="kpi-value" style="color:#ea580c">${stock}</p><p class="kpi-label">Stock actuel</p></div>
        <div class="kpi"><p class="kpi-value">${threshold}</p><p class="kpi-label">Seuil d'alerte</p></div>
      </div>
      <div class="alert-box alert-orange">
        ⚠️ Pensez à réapprovisionner ce produit pour éviter une rupture de stock.
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/stock" class="btn">Gérer le stock →</a>
      </div>
    `, `Stock bas : ${productName}`)
  }),

  stock_out: ({ productName, workspaceName }) => ({
    subject: `🚨 Rupture de stock : "${productName}" — ${workspaceName}`,
    preview: `${productName} est en rupture de stock`,
    html: baseLayout(`
      <h2>Rupture de stock 🚨</h2>
      <p>Le produit <strong>${productName}</strong> dans <strong>${workspaceName}</strong> est en <strong>rupture de stock</strong>.</p>
      <div class="alert-box alert-red">
        🚨 Ce produit n'est plus disponible. Les nouvelles commandes pourraient être impactées.
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/stock" class="btn btn-danger">Réapprovisionner →</a>
      </div>
    `, `Rupture de stock : ${productName}`)
  }),

  // BUSINESS
  sales_spike: ({ workspaceName, ordersCount, period, revenue }) => ({
    subject: `🚀 Pic de ventes détecté — ${workspaceName}`,
    preview: `${ordersCount} commandes en ${period} — performance exceptionnelle !`,
    html: baseLayout(`
      <h2>Pic de ventes 🚀</h2>
      <p>Un pic de ventes exceptionnel a été détecté dans <strong>${workspaceName}</strong> !</p>
      <div class="kpi-row">
        <div class="kpi" style="background:#f0fdf4"><p class="kpi-value" style="color:#059669">${ordersCount}</p><p class="kpi-label">Commandes</p></div>
        <div class="kpi"><p class="kpi-value">${revenue}</p><p class="kpi-label">Revenus</p></div>
        <div class="kpi"><p class="kpi-value">${period}</p><p class="kpi-label">Période</p></div>
      </div>
      <div class="alert-box alert-green">
        🎉 Performance exceptionnelle ! Continuez sur cette lancée.
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://ecomcookpit.site/ecom/orders" class="btn btn-success">Voir les commandes →</a>
      </div>
    `, `Pic de ventes : ${ordersCount} commandes !`)
  }),

  new_record: ({ workspaceName, metric, value, previousRecord }) => ({
    subject: `🏆 Nouveau record — ${metric} — ${workspaceName}`,
    preview: `Nouveau record battu : ${value}`,
    html: baseLayout(`
      <h2>Nouveau record 🏆</h2>
      <p>Félicitations ! <strong>${workspaceName}</strong> vient de battre un nouveau record.</p>
      <div class="kpi-row">
        <div class="kpi" style="background:#f0fdf4"><p class="kpi-value" style="color:#059669">${value}</p><p class="kpi-label">${metric}</p></div>
        ${previousRecord ? `<div class="kpi"><p class="kpi-value">${previousRecord}</p><p class="kpi-label">Précédent record</p></div>` : ''}
      </div>
      <div class="alert-box alert-green">🏆 Nouveau record battu ! Continuez comme ça.</div>
    `, `Nouveau record : ${metric}`)
  }),

  // ─── TRIAL / PLAN EXPIRY ─────────────────────────────────────────────────

  trial_expiring: ({ name, workspaceName, hoursLeft, trialEndsAt }) => ({
    subject: `⏰ Votre essai gratuit expire bientôt — ${BRAND_NAME}`,
    preview: `Plus que ${hoursLeft}h pour profiter de toutes les fonctionnalités`,
    html: baseLayout(`
      <h2>Votre essai gratuit expire bientôt ⏰</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Votre essai gratuit de <strong>${workspaceName}</strong> expire dans <strong>${hoursLeft} heures</strong> (le ${trialEndsAt}).</p>
      <div class="alert-box alert-orange">
        ⚠️ Après expiration, vos <strong>agents commerciaux IA</strong> seront <strong>désactivés</strong> et ne répondront plus aux clients sur WhatsApp.
      </div>
      <p>Pour continuer à vendre automatiquement, passez à un plan Pro ou Ultra dès maintenant.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${FRONTEND_URL}/ecom/billing" class="btn">Passer à Pro — Garder mes agents actifs →</a>
      </div>
      <hr class="divider"/>
      <p style="font-size:13px;color:#888">Si vous ne souhaitez pas continuer, aucune action n'est requise. Vos données seront conservées.</p>
    `, `Essai gratuit expire dans ${hoursLeft}h`)
  }),

  trial_expired: ({ name, workspaceName }) => ({
    subject: `🚫 Essai terminé — Vos agents IA sont désactivés`,
    preview: `Votre essai gratuit est terminé, passez à Pro pour réactiver vos agents`,
    html: baseLayout(`
      <h2>Votre essai gratuit est terminé 🚫</h2>
      <p>Bonjour ${name || ''},</p>
      <p>L'essai gratuit de <strong>${workspaceName}</strong> a expiré. Vos agents commerciaux IA sont maintenant <strong>désactivés</strong>.</p>
      <div class="alert-box alert-red">
        🚨 <strong>Vos agents ne répondent plus</strong> aux messages de vos clients sur WhatsApp. Chaque minute sans agent = des ventes perdues.
      </div>
      <div class="kpi-row">
        <div class="kpi" style="background:#fef2f2">
          <p class="kpi-value" style="color:#dc2626">Inactifs</p>
          <p class="kpi-label">Agents IA</p>
        </div>
        <div class="kpi" style="background:#fef2f2">
          <p class="kpi-value" style="color:#dc2626">0</p>
          <p class="kpi-label">Messages traités</p>
        </div>
      </div>
      <p><strong>Passez à Pro maintenant</strong> pour réactiver vos agents et ne plus perdre de clients.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${FRONTEND_URL}/ecom/billing" class="btn btn-danger">Réactiver mes agents — Passer à Pro →</a>
      </div>
      <hr class="divider"/>
      <p style="font-size:13px;color:#888">Vos données et configurations d'agents sont conservées. Vous pourrez les réactiver à tout moment en souscrivant.</p>
    `, `Agents IA désactivés — Passez à Pro`)
  }),

  plan_expired: ({ name, workspaceName, planName }) => ({
    subject: `🚫 Plan ${planName} expiré — Agents IA désactivés`,
    preview: `Votre plan ${planName} a expiré, renouvelez pour garder vos agents actifs`,
    html: baseLayout(`
      <h2>Votre plan ${planName} a expiré 🚫</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Votre abonnement <strong>${planName}</strong> pour <strong>${workspaceName}</strong> a expiré. Vous êtes revenu au <strong>plan gratuit</strong>.</p>
      <div class="alert-box alert-red">
        🚨 <strong>Vos agents commerciaux IA sont désactivés.</strong> Ils ne traitent plus les messages de vos clients sur WhatsApp.
      </div>
      <p>Renouvelez votre abonnement pour réactiver vos agents et continuer à vendre.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${FRONTEND_URL}/ecom/billing" class="btn btn-danger">Renouveler mon plan ${planName} →</a>
      </div>
    `, `Plan ${planName} expiré`)
  })
};

// ─── Fonction principale d'envoi ──────────────────────────────────────────────

export const sendNotificationEmail = async ({
  to,
  templateKey,
  data = {},
  userId = null,
  workspaceId = null,
  eventType = templateKey
}) => {
  const template = TEMPLATES[templateKey];
  if (!template) {
    console.warn(`[email.service] Template inconnu: ${templateKey}`);
    return { success: false, error: 'Template inconnu' };
  }

  const { subject, html, preview } = template(data);

  try {
    const client = getResend();
    const result = await client.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    });

    await NotificationLog.create({
      userId,
      workspaceId,
      eventType,
      channel: 'EMAIL',
      status: 'SENT',
      recipient: Array.isArray(to) ? to.join(', ') : to,
      subject,
      metadata: { templateKey, resendId: result?.data?.id }
    });

    console.log(`✅ [email] ${templateKey} → ${to}`);
    return { success: true, id: result?.data?.id };
  } catch (err) {
    console.error(`❌ [email] ${templateKey} → ${to}:`, err.message);

    await NotificationLog.create({
      userId,
      workspaceId,
      eventType,
      channel: 'EMAIL',
      status: 'FAILED',
      recipient: Array.isArray(to) ? to.join(', ') : to,
      subject,
      errorMessage: err.message,
      metadata: { templateKey }
    }).catch(() => {});

    return { success: false, error: err.message };
  }
};
