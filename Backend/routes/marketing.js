import express from 'express';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import EmailCampaign from '../models/EmailCampaign.js';
import EmailCampaignRecipientLog from '../models/EmailCampaignRecipientLog.js';
import Campaign from '../models/Campaign.js';
import Client from '../models/Client.js';
import Order from '../models/Order.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from '../services/evolutionApiService.js';
import EcomUser from '../models/EcomUser.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import { formatInternationalPhone, normalizePhone } from '../utils/phoneUtils.js';

// ─── WhatsApp helpers (shared with campaigns.js) ─────────────────────────────
const sanitizePhoneNumber = (phone) => {
  const result = formatInternationalPhone(phone);
  return result.success ? result.formatted : null;
};

// Caractères invisibles unicode pour varier la longueur du message sans changer le rendu
const INVISIBLE_CHARS = ['\u200B', '\u200C', '\u200D', '\uFEFF'];

// Synonymes et variantes pour rendre chaque message unique
const SYNONYMS = {
  bonjour: ['Bonjour', 'Bonsoir', 'Salut', 'Hello', 'Coucou'],
  merci: ['Merci', 'Merci beaucoup', 'Grand merci', 'Mille mercis'],
  cordialement: ['Cordialement', 'Bonne journée', 'À bientôt', 'Bien à vous'],
  profitez: ['Profitez', 'Bénéficiez', 'Saisissez', 'Utilisez'],
  disponible: ['disponible', 'en stock', 'prêt', 'accessible'],
  rapidement: ['rapidement', 'vite', 'au plus tôt', 'dès que possible'],
  commande: ['commande', 'achat', 'livraison'],
  produit: ['produit', 'article', 'colis'],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function varyMessage(text) {
  // 1. Remplacer les mots-clés par des synonymes (insensible à la casse)
  let result = text;
  for (const [word, variants] of Object.entries(SYNONYMS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      const variant = pick(variants);
      // Conserver la casse du début si le mot original commence par majuscule
      return match[0] === match[0].toUpperCase() ? variant.charAt(0).toUpperCase() + variant.slice(1) : variant.toLowerCase();
    });
  }

  // 2. Insérer 1-3 caractères invisibles à des positions aléatoires dans le texte
  const numInvisible = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < numInvisible; i++) {
    const pos = Math.floor(Math.random() * result.length);
    const invisChar = pick(INVISIBLE_CHARS);
    result = result.slice(0, pos) + invisChar + result.slice(pos);
  }

  // 3. Varier légèrement la ponctuation finale (. → ! ou rien, etc.)
  result = result.replace(/\.(\s*)$/, () => pick(['.', '!', ' !', '.']).trimEnd() + '\n'.repeat(0));

  return result;
}

function renderMessage(template, client, orderData = null) {
  const orderInfo = orderData || client;
  return template
    .replace(/\{firstName\}/g, client.firstName || orderInfo.clientName?.split(' ')[0] || '')
    .replace(/\{lastName\}/g, client.lastName || orderInfo.clientName?.split(' ').slice(1).join(' ') || '')
    .replace(/\{fullName\}/g, client.firstName && client.lastName ? [client.firstName, client.lastName].join(' ') : (orderInfo.clientName || ''))
    .replace(/\{phone\}/g, client.phone || orderInfo.clientPhone || '')
    .replace(/\{city\}/g, client.city || orderInfo.city || '')
    .replace(/\{product\}/g, (client.products || []).join(', ') || orderInfo.product || '')
    .replace(/\{totalOrders\}/g, String(client.totalOrders || 1))
    .replace(/\{totalSpent\}/g, String(client.totalSpent || 0))
    .replace(/\{status\}/g, client._orderStatus || orderInfo.status || '')
    .replace(/\{price\}/g, String(orderInfo.price || 0))
    .replace(/\{quantity\}/g, String(orderInfo.quantity || 1));
}

function toMongoIn(v) {
  const arr = Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
  if (!arr.length) return null;
  return arr.length === 1 ? arr[0] : { $in: arr };
}

