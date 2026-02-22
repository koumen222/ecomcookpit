import express from 'express';
import { Resend } from 'resend';
import EmailCampaign from '../models/EmailCampaign.js';
import EcomUser from '../models/EcomUser.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';

const router = express.Router();

const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY non configuré');
  return new Resend(key);
};

const FROM_DEFAULT = process.env.EMAIL_FROM || 'contact@infomania.store';
const FROM_NAME_DEFAULT = process.env.EMAIL_FROM_NAME || 'Ecom Cockpit';

// ─── Middleware: super_admin OR ecom_admin ───────────────────────────────────
const requireMarketingAccess = [requireEcomAuth, (req, res, next) => {
  const role = req.ecomUser?.role;
  if (role === 'super_admin' || role === 'ecom_admin') return next();
  return res.status(403).json({ success: false, message: 'Accès refusé' });
}];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHtml(campaign, user = null) {
  const brandColor = '#4f46e5';
  const fromName = campaign.fromName || FROM_NAME_DEFAULT;
  let body = campaign.bodyHtml || `<p>${(campaign.bodyText || '').replace(/\n/g, '<br/>')}</p>`;
  
  // Substitution de variables personnalisées
  if (user) {
    body = body
      .replace(/\{\{prenom\}\}/g, user.name || '')
      .replace(/\{\{name\}\}/g, user.name || '')
      .replace(/\{\{email\}\}/g, user.email || '')
      .replace(/\{\{workspace\}\}/g, user.workspaceName || '')
      .replace(/\{\{role\}\}/g, user.role || '');
  } else {
    // Valeurs par défaut si pas d'utilisateur
    body = body
      .replace(/\{\{prenom\}\}/g, 'Bonjour')
      .replace(/\{\{name\}\}/g, 'Bonjour')
      .replace(/\{\{email\}\}/g, '')
      .replace(/\{\{workspace\}\}/g, '')
      .replace(/\{\{role\}\}/g, '');
  }
  
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${campaign.subject}</title>
  <style>
    body{margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrapper{max-width:600px;margin:0 auto;padding:32px 16px}
    .card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:${brandColor};padding:24px 32px;text-align:center}
    .header h1{color:#fff;margin:0;font-size:20px;font-weight:700}
    .body{padding:32px;color:#374151;font-size:15px;line-height:1.7}
    .footer{padding:16px 32px;text-align:center;background:#f8f9ff;border-top:1px solid #eee}
    .footer p{color:#aaa;font-size:12px;margin:4px 0}
    @media(max-width:600px){.body{padding:20px}}
  </style>
</head>
<body>
  ${campaign.previewText ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#fff">${campaign.previewText}</div>` : ''}
  <div class="wrapper"><div class="card">
    <div class="header"><h1>${fromName}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${fromName}</p>
      <p><a href="https://ecomcookpit.site/" style="color:#888;text-decoration:none">Accéder à la plateforme</a></p>
    </div>
  </div></div>
</body>
</html>`;
}

async function resolveRecipients(campaign) {
  const recipients = [];

  if (campaign.audienceType === 'custom_list') {
    (campaign.customEmails || []).forEach(e => e && recipients.push({ 
      email: e.toLowerCase().trim(), 
      name: '', 
      workspaceName: '', 
      role: '' 
    }));
  } else if (campaign.audienceType === 'all_users') {
    const users = await EcomUser.find({ isActive: true })
      .populate('workspaceId', 'name')
      .select('email name role workspaceId')
      .lean();
    users.forEach(u => u.email && recipients.push({ 
      email: u.email, 
      name: u.name || '', 
      workspaceName: u.workspaceId?.name || '', 
      role: u.role || '' 
    }));
  } else if (campaign.audienceType === 'workspace_users') {
    const query = { isActive: true };
    if (campaign.workspaceId) query.workspaceId = campaign.workspaceId;
    if (campaign.segmentFilter?.roles?.length) query.role = { $in: campaign.segmentFilter.roles };
    if (campaign.segmentFilter?.hasWorkspace === true) query.workspaceId = { $ne: null };
    if (campaign.segmentFilter?.hasWorkspace === false) query.workspaceId = null;
    const users = await EcomUser.find(query)
      .populate('workspaceId', 'name')
      .select('email name role workspaceId')
      .lean();
    users.forEach(u => u.email && recipients.push({ 
      email: u.email, 
      name: u.name || '', 
      workspaceName: u.workspaceId?.name || '', 
      role: u.role || '' 
    }));
  }

  return recipients;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/campaigns — list all campaigns
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns', requireMarketingAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (req.ecomUser.role === 'ecom_admin' && req.ecomUser.workspaceId) {
      query.workspaceId = req.ecomUser.workspaceId;
    }
    if (status) query.status = status;

    const total = await EmailCampaign.countDocuments(query);
    const campaigns = await EmailCampaign.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-results -bodyHtml -bodyText')
      .lean();

    res.json({ success: true, data: { campaigns, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('marketing/campaigns GET:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/campaigns/:id — get one campaign
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns/:id', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns — create campaign
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns', requireMarketingAccess, async (req, res) => {
  try {
    const {
      name, subject, previewText, fromName, fromEmail, replyTo,
      bodyHtml, bodyText, audienceType, customEmails, segmentFilter,
      scheduledAt, tags
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Nom requis' });
    if (!subject?.trim()) return res.status(400).json({ success: false, message: 'Sujet requis' });
    if (!bodyHtml?.trim() && !bodyText?.trim()) return res.status(400).json({ success: false, message: 'Contenu requis' });

    const campaign = new EmailCampaign({
      name: name.trim(),
      subject: subject.trim(),
      previewText: previewText?.trim() || '',
      fromName: fromName?.trim() || FROM_NAME_DEFAULT,
      fromEmail: fromEmail?.trim() || FROM_DEFAULT,
      replyTo: replyTo?.trim() || '',
      bodyHtml: bodyHtml || '',
      bodyText: bodyText || '',
      audienceType: audienceType || 'custom_list',
      customEmails: (customEmails || []).map(e => e.toLowerCase().trim()).filter(Boolean),
      segmentFilter: segmentFilter || {},
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'scheduled' : 'draft',
      workspaceId: req.ecomUser.workspaceId || null,
      createdBy: req.ecomUser._id,
      tags: tags || []
    });

    await campaign.save();
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    console.error('marketing/campaigns POST:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/ecom/marketing/campaigns/:id — update campaign (draft only)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/campaigns/:id', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ success: false, message: 'Impossible de modifier une campagne déjà envoyée' });
    }

    const fields = ['name', 'subject', 'previewText', 'fromName', 'fromEmail', 'replyTo',
      'bodyHtml', 'bodyText', 'audienceType', 'customEmails', 'segmentFilter', 'scheduledAt', 'tags'];
    fields.forEach(f => { if (req.body[f] !== undefined) campaign[f] = req.body[f]; });
    if (req.body.scheduledAt) campaign.status = 'scheduled';

    await campaign.save();
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/ecom/marketing/campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/campaigns/:id', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    if (campaign.status === 'sending') {
      return res.status(400).json({ success: false, message: 'Impossible de supprimer une campagne en cours d\'envoi' });
    }
    await campaign.deleteOne();
    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/send — send campaign now
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/send', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    if (campaign.status === 'sending') {
      return res.status(400).json({ success: false, message: 'Envoi déjà en cours' });
    }
    if (campaign.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Campagne déjà envoyée' });
    }

    const recipients = await resolveRecipients(campaign);
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun destinataire trouvé' });
    }

    // Mark as sending immediately
    campaign.status = 'sending';
    campaign.stats.targeted = recipients.length;
    campaign.results = [];
    await campaign.save();

    // Respond immediately, send in background
    res.json({ success: true, message: `Envoi démarré vers ${recipients.length} destinataires`, data: { targeted: recipients.length } });

    // Background send
    const resend = getResend();
    const from = `${campaign.fromName || FROM_NAME_DEFAULT} <${campaign.fromEmail || FROM_DEFAULT}>`;

    let sent = 0;
    let failed = 0;
    const results = [];

    // Send emails one by one with delay and personalization
    for (const recipient of recipients) {
      try {
        // Generate personalized HTML for each recipient
        const personalizedHtml = buildHtml(campaign, recipient);
        
        // Personalize subject too
        let personalizedSubject = campaign.subject;
        if (recipient.name) {
          personalizedSubject = personalizedSubject.replace(/\{\{prenom\}\}/g, recipient.name).replace(/\{\{name\}\}/g, recipient.name);
        } else {
          personalizedSubject = personalizedSubject.replace(/\{\{prenom\}\}/g, 'Bonjour').replace(/\{\{name\}\}/g, 'Bonjour');
        }
        
        const resp = await resend.emails.send({
          from,
          to: [recipient.email],
          subject: personalizedSubject,
          html: personalizedHtml,
          text: campaign.bodyText || undefined,
          reply_to: campaign.replyTo || undefined,
          headers: { 'X-Campaign-Id': campaign._id.toString() }
        });
        sent++;
        results.push({ email: recipient.email, status: 'sent', sentAt: new Date(), resendId: resp?.data?.id || null });
      } catch (err) {
        failed++;
        results.push({ email: recipient.email, status: 'failed', error: err.message, sentAt: new Date() });
      }
      
      // Delay between 3 and 5 seconds before next email
      const delay = 3000 + Math.random() * 2000; // 3000ms to 5000ms
      await new Promise(r => setTimeout(r, delay));
    }

    campaign.status = failed === recipients.length ? 'failed' : 'sent';
    campaign.sentAt = new Date();
    campaign.stats.sent = sent;
    campaign.stats.failed = failed;
    campaign.results = results.slice(0, 500); // cap stored results
    await campaign.save();

    console.log(`✅ Campagne email "${campaign.name}" envoyée: ${sent} ok, ${failed} échecs`);
  } catch (err) {
    console.error('marketing/send:', err);
    // Try to mark as failed
    try {
      await EmailCampaign.findByIdAndUpdate(req.params.id, { status: 'failed' });
    } catch (_) {}
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/test — send test email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/test', requireMarketingAccess, async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail) return res.status(400).json({ success: false, message: 'Email de test requis' });

    const campaign = await EmailCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });

    const resend = getResend();
    const html = buildHtml(campaign);
    const from = `${campaign.fromName || FROM_NAME_DEFAULT} <${campaign.fromEmail || FROM_DEFAULT}>`;

    await resend.emails.send({
      from,
      to: [testEmail],
      subject: `[TEST] ${campaign.subject}`,
      html,
      text: campaign.bodyText || undefined
    });

    res.json({ success: true, message: `Email de test envoyé à ${testEmail}` });
  } catch (err) {
    console.error('marketing/test:', err);
    res.status(500).json({ success: false, message: `Erreur d'envoi: ${err.message}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/duplicate — duplicate a campaign
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/duplicate', requireMarketingAccess, async (req, res) => {
  try {
    const original = await EmailCampaign.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Campagne introuvable' });

    const { _id, createdAt, updatedAt, sentAt, results, stats, ...rest } = original;
    const copy = new EmailCampaign({
      ...rest,
      name: `${original.name} (copie)`,
      status: 'draft',
      scheduledAt: null,
      sentAt: null,
      stats: { targeted: 0, sent: 0, failed: 0, opened: 0, clicked: 0 },
      results: [],
      createdBy: req.ecomUser._id
    });
    await copy.save();
    res.status(201).json({ success: true, data: copy });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/campaigns/:id/results — get send results
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns/:id/results', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id).select('name stats results status sentAt').lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/stats — global marketing stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', requireMarketingAccess, async (req, res) => {
  try {
    const query = {};
    if (req.ecomUser.role === 'ecom_admin' && req.ecomUser.workspaceId) {
      query.workspaceId = req.ecomUser.workspaceId;
    }

    const [total, byStatus, totals] = await Promise.all([
      EmailCampaign.countDocuments(query),
      EmailCampaign.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      EmailCampaign.aggregate([
        { $match: { ...query, status: 'sent' } },
        { $group: {
          _id: null,
          totalSent: { $sum: '$stats.sent' },
          totalFailed: { $sum: '$stats.failed' },
          totalTargeted: { $sum: '$stats.targeted' }
        }}
      ])
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        total,
        byStatus: statusMap,
        totals: totals[0] || { totalSent: 0, totalFailed: 0, totalTargeted: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/variables — list available substitution variables
// ─────────────────────────────────────────────────────────────────────────────
router.get('/variables', requireMarketingAccess, async (req, res) => {
  try {
    const variables = [
      { tag: '{{prenom}}', description: 'Prénom de l\'utilisateur', example: 'Jean' },
      { tag: '{{name}}', description: 'Nom complet de l\'utilisateur', example: 'Jean Dupont' },
      { tag: '{{email}}', description: 'Email de l\'utilisateur', example: 'jean@example.com' },
      { tag: '{{workspace}}', description: 'Nom du workspace', example: 'Ma Boutique' },
      { tag: '{{role}}', description: 'Rôle de l\'utilisateur', example: 'admin' }
    ];
    
    res.json({ success: true, data: { variables } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/audience-preview — preview audience count
// ─────────────────────────────────────────────────────────────────────────────
router.post('/audience-preview', requireMarketingAccess, async (req, res) => {
  try {
    const { audienceType, customEmails, segmentFilter } = req.body;
    let count = 0;

    if (audienceType === 'custom_list') {
      count = (customEmails || []).filter(e => e?.includes('@')).length;
    } else if (audienceType === 'all_users') {
      count = await EcomUser.countDocuments({ isActive: true });
    } else if (audienceType === 'workspace_users') {
      const query = { isActive: true };
      if (req.ecomUser.workspaceId) query.workspaceId = req.ecomUser.workspaceId;
      if (segmentFilter?.roles?.length) query.role = { $in: segmentFilter.roles };
      if (segmentFilter?.hasWorkspace === true) query.workspaceId = { $ne: null };
      if (segmentFilter?.hasWorkspace === false) query.workspaceId = null;
      count = await EcomUser.countDocuments(query);
    }

    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
