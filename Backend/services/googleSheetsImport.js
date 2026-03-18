/**
 * Google Sheets Import Service
 * Handles all Google Sheets data fetching, parsing, and column detection.
 * Clean ESM module with no side effects.
 */

import { normalizeCity } from '../utils/cityNormalizer.js';
import { normalizePhone } from '../utils/phoneUtils.js';

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
  
  console.log('🔍 [IMPORT] Column labels from API:', headers);

  if (!hasLabels && table.rows.length > 0) {
    const firstRow = table.rows[0];
    if (firstRow.c) {
      headers = firstRow.c.map(cell => {
        if (!cell) return '';
        // Try formatted value first, then raw value
        if (cell.f !== undefined && cell.f !== null) return String(cell.f);
        if (cell.v !== undefined && cell.v !== null) return String(cell.v);
        return '';
      });
    }
    console.log('🔍 [IMPORT] Headers from first row:', headers);
  }
  return headers;
}

function detectDataStartIndex(table, headers) {
  const colLabelsPresent = table.cols.some(col => col.label && col.label.trim());
  return colLabelsPresent ? 0 : 1;
}

const normalize = (s) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')  // Remove special chars except spaces
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim();

const COLUMN_PATTERNS = [
  { field: 'orderId', compound: ['order id', 'order number', 'numero commande', 'n commande', 'id commande', 'numero de commande', 'n cmd', 'ref commande', 'reference commande', 'numero'], simple: ['ref', 'reference', 'order', 'commande', 'id', 'cmd'] },
  { field: 'date', compound: ['date time', 'date commande', 'date de commande', 'date creation', 'created at', 'order date', 'date de creation'], simple: ['date', 'jour', 'day', 'created', 'timestamp', 'horodateur'] },
  { field: 'clientPhone', compound: ['phone number', 'numero telephone', 'num tel', 'numero de telephone', 'n tel', 'n telephone', 'numero client', 'contact telephone', 'telephone contact', 'tel client', 'telephone client', 'whatsapp number'], simple: ['tel', 'telephone', 'phone', 'mobile', 'whatsapp', 'gsm', 'portable', 'cellulaire', 'contact', 'numero'] },
  { field: 'clientName', compound: ['first name', 'last name', 'full name', 'nom complet', 'nom client', 'customer name', 'nom et prenom', 'nom prenom', 'nom du client', 'prenom nom', 'prenom et nom', 'nom beneficiaire', 'nom destinataire', 'nom acheteur'], simple: ['nom', 'name', 'client', 'prenom', 'firstname', 'lastname', 'customer', 'destinataire', 'beneficiaire', 'acheteur'] },
  { field: 'city', compound: ['ville de livraison', 'ville livraison', 'delivery city', 'zone de livraison', 'region livraison'], simple: ['ville', 'city', 'commune', 'localite', 'zone', 'region', 'wilaya', 'gouvernorat', 'quartier', 'secteur'] },
  { field: 'product', compound: ['product name', 'nom produit', 'nom article', 'nom du produit', 'libelle produit', 'product title', 'produit commande', 'article commande'], simple: ['produit', 'product', 'article', 'item', 'designation', 'libelle', 'offre', 'offer', 'pack'] },
  { field: 'price', compound: ['product price', 'prix produit', 'prix unitaire', 'unit price', 'selling price', 'prix de vente', 'total price', 'prix total', 'prix ttc', 'prix ht', 'montant total', 'montant ttc', 'total a payer', 'cout total', 'productprice'], simple: ['prix', 'price', 'montant', 'amount', 'total', 'cout', 'cost', 'tarif', 'valeur', 'somme', 'pv', 'cash'] },
  { field: 'quantity', compound: [], simple: ['quantite', 'quantity', 'qte', 'qty', 'nb', 'nombre', 'pieces', 'unites'] },
  { field: 'status', compound: ['order status', 'statut commande', 'statut de livraison', 'delivery status', 'etat commande', 'etat de la commande', 'statut de la commande'], simple: ['statut', 'status', 'etat', 'state', 'livraison', 'delivery', 'situation'] },
  { field: 'notes', compound: [], simple: ['notes', 'note', 'commentaire', 'comment', 'remarque', 'observation', 'description', 'details', 'info'] },
  { field: 'address', compound: ['address 1', 'adresse 1', 'adresse de livraison', 'delivery address', 'adresse complete', 'adresse client'], simple: ['adresse', 'address', 'rue', 'street'] },
];

/**
 * Detects column types by analyzing content of first few rows.
 * Returns { field: columnIndex } mapping based on content patterns.
 */
