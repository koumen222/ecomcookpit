import express from 'express';
import Workspace from '../models/Workspace.js';
import { saveSkolerOrder } from '../services/skolerOrderService.js';

const router = express.Router();

/**
 * POST /api/orders/skelor
 * Reçoit une commande depuis le storefront Skelor (*.scalor.net).
 * Même pipeline que Shopify : sauvegarde + WhatsApp auto + notification temps réel.
 *
 * Body:
 *   subdomain      {string}  - Identifiant du workspace (ex: "koumen")
 *   customer_name  {string}
 *   phone          {string}
 *   address        {string}
 *   city           {string}
 *   product        {string}  - Description texte (si pas d'items)
 *   items          {Array}   - [{ name, quantity, price }] (optionnel)
 *   total_price    {number}
 *   currency       {string}  - Défaut: XAF
 *   status         {string}  - Défaut: pending
 *   order_id       {string}  - ID de référence (ex: StoreOrder._id)
 *   notes          {string}
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      subdomain,
      customer_name,
      phone,
      address,
      city,
      product,
      items = [],
      total_price,
      currency,
      status,
      order_id,
      notes,
      store_order_id,
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!subdomain) {
      return res.status(400).json({ success: false, error: 'subdomain requis' });
    }
    if (!phone && !customer_name) {
      return res.status(400).json({ success: false, error: 'phone ou customer_name requis' });
    }

    // ── Résoudre le workspace via subdomain ───────────────────────────────
    const workspace = await Workspace.findOne({ subdomain, isActive: true }).lean();

    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Boutique introuvable' });
    }

    const workspaceId = workspace._id.toString();

    // Lire aussi WorkspaceSettings pour whatsappAutoConfirm (peut être stocké là)
    const WorkspaceSettings = (await import('../models/WorkspaceSettings.js')).default;
    const wsSettings = await WorkspaceSettings.findOne({ workspaceId: workspace._id }).lean();

    const workspaceSettings = {
      whatsappAutoConfirm:    workspace.whatsappAutoConfirm || wsSettings?.whatsappAutoConfirm || false,
      whatsappOrderTemplate:  workspace.whatsappOrderTemplate || wsSettings?.whatsappOrderTemplate || null,
      whatsappAutoInstanceId: workspace.whatsappAutoInstanceId || wsSettings?.whatsappAutoInstanceId || null,
      whatsappAutoImageUrl:   workspace.whatsappAutoImageUrl || wsSettings?.whatsappAutoImageUrl || null,
      whatsappAutoAudioUrl:   workspace.whatsappAutoAudioUrl || wsSettings?.whatsappAutoAudioUrl || null,
      storeName:              workspace.storeSettings?.storeName || workspace.name || '',
    };

    // ── Répondre immédiatement (non-bloquant) ─────────────────────────────
    res.status(200).json({ success: true, received: true });

    // ── Traitement en arrière-plan ────────────────────────────────────────
    setImmediate(async () => {
      try {
        const order = await saveSkolerOrder(
          {
            orderId:     order_id || store_order_id || null,
            customerName: customer_name,
            phone,
            address,
            city,
            product,
            items,
            totalPrice:  total_price,
            currency,
            status,
            notes,
            storeOrderId: store_order_id || null,
          },
          workspaceId,
          workspaceSettings
        );

        const duration = Date.now() - startTime;
        if (order) {
          console.log(`✅ [Skelor Route] Commande #${order_id || order._id} → ${workspace.name} en ${duration}ms`);
        } else {
          console.log(`ℹ️ [Skelor Route] Commande #${order_id} ignorée (doublon) — ${duration}ms`);
        }
      } catch (err) {
        console.error(`❌ [Skelor Route] Erreur traitement:`, err.message);
      }
    });

  } catch (err) {
    console.error('❌ [Skelor Route] Erreur:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
