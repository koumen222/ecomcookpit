/**
 * orderWebhookService.js
 * ──────────────────────
 * Service responsable de :
 *   - Vérification de la signature HMAC des webhooks entrants
 *   - Extraction et validation des champs de commande
 *   - Filtrage par ville / produit (bonus)
 *   - Dédoublonnage et persistance en base MongoDB
 *   - Notification temps réel (WebSocket + Push)
 */

import crypto from 'crypto';
import Order from '../models/Order.js';
import { notifyNewOrder } from './notificationHelper.js';
import { normalizeCity } from '../utils/cityNormalizer.js';

// ─── HMAC Verification ──────────────────────────────────────────────────────

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook.
 *
 * L'expéditeur doit envoyer le header :
 *   X-Webhook-Signature: sha256=<hex>
 *
 * @param {Buffer|string} rawBody       - Corps brut de la requête
 * @param {string}        signatureHeader - Valeur du header X-Webhook-Signature
 * @param {string}        secret         - Secret partagé (ORDER_WEBHOOK_SECRET)
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;

  // Accepter le format "sha256=<hex>" ou "<hex>" directement
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    // Comparaison en temps constant pour éviter les timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(provided.padEnd(64, '0'), 'hex'),
      Buffer.from(expected,               'hex')
    );
  } catch {
    return false;
  }
}

// ─── Sanitization helpers ────────────────────────────────────────────────────

/**
 * Supprime les caractères dangereux et tronque la chaîne.
 * Protège contre XSS persistant (les données sont re-rendues côté client).
 */
