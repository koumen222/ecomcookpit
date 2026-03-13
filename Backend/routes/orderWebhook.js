/**
 * orderWebhook.js — Route
 * ─────────────────────────
 * Monte les endpoints du webhook de réception de commandes.
 *
 * Endpoints exposés :
 *   GET  /webhook/orders/health          → Vérification de santé
 *   POST /webhook/orders/:workspaceToken → Réception d'une commande
 *
 * Le :workspaceToken est un identifiant unique per-workspace qui permet
 * de router la commande vers le bon workspace sans authentification JWT
 * (les webhooks sont appelés par des systèmes externes, pas des utilisateurs).
 */

import express from 'express';
import {
  handleOrderWebhook,
  healthCheck,
} from '../controllers/orderWebhookController.js';

const router = express.Router();

// ── GET /webhook/orders/health ────────────────────────────────────────────
// Doit être déclaré AVANT la route /:workspaceToken pour éviter que
// le segment "health" soit interprété comme un token.
router.get('/health', healthCheck);

// ── POST /webhook/orders/:workspaceToken ──────────────────────────────────
router.post('/:workspaceToken', handleOrderWebhook);

export default router;
