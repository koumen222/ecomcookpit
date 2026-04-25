import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import StoreProduct from '../models/StoreProduct.js';
import Product from '../models/Product.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { requireStoreOwner } from '../middleware/storeAuth.js';
import { checkPlanLimit } from '../middleware/planLimits.js';
import { uploadImage, isConfigured } from '../services/cloudflareImagesService.js';
import OpenAI from 'openai';

let openai = null;
const getOpenAI = () => {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

const router = express.Router();
const MAX_PRODUCT_NAME_LENGTH = 200;

/**
 * Build a product filter scoped to the active store.
 * Strict: only returns products belonging to the active store.
 */
function buildStoreFilter(req) {
  const base = { workspaceId: req.workspaceId };
  if (req.activeStoreId) {
    return { ...base, storeId: req.activeStoreId };
  }
  return base;
}

const SHOPIFY_TEMPLATE_COLUMNS = [
  'Title',
  'URL handle',
  'Description',
  'Vendor',
  'Product category',
  'Type',
  'Tags',
  'Published on online store',
  'Status',
  'SKU',
  'Barcode',
  'Option1 name',
  'Option1 value',
  'Option1 Linked To',
  'Option2 name',
  'Option2 value',
  'Option2 Linked To',
  'Option3 name',
  'Option3 value',
  'Option3 Linked To',
  'Price',
  'Compare-at price',
  'Cost per item',
  'Charge tax',
  'Tax code',
  'Unit price total measure',
  'Unit price total measure unit',
  'Unit price base measure',
  'Unit price base measure unit',
  'Inventory tracker',
  'Inventory quantity',
  'Continue selling when out of stock',
  'Weight value (grams)',
  'Weight unit for display',
  'Requires shipping',
  'Fulfillment service',
  'Product image URL',
  'Image position',
  'Image alt text',
  'Variant image URL',
  'Gift card',
  'SEO title',
  'SEO description',
  'Color (product.metafields.shopify.color-pattern)',
  'Google Shopping / Google product category',
  'Google Shopping / Gender',
  'Google Shopping / Age group',
  'Google Shopping / Manufacturer part number (MPN)',
  'Google Shopping / Ad group name',
  'Google Shopping / Ads labels',
  'Google Shopping / Condition',
  'Google Shopping / Custom product',
  'Google Shopping / Custom label 0',
  'Google Shopping / Custom label 1',
  'Google Shopping / Custom label 2',
  'Google Shopping / Custom label 3',
  'Google Shopping / Custom label 4'
];

const SCALOR_EXTRA_COLUMNS = [
  'Scalor linked product ID',
  'Scalor currency',
  'Scalor target market',
  'Scalor country',
  'Scalor city',
  'Scalor locale',
  'Scalor videos JSON',
  'Scalor features JSON',
  'Scalor testimonials JSON',
  'Scalor testimonials config JSON',
  'Scalor FAQ JSON',
  'Scalor page data JSON',
  'Scalor page builder JSON',
  'Scalor product page config JSON',
  'Scalor created at',
  'Scalor updated at'
];

const CSV_COLUMNS = [...SHOPIFY_TEMPLATE_COLUMNS, ...SCALOR_EXTRA_COLUMNS];

const CSV_HEADER_ALIASES = new Map([
  ['handle', 'URL handle'],
  ['body (html)', 'Description'],
  ['published', 'Published on online store'],
  ['variant sku', 'SKU'],
  ['variant barcode', 'Barcode'],
  ['option1 name', 'Option1 name'],
  ['option1 value', 'Option1 value'],
  ['option2 name', 'Option2 name'],
  ['option2 value', 'Option2 value'],
  ['option3 name', 'Option3 name'],
  ['option3 value', 'Option3 value'],
  ['variant price', 'Price'],
  ['variant compare at price', 'Compare-at price'],
  ['cost per item', 'Cost per item'],
  ['variant grams', 'Weight value (grams)'],
  ['variant inventory tracker', 'Inventory tracker'],
  ['variant inventory qty', 'Inventory quantity'],
  ['variant inventory policy', 'Continue selling when out of stock'],
  ['variant fulfillment service', 'Fulfillment service'],
  ['image src', 'Product image URL'],
  ['image position', 'Image position'],
  ['image alt text', 'Image alt text'],
  ['variant image', 'Variant image URL'],
  ['google shopping / google product category', 'Google Shopping / Google product category'],
  ['google shopping / gender', 'Google Shopping / Gender'],
  ['google shopping / age group', 'Google Shopping / Age group'],
  ['google shopping / mpn', 'Google Shopping / Manufacturer part number (MPN)'],
]);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || /\.csv$/i.test(file.originalname || '')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only CSV files are allowed'), false);
  }
});

function sanitizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeCsvValue(value) {
  const stringValue = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function detectCsvDelimiter(text) {
  const candidates = [',', ';', '\t'];
  const scores = new Map(candidates.map((candidate) => [candidate, 0]));
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      break;
    }

    if (!inQuotes && scores.has(char)) {
      scores.set(char, scores.get(char) + 1);
    }
  }

  const best = [...scores.entries()].sort((left, right) => right[1] - left[1])[0];
  return best && best[1] > 0 ? best[0] : ',';
}

function parseCsvText(input) {
  const text = String(input || '').replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      cell = '';
      if (row.some((entry) => entry !== '')) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((entry) => entry !== '')) rows.push(row);

  const firstRow = rows[0] || [];
  const firstRowJoined = firstRow.join('').trim();
  const firstCell = String(firstRow[0] || '').trim();
  if (/^sep=.+$/i.test(firstRowJoined) || /^sep=$/i.test(firstCell)) {
    rows.shift();
  }

  return rows;
}

