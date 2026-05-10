/**
 * Cloudflare Custom Hostnames Service
 *
 * Gère les domaines personnalisés clients via l'API Cloudflare Custom Hostnames.
 * Flux : client soumet son domaine → on crée le custom hostname CF avec ssl.method:"http"
 * → CF valide automatiquement dès que le CNAME est en place → SSL actif.
 *
 * Variables d'environnement requises :
 *   CF_ZONE_ID          — Zone ID Cloudflare de scalor.net
 *   CF_API_TOKEN        — API Token avec permission "Zone > SSL and Certificates > Edit"
 *   CF_FALLBACK_ORIGIN  — hostname de l'origin fallback (ex: custom-origin.scalor.net)
 *                         Doit être configuré UNE FOIS dans CF SSL/TLS > Custom Hostnames
 */

import axios from 'axios';

const CF_API = 'https://api.cloudflare.com/client/v4';

function cfHeaders() {
  const token = process.env.CF_API_TOKEN;
  if (!token) throw new Error('CF_API_TOKEN non configuré');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function zoneId() {
  const id = process.env.CF_ZONE_ID;
  if (!id) throw new Error('CF_ZONE_ID non configuré');
  return id;
}

/**
 * Crée un custom hostname Cloudflare avec validation HTTP automatique.
 * @param {string} hostname  — domaine du client (ex: "shop.client.com")
 * @param {string} userId    — metadata optionnelle pour retrouver le workspace
 * @returns {{ id, hostname, sslStatus }}
 */
export async function createCustomHostname(hostname, userId = '') {
  const body = {
    hostname,
    ssl: {
      method: 'http',
      type: 'dv',
      wildcard: false,
    },
    ...(userId && { custom_metadata: { user_id: userId } }),
  };

  const res = await axios.post(
    `${CF_API}/zones/${zoneId()}/custom_hostnames`,
    body,
    { headers: cfHeaders(), timeout: 15000 }
  );

  if (!res.data?.success) {
    const errors = res.data?.errors?.map(e => e.message).join(', ') || 'Erreur Cloudflare';
    throw new Error(errors);
  }

  const r = res.data.result;
  return {
    id: r.id,
    hostname: r.hostname,
    sslStatus: r.ssl?.status ?? 'pending_validation',
    ownershipStatus: r.status ?? 'pending',
  };
}

/**
 * Récupère le statut d'un custom hostname par son ID Cloudflare.
 * @param {string} hostnameId — CF custom hostname ID
 * @returns {{ id, hostname, sslStatus, ownershipStatus }}
 */
export async function getCustomHostnameStatus(hostnameId) {
  const res = await axios.get(
    `${CF_API}/zones/${zoneId()}/custom_hostnames/${hostnameId}`,
    { headers: cfHeaders(), timeout: 10000 }
  );

  if (!res.data?.success) {
    const errors = res.data?.errors?.map(e => e.message).join(', ') || 'Erreur Cloudflare';
    throw new Error(errors);
  }

  const r = res.data.result;
  return {
    id: r.id,
    hostname: r.hostname,
    sslStatus: r.ssl?.status ?? 'pending_validation',
    ownershipStatus: r.status ?? 'pending',
    // "active" quand ssl.status === "active" ET status === "active"
    isActive: r.ssl?.status === 'active' && r.status === 'active',
  };
}

/**
 * Cherche un custom hostname CF par son nom (pour la récupération en cas de perte d'ID).
 * @param {string} hostname
 * @returns {{ id, hostname, sslStatus, ownershipStatus } | null}
 */
export async function findCustomHostnameByName(hostname) {
  const res = await axios.get(
    `${CF_API}/zones/${zoneId()}/custom_hostnames`,
    {
      params: { hostname },
      headers: cfHeaders(),
      timeout: 10000,
    }
  );

  if (!res.data?.success) return null;

  const match = (res.data.result || []).find(r => r.hostname === hostname);
  if (!match) return null;

  return {
    id: match.id,
    hostname: match.hostname,
    sslStatus: match.ssl?.status ?? 'pending_validation',
    ownershipStatus: match.status ?? 'pending',
    isActive: match.ssl?.status === 'active' && match.status === 'active',
  };
}

/**
 * Supprime un custom hostname CF (ex: quand le client déconnecte son domaine).
 * @param {string} hostnameId
 */
export async function deleteCustomHostname(hostnameId) {
  if (!hostnameId) return;
  try {
    await axios.delete(
      `${CF_API}/zones/${zoneId()}/custom_hostnames/${hostnameId}`,
      { headers: cfHeaders(), timeout: 10000 }
    );
  } catch (err) {
    // 404 = déjà supprimé → on ignore silencieusement
    if (err.response?.status !== 404) throw err;
  }
}

/**
 * Retourne true si CF_API_TOKEN et CF_ZONE_ID sont définis.
 */
export function isCfConfigured() {
  return !!(process.env.CF_API_TOKEN && process.env.CF_ZONE_ID);
}