function detectColumnsByContent(rows, headers) {
  const mapping = {};
  if (!rows || rows.length === 0) return mapping;

  const sampleSize = Math.min(5, rows.length);
  const columnScores = {}; // { colIndex: { field: score } }

  // Initialize scores for each column
  headers.forEach((_, idx) => {
    columnScores[idx] = {
      price: 0,
      quantity: 0,
      clientPhone: 0,
      orderId: 0,
      date: 0,
      city: 0,
      clientName: 0
    };
  });

  // Analyze first few rows
  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i];
    if (!row.c) continue;

    row.c.forEach((cell, idx) => {
      if (!cell || cell.v == null) return;
      let val = String(cell.v).trim();
      if (!val || val === 'null' || val === 'undefined') return;

      // Remove apostrophe for analysis
      val = val.replace(/^'+/, '');

      // Check for phone numbers (starts with + or has 9+ digits)
      const digitsOnly = val.replace(/\D/g, '');
      if (val.startsWith('+') && digitsOnly.length >= 9) {
        columnScores[idx].clientPhone += 2;
      } else if (digitsOnly.length >= 9 && digitsOnly.length <= 15 && /^[\d\s\-\+\.\(\)]*$/.test(val)) {
        columnScores[idx].clientPhone += 1;
      }

      // Check for prices (numbers with currency symbols or in typical price range)
      const hasCurrency = /fcfa|cfa|xof|xaf|dh|mad|da|dzd|dt|tnd|gnf|eur|usd|\$|€/i.test(val);
      const numVal = parseFloat(cleanNumericString(val));
      if (!isNaN(numVal) && numVal > 0 && numVal <= 10000000) {
        if (hasCurrency) {
          columnScores[idx].price += 3;
        } else if (numVal >= 100 && (val.includes(',') || val.includes(' ') || val.includes('.'))) {
          columnScores[idx].price += 2;
        } else if (numVal >= 500) {
          columnScores[idx].price += 1;
        }
      }

      // Check for quantities (small integers 1-100)
      const intVal = parseInt(val);
      if (!isNaN(intVal) && intVal >= 1 && intVal <= 100 && !val.includes(',') && !val.includes('.')) {
        columnScores[idx].quantity += 1;
      }

      // Check for order IDs (numbers 1000-99999 or # prefix)
      if (/^#?\d{3,6}$/.test(val.replace(/\s/g, ''))) {
        columnScores[idx].orderId += 1;
      }

      // Check for dates (contains / or - or . with numbers)
      if (/\d+[\/\-\.]\d+/.test(val) || /\d{4}-\d{2}-\d{2}/.test(val)) {
        columnScores[idx].date += 1;
      }

      // Check for cities (short text, no digits, common city names)
      if (val.length > 2 && val.length < 30 && !/\d/.test(val)) {
        const commonCities = ['douala', 'yaounde', 'yaoundé', 'bafoussam', 'bamenda', 'bertoua', 'ngaoundere', 'maroua', 'garoua', 'limbe', 'kumba', 'buea', 'bafia', 'mbalmayo', 'ebolowa', 'bafia'];
        if (commonCities.some(c => val.toLowerCase().includes(c))) {
          columnScores[idx].city += 2;
        } else if (/^[a-zA-Z\s\-éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ]+$/.test(val)) {
          columnScores[idx].city += 0.5;
        }
      }

      // Check for names (two words, no digits)
      if (/^[a-zA-Z\s\-éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ']+$/i.test(val) && val.includes(' ') && val.length > 5 && val.length < 50) {
        columnScores[idx].clientName += 1;
      }
    });
  }

  // Assign fields based on highest scores
  const usedFields = new Set();
  const usedIndices = new Set();

  // Sort by score and assign
  Object.entries(columnScores).forEach(([idx, scores]) => {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestField, bestScore] = sorted[0];

    if (bestScore >= 2 && !usedFields.has(bestField) && !usedIndices.has(idx)) {
      mapping[bestField] = parseInt(idx);
      usedFields.add(bestField);
      usedIndices.add(idx);
    }
  });

  console.log('🔍 [IMPORT] Content-based detection:', mapping);
  console.log('🔍 [IMPORT] Column scores:', columnScores);

  return mapping;
}

/**
 * Auto-detects column mapping from headers AND content.
 * Returns { field: columnIndex } mapping.
 */