function buildClientFilter(workspaceId, targetFilters) {
  const filter = { workspaceId };
  const clientStatus = toMongoIn(targetFilters.clientStatus);
  if (clientStatus) filter.status = clientStatus;
  if (targetFilters.city) {
    const cities = Array.isArray(targetFilters.city) ? targetFilters.city : [targetFilters.city];
    filter.$or = cities.map(c => ({ city: { $regex: `^${c}`, $options: 'i' } }));
  }
  if (targetFilters.product) {
    const prods = Array.isArray(targetFilters.product) ? targetFilters.product : [targetFilters.product];
    filter.products = prods.length > 1 ? { $in: prods } : prods[0];
  }
  if (targetFilters.minOrders > 0) filter.totalOrders = { $gte: targetFilters.minOrders };
  return filter;
}

const router = express.Router();

const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY non configuré');
  return new Resend(key);
};

const FROM_DEFAULT = process.env.EMAIL_FROM || 'contact@infomania.store';
const FROM_NAME_DEFAULT = process.env.EMAIL_FROM_NAME || 'Scalor';
const TRACKING_BASE_URL = process.env.TRACKING_BASE_URL || process.env.BACKEND_PUBLIC_URL || process.env.FRONTEND_URL || 'https://ecomcockpit.site';

// ─── Middleware: super_admin OR ecom_admin ───────────────────────────────────
const requireMarketingAccess = [requireEcomAuth, (req, res, next) => {
  const role = req.ecomUser?.role;
  if (role === 'super_admin' || role === 'ecom_admin') return next();
  return res.status(403).json({ success: false, message: 'Accès refusé' });
}];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHtml(campaign, user = null, recipientToken = null) {
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

  // Ajouter le tracking des liens si on a un token de destinataire
  if (recipientToken) {
    // Transformer les liens pour le tracking
    body = body.replace(/href="([^"]+)"/g, (match, url) => {
      if (url.startsWith('mailto:') || url.startsWith('#') || url.includes('track/click')) {
        return match; // Ne pas tracker les emails ou ancres
      }
      const encodedUrl = encodeURIComponent(url);
      return `href="${TRACKING_BASE_URL}/api/ecom/marketing/track/click/${campaign._id}/${recipientToken}?url=${encodedUrl}"`;
    });
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
  ${recipientToken ? `<img src="${TRACKING_BASE_URL}/api/ecom/marketing/track/open/${campaign._id}/${recipientToken}" width="1" height="1" style="display:none;" alt="" />` : ''}
  <div class="wrapper"><div class="card">
    <div class="header"><h1>${fromName}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${fromName}</p>
      <p><a href="https://scalor.site/" style="color:#888;text-decoration:none">Accéder à la plateforme</a></p>
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

