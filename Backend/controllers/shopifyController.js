import axios from 'axios';
import crypto from 'crypto';
import ShopifyStore from '../models/ShopifyStore.js';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI || 'https://api.scalor.net/api/ecom/shopify/callback';
const SHOPIFY_SCOPES = 'read_orders,read_products,read_customers';
const SHOPIFY_API_VERSION = '2024-01';

// Frontend URL pour redirection post-OAuth
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://scalor.net';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Valide le format du domaine Shopify
 * Accepte: mystore.myshopify.com
 */
function isValidShopDomain(shop) {
  if (!shop || typeof shop !== 'string') return false;
  const cleaned = shop.trim().toLowerCase();
  // Doit être un sous-domaine .myshopify.com valide
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleaned);
}

/**
 * Génère un nonce aléatoire pour la protection CSRF
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Vérifie le HMAC de Shopify pour valider l'authenticité du callback
 */
function verifyShopifyHmac(query) {
  if (!SHOPIFY_API_SECRET) return false;
  const { hmac, ...params } = query;
  if (!hmac) return false;

  // Trier les paramètres par clé et construire la chaîne de requête
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hmac, 'hex'),
    Buffer.from(generatedHmac, 'hex')
  );
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /shopify/connect
 * Initie le flux OAuth Shopify
 * Query params: shop (ex: mystore.myshopify.com)
 */
export const connect = (req, res) => {
  try {
    const { shop } = req.query;

    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      console.error('❌ [Shopify] Variables SHOPIFY_API_KEY / SHOPIFY_API_SECRET manquantes');
      return res.status(500).json({
        success: false,
        message: 'Configuration Shopify manquante côté serveur. Contactez l\'administrateur.'
      });
    }

    if (!isValidShopDomain(shop)) {
      return res.status(400).json({
        success: false,
        message: 'Domaine Shopify invalide. Format attendu : votre-boutique.myshopify.com'
      });
    }

    const cleanShop = shop.trim().toLowerCase();
    const nonce = generateNonce();

    // Stocker le nonce en session/cookie pour vérification au callback
    res.cookie('shopify_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    // Stocker aussi le userId et workspaceId pour le callback
    const userId = req.user?.id || req.query.userId;
    const workspaceId = req.query.workspaceId || req.workspaceId;
    
    if (userId) {
      res.cookie('shopify_user_id', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000
      });
    }
    if (workspaceId) {
      res.cookie('shopify_workspace_id', workspaceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000
      });
    }

    const authUrl = `https://${cleanShop}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_API_KEY}` +
      `&scope=${SHOPIFY_SCOPES}` +
      `&redirect_uri=${encodeURIComponent(SHOPIFY_REDIRECT_URI)}` +
      `&state=${nonce}`;

    console.log(`🔗 [Shopify] Redirection OAuth vers ${cleanShop} pour user ${userId}`);
    res.redirect(authUrl);
  } catch (err) {
    console.error('❌ [Shopify] Erreur connect:', err.message);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'initialisation OAuth Shopify' });
  }
};

/**
 * GET /shopify/callback
 * Callback OAuth Shopify — échange le code contre un access_token
 */
