/**
 * KPay — passerelle de paiement Mobile Money (https://kpay.site).
 *
 * Intégration par marchand : chaque boutique renseigne SES clés KPay
 * (storePayments.kpay = { enabled, kpayApiKey, kpaySecretKey, kpayWebhookSecret? }).
 * L'argent va directement sur le compte KPay du marchand.
 *
 * Mode utilisé : GATEWAY (page de paiement hébergée par KPay) — même schéma
 * que Scalor Pay/MoneyFusion : init → redirect gatewayUrl → webhook.
 *
 * Sandbox/production : déterminé par le préfixe des clés du marchand
 * (kpay_test_/sk_test_ vs kpay_live_/sk_live_) — même URL d'API.
 */

import crypto from 'crypto';

const KPAY_BASE_URL = process.env.KPAY_BASE_URL || 'https://admin.kpay.site';
const FETCH_TIMEOUT_MS = 20000;

function kpayHeaders(cfg) {
  return {
    'X-API-Key': cfg.kpayApiKey,
    'X-Secret-Key': cfg.kpaySecretKey,
    'Content-Type': 'application/json'
  };
}

async function kpayFetch(path, cfg, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${KPAY_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { ...kpayHeaders(cfg), ...(options.headers || {}) }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body?.message || `KPay API ${res.status}`);
      err.status = res.status;
      err.kpayBody = body;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Config marchande valide ? (clés présentes + activé) */
export function isKpayConfigValid(cfg) {
  return !!(cfg && cfg.enabled === true && cfg.kpayApiKey && cfg.kpaySecretKey);
}

/**
 * Initie un paiement en mode GATEWAY (page hébergée KPay).
 * Retourne { id, reference, gatewayUrl, expiresAt, isTest }.
 */
export async function initKpayGatewayPayment(cfg, { amount, externalId, description, returnUrl, cancelUrl, metadata }) {
  const payload = {
    amount: Math.round(Number(amount) || 0),
    externalId: String(externalId),
    returnUrl,
    ...(cancelUrl ? { cancelUrl } : {}),
    ...(description ? { description } : {}),
    ...(metadata ? { metadata } : {})
  };
  const data = await kpayFetch('/api/v1/payments/init', cfg, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!data?.gatewayUrl) {
    const err = new Error('Réponse KPay sans gatewayUrl');
    err.kpayBody = data;
    throw err;
  }
  return data;
}

/** Statut d'un paiement (source de vérité avant de marquer payé). */
export async function getKpayPayment(cfg, paymentId) {
  return kpayFetch(`/api/v1/payments/${encodeURIComponent(paymentId)}`, cfg, { method: 'GET' });
}

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook KPay (sur le corps BRUT).
 * Retourne true si valide. Si aucun secret n'est configuré côté marchand,
 * retourne null (indéterminé) — l'appelant DOIT alors confirmer via getKpayPayment.
 */
export function verifyKpayWebhookSignature(rawBody, signature, webhookSecret) {
  if (!webhookSecret) return null;
  if (!signature || !rawBody) return false;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  const sigBuf = Buffer.from(String(signature));
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Config KPay PLATEFORME (abonnements + crédits) — définie dans le Super Admin.
 * Retourne une config au format attendu par init/get, ou null si KPay n'est
 * pas le provider actif ou si les clés sont absentes.
 */
export async function getPlatformKpayConfig() {
  const { default: PlatformPaymentConfig } = await import('../models/PlatformPaymentConfig.js');
  const doc = await PlatformPaymentConfig.getSingleton();
  if (doc.billingProvider !== 'kpay') return null;
  const cfg = {
    enabled: true,
    kpayApiKey: doc.kpay?.apiKey || '',
    kpaySecretKey: doc.kpay?.secretKey || '',
    kpayWebhookSecret: doc.kpay?.webhookSecret || ''
  };
  return isKpayConfigValid(cfg) ? cfg : null;
}

/**
 * Variante par payeur : renvoie null (→ repli MoneyFusion) si l'indicatif du
 * numéro figure dans kpayFallbackPrefixes (pays non couverts par KPay, ex. Togo).
 */
export async function getPlatformKpayConfigForPhone(phone) {
  const { default: PlatformPaymentConfig } = await import('../models/PlatformPaymentConfig.js');
  const doc = await PlatformPaymentConfig.getSingleton();
  if (doc.billingProvider !== 'kpay') return null;

  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  const prefixes = (doc.kpayFallbackPrefixes || [])
    .map(p => String(p).replace(/\D/g, ''))
    .filter(Boolean);
  if (digits && prefixes.some(p => digits.startsWith(p))) {
    return null; // pays exclu de KPay → MoneyFusion
  }

  const cfg = {
    enabled: true,
    kpayApiKey: doc.kpay?.apiKey || '',
    kpaySecretKey: doc.kpay?.secretKey || '',
    kpayWebhookSecret: doc.kpay?.webhookSecret || ''
  };
  return isKpayConfigValid(cfg) ? cfg : null;
}

/**
 * Résout la config KPay d'une commande boutique : Store.storePayments.kpay
 * en priorité, sinon Workspace.storePayments.kpay (legacy mono-boutique).
 */
export async function resolveKpayConfigForOrder(order) {
  const { default: Store } = await import('../models/Store.js');
  if (order.storeId) {
    const store = await Store.findById(order.storeId).select('storePayments').lean();
    const cfg = store?.storePayments?.kpay;
    if (isKpayConfigValid(cfg)) return cfg;
  }
  const { default: Workspace } = await import('../models/Workspace.js');
  const ws = await Workspace.findById(order.workspaceId).select('storePayments').lean();
  const cfg = ws?.storePayments?.kpay;
  return isKpayConfigValid(cfg) ? cfg : null;
}
