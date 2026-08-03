/**
 * Store Sheet Sync — export temps réel des commandes Scalor vers Google Sheets.
 *
 * Méthode : service account Google (Sheets API v4). Le marchand partage sa
 * feuille en Éditeur avec l'email du service account, puis colle l'URL de la
 * feuille dans Boutique → Google Sheets. Chaque nouvelle commande boutique
 * (source skelor/boutique) est ajoutée en fin de feuille.
 *
 * Config env (l'une des deux formes) :
 *  - GOOGLE_SHEETS_SA_KEY_JSON : contenu JSON complet de la clé du service account
 *  - GOOGLE_SHEETS_SA_EMAIL + GOOGLE_SHEETS_SA_PRIVATE_KEY (clé PEM, \n échappés acceptés)
 *
 * Aucune dépendance nouvelle : google-auth-library (déjà présent) fournit le JWT,
 * les appels Sheets passent par fetch natif.
 */

import Store from '../models/Store.js';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const FETCH_TIMEOUT_MS = 15000;

export const SHEET_HEADER = [
  'Date', 'N° commande', 'Client', 'Téléphone', 'Ville',
  'Adresse', 'Produit', 'Quantité', 'Prix unitaire', 'Total', 'Statut', 'Source'
];

// ─── Credentials ────────────────────────────────────────────────────────────

function readSaCredentials() {
  const rawJson = process.env.GOOGLE_SHEETS_SA_KEY_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, key: parsed.private_key };
      }
    } catch (e) {
      console.error('❌ [SheetSync] GOOGLE_SHEETS_SA_KEY_JSON invalide:', e.message);
    }
  }
  const email = process.env.GOOGLE_SHEETS_SA_EMAIL;
  const key = (process.env.GOOGLE_SHEETS_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (email && key) return { email, key };
  return null;
}

export function isSaConfigured() {
  return !!readSaCredentials();
}

export function getSaEmail() {
  return readSaCredentials()?.email || null;
}

// ─── Token (JWT service account, mis en cache par google-auth-library) ──────

let jwtClient = null;

async function getAccessToken() {
  const creds = readSaCredentials();
  if (!creds) {
    const err = new Error('Service account Google non configuré côté serveur (GOOGLE_SHEETS_SA_KEY_JSON ou GOOGLE_SHEETS_SA_EMAIL/GOOGLE_SHEETS_SA_PRIVATE_KEY).');
    err.code = 'SA_NOT_CONFIGURED';
    throw err;
  }
  if (!jwtClient || jwtClient.email !== creds.email) {
    const { JWT } = await import('google-auth-library');
    jwtClient = new JWT({ email: creds.email, key: creds.key, scopes: [SHEETS_SCOPE] });
  }
  const { token } = await jwtClient.getAccessToken();
  if (!token) throw new Error('Impossible d\'obtenir un jeton d\'accès Google');
  return token;
}

// ─── Appels Sheets API ──────────────────────────────────────────────────────

async function sheetsFetch(url, options = {}) {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = body?.error?.message || `Google Sheets API ${res.status}`;
      const err = new Error(translateSheetsError(res.status, message));
      err.status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function translateSheetsError(status, message) {
  if (status === 403) return 'Accès refusé à la feuille. Partagez-la en Éditeur avec le service account.';
  if (status === 404) return 'Feuille introuvable. Vérifiez l\'URL du Google Sheet.';
  if (status === 400 && /Unable to parse range/i.test(message)) return 'Onglet introuvable dans la feuille. Vérifiez le nom de l\'onglet.';
  return message;
}

function rangeFor(sheetName, cells) {
  const tab = sheetName ? `'${String(sheetName).replace(/'/g, "''")}'!` : '';
  return `${tab}${cells}`;
}

async function readRange(spreadsheetId, sheetName, cells) {
  const range = encodeURIComponent(rangeFor(sheetName, cells));
  return sheetsFetch(`${SHEETS_API}/${spreadsheetId}/values/${range}`);
}

async function appendRows(spreadsheetId, sheetName, rows) {
  const range = encodeURIComponent(rangeFor(sheetName, 'A1'));
  return sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: rows }) }
  );
}