export const callback = async (req, res) => {
  try {
    const { shop, code, state, hmac } = req.query;

    // Vérifier les paramètres requis
    if (!shop || !code) {
      console.error('❌ [Shopify] Callback sans shop ou code');
      return res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?error=missing_params`);
    }

    if (!isValidShopDomain(shop)) {
      console.error('❌ [Shopify] Domaine invalide au callback:', shop);
      return res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?error=invalid_shop`);
    }

    // Vérifier le nonce (protection CSRF)
    const savedNonce = req.cookies?.shopify_nonce;
    if (!state || state !== savedNonce) {
      console.error('❌ [Shopify] Nonce invalide:', { state, savedNonce });
      return res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?error=invalid_state`);
    }

    // Vérifier le HMAC si présent
    if (hmac && !verifyShopifyHmac(req.query)) {
      console.error('❌ [Shopify] HMAC invalide');
      return res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?error=invalid_hmac`);
    }

    // Récupérer userId et workspaceId depuis les cookies
    const userId = req.cookies?.shopify_user_id;
    const workspaceId = req.cookies?.shopify_workspace_id;

    if (!userId || !workspaceId) {
      console.error('❌ [Shopify] userId ou workspaceId manquant dans le callback');
      return res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?error=session_expired`);
    }

    // Échanger le code contre un access_token
    console.log(`🔄 [Shopify] Échange du code pour ${shop}...`);
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code
    });

    const { access_token, scope } = tokenResponse.data;

    if (!access_token) {
      console.error('❌ [Shopify] Pas d\'access_token dans la réponse');
      return res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?error=no_token`);
    }

    // Récupérer les infos de la boutique
    let shopMetadata = {};
    try {
      const shopInfoRes = await axios.get(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': access_token }
      });
      const shopInfo = shopInfoRes.data.shop;
      shopMetadata = {
        shopName: shopInfo.name,
        email: shopInfo.email,
        domain: shopInfo.domain,
        currency: shopInfo.currency,
        timezone: shopInfo.iana_timezone
      };
    } catch (metaErr) {
      console.warn('⚠️ [Shopify] Impossible de récupérer les infos boutique:', metaErr.message);
    }

    // Sauvegarder ou mettre à jour en base
    const store = await ShopifyStore.findOneAndUpdate(
      { workspaceId, shop: shop.toLowerCase() },
      {
        userId,
        workspaceId,
        platform: 'shopify',
        shop: shop.toLowerCase(),
        accessToken: access_token,
        scope: scope || SHOPIFY_SCOPES,
        isActive: true,
        syncError: null,
        metadata: shopMetadata
      },
      { upsert: true, new: true }
    );

    console.log(`✅ [Shopify] Boutique ${shop} connectée pour workspace ${workspaceId} (store ID: ${store._id})`);

    // Nettoyer les cookies temporaires
    res.clearCookie('shopify_nonce');
    res.clearCookie('shopify_user_id');
    res.clearCookie('shopify_workspace_id');

    // Rediriger vers le frontend avec succès
    res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?success=true&shop=${encodeURIComponent(shop)}`);
  } catch (err) {
    console.error('❌ [Shopify] Erreur callback:', err.response?.data || err.message);
    res.redirect(`${FRONTEND_URL}/ecom/integrations/shopify?error=oauth_failed`);
  }
};

/**
 * GET /shopify/stores
 * Liste les boutiques Shopify connectées pour le workspace courant
 */
export const getStores = async (req, res) => {
  try {
    const stores = await ShopifyStore.find({
      workspaceId: req.workspaceId,
      isActive: true
    }).select('-accessToken').sort({ createdAt: -1 });

    res.json({ success: true, data: stores });
  } catch (err) {
    console.error('❌ [Shopify] Erreur getStores:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * DELETE /shopify/stores/:id
 * Déconnecte une boutique Shopify
 */
export const disconnectStore = async (req, res) => {
  try {
    const store = await ShopifyStore.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { isActive: false },
      { new: true }
    );

    if (!store) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable' });
    }

    console.log(`🔌 [Shopify] Boutique ${store.shop} déconnectée`);
    res.json({ success: true, message: 'Boutique Shopify déconnectée' });
  } catch (err) {
    console.error('❌ [Shopify] Erreur disconnectStore:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * POST /shopify/stores/:id/sync
 * Synchronise les commandes Shopify
 */
export const syncOrders = async (req, res) => {
  try {
    const store = await ShopifyStore.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
      isActive: true
    });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable ou inactive' });
    }

    if (store.syncStatus === 'syncing') {
      return res.status(400).json({ success: false, message: 'Synchronisation déjà en cours' });
    }

    // Marquer comme en cours de sync
    store.syncStatus = 'syncing';
    store.syncError = null;
    await store.save();

    // Récupérer les commandes
    const orders = await fetchShopifyOrders(store.shop, store.accessToken);

    // Mettre à jour le statut
    store.syncStatus = 'idle';
    store.lastSyncAt = new Date();
    await store.save();

    console.log(`📦 [Shopify] ${orders.length} commandes synchronisées pour ${store.shop}`);

    res.json({
      success: true,
      message: `${orders.length} commande(s) récupérée(s)`,
      data: { orders, count: orders.length }
    });
  } catch (err) {
    console.error('❌ [Shopify] Erreur syncOrders:', err.message);

    // Mettre à jour le statut d'erreur
    try {
      await ShopifyStore.findByIdAndUpdate(req.params.id, {
        syncStatus: 'error',
        syncError: err.message
      });
    } catch (_) {}

    res.status(500).json({ success: false, message: 'Erreur lors de la synchronisation' });
  }
};

// ─── Shopify API Helpers ──────────────────────────────────────────────────────

/**
 * Récupère les commandes Shopify avec pagination
 */
export async function fetchShopifyOrders(shop, accessToken, params = {}) {
  const allOrders = [];
  let url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`;
  
  const queryParams = {
    limit: 250,
    status: 'any',
    ...params
  };

  try {
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await axios.get(url, {
        headers: { 'X-Shopify-Access-Token': accessToken },
        params: queryParams
      });

      const orders = response.data.orders || [];
      allOrders.push(...orders);

      // Vérifier la pagination via Link header
      const linkHeader = response.headers.link || response.headers.Link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          url = nextMatch[1];
          // Supprimer queryParams pour les pages suivantes (URL complète dans le Link header)
          Object.keys(queryParams).forEach(k => delete queryParams[k]);
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }

      // Safety: max 10 pages (2500 commandes)
      if (allOrders.length >= 2500) {
        console.warn(`⚠️ [Shopify] Limite de 2500 commandes atteinte pour ${shop}`);
        break;
      }
    }

    return allOrders;
  } catch (err) {
    console.error(`❌ [Shopify] Erreur fetchOrders pour ${shop}:`, err.response?.data || err.message);
    throw new Error(err.response?.data?.errors || err.message);
  }
}

/**
 * Récupère les produits Shopify
 */
export async function fetchShopifyProducts(shop, accessToken) {
  try {
    const response = await axios.get(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken },
        params: { limit: 250 }
      }
    );
    return response.data.products || [];
  } catch (err) {
    console.error(`❌ [Shopify] Erreur fetchProducts pour ${shop}:`, err.response?.data || err.message);
    throw new Error(err.response?.data?.errors || err.message);
  }
}

// ─── Webhook verification (préparation future) ───────────────────────────────

/**
 * Vérifie le HMAC d'un webhook Shopify entrant
 */
export function verifyWebhookHmac(rawBody, hmacHeader) {
  if (!SHOPIFY_API_SECRET || !hmacHeader) return false;

  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(generatedHmac)
  );
}
