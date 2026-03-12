import { Router } from 'express';
import express from 'express';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import {
  connect,
  callback,
  getStores,
  disconnectStore,
  syncOrders,
  verifyWebhookHmac
} from '../controllers/shopifyController.js';

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