function normalizeCsvHeader(header) {
  const trimmed = String(header || '').replace(/^\uFEFF/, '').trim();
  const normalized = CSV_HEADER_ALIASES.get(trimmed.toLowerCase());
  return normalized || trimmed;
}

function parseJsonField(value, fallback) {
  if (value == null || String(value).trim() === '') return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function isShopifyTemplateHeaders(headers = []) {
  const normalizedHeaders = headers.map((header) => normalizeCsvHeader(header));
  return normalizedHeaders.includes('Title') && normalizedHeaders.includes('URL handle') && normalizedHeaders.includes('Price');
}

function parseNumberField(value, fallback = 0) {
  if (value == null || String(value).trim() === '') return fallback;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanField(value) {
  return ['true', '1', 'yes', 'oui'].includes(String(value || '').trim().toLowerCase());
}

function parseTagsField(value) {
  if (!value) return [];
  const jsonTags = parseJsonField(value, null);
  if (Array.isArray(jsonTags)) {
    return jsonTags.map((tag) => String(tag || '').trim()).filter(Boolean);
  }
  return String(value)
    .split(/[|,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeImageEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((img, index) => {
      if (typeof img === 'string') {
        return { url: img, alt: '', order: index };
      }
      if (!img || !img.url) return null;
      return {
        url: String(img.url),
        alt: String(img.alt || ''),
        order: Number.isFinite(Number(img.order)) ? Number(img.order) : index,
      };
    })
    .filter(Boolean);
}

function normalizeVideoEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((video, index) => {
      if (typeof video === 'string') {
        return { url: video, type: 'direct', thumbnail: '', title: '', order: index };
      }
      if (!video || !video.url) return null;
      return {
        url: String(video.url),
        type: ['youtube', 'vimeo', 'direct'].includes(video.type) ? video.type : 'direct',
        thumbnail: String(video.thumbnail || ''),
        title: String(video.title || ''),
        order: Number.isFinite(Number(video.order)) ? Number(video.order) : index,
      };
    })
    .filter(Boolean);
}

function normalizeFeatureEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((feature) => {
      if (typeof feature === 'string') {
        const text = feature.trim();
        return text ? { icon: '', text } : null;
      }
      if (!feature || !feature.text) return null;
      return {
        icon: String(feature.icon || ''),
        text: String(feature.text).trim().slice(0, 50),
      };
    })
    .filter(Boolean);
}

function buildShopifyCsvRows(product) {
  const handle = sanitizeSlug(product.slug || product.name || 'product');
  const images = normalizeImageEntries(product.images || []);
  const imageRows = images.length > 0 ? images : [{ url: '', alt: '', order: 0 }];

  return imageRows.map((image, index) => ({
    Title: index === 0 ? (product.name || '') : '',
    'URL handle': handle,
    Description: index === 0 ? (product.description || '') : '',
    Vendor: '',
    'Product category': index === 0 ? (product.category || '') : '',
    Type: index === 0 ? (product.category || '') : '',
    Tags: index === 0 ? (product.tags || []).join(', ') : '',
    'Published on online store': index === 0 ? (product.isPublished ? 'TRUE' : 'FALSE') : '',
    Status: index === 0 ? (product.isPublished ? 'Active' : 'Draft') : '',
    SKU: '',
    Barcode: '',
    'Option1 name': '',
    'Option1 value': '',
    'Option1 Linked To': '',
    'Option2 name': '',
    'Option2 value': '',
    'Option2 Linked To': '',
    'Option3 name': '',
    'Option3 value': '',
    'Option3 Linked To': '',
    Price: index === 0 ? (product.price ?? '') : '',
    'Compare-at price': index === 0 ? (product.compareAtPrice ?? '') : '',
    'Cost per item': '',
    'Charge tax': index === 0 ? 'TRUE' : '',
    'Tax code': '',
    'Unit price total measure': '',
    'Unit price total measure unit': '',
    'Unit price base measure': '',
    'Unit price base measure unit': '',
    'Inventory tracker': index === 0 ? 'shopify' : '',
    'Inventory quantity': index === 0 ? (product.stock ?? 0) : '',
    'Continue selling when out of stock': index === 0 ? 'DENY' : '',
    'Weight value (grams)': '',
    'Weight unit for display': index === 0 ? 'g' : '',
    'Requires shipping': index === 0 ? 'TRUE' : '',
    'Fulfillment service': index === 0 ? 'manual' : '',
    'Product image URL': image.url || '',
    'Image position': image.url ? (index + 1) : '',
    'Image alt text': image.alt || '',
    'Variant image URL': '',
    'Gift card': index === 0 ? 'FALSE' : '',
    'SEO title': index === 0 ? (product.seoTitle || '') : '',
    'SEO description': index === 0 ? (product.seoDescription || '') : '',
    'Color (product.metafields.shopify.color-pattern)': '',
    'Google Shopping / Google product category': index === 0 ? (product.category || '') : '',
    'Google Shopping / Gender': '',
    'Google Shopping / Age group': '',
    'Google Shopping / Manufacturer part number (MPN)': '',
    'Google Shopping / Ad group name': '',
    'Google Shopping / Ads labels': '',
    'Google Shopping / Condition': index === 0 ? 'New' : '',
    'Google Shopping / Custom product': index === 0 ? 'FALSE' : '',
    'Google Shopping / Custom label 0': '',
    'Google Shopping / Custom label 1': '',
    'Google Shopping / Custom label 2': '',
    'Google Shopping / Custom label 3': '',
    'Google Shopping / Custom label 4': '',
    'Scalor linked product ID': index === 0 ? (product.linkedProductId || '') : '',
    'Scalor currency': index === 0 ? (product.currency || '') : '',
    'Scalor target market': index === 0 ? (product.targetMarket || '') : '',
    'Scalor country': index === 0 ? (product.country || '') : '',
    'Scalor city': index === 0 ? (product.city || '') : '',
    'Scalor locale': index === 0 ? (product.locale || '') : '',
    'Scalor videos JSON': index === 0 ? JSON.stringify(product.videos || []) : '',
    'Scalor features JSON': index === 0 ? JSON.stringify(product.features || []) : '',
    'Scalor testimonials JSON': index === 0 ? JSON.stringify(product.testimonials || []) : '',
    'Scalor testimonials config JSON': index === 0 ? (product.testimonialsConfig ? JSON.stringify(product.testimonialsConfig) : '') : '',
    'Scalor FAQ JSON': index === 0 ? JSON.stringify(product.faq || []) : '',
    'Scalor page data JSON': index === 0 ? (product._pageData ? JSON.stringify(product._pageData) : '') : '',
    'Scalor page builder JSON': index === 0 ? (product.pageBuilder ? JSON.stringify(product.pageBuilder) : '') : '',
    'Scalor product page config JSON': index === 0 ? (product.productPageConfig ? JSON.stringify(product.productPageConfig) : '') : '',
    'Scalor created at': index === 0 && product.createdAt ? new Date(product.createdAt).toISOString() : '',
    'Scalor updated at': index === 0 && product.updatedAt ? new Date(product.updatedAt).toISOString() : '',
  }));
}

function rowsToCsv(rowObjects) {
  return [
    CSV_COLUMNS.join(','),
    ...rowObjects.map((row) => CSV_COLUMNS.map((column) => escapeCsvValue(row[column] ?? '')).join(','))
  ].join('\n');
}

function parseShopifyTemplateProducts(rows, headers) {
  const grouped = new Map();

  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index];
    const row = Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] ?? '']));
    const handle = sanitizeSlug(row['URL handle'] || row.Title || `row-${index}`);
    if (!grouped.has(handle)) grouped.set(handle, []);
    grouped.get(handle).push(row);
  }

  return Array.from(grouped.entries()).map(([handle, productRows]) => {
    const firstContentRow = productRows.find((row) => String(row.Title || '').trim() || String(row.Description || '').trim()) || productRows[0];
    const images = productRows
      .flatMap((row, rowIndex) => {
        const candidates = [row['Product image URL'], row['Variant image URL']].filter(Boolean);
        return candidates.map((url, imageIndex) => ({
          url: String(url),
          alt: String(row['Image alt text'] || firstContentRow.Title || ''),
          order: parseNumberField(row['Image position'], rowIndex + imageIndex),
        }));
      })
      .filter((entry, index, array) => entry.url && array.findIndex((candidate) => candidate.url === entry.url) === index)
      .sort((left, right) => left.order - right.order);

    return {
      slug: handle,
      name: String(firstContentRow.Title || '').trim(),
      description: String(firstContentRow.Description || ''),
      price: parseNumberField(firstContentRow.Price, NaN),
      compareAtPrice: firstContentRow['Compare-at price'] === '' ? null : parseNumberField(firstContentRow['Compare-at price'], null),
      currency: String(firstContentRow['Scalor currency'] || '').trim().toUpperCase(),
      targetMarket: String(firstContentRow['Scalor target market'] || ''),
      country: String(firstContentRow['Scalor country'] || ''),
      city: String(firstContentRow['Scalor city'] || ''),
      locale: String(firstContentRow['Scalor locale'] || ''),
      stock: parseNumberField(firstContentRow['Inventory quantity'], 0),
      category: String(firstContentRow['Product category'] || firstContentRow.Type || ''),
      tags: parseTagsField(firstContentRow.Tags),
      isPublished: parseBooleanField(firstContentRow['Published on online store']) || /active/i.test(String(firstContentRow.Status || '')),
      seoTitle: String(firstContentRow['SEO title'] || ''),
      seoDescription: String(firstContentRow['SEO description'] || ''),
      linkedProductId: String(firstContentRow['Scalor linked product ID'] || ''),
      images,
      videos: normalizeVideoEntries(parseJsonField(firstContentRow['Scalor videos JSON'], [])),
      features: normalizeFeatureEntries(parseJsonField(firstContentRow['Scalor features JSON'], [])),
      testimonials: normalizeTestimonials(parseJsonField(firstContentRow['Scalor testimonials JSON'], [])) || [],
      testimonialsConfig: parseJsonField(firstContentRow['Scalor testimonials config JSON'], null),
      faq: normalizeFaq(parseJsonField(firstContentRow['Scalor FAQ JSON'], [])) || [],
      _pageData: parseJsonField(firstContentRow['Scalor page data JSON'], null),
      pageBuilder: parseJsonField(firstContentRow['Scalor page builder JSON'], null),
      productPageConfig: parseJsonField(firstContentRow['Scalor product page config JSON'], null),
    };
  });
}

