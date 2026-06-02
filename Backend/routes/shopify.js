import { Router } from 'express';
import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import {
  connect,
  callback,
  getStores,
  disconnectStore,
  syncOrders,
  verifyWebhookHmac,
  fetchShopifyProducts
} from '../controllers/shopifyController.js';
import ShopifyStore from '../models/ShopifyStore.js';
import Product from '../models/Product.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /shopify/connect — Initie le flux OAuth Shopify
// Pas de requireEcomAuth car c'est une redirection navigateur
// L'userId et workspaceId sont passés en query params et stockés en cookie
// ─────────────────────────────────────────────────────────────────────────────
router.get('/connect', connect);

// ─────────────────────────────────────────────────────────────────────────────
// GET /shopify/callback — Callback OAuth après autorisation Shopify
// Pas de requireEcomAuth (Shopify redirige directement ici)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/callback', callback);

// ─────────────────────────────────────────────────────────────────────────────
// GET /shopify/stores — Liste les boutiques connectées
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stores', requireEcomAuth, getStores);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /shopify/stores/:id — Déconnecte une boutique
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/stores/:id', requireEcomAuth, disconnectStore);

// ─────────────────────────────────────────────────────────────────────────────
// POST /shopify/stores/:id/sync — Synchronise les commandes
// ─────────────────────────────────────────────────────────────────────────────
router.post('/stores/:id/sync', requireEcomAuth, syncOrders);

// ─────────────────────────────────────────────────────────────────────────────
// POST /shopify/sync-products — Importer les produits Shopify dans la collection Product
// Crée les produits qui n'existent pas encore (match par nom, insensible à la casse)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync-products', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const stores = await ShopifyStore.find({
      workspaceId: req.workspaceId,
      isActive: true
    });

    if (!stores.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucune boutique Shopify connectée'
      });
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const store of stores) {
      try {
        const shopifyProducts = await fetchShopifyProducts(store.shop, store.accessToken);

        for (const sp of shopifyProducts) {
          const title = (sp.title || '').trim();
          if (!title) continue;

          const existing = await Product.findOne({
            workspaceId: req.workspaceId,
            name: { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
          }).select('_id').lean();

          if (existing) {
            totalSkipped++;
            continue;
          }

          const price = sp.variants?.[0]?.price ? parseFloat(sp.variants[0].price) : 0;

          await Product.create({
            workspaceId: req.workspaceId,
            name: title,
            sellingPrice: price,
            productCost: 0,
            deliveryCost: 0,
            stock: 0,
            reorderThreshold: 10,
            isActive: true,
            createdBy: req.user.id,
          });
          totalCreated++;
        }
      } catch (storeErr) {
        console.warn(`⚠️ [Shopify] Erreur sync produits pour ${store.shop}:`, storeErr.message);
      }
    }

    res.json({
      success: true,
      message: `${totalCreated} produit(s) importé(s), ${totalSkipped} déjà existant(s)`,
      data: { created: totalCreated, skipped: totalSkipped }
    });
  } catch (err) {
    console.error('❌ [Shopify] Erreur sync-products:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /shopify/webhooks/orders-create — Webhook Shopify (orders/create)
// Préparation future — pas de requireEcomAuth (Shopify envoie directement)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhooks/orders-create', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const rawBody = req.body;

    if (!verifyWebhookHmac(rawBody, hmac)) {
      console.error('❌ [Shopify Webhook] HMAC invalide');
      return res.status(401).json({ success: false, message: 'HMAC invalide' });
    }

    const data = JSON.parse(rawBody.toString('utf8'));
    console.log(`📦 [Shopify Webhook] Nouvelle commande reçue: ${data.name || data.id}`);

    // TODO: Traiter la commande (créer un Order dans la base, notifier, etc.)

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ [Shopify Webhook] Erreur:', err.message);
    res.status(500).json({ success: false });
  }
});

export default router;