export function autoDetectColumns(headers, rows = []) {
  const mapping = {};

  console.log('🔍 [IMPORT] Headers detected:', headers);

  // Pass 1: compound (more specific) matches from headers
  headers.forEach((header, index) => {
    const h = normalize(header);
    for (const p of COLUMN_PATTERNS) {
      if (!mapping[p.field] && p.compound.some(c => h.includes(normalize(c)))) {
        mapping[p.field] = index;
        console.log(`✅ [IMPORT] Mapped ${p.field} -> column ${index} (${header}) [compound]`);
      }
    }
  });

  // Pass 2: simple matches from headers (only if field not already mapped)
  const usedIndices = new Set(Object.values(mapping));
  headers.forEach((header, index) => {
    if (usedIndices.has(index)) return;
    const h = normalize(header);
    for (const p of COLUMN_PATTERNS) {
      if (!mapping[p.field] && p.simple.some(k => h.includes(normalize(k)))) {
        mapping[p.field] = index;
        usedIndices.add(index);
        console.log(`✅ [IMPORT] Mapped ${p.field} -> column ${index} (${header}) [simple]`);
        break;
      }
    }
  });

  // Pass 3: content-based detection for missing fields
  if (rows.length > 0) {
    const contentMapping = detectColumnsByContent(rows, headers);
    Object.entries(contentMapping).forEach(([field, idx]) => {
      if (!mapping[field]) {
        mapping[field] = idx;
        console.log(`✅ [IMPORT] Mapped ${field} -> column ${idx} (content-based)`);
      }
    });
  }
  // Pass 4: Content-based validation — detect and fix swapped columns
  if (rows.length > 0) {
    const sampleRows = rows.slice(0, Math.min(10, rows.length));

    const analyzeColumn = (colIdx) => {
      let numericCount = 0, textCount = 0, dateCount = 0, urlCount = 0, total = 0;
      for (const row of sampleRows) {
        if (!row?.c?.[colIdx]) continue;
        const cell = row.c[colIdx];
        if (cell.v == null) continue;
        total++;
        if (typeof cell.v === 'number') { numericCount++; continue; }
        const val = String(cell.f || cell.v).trim();
        if (!val) continue;
        if (/^https?:\/\//i.test(val)) { urlCount++; continue; }
        if (/^\d{4}-\d{2}-\d{2}/.test(val) || (typeof cell.v === 'string' && cell.v.startsWith('Date('))) { dateCount++; continue; }
        const numCleaned = parseFloat(cleanNumericString(val));
        if (!isNaN(numCleaned) && numCleaned > 0 && /^[\d'+]/.test(val.trim())) { numericCount++; } else { textCount++; }
      }
      return { numericCount, textCount, dateCount, urlCount, total };
    };

    // Fix price \u2194 product swap: if price col has text and product col has numbers
    if (mapping.price !== undefined && mapping.product !== undefined) {
      const priceA = analyzeColumn(mapping.price);
      const productA = analyzeColumn(mapping.product);
      if (priceA.textCount > priceA.total / 2 && productA.numericCount > productA.total / 2) {
        console.log(`\ud83d\udd04 [IMPORT] Swapping price (col ${mapping.price}) \u2194 product (col ${mapping.product}) \u2014 content mismatch`);
        [mapping.price, mapping.product] = [mapping.product, mapping.price];
      }
    }

    // Fix city \u2194 address swap: if city col has dates/timestamps and address has city-like text
    if (mapping.city !== undefined && mapping.address !== undefined) {
      const cityA = analyzeColumn(mapping.city);
      const addressA = analyzeColumn(mapping.address);
      if ((cityA.dateCount + cityA.urlCount) > cityA.total / 2 && addressA.textCount > addressA.total / 2) {
        console.log(`\ud83d\udd04 [IMPORT] Swapping city (col ${mapping.city}) \u2194 address (col ${mapping.address}) \u2014 content mismatch`);
        [mapping.city, mapping.address] = [mapping.address, mapping.city];
      }
    }

    // Fix orderId \u2192 date: if orderId has dates but date col has URLs/garbage
    if (mapping.orderId !== undefined && mapping.date !== undefined) {
      const orderA = analyzeColumn(mapping.orderId);
      const dateA = analyzeColumn(mapping.date);
      if (orderA.dateCount > orderA.total / 2 && (dateA.urlCount + dateA.textCount) > dateA.total / 2) {
        console.log(`\ud83d\udd04 [IMPORT] Moving orderId (col ${mapping.orderId}) \u2192 date \u2014 orderId has dates, date col has non-date content`);
        mapping.date = mapping.orderId;
        delete mapping.orderId;
      }
    }
  }
  console.log('🔍 [IMPORT] Final mapping:', mapping);
  return mapping;
}

/**
 * Validates column mapping — always valid, warnings only.
 * Returns { valid, missing, warnings }.
 */
export function validateColumnMapping(mapping) {
  const recommended = ['clientName', 'clientPhone', 'product', 'price', 'city'];
  const warnings = recommended.filter(f => mapping[f] === undefined);

  return {
    valid: true,
    missing: [],
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
  let s = String(val).trim();
  // Remove Google Sheets apostrophe prefix first
  s = s.replace(/^'+/, '');
  
  // Remove currency text (FCFA, CFA, DH, MAD, €, $, etc.)
  s = s.replace(/\b(fcfa|cfa|xof|xaf|dh|mad|da|dzd|dt|tnd|gnf|eur|usd|ariary|ar)\b/gi, '');
  s = s.replace(/[€$£¥]/g, '');
  
  // Handle French format: "12 000,00" or "12 000"
  // Remove spaces used as thousands separators
  s = s.replace(/\s/g, '');
  
  // Remove remaining non-numeric chars except , . -
  let cleaned = s.replace(/[^0-9,.\-]/g, '').trim();
  if (!cleaned) return '0';
  
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  
  if (lastComma !== -1 && lastDot !== -1) {
    // Both comma and dot present — determine format by position
    if (lastComma > lastDot) {
      // French: "12.000,50" → dots are thousands, comma is decimal
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // English: "12,000.50" → commas are thousands, dot is decimal
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only commas, no dots
    const parts = cleaned.split(',');
    const afterComma = parts[parts.length - 1];
    if (afterComma && afterComma.length <= 2) {
      // Likely decimal: "12000,50" or "12,50"
      cleaned = cleaned.replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '');
    } else {
      // Likely thousands: "12,000" or "1,000,000"
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    // Only dots, no commas
    const parts = cleaned.split('.');
    const afterDot = parts[parts.length - 1];
    if (parts.length > 1 && afterDot.length === 3 && parts[0].length <= 3) {
      // Likely thousands separator: "15.000", "1.000.000"
      cleaned = cleaned.replace(/\./g, '');
    }
    // Otherwise keep as-is (decimal: "25.99")
  }
  return cleaned || '0';
}

function cleanPhone(val) {
  if (!val) return '';
  let phone = String(val).trim();
  
  // If empty after trim, return empty
  if (!phone || phone === 'null' || phone === 'undefined') return '';
  
  // Remove Google Sheets apostrophe prefix (used to force text format)
  phone = phone.replace(/^'+/, '');
  
  // Remove common prefixes
  phone = phone.replace(/^(tel:|phone:|whatsapp:|wa:)/i, '');

  // Remove hidden/invisible characters sometimes copied from Sheets/WhatsApp
  phone = phone.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Prefer extracting a phone-like chunk when text is mixed with letters
  // Examples: "Client: +237 6 99 88 77 66" or "tel 699-88-77-66"
  const candidates = phone.match(/\+?\d[\d\s().-]{5,}\d/g) || [];
  if (candidates.length > 0) {
    phone = candidates.sort((a, b) => b.length - a.length)[0];
  }
  
  // Keep digits only → WhatsApp-ready format (no +, no spaces, no dashes)
  phone = phone.replace(/\D/g, '');
  
  // If we end up with nothing, return empty
  if (!phone || phone.length === 0) return '';
  
  return phone;
}

function parseFlexDate(dateVal) {
  if (!dateVal) return new Date();
  let strVal = String(dateVal).trim();
  // Remove Google Sheets apostrophe prefix (used to force text format)
  strVal = strVal.replace(/^'+/, '');
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

    // Debug: log mapping for first row only
    if (rowIndex === 0 || rowIndex === 1) {
      console.log('🔍 [IMPORT] Column mapping:', columnMap);
      console.log('🔍 [IMPORT] Headers:', headers);
      console.log('🔍 [IMPORT] Row cells count:', row.c.length);
    }

    const getVal = (field) => {
      const idx = columnMap[field];
      if (idx === undefined || !row.c[idx]) return '';
      const cell = row.c[idx];
      // For phone numbers, Google Sheets may interpret +237... as a formula
      // Try: formatted value (f), then value (v), then raw value if available
      let val = '';
      if (cell.f) val = String(cell.f);
      else if (cell.v != null) val = String(cell.v);
      // Remove Google Sheets apostrophe prefix (used to force text format)
      return val.replace(/^'+/, '');
    };

    const getNumVal = (field) => {
      const idx = columnMap[field];
      if (idx === undefined || !row.c[idx]) return 0;
      const cell = row.c[idx];
      // Prefer raw numeric value from Google Sheets API (most reliable)
      if (typeof cell.v === 'number') {
        return cell.v;
      }
      // Fallback: parse from string value (v) or formatted value (f)
      let raw;
      if (cell.v !== undefined && cell.v !== null) {
        raw = String(cell.v);
      } else if (cell.f !== undefined && cell.f !== null) {
        raw = String(cell.f);
      } else {
        return 0;
      }
      raw = raw.replace(/^'+/, '');
      const result = parseFloat(cleanNumericString(raw)) || 0;
      return result;
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
        let val = cell.f || (cell.v != null ? String(cell.v) : '');
        // Remove Google Sheets apostrophe prefix (used to force text format)
        val = val.replace(/^'+/, '');
        rawData[header] = val;
      }
    });

    const statusRaw = normalize(getVal('status'));
    const mappedStatus = STATUS_MAP[statusRaw] || 'pending';

    const clientPhone = cleanPhone(getVal('clientPhone'));
    const clientName = getVal('clientName').trim();

    // Skip truly empty rows only
    const hasAnyData = row.c.some(cell => cell && cell.v != null && String(cell.v).trim() !== '');
    if (!hasAnyData) {
      return { success: false, error: 'Ligne vide', row: rowIndex };
    }

    // If no name/phone detected via mapping, use first non-empty cells as fallback
    const resolvedName = clientName || (row.c[0] ? String(row.c[0].v ?? '').trim() : '') || `Ligne ${rowIndex}`;
    const resolvedPhone = clientPhone || '';

    const data = {
      orderId: getVal('orderId') || `#${sourceName}_${rowIndex + 1}`,
      date: getDateVal('date'),
      clientName: resolvedName,
      clientPhone: resolvedPhone,
      clientPhoneNormalized: normalizePhone(resolvedPhone, '237'),
      city: normalizeCity(getVal('city')),
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
 * @param {Object} sheetData - Données du sheet
 * @param {number} maxRows - Nombre maximum de lignes à prévisualiser
 * @param {string} sheetOrder - Ordre d'affichage: 'newest_first' (haut) ou 'oldest_first' (bas)
 */
export function generatePreview(sheetData, maxRows = 5, sheetOrder = 'newest_first') {
  const { headers, rows, cols, dataStartIndex } = sheetData;
  // Pass rows for content-based column detection
  const columnMapping = autoDetectColumns(headers, rows);
  const validation = validateColumnMapping(columnMapping);

  const previewRows = [];
  const totalDataRows = rows.length - dataStartIndex;
  const limit = Math.min(maxRows, totalDataRows);

  // Déterminer les indices de début et fin selon l'ordre
  let startIdx, endIdx, step;
  if (sheetOrder === 'oldest_first') {
    // Plus anciennes d'abord = partir du bas du sheet
    startIdx = rows.length - 1;
    endIdx = dataStartIndex - 1;
    step = -1;
  } else {
    // Plus récentes d'abord (par défaut) = partir du haut
    startIdx = dataStartIndex;
    endIdx = dataStartIndex + limit;
    step = 1;
  }

  // Collecter les lignes selon l'ordre choisi
  let collected = 0;
  if (sheetOrder === 'oldest_first') {
    for (let i = startIdx; i > endIdx && collected < limit; i--) {
      const row = rows[i];
      if (!row?.c) continue;
      const rowData = {};
      headers.forEach((header, idx) => {
        if (header && row.c[idx]) {
          const cell = row.c[idx];
          let value = '';
          if (cell.f !== undefined && cell.f !== null) {
            value = String(cell.f);
          } else if (cell.v !== undefined && cell.v !== null) {
            value = String(cell.v);
          }
          value = value.replace(/^'+/, '');
          rowData[header] = value;
        } else {
          rowData[header] = '';
        }
      });
      previewRows.push(rowData);
      collected++;
    }
  } else {
    // newest_first - comportement par défaut
    for (let i = startIdx; i < endIdx && i < rows.length; i++) {
      const row = rows[i];
      if (!row?.c) continue;
      const rowData = {};
      headers.forEach((header, idx) => {
        if (header && row.c[idx]) {
          const cell = row.c[idx];
          let value = '';
          if (cell.f !== undefined && cell.f !== null) {
            value = String(cell.f);
          } else if (cell.v !== undefined && cell.v !== null) {
            value = String(cell.v);
          }
          value = value.replace(/^'+/, '');
          rowData[header] = value;
        } else {
          rowData[header] = '';
        }
      });
      previewRows.push(rowData);
    }
  }

  return {
    headers: headers.filter(h => h),
    columnMapping,
    validation,
    preview: previewRows,
    totalRows: totalDataRows,
    dataStartIndex,
    sheetOrder
  };
}