function sanitizeText(value, maxLen = 500) {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/[<>"'`]/g, '')   // Strip HTML/template injection chars
    .substring(0, maxLen);
}

/**
 * Nettoie un numéro de téléphone : ne conserve que chiffres et +.
 */
function sanitizePhone(phone) {
  if (!phone) return '';
  return String(phone)
    .trim()
    .replace(/[^\d+\s\-().]/g, '')
    .substring(0, 20);
}

/**
 * Convertit une valeur en float positif (retourne 0 si invalide).
 */
function sanitizePrice(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Convertit une valeur en entier >= 1.
 */
function sanitizeQuantity(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// ─── Data Extraction ─────────────────────────────────────────────────────────

/**
 * Extrait et valide les champs de commande depuis le payload brut.
 *
 * Supporte plusieurs formats de nommage (camelCase, snake_case, libellés humains)
 * pour être compatible avec un maximum de plateformes externes.
 *
 * @param {Object} payload - Corps JSON du webhook (req.body)
 * @returns {Object} Champs normalisés et validés
 */
export function extractOrderData(payload) {
  // Le payload peut encapsuler la commande dans `payload.order` ou l'exposer directement
  const raw = payload.order || payload;

  return {
    orderNumber: sanitizeText(
      raw.orderNumber  || raw.order_number  || raw['Order Number'] || '',
      100
    ),
    createdAt: raw.createdAt  || raw.created_at  || raw['Created Date'] || new Date(),
    fullName: sanitizeText(
      raw.fullName   || raw.full_name    || raw['Full Name']  || raw.name || '',
      200
    ),
    phone: sanitizePhone(
      raw.phone      || raw['Phone']     || raw.clientPhone  || raw.telephone || ''
    ),
    address1: sanitizeText(
      raw.address1   || raw.address_1    || raw['Address 1'] || raw.address   || '',
      500
    ),
    city: sanitizeText(
      raw.city       || raw['City']      || raw.ville        || '',
      100
    ),
    totalPrice: sanitizePrice(
      raw.totalPrice || raw.total_price  || raw['Total Price']
    ),
    productLink: sanitizeText(
      raw.productLink || raw.product_link || raw['Product Link'] || '',
      1000
    ),
    productQuantity: sanitizeQuantity(
      raw.productQuantity || raw.product_quantity || raw['Product Quantity'] || raw.quantity
    ),
    note: sanitizeText(
      raw.note       || raw.notes        || raw['Note']      || raw.comment   || '',
      2000
    ),
    // Nom du produit (optionnel, utilisé si productLink absent)
    product: sanitizeText(
      raw.product    || raw.productName  || raw.product_name || raw['Product Name'] || '',
      300
    ),
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Valide les champs obligatoires d'une commande.
 * Retourne null si valide, ou un message d'erreur sinon.
 *
 * @param {Object} orderData - Résultat de extractOrderData()
 * @returns {string|null}
 */
export function validateOrderData(orderData) {
  if (!orderData.phone && !orderData.fullName) {
    return 'Un numéro de téléphone ou un nom complet est requis';
  }
  if (orderData.phone && orderData.phone.replace(/\D/g, '').length < 6) {
    return 'Numéro de téléphone invalide (trop court)';
  }
  if (orderData.totalPrice < 0) {
    return 'Le prix total ne peut pas être négatif';
  }
  return null;
}

// ─── Filters (Bonus) ─────────────────────────────────────────────────────────

/**
 * Vérifie si une commande passe les filtres configurés au niveau du workspace.
 *
 * Exemples de filtres :
 *   { allowedCities: ["Paris", "Lyon"] }
 *   { allowedProducts: ["Nike", "Adidas"] }
 *
 * @param {Object} orderData - Résultat de extractOrderData()
 * @param {Object} filters   - { allowedCities?: string[], allowedProducts?: string[] }
 * @returns {boolean} true si la commande doit être enregistrée
 */
export function passesFilters(orderData, filters = {}) {
  const { allowedCities = [], allowedProducts = [] } = filters;

  // Filtre par ville
  if (allowedCities.length > 0) {
    const cityNorm = orderData.city.toLowerCase().trim();
    const cityMatches = allowedCities.some(c =>
      cityNorm.includes(c.toLowerCase().trim())
    );
    if (!cityMatches) {
      console.log(
        `🔶 [Webhook Orders] Commande rejetée — ville "${orderData.city}" hors filtre`
      );
      return false;
    }
  }

  // Filtre par produit (nom ou lien)
  if (allowedProducts.length > 0) {
    const productScope = `${orderData.product} ${orderData.productLink}`.toLowerCase();
    const productMatches = allowedProducts.some(p =>
      productScope.includes(p.toLowerCase().trim())
    );
    if (!productMatches) {
      console.log(
        `🔶 [Webhook Orders] Commande rejetée — produit "${orderData.product}" hors filtre`
      );
      return false;
    }
  }

  return true;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/**
 * Enregistre une commande reçue par webhook dans la base de données.
 *
 * - Dédoublonnage basé sur (orderId + source + workspaceId)
 * - Normalise la ville via cityNormalizer
 * - Déclenche la notification temps réel après création
 *
 * @param {Object} orderData    - Résultat validé de extractOrderData()
 * @param {string} workspaceId  - _id du workspace cible
 * @returns {Object|null} Document Order créé, ou null si doublon
 * @throws {Error} En cas d'erreur de validation ou de DB
 */
export async function saveWebhookOrder(orderData, workspaceId) {
  // ── Validation ────────────────────────────────────────────────────────
  const validationError = validateOrderData(orderData);
  if (validationError) {
    throw new Error(validationError);
  }

  // ── Normalisation de la ville ──────────────────────────────────────────
  const normalizedCity = normalizeCity(orderData.city) || orderData.city;

  // ── Dédoublonnage ──────────────────────────────────────────────────────
  // On dédoublonne sur orderId si disponible, sinon sur téléphone+produit+date(jour)
  if (orderData.orderNumber) {
    const duplicate = await Order.findOne({
      orderId:     orderData.orderNumber,
      source:      'webhook',
      workspaceId,
    }).lean();

    if (duplicate) {
      console.log(
        `ℹ️ [Webhook Orders] Commande #${orderData.orderNumber} déjà existante — ignorée`
      );
      return null;
    }
  } else {
    // Dédoublonnage soft : même téléphone + même jour (fenêtre 24h)
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    if (orderData.phone) {
      const softDuplicate = await Order.findOne({
        clientPhoneNormalized: orderData.phone.replace(/\D/g, ''),
        source:                'webhook',
        workspaceId,
        createdAt:             { $gte: dayStart },
      }).lean();

      if (softDuplicate) {
        console.log(
          `ℹ️ [Webhook Orders] Doublon probable (même téléphone aujourd'hui) — ignorée`
        );
        return null;
      }
    }
  }

  // ── Création du document ───────────────────────────────────────────────
  const newOrder = await Order.create({
    workspaceId,
    orderId:              orderData.orderNumber,
    date:                 new Date(orderData.createdAt),
    clientName:           orderData.fullName,
    clientPhone:          orderData.phone,
    clientPhoneNormalized: orderData.phone.replace(/\D/g, ''),
    city:                 normalizedCity,
    address:              orderData.address1,
    product:              orderData.product || orderData.productLink,
    quantity:             orderData.productQuantity,
    price:                orderData.totalPrice,
    notes:                orderData.note,
    source:               'webhook',
    rawData: {
      productLink:      orderData.productLink,
      originalPayload:  orderData,
    },
  });

  console.log(
    `✅ [Webhook Orders] Commande enregistrée — #${orderData.orderNumber || newOrder._id} (workspace: ${workspaceId})`
  );

  // ── Notification temps réel ────────────────────────────────────────────
  try {
    await notifyNewOrder(workspaceId, newOrder);
  } catch (notifErr) {
    // Non bloquant : la commande est sauvegardée, la notif peut échouer
    console.warn(`⚠️ [Webhook Orders] Notification échouée: ${notifErr.message}`);
  }

  return newOrder;
}