function generateRecipientToken() {
  return randomBytes(16).toString('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/campaigns — list all campaigns
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns', requireMarketingAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (req.ecomUser.role === 'ecom_admin' && req.workspaceId) {
      query.workspaceId = req.workspaceId;
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
      workspaceId: req.ecomUser.role === 'ecom_admin' ? (req.workspaceId || null) : null,
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
    // Vérifier d'abord si c'est une campagne WhatsApp en cours d'envoi
    const whatsappCampaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (whatsappCampaign) {
      // Empêcher la suppression si la campagne est en cours d'envoi
      if (whatsappCampaign.status === 'sending') {
        return res.status(400).json({ 
          success: false, 
          message: 'Impossible de supprimer une campagne en cours d\'envoi. Mettez-la en pause d\'abord.' 
        });
      }
      await Campaign.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: 'Campagne supprimée' });
    }
    
    // Sinon vérifier si c'est une campagne email
    const emailCampaign = await EmailCampaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (emailCampaign) {
      if (emailCampaign.status === 'sending') {
        return res.status(400).json({ 
          success: false, 
          message: 'Impossible de supprimer une campagne en cours d\'envoi.' 
        });
      }
      await EmailCampaign.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: 'Campagne supprimée' });
    }
    
    return res.status(404).json({ success: false, message: 'Campagne introuvable' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/send — send campaign now
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/send', requireMarketingAccess, async (req, res) => {
  try {
    console.log(`🔍 [marketing] Request body:`, JSON.stringify(req.body, null, 2));
    
    // ── Tentative 1 : campagne email ──────────────────────────────────────────
    const emailCampaign = await EmailCampaign.findById(req.params.id);

    // ── Tentative 2 : campagne WhatsApp avec SSE streaming ─────────────────────
    if (!emailCampaign) {
      const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });

      // Utiliser l'instance sélectionnée par l'utilisateur ou la première par défaut
      let instance;
      const selectedInstanceId = req.body.whatsappInstanceId || req.body.instanceId;
      const userIdStr = String(req.ecomUser._id);
      if (selectedInstanceId) {
        instance = await WhatsAppInstance.findOne({
          _id: selectedInstanceId,
          $or: [
            { workspaceId: req.workspaceId },
            { userId: userIdStr }
          ],
          isActive: true
        });
        if (!instance) {
          // Dernière tentative : chercher uniquement par _id (cas instance liée à un autre user du même workspace)
          instance = await WhatsAppInstance.findOne({ _id: selectedInstanceId, isActive: true });
        }
        if (!instance) {
          return res.status(400).json({ success: false, message: 'Instance WhatsApp sélectionnée introuvable ou inactive.' });
        }
        console.log(`🎯 Instance sélectionnée par l'utilisateur: "${instance.customName || instance.instanceName}"`);
      } else {
        let instances = await WhatsAppInstance.find({ workspaceId: req.workspaceId, isActive: true, status: { $in: ['connected', 'active'] } }).sort({ defaultPart: -1 });
        if (instances.length === 0) {
          instances = await WhatsAppInstance.find({ userId: userIdStr, isActive: true, status: { $in: ['connected', 'active'] } }).sort({ defaultPart: -1 });
        }
        if (instances.length === 0) return res.status(400).json({ success: false, message: 'Aucune instance WhatsApp connectée. Configurez une instance dans "Connexion WhatsApp".' });
        instance = instances[0];
        console.log(`🎯 Instance par défaut: "${instance.customName || instance.instanceName}" (defaultPart: ${instance.defaultPart || 50}%)`);
      }

      const instanceStatus = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);
      if (!instanceStatus || !instanceStatus.instance || instanceStatus.instance.state !== 'open') {
        return res.status(400).json({ success: false, message: `L'instance "${instance.customName || instance.instanceName}" n'est pas connectée à WhatsApp. Scannez le QR code pour vous connecter.` });
      }

      if (campaign.status === 'sending') return res.status(400).json({ success: false, message: 'Envoi déjà en cours' });

      // ✅ Résoudre les destinataires DIRECTEMENT depuis Google Sheets (Order)
      let recipients = [];
      
      // Méthode 1: selectedClientIds (ce sont des Order IDs depuis Google Sheets)
      if (campaign.selectedClientIds?.length > 0) {
        console.log(`📋 [marketing] Récupération depuis selectedClientIds (${campaign.selectedClientIds.length} Order IDs)`);
        const orders = await Order.find({ _id: { $in: campaign.selectedClientIds }, workspaceId: req.workspaceId })
          .select('clientName clientPhone city address product price date status quantity')
          .lean();
        console.log(`✅ [marketing] ${orders.length} commandes trouvées depuis Google Sheets`);
        
        // Utiliser DIRECTEMENT les données des commandes
        const phoneMap = new Map();
        for (const order of orders) {
          const phone = (order.clientPhone || '').trim();
          if (!phone) continue;
          // Auto-détection du code pays (pas de préfixe forcé)
          const normalized = normalizePhone(phone);
          if (!normalized) continue;
          // Garder la commande la plus récente par numéro
          if (!phoneMap.has(normalized) || new Date(order.date) > new Date(phoneMap.get(normalized).date)) {
            phoneMap.set(normalized, order);
          }
        }
        
        console.log(`📞 [marketing] ${phoneMap.size} numéros uniques extraits`);
        
        for (const [normalized, order] of phoneMap) {
          recipients.push({
            phone: normalized,
            client: {
              firstName: order.clientName?.split(' ')[0] || '',
              lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
              phone: normalized,
              city: order.city || '',
              address: order.address || ''
            },
            orderData: order
          });
        }
        console.log(`✅ [marketing] ${recipients.length} destinataires créés depuis Google Sheets`);
      }
      // Méthode 2: recipientSnapshotIds - DÉSACTIVÉE (on utilise selectedClientIds à la place)
      // Méthode 3: targetFilters - utiliser filtres clients directs uniquement si pas de selectedClientIds
      else if (campaign.targetFilters && Object.keys(campaign.targetFilters).some(k => campaign.targetFilters[k])) {
        const filter = buildClientFilter(req.workspaceId, campaign.targetFilters);
        filter.phone = { $exists: true, $ne: '' };
        const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').limit(1000).lean();
        recipients = clients.map(c => ({ phone: c.phone, client: c, orderData: null }));
      }

      if (recipients.length === 0) {
        console.error(`❌ [marketing] Aucun destinataire trouvé - selectedClientIds: ${campaign.selectedClientIds?.length || 0}`);
        return res.status(400).json({ success: false, message: 'Aucun destinataire trouvé pour cette campagne' });
      }

      // Debug: vérifier les médias de la campagne
      console.log('📸 [Campaign Media Debug]:', {
        hasMedia: !!campaign.media,
        mediaType: campaign.media?.type,
        mediaUrl: campaign.media?.url,
        mediaFileName: campaign.media?.fileName
      });

      // ══ SSE : diffusion temps réel ════════════════════════════════════════════
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let clientConnected = true;
      req.on('close', () => { clientConnected = false; });

      const emit = (event, data) => {
        if (!clientConnected) return;
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          if (res.flush) res.flush();
        } catch (_) { clientConnected = false; }
      };

      // Ne jamais interrompre la boucle à cause d'une déconnexion client
      // La campagne continue en arrière-plan même si le client se déconnecte

      campaign.status = 'sending';
      campaign.pauseRequested = false;
      await campaign.save();

      console.log(`📤 Envoi SSE "${campaign.name}" → ${recipients.length} destinataires via ${instance.instanceName}`);

      const BATCH_SIZE = 10;
      const BATCH_PAUSE_MS = 20 * 60 * 1000; // 20 minutes
      const MSG_DELAY_MS = 30000; // 30 secondes entre chaque message

      // Si reprise (paused/interrupted/failed), skip les déjà traités
      const alreadyProcessed = (campaign.sendProgress?.sent || 0) + (campaign.sendProgress?.failed || 0) + (campaign.sendProgress?.skipped || 0);
      let sent = campaign.sendProgress?.sent || 0;
      let failed = campaign.sendProgress?.failed || 0;
      let skipped = campaign.sendProgress?.skipped || 0;
      const totalRecipients = recipients.length;

      if (alreadyProcessed > 0 && alreadyProcessed < recipients.length) {
        console.log(`⏩ [CAMPAIGN] Reprise depuis le destinataire #${alreadyProcessed + 1} (${sent} envoyés, ${failed} échecs, ${skipped} ignorés)`);
        recipients = recipients.slice(alreadyProcessed);
      }

      emit('start', { total: totalRecipients, campaignName: campaign.name, instance: instance.customName || instance.instanceName, resumeFrom: alreadyProcessed, sent, failed, skipped });

      for (const { phone, client, orderData } of recipients) {
        // Vérifier demande de pause (seulement via DB, pas via déconnexion client)
        const fresh = await Campaign.findById(campaign._id).select('pauseRequested').lean();
        if (fresh?.pauseRequested) {
          campaign.status = 'paused';
          campaign.pauseRequested = false;
          campaign.sendProgress = { sent, failed, skipped, targeted: recipients.length };
          await campaign.save();
          emit('paused', { sent, failed, skipped, total: recipients.length });
          res.end();
          return;
        }

        const cleanNumber = sanitizePhoneNumber(phone);
        const clientName = [client.firstName, client.lastName].filter(Boolean).join(' ') || phone;

        if (!cleanNumber) {
          skipped++;
          emit('progress', { sent, failed, skipped, total: recipients.length, current: { name: clientName, phone, status: 'skipped', reason: 'Numéro invalide' } });
          continue;
        }

        const message = varyMessage(renderMessage(campaign.messageTemplate, client, orderData));
        
        // Envoyer le média si présent (image ou vocal)
        let result;
        try {
        if (campaign.media?.type === 'image' && campaign.media?.url) {
          // Étape 1 : envoyer le texte d'abord
          emit('substep', { name: clientName, phone: cleanNumber, step: 'text', status: 'sending' });
          const textResult = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
          emit('substep', { name: clientName, phone: cleanNumber, step: 'text', status: textResult.success ? 'done' : 'failed', error: textResult.error });

          // Étape 2 : envoyer l'image ensuite
          await new Promise(r => setTimeout(r, 1500));
          emit('substep', { name: clientName, phone: cleanNumber, step: 'image', status: 'sending' });
          const imageResult = await evolutionApiService.sendMedia(
            instance.instanceName,
            instance.instanceToken,
            cleanNumber,
            campaign.media.url,
            '',
            campaign.media.fileName || 'image.jpg'
          );
          emit('substep', { name: clientName, phone: cleanNumber, step: 'image', status: imageResult.success ? 'done' : 'failed', error: imageResult.error });
          // Succès global = le texte au moins est parti
          result = textResult.success ? textResult : imageResult;
        } else if (campaign.media?.type === 'audio' && campaign.media?.url) {
          // Envoyer le vocal d'abord, puis le message texte
          const audioResult = await evolutionApiService.sendAudio(
            instance.instanceName, 
            instance.instanceToken, 
            cleanNumber, 
            campaign.media.url
          );
          
          // Si le vocal est envoyé avec succès et qu'il y a un message texte, l'envoyer aussi
          if (audioResult.success && message.trim()) {
            await new Promise(r => setTimeout(r, 2000)); // Petit délai entre vocal et texte
            result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
          } else {
            result = audioResult;
          }
        } else {
          // Message texte simple
          result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
        }
        } catch (sendError) {
          // Capturer toute exception pour ne pas casser la boucle
          console.error(`❌ Exception envoi à ${cleanNumber}:`, sendError.message);
          result = { success: false, error: sendError.message || 'Exception lors de l\'envoi' };
        }

        const index = alreadyProcessed + sent + failed + skipped;
        if (result.success) {
          sent++;
          emit('progress', { sent, failed, skipped, total: totalRecipients, index, current: { name: clientName, phone: cleanNumber, status: 'sent', reason: 'Envoyé' } });
        } else if (result.noWhatsApp) {
          skipped++;
          emit('progress', { sent, failed, skipped, total: totalRecipients, index, current: { name: clientName, phone: cleanNumber, status: 'skipped', reason: 'Pas sur WhatsApp' } });
        } else {
          failed++;
          emit('progress', { sent, failed, skipped, total: totalRecipients, index, current: { name: clientName, phone: cleanNumber, status: 'failed', reason: String(result.error || 'Erreur inconnue') } });
        }

        // Sauvegarder le progress après chaque message pour permettre la reprise
        campaign.sendProgress = { sent, failed, skipped, targeted: totalRecipients };
        await campaign.save().catch(() => {});

        // Pause de 20 min tous les 10 messages envoyés avec succès
        if (result.success && sent % BATCH_SIZE === 0 && (alreadyProcessed + sent + failed + skipped) < totalRecipients) {
          console.log(`⏸️ [CAMPAIGN] Pause 20 min après ${sent} messages envoyés...`);
          emit('substep', { name: '', phone: '', step: 'batch_pause', status: 'pausing', detail: `Pause anti-spam 20 min (${sent} envoyés)` });
          await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
          emit('substep', { name: '', phone: '', step: 'batch_pause', status: 'done' });
        } else {
          await new Promise(r => setTimeout(r, MSG_DELAY_MS));
        }
      }

      campaign.status = 'sent';
      campaign.sentAt = new Date();
      campaign.sendProgress = { sent, failed, skipped, targeted: totalRecipients };
      campaign.stats = { ...(campaign.stats?.toObject?.() || campaign.stats || {}), sent, failed, targeted: totalRecipients };
      await campaign.save();
      await WhatsAppInstance.findByIdAndUpdate(instance._id, { lastSeen: new Date(), status: 'connected' });

      emit('done', { sent, failed, skipped, total: totalRecipients, campaignName: campaign.name });
      console.log(`✅ Campagne SSE terminée : ${sent} envoyés, ${failed} échecs, ${skipped} ignorés`);
      res.end();
      return;
    }

    // ── Suite du traitement email normal ──────────────────────────────────────
    const campaign = emailCampaign;
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
    const recipientLogs = [];

    // Send emails one by one with delay and personalization
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const recipientToken = generateRecipientToken();
      try {
        // Generate personalized HTML for each recipient with tracking
        const personalizedHtml = buildHtml(campaign, recipient, recipientToken);
        
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
        const sentAt = new Date();
        results.push({
          email: recipient.email, 
          name: recipient.name,
          status: 'sent', 
          sentAt,
          resendId: resp?.data?.id || null,
          recipientToken,
          opened: false,
          clicks: [],
          uniqueClicks: 0
        });
        recipientLogs.push({
          campaignId: campaign._id,
          workspaceId: campaign.workspaceId || null,
          recipientToken,
          email: recipient.email,
          name: recipient.name || '',
          status: 'sent',
          error: '',
          sentAt,
          resendId: resp?.data?.id || null,
          opened: false,
          openCount: 0,
          clicks: [],
          uniqueClicks: 0
        });
      } catch (err) {
        failed++;
        const sentAt = new Date();
        const errorMessage = err.message || 'Erreur inconnue';
        results.push({
          email: recipient.email, 
          name: recipient.name,
          status: 'failed', 
          error: errorMessage,
          sentAt,
          recipientToken,
          opened: false,
          clicks: [],
          uniqueClicks: 0
        });
        recipientLogs.push({
          campaignId: campaign._id,
          workspaceId: campaign.workspaceId || null,
          recipientToken,
          email: recipient.email,
          name: recipient.name || '',
          status: 'failed',
          error: errorMessage,
          sentAt,
          resendId: null,
          opened: false,
          openCount: 0,
          clicks: [],
          uniqueClicks: 0
        });
      }
      
      // Delay between 3 and 5 seconds before next email
      const delay = 3000 + Math.random() * 2000; // 3000ms to 5000ms
      await new Promise(r => setTimeout(r, delay));
    }

    campaign.status = failed === recipients.length ? 'failed' : 'sent';
    campaign.sentAt = new Date();
    campaign.stats.sent = sent;
    campaign.stats.failed = failed;
    campaign.results = results.slice(0, 500); // aperçu rapide en campagne, historique complet dans EmailCampaignRecipientLog
    await campaign.save();

    if (recipientLogs.length > 0) {
      await EmailCampaignRecipientLog.deleteMany({ campaignId: campaign._id });
      await EmailCampaignRecipientLog.insertMany(recipientLogs, { ordered: false });
    }

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
// GET /api/ecom/marketing/campaigns/:id/results — get detailed send results
router.get('/campaigns/:id/results', requireMarketingAccess, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const status = req.query.status ? String(req.query.status) : '';
    const search = String(req.query.search || '').trim();

    const campaignQuery = { _id: req.params.id };
    if (req.ecomUser.role === 'ecom_admin' && req.workspaceId) {
      campaignQuery.workspaceId = req.workspaceId;
    }

    const campaign = await EmailCampaign.findOne(campaignQuery)
      .select('name stats createdAt sentAt status workspaceId')
      .lean();
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    }

    const logFilter = { campaignId: campaign._id };
    if (status) logFilter.status = status;
    if (search) {
      logFilter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const [recipients, totalRecipients, summaryAgg, topLinksAgg] = await Promise.all([
      EmailCampaignRecipientLog.find(logFilter)
        .sort({ sentAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailCampaignRecipientLog.countDocuments(logFilter),
      EmailCampaignRecipientLog.aggregate([
        { $match: { campaignId: campaign._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            opened: { $sum: { $cond: ['$opened', 1, 0] } },
            clicked: { $sum: { $cond: [{ $gt: ['$uniqueClicks', 0] }, 1, 0] } },
            totalClicks: { $sum: { $size: { $ifNull: ['$clicks', []] } } }
          }
        }
      ]),
      EmailCampaignRecipientLog.aggregate([
        { $match: { campaignId: campaign._id } },
        { $unwind: { path: '$clicks', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$clicks.url',
            clicks: { $sum: 1 },
            uniqueRecipients: { $addToSet: '$email' }
          }
        },
        {
          $project: {
            _id: 0,
            url: '$_id',
            clicks: 1,
            uniqueRecipients: { $size: '$uniqueRecipients' }
          }
        },
        { $sort: { clicks: -1 } },
        { $limit: 10 }
      ])
    ]);

    const summaryRow = summaryAgg[0] || { total: 0, sent: 0, failed: 0, opened: 0, clicked: 0, totalClicks: 0 };
    const sentCount = summaryRow.sent;
    const failedCount = summaryRow.failed;
    const openedCount = summaryRow.opened;
    const clickedCount = summaryRow.clicked;
    const totalClicks = summaryRow.totalClicks;

    // Taux de conversion
    const openRate = sentCount > 0 ? (openedCount / sentCount * 100).toFixed(1) : 0;
    const clickRate = sentCount > 0 ? (clickedCount / sentCount * 100).toFixed(1) : 0;
    const clickToOpenRate = openedCount > 0 ? (clickedCount / openedCount * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign._id,
          name: campaign.name,
          status: campaign.status,
          createdAt: campaign.createdAt,
          sentAt: campaign.sentAt
        },
        summary: {
          total: summaryRow.total,
          sent: sentCount,
          failed: failedCount,
          opened: openedCount,
          clicked: clickedCount,
          totalClicks: totalClicks,
          openRate: parseFloat(openRate),
          clickRate: parseFloat(clickRate),
          clickToOpenRate: parseFloat(clickToOpenRate)
        },
        pagination: {
          page,
          limit,
          total: totalRecipients,
          pages: Math.ceil(totalRecipients / limit)
        },
        topLinks: topLinksAgg,
        recipients: recipients.map((recipient, index) => ({
          index: (page - 1) * limit + index,
          email: recipient.email,
          name: recipient.name,
          status: recipient.status,
          error: recipient.error,
          sentAt: recipient.sentAt,
          opened: recipient.opened,
          openedAt: recipient.openedAt,
          openCount: recipient.openCount || 0,
          uniqueClicks: recipient.uniqueClicks,
          totalClicks: recipient.clicks?.length || 0,
          lastClickedAt: recipient.lastClickedAt,
          clicks: recipient.clicks || []
        }))
      }
    });
  } catch (err) {
    console.error('marketing/results:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/stats — global marketing stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', requireMarketingAccess, async (req, res) => {
  try {
    const query = {};
    if (req.ecomUser.role === 'ecom_admin' && req.workspaceId) {
      query.workspaceId = req.workspaceId;
    }

    const [total, byStatus, totals, engagementTotals] = await Promise.all([
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
      ]),
      EmailCampaign.aggregate([
        { $match: { ...query, status: 'sent' } },
        { $group: {
          _id: null,
          totalOpened: { $sum: '$stats.opened' },
          totalClicked: { $sum: '$stats.clicked' }
        }}
      ])
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });
    const totalsSummary = totals[0] || { totalSent: 0, totalFailed: 0, totalTargeted: 0 };
    const engagementSummary = engagementTotals[0] || { totalOpened: 0, totalClicked: 0 };
    const openRate = totalsSummary.totalSent > 0
      ? Number(((engagementSummary.totalOpened / totalsSummary.totalSent) * 100).toFixed(1))
      : 0;
    const clickRate = totalsSummary.totalSent > 0
      ? Number(((engagementSummary.totalClicked / totalsSummary.totalSent) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        total,
        byStatus: statusMap,
        totals: {
          ...totalsSummary,
          ...engagementSummary,
          openRate,
          clickRate
        }
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
      if (req.ecomUser.role === 'ecom_admin' && req.workspaceId) query.workspaceId = req.workspaceId;
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/pause
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/pause', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    }
    
    // Vérifier que la campagne est bien en cours d'envoi
    if (campaign.status !== 'sending') {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible de mettre en pause une campagne avec le statut "${campaign.status}". Seules les campagnes en cours d'envoi peuvent être mises en pause.` 
      });
    }
    
    // Marquer la demande de pause
    campaign.pauseRequested = true;
    await campaign.save();
    
    res.json({ success: true, message: 'Pause demandée, arrêt après le message en cours...' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/resume  (remet en draft pour relancer)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/resume', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    }
    
    // Vérifier que la campagne peut être reprise
    const resumableStatuses = ['paused', 'interrupted', 'failed'];
    if (!resumableStatuses.includes(campaign.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible de reprendre une campagne avec le statut "${campaign.status}". Seules les campagnes en pause, interrompues ou échouées peuvent être reprises.` 
      });
    }
    
    campaign.status = 'draft';
    campaign.pauseRequested = false;
    await campaign.save();
    
    res.json({ success: true, message: 'Campagne prête. Cliquez sur Envoyer pour relancer.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/restart  (relancer depuis le début)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/restart', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { status: 'draft', pauseRequested: false, sendProgress: { sent: 0, failed: 0, skipped: 0, targeted: 0 }, sentAt: null },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    res.json({ success: true, message: 'Campagne réinitialisée. Prête à être relancée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL TRACKING ROUTES (PUBLIC - no auth required)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/ecom/marketing/track/open/:campaignId/:recipientToken — track email open
router.get('/track/open/:campaignId/:recipientToken', async (req, res) => {
  try {
    const { campaignId, recipientToken } = req.params;

    const updatedLog = await EmailCampaignRecipientLog.findOneAndUpdate(
      { campaignId, recipientToken, opened: { $ne: true } },
      { $set: { opened: true, openedAt: new Date() }, $inc: { openCount: 1 } },
      { new: true }
    );

    if (!updatedLog) {
      const existingLog = await EmailCampaignRecipientLog.findOne({ campaignId, recipientToken }).lean();
      if (!existingLog) {
        return res.status(404).send('Not found');
      }
      await EmailCampaignRecipientLog.updateOne({ _id: existingLog._id }, { $inc: { openCount: 1 } });
    } else {
      await EmailCampaign.updateOne({ _id: campaignId }, { $inc: { 'stats.opened': 1 } });
    }

    const campaign = await EmailCampaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).send('Not found');
    }

    const resultIdx = campaign.results.findIndex(r => r.recipientToken === recipientToken);
    if (resultIdx !== -1) {
      if (!campaign.results[resultIdx].opened) {
        campaign.results[resultIdx].opened = true;
        campaign.results[resultIdx].openedAt = new Date();
      }
      campaign.results[resultIdx].openCount = (campaign.results[resultIdx].openCount || 0) + 1;
      await campaign.save();
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(pixel);
  } catch (err) {
    console.error('Email open tracking error:', err);
    res.status(500).send('Error');
  }
});

// GET /api/ecom/marketing/track/click/:campaignId/:recipientToken — track link click
router.get('/track/click/:campaignId/:recipientToken', async (req, res) => {
  try {
    const { campaignId, recipientToken } = req.params;

    const campaign = await EmailCampaign.findById(campaignId);
    if (!campaign) {
      return res.redirect('https://ecomcockpit.site');
    }
    const originalUrl = req.query.url;

    if (originalUrl) {
      const now = new Date();
      const log = await EmailCampaignRecipientLog.findOne({ campaignId, recipientToken });

      if (log) {
        const clicks = Array.isArray(log.clicks) ? [...log.clicks] : [];
        clicks.push({ url: originalUrl, clickedAt: now });
        const previousUnique = log.uniqueClicks || 0;
        const uniqueUrls = new Set(clicks.map(c => c.url));
        const newUnique = uniqueUrls.size;

        log.clicks = clicks;
        log.uniqueClicks = newUnique;
        log.lastClickedAt = now;
        await log.save();

        if (newUnique > previousUnique) {
          await EmailCampaign.updateOne({ _id: campaignId }, { $inc: { 'stats.clicked': 1 } });
        }
      }

      const resultIdx = campaign.results.findIndex(r => r.recipientToken === recipientToken);
      if (resultIdx !== -1) {
        const clicks = Array.isArray(campaign.results[resultIdx].clicks) ? campaign.results[resultIdx].clicks : [];
        const prevUnique = campaign.results[resultIdx].uniqueClicks || 0;
        clicks.push({ url: originalUrl, clickedAt: now });
        campaign.results[resultIdx].clicks = clicks;
        campaign.results[resultIdx].uniqueClicks = new Set(clicks.map(c => c.url)).size;
        campaign.results[resultIdx].lastClickedAt = now;

        if (campaign.results[resultIdx].uniqueClicks > prevUnique) {
          campaign.stats.clicked += 1;
        }

        await campaign.save();
      }

      // Redirect to original URL
      res.redirect(originalUrl);
    } else {
      res.redirect('https://ecomcockpit.site');
    }
  } catch (err) {
    console.error('Email click tracking error:', err);
    res.redirect('https://ecomcockpit.site');
  }
});

export default router;