async function ensureLinkedProductForImport({ existingLinkedProductId, requestedLinkedProductId, name, price, stock, workspaceId, userId }) {
  const candidateIds = [existingLinkedProductId, requestedLinkedProductId].filter(Boolean);

  for (const candidateId of candidateIds) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) continue;
    const linked = await Product.findOne({ _id: candidateId, workspaceId }).select('_id').lean();
    if (linked?._id) return linked._id;
  }

  const systemProduct = new Product(buildSystemProductPayload({
    name,
    price,
    stock,
    workspaceId,
    userId,
  }));

  await systemProduct.save();
  return systemProduct._id;
}

// Configure multer for memory storage (files uploaded to Cloudflare, not local disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 5 // Max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (authenticated, workspace-scoped)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /store-products
 * List all store products for the current workspace (dashboard).
 * Supports pagination: ?page=1&limit=20&category=&search=
 */
router.get('/', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, isPublished } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    // Build filter — scoped to active store
    const filter = buildStoreFilter(req);
    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    const [products, total] = await Promise.all([
      StoreProduct.findPaginated(filter, { page: pageNum, limit: limitNum }),
      StoreProduct.countForFilter(filter)
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Erreur GET /store-products:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-products/categories/list
 * Get unique categories for current workspace.
 * MUST be defined before /:id to avoid Express matching "categories" as an ID.
 */
router.get('/categories/list', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const categories = await StoreProduct.distinct('category', {
      ...buildStoreFilter(req),
      category: { $ne: '' }
    });

    res.json({ success: true, data: categories.sort() });
  } catch (error) {
    console.error('Erreur GET /store-products/categories:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-products/export/csv
 * Export store product pages to CSV.
 */
router.get('/export/csv', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { category, search, isPublished } = req.query;
    const filter = buildStoreFilter(req);

    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await StoreProduct.find(filter).sort({ createdAt: -1 }).lean();
    const csv = rowsToCsv(products.flatMap((product) => buildShopifyCsvRows(product)));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pages-produits-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Erreur GET /store-products/export/csv:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de l’export CSV' });
  }
});

/**
 * GET /store-products/:id/export/csv
 * Export a single store product page to CSV.
 */
router.get('/:id/export/csv', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const product = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const csv = rowsToCsv(buildShopifyCsvRows(product));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="page-produit-${sanitizeSlug(product.slug || product.name || 'produit')}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Erreur GET /store-products/:id/export/csv:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de l’export CSV du produit' });
  }
});

