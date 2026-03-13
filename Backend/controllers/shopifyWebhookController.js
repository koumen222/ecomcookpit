import crypto from 'crypto';
import Workspace from '../models/Workspace.js';
import { saveShopifyOrder } from '../services/shopifyOrderService.js';

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

// ─── HMAC Verification ──────────────────────────────────────────────────────

/**
 * Vérifie le HMAC SHA-256 du webhook Shopify.
 * Shopify signe chaque webhook avec le secret configuré.
 * Header: X-Shopify-Hmac-Sha256 (base64)
 */
function verifyShopifyWebhookHmac(rawBody, hmacHeader) {
  if (!SHOPIFY_WEBHOOK_SECRET || !hmacHeader) return false;

  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader, 'base64'),
      Buffer.from(generatedHmac, 'base64')
    );
  } catch {
    return false;
  }
}

// ─── Controller ─────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/shopify/orders/:webhookToken
 * Reçoit le webhook Shopify orders/create
 * Le :webhookToken identifie le workspace destinataire
 *
 * Performance: répond 200 immédiatement, traite en arrière-plan.
 */
export const handleOrderCreated = (req, res) => {
  const startTime = Date.now();
  const { webhookToken } = req.params;

  // ── Vérifier le token ────────────────────────────────────────────────────
  if (!webhookToken) {
    console.error('❌ [Shopify WH] Token manquant dans l\'URL');
    return res.status(400).json({ success: false, message: 'Missing webhook token' });
  }

  // ── Vérifier que le body existe ──────────────────────────────────────────
  if (!req.body || typeof req.body !== 'object' || !req.body.id) {
    console.error('❌ [Shopify WH] Body JSON manquant ou invalide');
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  // ── Vérifier le HMAC si le secret est configuré ──────────────────────────
  if (SHOPIFY_WEBHOOK_SECRET) {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const rawBody = req.rawBody;

    if (!rawBody || !hmacHeader) {
      console.error('❌ [Shopify WH] HMAC header ou raw body manquant');
      return res.status(401).json({ success: false, message: 'Missing HMAC' });
    }

    if (!verifyShopifyWebhookHmac(rawBody, hmacHeader)) {
      console.error('❌ [Shopify WH] Signature HMAC invalide');
      return res.status(401).json({ success: false, message: 'Invalid HMAC signature' });
    }
  }

  // ── Extraire les métadonnées Shopify ─────────────────────────────────────
  const shopDomain = req.headers['x-shopify-shop-domain'] || '';
  const shopifyOrderId = req.body.id;
  const orderNumber = req.body.order_number || shopifyOrderId;
  const email = req.body.email || '';
  const totalPrice = req.body.total_price || '0';

  console.log(`📥 [Shopify WH] Nouvelle commande reçue`);
  console.log(`   🆔 #${orderNumber} | 📧 ${email} | 💰 ${totalPrice} ${req.body.currency || ''}`);
  console.log(`   🏪 ${shopDomain} | 🔑 token: ${webhookToken.substring(0, 8)}...`);

  // ── Répondre 200 immédiatement (Shopify attend < 5s) ─────────────────────
  res.status(200).json({ success: true, received: true });

  // ── Traitement asynchrone en arrière-plan ────────────────────────────────
  setImmediate(async () => {
    try {
      // Résoudre le workspace via le token
      const workspace = await Workspace.findOne({
        shopifyWebhookToken: webhookToken,
        isActive: true
      }).lean();

      if (!workspace) {
        console.error(`❌ [Shopify WH] Token invalide: ${webhookToken}`);
        return;
      }

      const workspaceId = workspace._id;
      console.log(`   🏢 Workspace: ${workspace.name} (${workspaceId})`);

      // Extraire les settings WhatsApp pour l'auto-confirmation
      const workspaceSettings = {
        whatsappAutoConfirm:    workspace.whatsappAutoConfirm || false,
        whatsappOrderTemplate:  workspace.whatsappOrderTemplate || null,
        storeName:              workspace.storeSettings?.storeName || workspace.name || '',
      };

      const order = await saveShopifyOrder(req.body, shopDomain, workspaceId, workspaceSettings);
      const duration = Date.now() - startTime;

      if (order) {
        console.log(`✅ [Shopify WH] Commande #${orderNumber} → ${workspace.name} en ${duration}ms`);
      } else {
        console.log(`ℹ️ [Shopify WH] Commande #${orderNumber} ignorée (doublon) — ${duration}ms`);
      }
    } catch (err) {
      console.error(`❌ [Shopify WH] Erreur traitement commande #${orderNumber}:`, err.message);
      console.error(err.stack);
    }
  });
};

/**
 * GET /api/webhooks/shopify/test
 * Route de test pour vérifier que l'endpoint webhook est accessible
 */
export const testWebhook = (req, res) => {
  res.json({
    success: true,
    message: 'Shopify webhook endpoint is active',
    timestamp: new Date().toISOString(),
    hmacConfigured: !!SHOPIFY_WEBHOOK_SECRET
  });
};

/**
 * POST /api/webhooks/shopify/generate-token
 * Génère ou récupère le token webhook unique pour le workspace courant
 * Appelé depuis le frontend (nécessite auth via header)
 */
export const getWebhookToken = async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.headers['x-workspace-id'];

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID manquant' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Générer un token s'il n'existe pas encore
    if (!workspace.shopifyWebhookToken) {
      workspace.shopifyWebhookToken = crypto.randomBytes(20).toString('hex');
      await workspace.save();
      console.log(`🔑 [Shopify WH] Token généré pour workspace ${workspace.name}`);
    }

    res.json({
      success: true,
      data: {
        webhookToken: workspace.shopifyWebhookToken,
        webhookUrl: `https://api.scalor.net/api/webhooks/shopify/orders/${workspace.shopifyWebhookToken}`
      }
    });
  } catch (err) {
    console.error('❌ [Shopify WH] Erreur generate-token:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
