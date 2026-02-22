/**
 * Google Sheets Import Service
 * Handles all Google Sheets data fetching, parsing, and column detection.
 * Clean ESM module with no side effects.
 */

const GOOGLE_VIZ_BASE = 'https://docs.google.com/spreadsheets/d';
const FETCH_TIMEOUT = 45000;
const MAX_ROWS = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 6000];

// ─── Spreadsheet ID Extraction ──────────────────────────────────────────────

export function extractSpreadsheetId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// ─── Google Sheets Data Fetching ────────────────────────────────────────────

function buildSheetUrl(spreadsheetId, sheetName) {
  let url = `${GOOGLE_VIZ_BASE}/${spreadsheetId}/gviz/tq?tqx=out:json`;
  if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
  return url;
}

function parseGoogleVizResponse(text) {
  const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?$/s);
  if (!jsonStr) throw new Error('Format de réponse Google Sheets invalide');
  const json = JSON.parse(jsonStr[1]);
  if (json.status === 'error') {
    throw new Error(json.errors?.[0]?.message || 'Erreur inconnue du spreadsheet');
  }
  return json.table;
}

/**
 * Validates that a spreadsheet is accessible and returns metadata.
 */
export async function validateSpreadsheet(spreadsheetIdOrUrl, sheetName) {
  const id = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!id) return { valid: false, error: 'ID de spreadsheet invalide' };

  try {
    const url = buildSheetUrl(id, sheetName);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Ecom-Import-Service/2.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { valid: false, error: `Accès refusé (${response.status}). Vérifiez que le sheet est partagé en lecture.` };
    }

    const text = await response.text();
    const table = parseGoogleVizResponse(text);

    if (!table || !table.rows || table.rows.length === 0) {
      return { valid: true, empty: true, id, rowCount: 0, columnCount: 0, headers: [] };
    }

    const headers = extractHeaders(table);

    return {
      valid: true,
      empty: false,
      id,
      rowCount: table.rows.length,
      columnCount: table.cols?.length || 0,
      headers
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { valid: false, error: 'Timeout de connexion au spreadsheet (10s)' };
    }
    return { valid: false, error: `Erreur de connexion: ${err.message}` };
  }
}

/**
 * Internal fetch with retry logic and exponential backoff.
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}: Accès refusé au sheet`);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error(`Timeout de connexion (tentative ${attempt + 1}/${retries})`);
      }
      if (attempt < retries - 1) {
        const delay = RETRY_DELAYS[attempt] || 3000;
        console.log(`⏳ Retry fetch (${attempt + 1}/${retries}) dans ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Fetches raw data from a Google Spreadsheet.
 */
export async function fetchSheetData(spreadsheetIdOrUrl, sheetName) {
  const id = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!id) throw new Error('ID de spreadsheet invalide');

  const url = buildSheetUrl(id, sheetName);

  const response = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'Ecom-Import-Service/2.0' }
  });

  const text = await response.text();
  const table = parseGoogleVizResponse(text);

  if (!table || !table.rows || table.rows.length === 0) {
    return { headers: [], rows: [], dataStartIndex: 0 };
  }

  const headers = extractHeaders(table);
  const dataStartIndex = detectDataStartIndex(table, headers);

  // Limit rows
  const rows = table.rows.length > MAX_ROWS
    ? table.rows.slice(0, MAX_ROWS)
    : table.rows;

  return { headers, rows, cols: table.cols, dataStartIndex, totalRows: table.rows.length };
}

// ─── Header & Column Detection ──────────────────────────────────────────────

function extractHeaders(table) {
  let headers = table.cols.map(col => col.label || '');
  const hasLabels = headers.some(h => h && h.trim());

  if (!hasLabels && table.rows.length > 0) {
    const firstRow = table.rows[0];
    if (firstRow.c) {
      headers = firstRow.c.map(cell =>
        cell ? (cell.f || (cell.v != null ? String(cell.v) : '')) : ''
      );
    }
  }
  return headers;
}

function detectDataStartIndex(table, headers) {
  const colLabelsPresent = table.cols.some(col => col.label && col.label.trim());
  return colLabelsPresent ? 0 : 1;
}