/**
 * POST /store-products/:id/import/csv
 * Import a CSV into a specific store product page (updates only this product).
 */
router.post('/:id/import/csv', requireEcomAuth, requireWorkspace, requireStoreOwner, (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ success: false, message: err.message || 'Fichier CSV invalide' });
  });
}, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, message: 'Aucun fichier CSV fourni' });
    }

    const existingProduct = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
    });

    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const rows = parseCsvText(req.file.buffer.toString('utf-8'));
    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: 'Le fichier CSV est vide' });
    }

    const headers = rows[0].map((header) => normalizeCsvHeader(header));
    if (!isShopifyTemplateHeaders(headers)) {
      return res.status(400).json({ success: false, message: 'Le CSV doit suivre le template produit attendu' });
    }

    const parsedProducts = parseShopifyTemplateProducts(rows, headers);
    const importedProduct = parsedProducts[0];

    if (!importedProduct) {
      return res.status(400).json({ success: false, message: 'Aucune ligne produit trouvée dans le CSV' });
    }

    const name = String(importedProduct.name || '').trim();
    const price = parseNumberField(importedProduct.price, NaN);

    if (!name || !Number.isFinite(price)) {
      return res.status(400).json({ success: false, message: 'Le CSV doit contenir au minimum les colonnes name et price valides' });
    }

    const userId = req.user?._id || req.user?.id;
    const linkedProductId = await ensureLinkedProductForImport({
      existingLinkedProductId: existingProduct.linkedProductId,
      requestedLinkedProductId: importedProduct.linkedProductId,
      name,
      price,
      stock: parseNumberField(importedProduct.stock, 0),
      workspaceId: req.workspaceId,
      userId,
    });

    const update = {
      name,
      description: String(importedProduct.description || ''),
      price,
      compareAtPrice: importedProduct.compareAtPrice,
      currency: importedProduct.currency || '',
      targetMarket: String(importedProduct.targetMarket || ''),
      country: String(importedProduct.country || ''),
      city: String(importedProduct.city || ''),
      locale: String(importedProduct.locale || ''),
      stock: parseNumberField(importedProduct.stock, 0),
      category: String(importedProduct.category || ''),
      tags: importedProduct.tags || [],
      isPublished: Boolean(importedProduct.isPublished),
      seoTitle: String(importedProduct.seoTitle || ''),
      seoDescription: String(importedProduct.seoDescription || ''),
      linkedProductId,
      images: importedProduct.images || [],
      videos: importedProduct.videos || [],
      features: importedProduct.features || [],
      testimonials: importedProduct.testimonials || [],
      testimonialsConfig: importedProduct.testimonialsConfig,
      faq: importedProduct.faq || [],
      _pageData: importedProduct._pageData,
      pageBuilder: importedProduct.pageBuilder,
      productPageConfig: importedProduct.productPageConfig,
    };

    const importedSlug = sanitizeSlug(importedProduct.slug);
    if (importedSlug) update.slug = importedSlug;

    const product = await StoreProduct.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { $set: update },
      { new: true, lean: true }
    );

    res.json({
      success: true,
      message: 'Produit importé depuis le CSV',
      data: product,
    });
  } catch (error) {
    console.error('Erreur POST /store-products/:id/import/csv:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de l’import CSV du produit' });
  }
});

/**
 * POST /store-products/import/csv
 * Import store product pages from CSV.
 */
