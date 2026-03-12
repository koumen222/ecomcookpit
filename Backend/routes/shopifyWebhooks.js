import express from 'express';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { handleOrderCreated, testWebhook, getWebhookToken } from '../controllers/shopifyWebhookController.js';

const router = express.Router();

/**
 * POST /api/webhooks/shopify/orders/:webhookToken
 * Webhook Shopify — événement orders/create
 * Chaque workspace a son propre token unique (PAS d'auth — appelé par Shopify)
 *
 * Configuration côté Shopify :
 *   Event:        Order creation
 *   Format:       JSON
 *   Webhook URL:  https://api.scalor.net/api/webhooks/shopify/orders/<VOTRE_TOKEN>
 */
router.post('/orders/:webhookToken', handleOrderCreated);

/**
 * GET /api/webhooks/shopify/test
 * Vérifier que l'endpoint est accessible
 */
router.get('/test', testWebhook);

/**
 * POST /api/webhooks/shopify/generate-token
 * Génère ou récupère le token webhook pour le workspace courant
 * Nécessite authentification (appelé depuis le frontend)
 */
router.post('/generate-token', requireEcomAuth, getWebhookToken);

export default router;