const normalize = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const COLUMN_PATTERNS = [
  { field: 'orderId', compound: ['order id', 'order number', 'numero commande', 'n° commande', 'n commande', 'id commande', 'numero de commande', 'numero', 'n° cmd'], simple: ['ref', 'reference', 'order', 'commande', 'id', 'cmd'] },
  { field: 'date', compound: ['date & time', 'date time', 'date commande', 'date de commande', 'date creation', 'created at', 'order date'], simple: ['date', 'jour', 'day', 'created', 'timestamp'] },
  { field: 'clientPhone', compound: ['phone number', 'numero telephone', 'num tel', 'numero de telephone', 'n° tel', 'n° telephone', 'numero client'], simple: ['tel', 'telephone', 'phone', 'mobile', 'whatsapp', 'gsm', 'portable', 'cellulaire'] },
  { field: 'clientName', compound: ['first name', 'last name', 'full name', 'nom complet', 'nom client', 'customer name', 'nom et prenom', 'nom prenom', 'nom du client'], simple: ['nom', 'name', 'client', 'prenom', 'firstname', 'lastname', 'customer', 'destinataire', 'beneficiaire', 'acheteur'] },
  { field: 'city', compound: ['ville de livraison', 'ville livraison', 'delivery city'], simple: ['ville', 'city', 'commune', 'localite', 'zone', 'region', 'wilaya', 'gouvernorat'] },
  { field: 'product', compound: ['product name', 'nom produit', 'nom article', 'nom du produit', 'libelle produit', 'product title'], simple: ['produit', 'product', 'article', 'item', 'designation', 'libelle', 'offre', 'offer', 'pack'] },
  { field: 'price', compound: ['product price', 'prix produit', 'prix unitaire', 'unit price', 'selling price', 'prix de vente', 'prix total', 'total price', 'prix ttc', 'prix ht'], simple: ['prix', 'price', 'montant', 'amount', 'total', 'cout', 'cost', 'tarif', 'valeur', 'revenue', 'ca'] },
  { field: 'quantity', compound: [], simple: ['quantite', 'quantity', 'qte', 'qty', 'nb', 'nombre', 'pieces', 'unites'] },
  { field: 'status', compound: ['order status', 'statut commande', 'statut de livraison', 'delivery status', 'etat commande'], simple: ['statut', 'status', 'etat', 'state', 'livraison', 'delivery', 'situation'] },
  { field: 'notes', compound: [], simple: ['notes', 'note', 'commentaire', 'comment', 'remarque', 'observation', 'description', 'details', 'info'] },
  { field: 'address', compound: ['address 1', 'adresse 1', 'adresse de livraison', 'delivery address', 'adresse complete'], simple: ['adresse', 'address', 'rue', 'street'] },
];

/**
 * Auto-detects column mapping from headers.
 * Returns { field: columnIndex } mapping.
 */
export function autoDetectColumns(headers) {
  const mapping = {};

  // Pass 1: compound (more specific) matches
  headers.forEach((header, index) => {
    const h = normalize(header);
    for (const p of COLUMN_PATTERNS) {
      if (!mapping[p.field] && p.compound.some(c => h.includes(c))) {
        mapping[p.field] = index;
      }
    }
  });

  // Pass 2: simple matches (only if field not already mapped AND index not already used)
  const usedIndices = new Set(Object.values(mapping));
  headers.forEach((header, index) => {
    if (usedIndices.has(index)) return;
    const h = normalize(header);
    for (const p of COLUMN_PATTERNS) {
      if (!mapping[p.field] && p.simple.some(k => h.includes(k))) {
        mapping[p.field] = index;
        usedIndices.add(index);
        break;
      }
    }
  });

  return mapping;
}

/**
 * Validates that critical columns are present.
 * Returns { valid, missing, warnings }.
 */
export function validateColumnMapping(mapping) {
  const identifiers = ['clientName', 'clientPhone'];
  const recommended = ['product', 'price', 'city'];
  const missingIdentifiers = identifiers.filter(f => mapping[f] === undefined);
  const warnings = recommended.filter(f => mapping[f] === undefined);

  // Valid if at least one identifier (name or phone) is detected
  const valid = missingIdentifiers.length < identifiers.length;
  if (missingIdentifiers.length > 0) {
    warnings.unshift(...missingIdentifiers);
  }

  return {
    valid,
    missing: valid ? [] : missingIdentifiers,
    warnings,
    detectedFields: Object.keys(mapping)
  };
}

// ─── Row Parsing ────────────────────────────────────────────────────────────

const STATUS_MAP = {
  'en attente': 'pending', 'pending': 'pending', 'nouveau': 'pending', 'new': 'pending',
  'en cours': 'pending', 'processing': 'pending', 'a traiter': 'pending', 'non traite': 'pending',
  'pas encore': 'pending', 'no answer': 'pending', 'sans reponse': 'pending',
  'confirme': 'confirmed', 'confirmed': 'confirmed', 'valide': 'confirmed', 'accepted': 'confirmed',
  'a confirmer': 'pending', 'en confirmation': 'pending',
  'expedie': 'shipped', 'shipped': 'shipped', 'envoye': 'shipped', 'dispatched': 'shipped',
  'en livraison': 'shipped', 'in transit': 'shipped', 'en transit': 'shipped', 'en route': 'shipped',
  'pret': 'shipped', 'ready': 'shipped', 'ramasse': 'shipped', 'picked up': 'shipped',
  'livre': 'delivered', 'delivered': 'delivered', 'recu': 'delivered', 'received': 'delivered',
  'paye': 'delivered', 'paid': 'delivered', 'encaisse': 'delivered',
  'retour': 'returned', 'returned': 'returned', 'retourne': 'returned', 'return': 'returned',
  'refuse': 'returned', 'refused': 'returned', 'echec': 'returned', 'failed': 'returned',
  'injoignable': 'returned', 'unreachable': 'returned', 'no show': 'returned',
  'annule': 'cancelled', 'cancelled': 'cancelled', 'canceled': 'cancelled', 'cancel': 'cancelled',
  'supprime': 'cancelled', 'deleted': 'cancelled', 'abandonne': 'cancelled',
  'doublon': 'cancelled', 'duplicate': 'cancelled', 'faux numero': 'cancelled'
};