router.post('/import/csv', requireEcomAuth, requireWorkspace, requireStoreOwner, (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ success: false, message: err.message || 'Fichier CSV invalide' });
  });
}, async (req, res) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, message: 'Aucun fichier CSV fourni' });
    }

    const rows = parseCsvText(req.file.buffer.toString('utf-8'));
    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: 'Le fichier CSV est vide' });
    }

    const headers = rows[0].map((header) => normalizeCsvHeader(header));
    if (!isShopifyTemplateHeaders(headers)) {
      return res.status(400).json({ success: false, message: 'Le CSV doit suivre le template produit attendu' });
    }

    const parsedProducts = parseShopifyTemplateProducts(rows, headers);
    const userId = req.user?._id || req.user?.id;
    const stats = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let index = 0; index < parsedProducts.length; index += 1) {
      const importedProduct = parsedProducts[index];
      const lineNumber = index + 2;
      const name = String(importedProduct.name || '').trim();

      if (!name) {
        stats.skipped += 1;
        continue;
      }

      const price = parseNumberField(importedProduct.price, NaN);
      if (!Number.isFinite(price)) {
        stats.errors.push(`Ligne ${lineNumber}: prix invalide pour "${name}"`);
        continue;
      }

      try {
        let existingProduct = null;
        if (mongoose.Types.ObjectId.isValid(importedProduct.linkedProductId || '')) {
          existingProduct = await StoreProduct.findOne({ linkedProductId: importedProduct.linkedProductId, ...buildStoreFilter(req) });
        }
        if (!existingProduct && importedProduct.slug) {
          existingProduct = await StoreProduct.findOne({ slug: sanitizeSlug(importedProduct.slug), ...buildStoreFilter(req) });
        }

        const linkedProductId = await ensureLinkedProductForImport({
          existingLinkedProductId: existingProduct?.linkedProductId,
          requestedLinkedProductId: importedProduct.linkedProductId,
          name,
          price,
          stock: parseNumberField(importedProduct.stock, 0),
          workspaceId: req.workspaceId,
          userId,
        });

        const payload = {
          workspaceId: req.workspaceId,
          storeId: req.activeStoreId || null,
          name,
          description: String(importedProduct.description || ''),
          price,
          compareAtPrice: importedProduct.compareAtPrice,
          currency: importedProduct.currency || '',
          targetMarket: String(importedProduct.targetMarket || ''),
          country: String(importedProduct.country || ''),
          city: String(importedProduct.city || ''),
          locale: String(importedProduct.locale || ''),
          stock: parseNumberField(importedProduct.stock, 0),
          category: String(importedProduct.category || ''),
          tags: importedProduct.tags || [],
          isPublished: Boolean(importedProduct.isPublished),
          seoTitle: String(importedProduct.seoTitle || ''),
          seoDescription: String(importedProduct.seoDescription || ''),
          linkedProductId,
          images: importedProduct.images || [],
          videos: importedProduct.videos || [],
          features: importedProduct.features || [],
          testimonials: importedProduct.testimonials || [],
          testimonialsConfig: importedProduct.testimonialsConfig,
          faq: importedProduct.faq || [],
          _pageData: importedProduct._pageData,
          pageBuilder: importedProduct.pageBuilder,
          productPageConfig: importedProduct.productPageConfig,
        };

        const importedSlug = sanitizeSlug(importedProduct.slug);
        if (existingProduct) {
          const update = {
            ...payload,
            slug: importedSlug || existingProduct.slug,
          };

          await StoreProduct.updateOne(
            { _id: existingProduct._id, workspaceId: req.workspaceId },
            { $set: update }
          );
          stats.updated += 1;
        } else {
          const product = new StoreProduct({
            ...payload,
            createdBy: req.user.id,
            ...(importedSlug && { slug: importedSlug }),
          });
          await product.save();
          stats.created += 1;
        }
      } catch (error) {
        stats.errors.push(`Ligne ${lineNumber}: ${error.message}`);
      }
    }

    res.json({
      success: stats.errors.length === 0,
      message: `Import CSV terminé: ${stats.created} créé(s), ${stats.updated} mis à jour, ${stats.skipped} ignoré(s)`,
      data: stats,
    });
  } catch (error) {
    console.error('Erreur POST /store-products/import/csv:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de l’import CSV' });
  }
});

/**
 * POST /store-products/upload
 * Upload product images to Cloudflare Images.
 * Returns array of uploaded image URLs with metadata.
 * Max 5 images, 5MB each.
 */
router.post(
  '/upload',
  requireEcomAuth,
  requireWorkspace,
  requireStoreOwner,
  (req, res, next) => {
    // Accept both "images" and "image" field names from frontend forms
    const uploader = upload.fields([
      { name: 'images', maxCount: 5 },
      { name: 'image', maxCount: 5 }
    ]);

    uploader(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large. Max size is 5MB per file.'
          : err.code === 'LIMIT_FILE_COUNT'
            ? 'Too many files. Max 5 images per upload.'
            : err.message;
        return res.status(400).json({ success: false, message, code: err.code });
      }

      return res.status(400).json({ success: false, message: err.message || 'Invalid upload payload' });
    });
  },
  async (req, res) => {
    try {
      if (!isConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Cloudflare Images not configured',
          code: 'CLOUDFLARE_NOT_CONFIGURED'
        });
      }

      const files = [
        ...(req.files?.images || []),
        ...(req.files?.image || [])
      ];

      if (!files.length) {
        return res.status(400).json({
          success: false,
          message: 'No images provided'
        });
      }

      const uploadedImages = [];

      for (const file of files) {
        const result = await uploadImage(
          file.buffer,
          file.originalname,
          {
            workspaceId: req.workspaceId.toString(),
            uploadedBy: req.user.id,
            filename: file.originalname,
            mimeType: file.mimetype,
            width: 1200,
            height: 1200,
            quality: 82
          }
        );

        uploadedImages.push({
          id: result.id,
          url: result.url,
          key: result.key,
          filename: result.filename,
          size: result.size
        });
      }

      res.json({
        success: true,
        message: `${uploadedImages.length} image(s) uploaded`,
        data: uploadedImages
      });

    } catch (error) {
      console.error('❌ Image upload error:', error.message);
      const status = /configured/i.test(error.message)
        ? 503
        : /Cloudflare upload failed/i.test(error.message)
          ? 502
          : 500;
      res.status(status).json({
        success: false,
        message: error.message || 'Image upload failed'
      });
    }
  }
);