// ─── Header (créé une fois si la feuille est vide) ──────────────────────────

const headerEnsured = new Map(); // `${spreadsheetId}::${sheetName}` → timestamp
const HEADER_TTL_MS = 6 * 60 * 60 * 1000;

async function ensureHeader(spreadsheetId, sheetName) {
  const key = `${spreadsheetId}::${sheetName || ''}`;
  const cached = headerEnsured.get(key);
  if (cached && Date.now() - cached < HEADER_TTL_MS) return;
  const data = await readRange(spreadsheetId, sheetName, 'A1:L1');
  const hasHeader = Array.isArray(data?.values) && data.values.length > 0 && data.values[0].some(v => String(v || '').trim());
  if (!hasHeader) {
    await appendRows(spreadsheetId, sheetName, [SHEET_HEADER]);
  }
  headerEnsured.set(key, Date.now());
}

// ─── Mapping commande → ligne ───────────────────────────────────────────────

export function orderToRow(order) {
  const date = order.date || order.createdAt || new Date();
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = isNaN(d.getTime())
    ? ''
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const quantity = Math.max(1, Number(order.quantity) || 1);
  const unitPrice = Number(order.price) || 0;
  return [
    dateStr,
    order.orderId || String(order._id || ''),
    order.clientName || '',
    order.clientPhone ? `'${order.clientPhone}` : '', // apostrophe : force le format texte (garde le +/0 initial)
    order.city || '',
    order.address || '',
    order.product || '',
    quantity,
    unitPrice,
    unitPrice * quantity,
    order.status || 'pending',
    order.sourceName || 'Scalor Store'
  ];
}

// ─── Lecture de la config d'une boutique ────────────────────────────────────

function getSyncConfig(store) {
  const cfg = store?.storeSheetSync;
  if (!cfg || cfg.enabled !== true || !cfg.spreadsheetId) return null;
  return { spreadsheetId: cfg.spreadsheetId, sheetName: cfg.sheetName || '' };
}

async function recordSyncResult(storeId, patch) {
  try {
    await Store.updateOne({ _id: storeId }, { $set: patch });
  } catch { /* non bloquant */ }
}

// ─── API publique du service ────────────────────────────────────────────────

/**
 * Exporte une commande vers la feuille de sa boutique.
 * Fire-and-forget : ne lève jamais, journalise et stocke la dernière erreur.
 */
export async function syncOrderToSheet(order) {
  try {
    if (!order?.storeId) return;
    if (!['skelor', 'boutique'].includes(order.source)) return;
    const store = await Store.findById(order.storeId).select('storeSheetSync').lean();
    const cfg = getSyncConfig(store);
    if (!cfg) return;
    await ensureHeader(cfg.spreadsheetId, cfg.sheetName);
    await appendRows(cfg.spreadsheetId, cfg.sheetName, [orderToRow(order)]);
    await recordSyncResult(order.storeId, {
      'storeSheetSync.lastSyncAt': new Date(),
      'storeSheetSync.lastError': null
    });
    console.log(`✅ [SheetSync] Commande ${order.orderId || order._id} → Sheet ${cfg.spreadsheetId.slice(0, 8)}…`);
  } catch (err) {
    console.error('❌ [SheetSync] Échec export commande:', err.message);
    if (order?.storeId) {
      await recordSyncResult(order.storeId, {
        'storeSheetSync.lastError': err.message,
        'storeSheetSync.lastErrorAt': new Date()
      });
    }
  }
}

/**
 * Teste la connexion : vérifie l'accès, crée le header si besoin et ajoute
 * une ligne de test. Lève une erreur lisible en cas d'échec.
 */
export async function testSheetSync(spreadsheetId, sheetName) {
  await ensureHeader(spreadsheetId, sheetName);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  await appendRows(spreadsheetId, sheetName, [[
    dateStr, 'TEST', 'Ligne de test Scalor', '', '', '', 'Connexion réussie ✓', '', '', '', 'test', 'Scalor'
  ]]);
}