function cleanNumericString(val) {
  if (!val) return '0';
  const s = String(val).trim();
  let cleaned = s.replace(/[^0-9,\.\-]/g, '').trim();
  if (!cleaned) return '0';
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma !== -1) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastComma !== -1 && lastDot === -1) {
    const afterComma = cleaned.split(',')[1];
    if (afterComma && afterComma.length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  return cleaned || '0';
}

function cleanPhone(val) {
  if (!val) return '';
  let phone = String(val).trim();
  phone = phone.replace(/[\s\-\.\(\)]/g, '');
  phone = phone.replace(/^(tel:|phone:|whatsapp:|wa:)/i, '');
  return phone;
}

function parseFlexDate(dateVal) {
  if (!dateVal) return new Date();
  const strVal = String(dateVal).trim();
  if (!strVal) return new Date();
  const d = new Date(strVal);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1970) return d;
  const parts = strVal.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (day <= 31 && month <= 12) {
      const parsed = new Date(year < 100 ? 2000 + year : year, month - 1, day);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return new Date();
}

/**
 * Parses a single row into an order document.
 * Returns { success, data, error }.
 */
export function parseOrderRow(row, rowIndex, columnMap, headers, sourceName) {
  try {
    if (!row.c || row.c.every(cell => !cell || !cell.v)) {
      return { success: false, error: 'Ligne vide', row: rowIndex };
    }

    const getVal = (field) => {
      const idx = columnMap[field];
      if (idx === undefined || !row.c[idx]) return '';
      const cell = row.c[idx];
      return cell.f || (cell.v != null ? String(cell.v) : '');
    };

    const getNumVal = (field) => {
      const idx = columnMap[field];
      if (idx === undefined || !row.c[idx]) return 0;
      const cell = row.c[idx];
      const raw = cell.f || (cell.v != null ? String(cell.v) : '0');
      return parseFloat(cleanNumericString(raw)) || 0;
    };

    const getDateVal = (field) => {
      const idx = columnMap[field];
      if (idx === undefined || !row.c[idx]) return new Date();
      const cell = row.c[idx];
      if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
        const parts = cell.v.match(/Date\((\d+),(\d+),(\d+)/);
        if (parts) return new Date(parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3]));
      }
      return parseFlexDate(cell.f || cell.v);
    };

    // Build rawData from all columns
    const rawData = {};
    headers.forEach((header, idx) => {
      if (header && row.c[idx]) {
        const cell = row.c[idx];
        rawData[header] = cell.f || (cell.v != null ? String(cell.v) : '');
      }
    });

    const statusRaw = normalize(getVal('status'));
    const mappedStatus = STATUS_MAP[statusRaw] || 'pending';

    const clientPhone = cleanPhone(getVal('clientPhone'));
    const clientName = getVal('clientName').trim();

    // Lenient validation: accept if at least one identifier is present
    if (!clientName && !clientPhone) {
      // Try to salvage: check if any non-empty cell exists in the row
      const hasAnyData = headers.some((h, idx) => {
        if (!row.c[idx]) return false;
        const v = row.c[idx].v;
        return v != null && String(v).trim() !== '';
      });
      if (!hasAnyData) {
        return { success: false, error: 'Ligne vide', row: rowIndex };
      }
      // Row has data but no name/phone — still import with placeholder
    }

    const data = {
      orderId: getVal('orderId') || `#${sourceName}_${rowIndex + 1}`,
      date: getDateVal('date'),
      clientName,
      clientPhone,
      city: getVal('city'),
      product: getVal('product'),
      quantity: Math.max(1, parseInt(getNumVal('quantity')) || 1),
      price: Math.max(0, getNumVal('price')),
      status: mappedStatus,
      tags: [sourceName],
      notes: getVal('notes'),
      address: getVal('address'),
      rawData
    };

    return { success: true, data, row: rowIndex };
  } catch (err) {
    return {
      success: false,
      error: `Erreur de parsing: ${err.message}`,
      row: rowIndex
    };
  }
}

/**
 * Generates a preview of the first N rows from fetched sheet data.
 */
export function generatePreview(sheetData, maxRows = 5) {
  const { headers, rows, cols, dataStartIndex } = sheetData;
  const columnMapping = autoDetectColumns(headers);
  const validation = validateColumnMapping(columnMapping);

  const previewRows = [];
  const limit = Math.min(maxRows, rows.length - dataStartIndex);

  for (let i = dataStartIndex; i < dataStartIndex + limit; i++) {
    const row = rows[i];
    if (!row?.c) continue;
    const rowData = {};
    headers.forEach((header, idx) => {
      if (header && row.c[idx]) {
        const cell = row.c[idx];
        rowData[header] = cell.f || (cell.v != null ? String(cell.v) : '');
      }
    });
    previewRows.push(rowData);
  }

  return {
    headers: headers.filter(h => h),
    columnMapping,
    validation,
    preview: previewRows,
    totalRows: rows.length - dataStartIndex,
    dataStartIndex
  };
}