/**
 * POST /store-products/generate
 * Generate product fields using AI from a URL or detailed description.
 * Body: { input: string, inputType: 'url' | 'description' }
 * Returns: { name, description, category, tags, seoTitle, seoDescription, suggestedPrice, features }
 */
router.post('/generate', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const ai = getOpenAI();
    if (!ai) {
      return res.status(503).json({
        success: false,
        message: 'Génération IA non configurée. Veuillez configurer OPENAI_API_KEY.'
      });
    }

    const { input, inputType = 'description' } = req.body;
    if (!input?.trim()) {
      return res.status(400).json({ success: false, message: 'Contenu requis (URL ou description)' });
    }

    let context = input.trim();

    // If URL: fetch and strip HTML to get plain text (max 4000 chars for token budget)
    if (inputType === 'url') {
      try {
        const { default: nodeFetch } = await import('node-fetch');
        const response = await nodeFetch(input.trim(), {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000)
        });
        const html = await response.text();
        // Strip HTML tags and condense whitespace
        context = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 4000);
      } catch {
        return res.status(422).json({ success: false, message: 'Impossible de récupérer la page. Essayez avec une description.' });
      }
    }

    const systemPrompt = `Tu es un expert en e-commerce. À partir du texte fourni, génère les informations d'une page produit en JSON.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.
Format strict:
{
  "name": "Nom commercial accrocheur (max 80 chars)",
  "description": "Description persuasive pour le client final, 2-4 paragraphes, ton commercial",
  "category": "Catégorie courte (ex: Vêtements, Électronique, Beauté)",
  "tags": ["tag1", "tag2", "tag3"],
  "seoTitle": "Titre SEO optimisé (max 60 chars)",
  "seoDescription": "Méta description SEO (max 155 chars)",
  "features": ["Avantage 1", "Avantage 2", "Avantage 3"],
  "suggestedPrice": 0
}
Si le prix n'est pas mentionné, mettre 0. Répondre en français.`;

    const completion = await ai.chat.completions.create({
      model: process.env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    let generated;
    try {
      generated = JSON.parse(completion.choices[0].message.content);
    } catch {
      return res.status(500).json({ success: false, message: 'Réponse IA invalide, réessayez.' });
    }

    res.json({ success: true, data: generated });

  } catch (error) {
    console.error('❌ POST /store-products/generate error:', error.message);
    if (error?.status === 429) {
      return res.status(429).json({ success: false, message: 'Quota OpenAI dépassé. Réessayez plus tard.' });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la génération IA' });
  }
});

/**
 * POST /store-products/generate-reviews
 * Generate authentic product reviews (testimonials) using AI.
 * Body: { productDescription, country?, cities?, names?, count? }
 * Returns: { reviews: [{ name, text, rating, location, verified, date, source }] }
 */
