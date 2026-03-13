/**
 * orderWebhookController.js
 * ─────────────────────────
 * Controller pour le webhook de réception de commandes.
 *
 * Stratégie de performance :
 *   1. Valider et répondre 200 IMMÉDIATEMENT (évite les retries côté expéditeur).
 *   2. Traiter la commande en arrière-plan dans un setImmediate().
 *
 * Sécurité :
 *   - Vérification optionnelle de la signature HMAC-SHA256 (ORDER_WEBHOOK_SECRET)
 *   - Identification du workspace via un token unique dans l'URL (:workspaceToken)
 *   - Filtrage de l'événement : seuls les events "order.created" sont traités
 *   - Toutes les entrées sont sanitisées dans le service
 */

import crypto from 'crypto';
import Workspace from '../models/Workspace.js';
import {
  verifyWebhookSignature,
  extractOrderData,
  passesFilters,
  saveWebhookOrder,
} from '../services/orderWebhookService.js';

// Secret HMAC configuré dans les variables d'environnement.
// Si absent, la vérification de signature est désactivée (utile en dev).
const WEBHOOK_SECRET = process.env.ORDER_WEBHOOK_SECRET;

// ─── handleOrderWebhook ──────────────────────────────────────────────────────

/**
 * POST /webhook/orders/:workspaceToken
 *
 * Reçoit une commande depuis un système externe (formulaire, CRM, app tierce…).
 *
 * Format de payload attendu :
 * {
 *   "event": "order.created",          // optionnel, filtré si présent
 *   "order": {
 *     "orderNumber":     "1001",
 *     "createdAt":       "2024-01-01T10:00:00Z",
 *     "fullName":        "Ahmed Nour",
 *     "phone":           "+23512345678",
 *     "address1":        "Quartier Moursal, Maison 42",
 *     "city":            "N'Djamena",
 *     "totalPrice":      15000,
 *     "productLink":     "https://example.com/produit",
 *     "productQuantity": 2,
 *     "note":            "Appeler avant livraison"
 *   }
 * }
 *
 * Headers optionnels :
 *   X-Webhook-Signature: sha256=<hmac_hex>   (requis si ORDER_WEBHOOK_SECRET défini)
 */
export const handleOrderWebhook = (req, res) => {
  const startTime = Date.now();
  const { workspaceToken } = req.params;

  // Identifiant unique pour tracer ce webhook dans les logs
  const requestId = crypto.randomUUID().split('-')[0].toUpperCase();

  // ── 1. Logger la réception ────────────────────────────────────────────
  console.log(
    `📥 [Webhook Orders] [${requestId}] Reçu — token=...${workspaceToken?.slice(-6)}, ` +
    `IP=${req.ip}, event="${req.body?.event || 'non spécifié'}"`
  );

  // ── 2. Vérifier la présence du workspaceToken ─────────────────────────
  if (!workspaceToken) {
    console.warn(`⚠️ [Webhook Orders] [${requestId}] Token workspace manquant`);
    return res.status(400).json({ success: false, message: 'Workspace token requis' });
  }

  // ── 3. Vérifier la validité du body JSON ──────────────────────────────
  if (!req.body || typeof req.body !== 'object') {
    console.warn(`⚠️ [Webhook Orders] [${requestId}] Body JSON invalide`);
    return res.status(400).json({ success: false, message: 'Payload JSON invalide' });
  }

  // ── 4. Filtrer les événements non pertinents ──────────────────────────
  // Si le champ "event" est présent, on ne traite que les créations de commande.
  const event = req.body.event;
  if (event && event !== 'order.created' && event !== 'order_created' && event !== 'new_order') {
    console.log(`ℹ️ [Webhook Orders] [${requestId}] Event ignoré: "${event}"`);
    return res.status(200).json({ success: true, message: `Event "${event}" non pris en charge` });
  }

  // ── 5. Vérification de la signature HMAC (si secret configuré) ────────
  if (WEBHOOK_SECRET) {
    const signatureHeader = req.headers['x-webhook-signature'];
    const rawBody = req.rawBody; // capturé dans server.js pour /api/webhooks/*

    if (!signatureHeader || !rawBody) {
      console.warn(
        `⚠️ [Webhook Orders] [${requestId}] Signature ou raw body manquant ` +
        `(header: ${!!signatureHeader}, rawBody: ${!!rawBody})`
      );
      return res.status(401).json({ success: false, message: 'Signature manquante' });
    }

    if (!verifyWebhookSignature(rawBody, signatureHeader, WEBHOOK_SECRET)) {
      console.warn(`⚠️ [Webhook Orders] [${requestId}] Signature HMAC invalide`);
      return res.status(401).json({ success: false, message: 'Signature invalide' });
    }

    console.log(`🔐 [Webhook Orders] [${requestId}] Signature HMAC vérifiée ✓`);
  }

  // ── 6. Répondre 200 IMMÉDIATEMENT ─────────────────────────────────────
  // Cela évite que l'expéditeur considère le webhook comme un timeout et retry.
  res.status(200).json({ success: true, requestId });

  // ── 7. Traitement asynchrone (non bloquant) ────────────────────────────
  setImmediate(async () => {
    try {
      // Résoudre le workspace via son token unique
      const workspace = await Workspace.findOne(
        { orderWebhookToken: workspaceToken },
        { _id: 1, orderWebhookFilters: 1 }  // Projection minimale
      ).lean();

      if (!workspace) {
        console.error(
          `❌ [Webhook Orders] [${requestId}] Workspace introuvable pour token ...${workspaceToken.slice(-6)}`
        );
        return;
      }

      // Extraire et sanitiser les données de la commande
      const orderData = extractOrderData(req.body);

      console.log(
        `🔍 [Webhook Orders] [${requestId}] Commande extraite — ` +
        `#${orderData.orderNumber || 'sans-id'}, ` +
        `client="${orderData.fullName}", ville="${orderData.city}"`
      );

      // Appliquer les filtres configurés (ville, produit — voir bonus)
      const filters = workspace.orderWebhookFilters || {};
      if (!passesFilters(orderData, filters)) {
        console.log(
          `🔶 [Webhook Orders] [${requestId}] Commande filtrée par les règles du workspace`
        );
        return;
      }

      // Enregistrer en base (gère la déduplication en interne)
      const saved = await saveWebhookOrder(orderData, workspace._id);

      const elapsed = Date.now() - startTime;
      if (saved) {
        console.log(
          `✅ [Webhook Orders] [${requestId}] Traitement terminé en ${elapsed}ms ` +
          `— commande ID: ${saved._id}`
        );
      } else {
        console.log(
          `🔁 [Webhook Orders] [${requestId}] Commande ignorée (doublon) — ${elapsed}ms`
        );
      }
    } catch (err) {
      console.error(`❌ [Webhook Orders] [${requestId}] Erreur traitement: ${err.message}`);
      console.error(err.stack);
    }
  });
};

// ─── healthCheck ─────────────────────────────────────────────────────────────

/**
 * GET /webhook/orders/health
 * Endpoint de test pour vérifier que la route est opérationnelle.
 * Utile pour les checks de l'infrastructure (load balancer, Postman, etc.)
 */
export const healthCheck = (_req, res) => {
  res.json({
    success:   true,
    message:   'Webhook Orders opérationnel',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  });
};