router.post('/generate-reviews', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const ai = getOpenAI();
    if (!ai) {
      return res.status(503).json({
        success: false,
        message: 'Génération IA non configurée. Veuillez configurer OPENAI_API_KEY.'
      });
    }

    const { productDescription, country, cities, names, count } = req.body;
    if (!productDescription?.trim()) {
      return res.status(400).json({ success: false, message: 'Description du produit requise' });
    }

    const reviewCount = Math.max(3, Math.min(6, parseInt(count) || 4));
    const cityList = Array.isArray(cities) ? cities.filter(Boolean) : [];
    const nameList = Array.isArray(names) ? names.filter(Boolean) : [];

    const systemPrompt = `Tu es un générateur d'avis clients authentiques pour les marchés africains.
Tu génères des avis en français africain naturel, comme de vrais clients.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.

RÈGLES STRICTES :
- Ton authentique, UGC naturel (comme un vrai client africain)
- Chaque avis fait 1 à 2 phrases maximum
- Mentionne un bénéfice concret du produit
- INTERDIT : "http", "www", "image", "photo", "lien", emojis excessifs, URLs
- Majorité de notes 4 et 5 étoiles (quelques 4 pour la crédibilité)
- Chaque avis est unique et différent des autres
${nameList.length > 0 ? `- Utilise UNIQUEMENT ces prénoms (choisis-en ${reviewCount}) : ${nameList.join(', ')}` : '- Invente des prénoms africains variés avec initiale du nom (ex: Awa D., Koffi M.)'}
${cityList.length > 0 ? `- Utilise UNIQUEMENT ces villes : ${cityList.join(', ')}` : ''}
${country ? `- Pays : ${country}` : ''}

Format JSON strict :
{
  "reviews": [
    {
      "name": "Prénom N.",
      "text": "Texte de l'avis (1-2 phrases)",
      "rating": 5,
      "location": "Ville, Pays",
      "verified": true,
      "date": "Il y a X jours"
    }
  ]
}`;

    const userPrompt = `Génère exactement ${reviewCount} avis clients authentiques pour ce produit :\n\n${productDescription.trim().slice(0, 2000)}`;

    const completion = await ai.chat.completions.create({
      model: process.env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    let generated;
    try {
      generated = JSON.parse(completion.choices[0].message.content);
    } catch {
      return res.status(500).json({ success: false, message: 'Réponse IA invalide, réessayez.' });
    }

    // Normalize & sanitize reviews
    const reviews = (generated.reviews || []).map(r => ({
      name: String(r.name || '').slice(0, 100),
      text: String(r.text || '').replace(/https?:\/\/\S+/gi, '').slice(0, 500),
      rating: Math.max(1, Math.min(5, parseInt(r.rating) || 5)),
      location: String(r.location || '').slice(0, 100),
      verified: r.verified !== false,
      date: String(r.date || 'Récemment'),
      source: 'ai'
    }));

    res.json({ success: true, data: { reviews } });

  } catch (error) {
    console.error('❌ POST /store-products/generate-reviews error:', error.message);
    if (error?.status === 429) {
      return res.status(429).json({ success: false, message: 'Quota OpenAI dépassé. Réessayez plus tard.' });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la génération des avis' });
  }
});

/**
 * GET /store-products/system-products
 * Return main system products for the store product picker.
 * Lets the store owner pick an existing product to pre-fill name + price.
 * Supports ?search= and ?limit=
 * MUST be declared before /:id to avoid Express routing conflict.
 */
router.get('/system-products', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { search, status, isActive, limit = 50 } = req.query;
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    const filter = {
      workspaceId: req.workspaceId
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length) {
        filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
      }
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const products = await Product.find(filter)
      .select('_id name sellingPrice stock status isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Erreur GET /store-products/system-products:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-products/:id
 * Get single store product (dashboard).
 */
router.get('/:id', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const product = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Erreur GET /store-products/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Normalise les témoignages : date string → Date réelle, supprime les champs invalides.
 */
function normalizeTestimonials(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw.map(t => ({
    ...t,
    image: t.image && typeof t.image === 'object' ? (t.image.url || '') : (t.image || ''),
    date: t.date ? t.date : undefined,
  }));
}

/**
 * Normalise les FAQ : mappe `reponse` → `answer`, force le champ requis.
 */
function normalizeFaq(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map(f => ({
      question: f.question || '',
      answer: f.answer || f.reponse || f.response || '',
    }))
    .filter(f => f.question && f.answer);
}

function buildSystemProductPayload({ name, price, stock, workspaceId, userId }) {
  const sellingPrice = Number(price) || 0;
  const inferredCost = sellingPrice > 0 ? Math.max(0, Math.floor(sellingPrice * 0.4)) : 0;

  return {
    workspaceId,
    createdBy: userId,
    name,
    status: 'test',
    sellingPrice,
    productCost: inferredCost,
    deliveryCost: 0,
    avgAdsCost: 0,
    stock: Number(stock) || 0,
    reorderThreshold: 10,
    isActive: true
  };
}

/**
 * POST /store-products
 * Create a new store product (dashboard).
 */
router.post('/', requireEcomAuth, requireWorkspace, requireStoreOwner, checkPlanLimit('products'), async (req, res) => {
  try {
    const {
      name, description, price, compareAtPrice, stock,
      images, category, tags, isPublished,
      seoTitle, seoDescription, linkedProductId, currency,
      targetMarket, country, city, locale,
      testimonials, faq, _pageData, productPageConfig
    } = req.body;

    const normalizedName = String(name || '').trim();

    if (!normalizedName || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Nom et prix requis'
      });
    }

    if (normalizedName.length > MAX_PRODUCT_NAME_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Nom du produit trop long (max ${MAX_PRODUCT_NAME_LENGTH} caractères)`
      });
    }

    const userId = req.user?._id || req.user?.id;
    let resolvedLinkedProductId = linkedProductId || null;
    let createdSystemProductId = null;

    if (resolvedLinkedProductId) {
      if (!mongoose.Types.ObjectId.isValid(resolvedLinkedProductId)) {
        return res.status(400).json({ success: false, message: 'Produit système lié invalide' });
      }

      const existingLinkedProduct = await Product.findOne({
        _id: resolvedLinkedProductId,
        workspaceId: req.workspaceId
      }).select('_id');

      if (!existingLinkedProduct) {
        return res.status(404).json({ success: false, message: 'Produit système lié introuvable' });
      }
    } else {
      const systemProduct = new Product(buildSystemProductPayload({
        name: normalizedName,
        price,
        stock,
        workspaceId: req.workspaceId,
        userId
      }));

      await systemProduct.save();
      resolvedLinkedProductId = systemProduct._id;
      createdSystemProductId = systemProduct._id;
    }

    let product;
    try {
      product = new StoreProduct({
        workspaceId: req.workspaceId,
        storeId: req.activeStoreId || null,
        name: normalizedName,
        description: description || '',
        price: Number(price),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
        currency: typeof currency === 'string' ? currency.trim().toUpperCase() : '',
        targetMarket: targetMarket || '',
        country: country || '',
        city: city || '',
        locale: locale || '',
        stock: Number(stock) || 0,
        images: (images || []).map((img, i) => ({
          url: img.url,
          alt: img.alt || normalizedName,
          order: img.order ?? i
        })),
        category: category || '',
        tags: tags || [],
        isPublished: isPublished || false,
        seoTitle: seoTitle || '',
        seoDescription: seoDescription || '',
        linkedProductId: resolvedLinkedProductId,
        createdBy: req.user.id,
        ...(testimonials?.length > 0 && { testimonials: normalizeTestimonials(testimonials) }),
        ...(faq?.length > 0 && { faq: normalizeFaq(faq) }),
        ...(_pageData && { _pageData }),
        ...(productPageConfig && { productPageConfig })
      });

      await product.save();
    } catch (error) {
      if (createdSystemProductId) {
        await Product.deleteOne({ _id: createdSystemProductId, workspaceId: req.workspaceId }).catch(() => {});
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: product.toObject(),
      meta: {
        linkedProductId: resolvedLinkedProductId,
        systemProductCreated: Boolean(createdSystemProductId)
      }
    });
  } catch (error) {
    // Handle duplicate slug
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Un produit avec ce nom existe déjà'
      });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors || {}).map((item) => item.message).filter(Boolean).join(', ') || 'Données produit invalides'
      });
    }
    console.error('Erreur POST /store-products:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-products/:id
 * Update a store product (dashboard).
 */
router.put('/:id', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const {
      name, description, price, compareAtPrice, stock,
      images, category, tags, isPublished,
      seoTitle, seoDescription, linkedProductId, currency,
      targetMarket, country, city, locale,
      testimonials, faq, variants, _pageData, pageBuilder, productPageConfig
    } = req.body;

    const normalizedName = name === undefined ? undefined : String(name || '').trim();

    if (normalizedName !== undefined) {
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: 'Nom du produit requis' });
      }
      if (normalizedName.length > MAX_PRODUCT_NAME_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Nom du produit trop long (max ${MAX_PRODUCT_NAME_LENGTH} caractères)`
        });
      }
    }

    // Build update object — only include provided fields
    const update = {};
    if (normalizedName !== undefined) update.name = normalizedName;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = Number(price);
    if (compareAtPrice !== undefined) update.compareAtPrice = compareAtPrice ? Number(compareAtPrice) : null;
    if (currency !== undefined) update.currency = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    if (targetMarket !== undefined) update.targetMarket = targetMarket;
    if (country !== undefined) update.country = country;
    if (city !== undefined) update.city = city;
    if (locale !== undefined) update.locale = locale;
    if (stock !== undefined) update.stock = Number(stock);
    if (images !== undefined) {
      update.images = images.map((img, i) => ({
        url: img.url,
        alt: img.alt || '',
        order: img.order ?? i
      }));
    }
    if (category !== undefined) update.category = category;
    if (tags !== undefined) update.tags = tags;
    if (isPublished !== undefined) update.isPublished = isPublished;
    if (seoTitle !== undefined) update.seoTitle = seoTitle;
    if (seoDescription !== undefined) update.seoDescription = seoDescription;
    if (linkedProductId !== undefined) update.linkedProductId = linkedProductId || null;
    if (testimonials !== undefined) update.testimonials = normalizeTestimonials(testimonials);
    if (faq !== undefined) update.faq = normalizeFaq(faq);
    if (variants !== undefined) update.variants = variants;
    if (_pageData !== undefined) update._pageData = _pageData;
    if (pageBuilder !== undefined) update.pageBuilder = pageBuilder;
    if (productPageConfig !== undefined) update.productPageConfig = productPageConfig;

    // Only regenerate slug if name actually changed
    if (normalizedName) {
      const existing = await StoreProduct.findOne({ _id: req.params.id, workspaceId: req.workspaceId }).select('name').lean();
      if (existing && existing.name !== normalizedName) {
        update.slug = normalizedName
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          + '-' + Date.now().toString(36);
      }
    }

    const product = await StoreProduct.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { $set: update },
      { new: true, lean: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    res.json({
      success: true,
      message: 'Produit mis à jour',
      data: product
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Un produit avec ce nom existe déjà'
      });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors || {}).map((item) => item.message).filter(Boolean).join(', ') || 'Données produit invalides'
      });
    }
    console.error('Erreur PUT /store-products/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * DELETE /store-products/:id
 * Delete a store product (dashboard).
 */
router.delete('/:id', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const result = await StoreProduct.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /store-products/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /store-products/:id/duplicate
 * Clone a store product (1-click duplication).
 */
router.post('/:id/duplicate', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const original = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    if (!original) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const {
      name,
      price,
      compareAtPrice,
      currency,
      targetMarket,
      country,
      city,
      locale,
      stock,
      category,
      tags,
      isPublished,
      images,
      _pageData,
      productPageConfig
    } = req.body || {};

    const { _id, createdAt, updatedAt, slug, ...rest } = original;
    const clonedName = String(name || '').trim() || `${rest.name} (copie)`;

    const createdBy = req.user?._id || req.user?.id || req.ecomUser?._id;
    if (!createdBy) {
      return res.status(401).json({ success: false, message: 'Utilisateur introuvable pour la duplication' });
    }

    const cloned = new StoreProduct({
      ...rest,
      name: clonedName,
      ...(price !== undefined ? { price: Number(price) } : {}),
      ...(compareAtPrice !== undefined ? { compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null } : {}),
      ...(currency !== undefined ? { currency: String(currency || '').trim().toUpperCase() } : {}),
      ...(targetMarket !== undefined ? { targetMarket } : {}),
      ...(country !== undefined ? { country } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(locale !== undefined ? { locale } : {}),
      ...(stock !== undefined ? { stock: Number(stock) || 0 } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(tags !== undefined ? { tags: Array.isArray(tags) ? tags : [] } : {}),
      ...(images !== undefined ? {
        images: (Array.isArray(images) ? images : []).filter((image) => image?.url).map((image, index) => ({
          url: image.url,
          alt: image.alt || '',
          order: image.order ?? index,
        }))
      } : {}),
      ...(_pageData !== undefined ? { _pageData } : {}),
      ...(productPageConfig !== undefined ? { productPageConfig } : {}),
      isPublished: isPublished === true ? true : false,
      storeId: req.activeStoreId || original.storeId || null,
      createdBy,
      workspaceId: req.workspaceId,
    });

    await cloned.save();

    res.status(201).json({
      success: true,
      message: 'Produit dupliqué',
      data: cloned.toObject()
    });
  } catch (error) {
    console.error('Erreur POST /store-products/:id/duplicate:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
