import express from 'express';
import mongoose from 'mongoose';
import OrderSource from '../models/OrderSource.js';
import CloseuseAssignment from '../models/CloseuseAssignment.js';
import EcomUser from '../models/EcomUser.js';
import Product from '../models/Product.js';
import WorkspaceSettings from '../models/WorkspaceSettings.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { getIO } from '../services/socketService.js';

const router = express.Router();

// ===== GESTION GOOGLE SHEETS =====

// Helper: extract spreadsheet ID from URL or raw ID
function extractId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  return input.trim();
}

// Helper: fetch Google Sheets JSON
async function fetchSheetsJson(rawSpreadsheetId, sheetName) {
  const spreadsheetId = extractId(rawSpreadsheetId);
  // Essayer avec le sheetName d'abord, puis sans si 404
  const baseUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
  const urls = [];
  if (sheetName) {
    urls.push(baseUrl + `&sheet=${encodeURIComponent(sheetName)}`);
  }
  urls.push(baseUrl); // Fallback sans sheetName

  let lastError;
  for (const url of urls) {
    console.log('📊 [fetchSheetsJson] Trying URL:', url);
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Ecom-Import-Service/1.0' } });
      console.log('📊 [fetchSheetsJson] Response status:', response.status);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue; // Try next URL
      }
      const text = await response.text();
      const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?$/s);
      if (!jsonStr) {
        lastError = new Error('Format de réponse invalide');
        continue;
      }
      return JSON.parse(jsonStr[1]);
    } catch (err) {
      lastError = err;
      console.log('📊 [fetchSheetsJson] Error:', err.message, '- trying next...');
    }
  }
  throw lastError;
}

// Valider une connexion Google Sheets
router.post('/validate-sheets', requireEcomAuth, async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;
    if (!spreadsheetId) return res.status(400).json({ success: false, message: 'ID spreadsheet requis' });

    const json = await fetchSheetsJson(spreadsheetId, sheetName);
    if (json.status === 'error') return res.status(400).json({ success: false, message: json.errors?.[0]?.message || 'Erreur spreadsheet' });

    const table = json.table;
    res.json({
      success: true,
      data: {
        id: spreadsheetId,
        title: table?.cols?.[0]?.label || 'Spreadsheet',
        rowCount: table?.rows?.length || 0,
        columnCount: table?.cols?.length || 0
      }
    });
  } catch (error) {
    console.error('Erreur validation sheets:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Aperçu des données Google Sheets
router.post('/preview-sheets', requireEcomAuth, async (req, res) => {
  try {
    const { spreadsheetId, sheetName, maxRows = 10 } = req.body;
    if (!spreadsheetId) return res.status(400).json({ success: false, message: 'ID spreadsheet requis' });

    const json = await fetchSheetsJson(spreadsheetId, sheetName);
    const table = json.table;
    const headers = (table?.cols || []).map(c => c.label || '');
    const rows = (table?.rows || []).slice(0, maxRows).map(row => {
      const parsed = {};
      (row.c || []).forEach((cell, i) => {
        parsed[headers[i] || `col_${i}`] = cell?.f || (cell?.v != null ? String(cell.v) : '');
      });
      return parsed;
    });

    res.json({ success: true, data: { headers, preview: rows, metadata: { parsedRows: table?.rows?.length || 0 } } });
  } catch (error) {
    console.error('Erreur preview sheets:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Synchroniser les sources depuis WorkspaceSettings Google Sheets
router.post('/sync-sources', requireEcomAuth, async (req, res) => {
  try {
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) return res.status(404).json({ success: false, message: 'Paramètres workspace non trouvés' });

    const sourcesToCreate = [];

    // Source legacy Google Sheets
    if (settings.googleSheets?.spreadsheetId) {
      sourcesToCreate.push({
        name: 'Commandes Zendo',
        description: 'Source principale synchronisée depuis Google Sheets',
        color: '#10B981',
        icon: '📊',
        workspaceId: req.workspaceId,
        createdBy: req.ecomUser._id,
        metadata: {
          type: 'google_sheets',
          spreadsheetId: settings.googleSheets.spreadsheetId,
          sheetName: settings.googleSheets.sheetName || 'Sheet1'
        }
      });
    }

    // Sources custom
    if (settings.sources?.length > 0) {
      settings.sources.forEach((source) => {
        if (source.isActive && source.spreadsheetId) {
          sourcesToCreate.push({
            name: source.name || 'Source Google Sheets',
            description: 'Source synchronisée depuis Google Sheets',
            color: source.color || '#3B82F6',
            icon: source.icon || '📱',
            workspaceId: req.workspaceId,
            createdBy: req.ecomUser._id,
            metadata: {
              type: 'google_sheets',
              spreadsheetId: source.spreadsheetId,
              sheetName: source.sheetName || 'Sheet1'
            }
          });
        }
      });
    }

    // Upsert: update existing or create new
    let created = 0, updated = 0;
    for (const sourceData of sourcesToCreate) {
      const existing = await OrderSource.findOne({
        workspaceId: req.workspaceId,
        'metadata.spreadsheetId': sourceData.metadata.spreadsheetId
      });
      if (existing) {
        existing.name = sourceData.name;
        existing.color = sourceData.color;
        existing.icon = sourceData.icon;
        existing.metadata = sourceData.metadata;
        existing.isActive = true;
        await existing.save();
        updated++;
      } else {
        await new OrderSource(sourceData).save();
        created++;
      }
    }

    const sources = await OrderSource.find({ workspaceId: req.workspaceId, isActive: true })
      .populate('createdBy', 'name email').sort({ name: 1 });

    res.json({
      success: true,
      message: `Synchronisation terminée: ${created} créée(s), ${updated} mise(s) à jour`,
      data: sources
    });
  } catch (error) {
    console.error('Erreur sync sources:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Extraire les produits uniques d'une source Google Sheets
router.post('/sheet-products', requireEcomAuth, async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;
    if (!spreadsheetId) return res.status(400).json({ success: false, message: 'ID spreadsheet requis' });

    const json = await fetchSheetsJson(spreadsheetId, sheetName);
    const table = json.table;

    // Essayer cols.label d'abord
    const colHeaders = (table?.cols || []).map(c => c.label || '');
    const hasColLabels = colHeaders.some(h => h && h.trim());

    // Essayer aussi la première ligne de données
    let firstRowHeaders = [];
    if (table?.rows?.[0]?.c) {
      firstRowHeaders = table.rows[0].c.map(cell => cell?.f || (cell?.v != null ? String(cell.v) : ''));
    }

    console.log('📊 [sheet-products] Col labels:', colHeaders);
    console.log('📊 [sheet-products] First row:', firstRowHeaders);

    const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const productKeywords = ['produit', 'product', 'article', 'item', 'designation', 'libelle', 'offre', 'offer', 'pack'];

    const findProductCol = (headers) => {
      const normalized = headers.map(h => normalize(h));
      for (const keyword of productKeywords) {
        const idx = normalized.findIndex(h => h.includes(keyword));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    // Stratégie 1: chercher dans cols.label
    let effectiveHeaders = colHeaders;
    let dataStartIndex = 0;
    let productColIndex = hasColLabels ? findProductCol(colHeaders) : -1;

    // Stratégie 2: si pas trouvé, chercher dans la première ligne
    if (productColIndex === -1 && firstRowHeaders.length > 0) {
      productColIndex = findProductCol(firstRowHeaders);
      if (productColIndex !== -1) {
        effectiveHeaders = firstRowHeaders;
        dataStartIndex = 1;
      }
    }

    console.log('📊 [sheet-products] Product col index:', productColIndex, 'headers used:', effectiveHeaders, 'dataStart:', dataStartIndex);

    if (productColIndex === -1) {
      return res.json({
        success: true,
        data: {
          products: [],
          message: 'Colonne produit non détectée',
          debugHeaders: { colLabels: colHeaders, firstRow: firstRowHeaders }
        }
      });
    }

    // Extraire les produits uniques
    const productSet = new Set();
    const rows = table?.rows || [];
    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row?.c || !row.c[productColIndex]) continue;
      const cell = row.c[productColIndex];
      const value = (cell.f || (cell.v != null ? String(cell.v) : '')).trim();
      if (value) productSet.add(value);
    }

    const products = Array.from(productSet).sort();
    console.log('📊 [sheet-products] Found', products.length, 'unique products');

    res.json({
      success: true,
      data: {
        products,
        productColumn: effectiveHeaders[productColIndex],
        totalProducts: products.length,
        totalRows: rows.length - dataStartIndex
      }
    });
  } catch (error) {
    console.error('Erreur extraction produits sheets:', error.message);
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        message: 'Google Sheet non accessible. Vérifiez que le sheet est partagé en "Anyone with the link can view".'
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Extraire les villes uniques d'une source Google Sheets
router.post('/sheet-cities', requireEcomAuth, async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;
    if (!spreadsheetId) return res.status(400).json({ success: false, message: 'ID spreadsheet requis' });

    const json = await fetchSheetsJson(spreadsheetId, sheetName);
    const table = json.table;

    // Essayer cols.label d'abord
    const colHeaders = (table?.cols || []).map(c => c.label || '');
    const hasColLabels = colHeaders.some(h => h && h.trim());

    // Essayer première ligne comme headers
    let firstRowHeaders = [];
    if (table?.rows?.[0]?.c) {
      firstRowHeaders = table.rows[0].c.map(cell => cell?.f || (cell?.v != null ? String(cell.v) : ''));
    }

    const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cityKeywords = ['ville', 'city', 'commune', 'localite', 'zone', 'region', 'wilaya', 'gouvernorat', 'lieu', 'destination', 'livraison'];

    const findCityCol = (headers) => {
      const normalized = headers.map(h => normalize(h));
      for (const keyword of cityKeywords) {
        const idx = normalized.findIndex(h => h.includes(keyword));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    // Stratégie 1: cols.label
    let effectiveHeaders = colHeaders;
    let dataStartIndex = 0;
    let cityColIndex = hasColLabels ? findCityCol(colHeaders) : -1;

    // Stratégie 2: première ligne
    if (cityColIndex === -1 && firstRowHeaders.length > 0) {
      cityColIndex = findCityCol(firstRowHeaders);
      if (cityColIndex !== -1) {
        effectiveHeaders = firstRowHeaders;
        dataStartIndex = 1;
      }
    }

    if (cityColIndex === -1) {
      return res.json({
        success: true,
        data: { cities: [], message: 'Colonne ville non détectée' }
      });
    }

    // Extraire les villes uniques
    const citySet = new Set();
    const rows = table?.rows || [];
    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row?.c || !row.c[cityColIndex]) continue;
      const cell = row.c[cityColIndex];
      const value = (cell.f || (cell.v != null ? String(cell.v) : '')).trim();
      if (value) citySet.add(value);
    }

    const cities = Array.from(citySet).sort();
    console.log('📊 [sheet-cities] Found', cities.length, 'unique cities');

    res.json({
      success: true,
      data: {
        cities,
        cityColumn: effectiveHeaders[cityColIndex],
        totalCities: cities.length,
        totalRows: rows.length - dataStartIndex
      }
    });
  } catch (error) {
    console.error('Erreur extraction villes sheets:', error.message);
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        message: 'Google Sheet non accessible. Vérifiez que le sheet est partagé en "Anyone with the link can view".'
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// ===== GESTION DES SOURCES DE COMMANDES =====

// Lister toutes les sources du workspace (Google Sheets + OrderSource : Scalor, webhook, shopify)
router.get('/sources', requireEcomAuth, async (req, res) => {
  try {
    const [settings, orderSources] = await Promise.all([
      WorkspaceSettings.findOne({ workspaceId: req.workspaceId }),
      OrderSource.find({ workspaceId: req.workspaceId, isActive: true }).sort({ name: 1 }).lean()
    ]);

    const allSources = [];

    if (settings) {
      // Legacy Google Sheets source
      if (settings.googleSheets?.spreadsheetId) {
        allSources.push({
          _id: 'legacy',
          sourceType: 'legacy',
          name: 'Commandes Zendo',
          description: 'Source principale Google Sheets',
          color: '#10B981',
          icon: '📊',
          isActive: true,
          workspaceId: req.workspaceId,
          metadata: { type: 'google_sheets', spreadsheetId: settings.googleSheets.spreadsheetId, sheetName: settings.googleSheets.sheetName || 'Sheet1' }
        });
      }

      // Custom Google Sheets sources
      if (settings.sources?.length > 0) {
        settings.sources.forEach((source) => {
          if (source.isActive && source.spreadsheetId) {
            allSources.push({
              _id: source._id.toString(),
              sourceType: 'custom',
              name: source.name || 'Source Google Sheets',
              description: 'Source Google Sheets',
              color: source.color || '#3B82F6',
              icon: source.icon || '📱',
              isActive: true,
              workspaceId: req.workspaceId,
              metadata: { type: 'google_sheets', spreadsheetId: source.spreadsheetId, sheetName: source.sheetName || 'Sheet1' }
            });
          }
        });
      }
    }

    // Auto-créer la source "Scalor Store" si elle n'existe pas encore
    const hasScalorSource = orderSources.some(os => os.metadata?.type === 'scalor_store');
    if (!hasScalorSource) {
      try {
        const adminUser = await EcomUser.findOne({
          workspaceId: req.workspaceId,
          role: { $in: ['ecom_admin', 'super_admin'] },
          isActive: true
        }).select('_id').lean();
        if (adminUser) {
          const created = await OrderSource.create({
            name: 'Scalor Store',
            description: 'Commandes reçues via la boutique en ligne Scalor',
            color: '#0F6B4F',
            icon: '🛒',
            workspaceId: req.workspaceId,
            createdBy: adminUser._id,
            isActive: true,
            metadata: { type: 'scalor_store', createdAt: new Date() }
          });
          orderSources.push(created.toObject());
          console.log(`📦 [Assignments] Source Scalor Store auto-créée pour workspace ${req.workspaceId}`);
        }
      } catch (seedErr) {
        console.error('❌ [Assignments] Erreur auto-création Scalor Store:', seedErr.message);
      }
    }

    // Auto-créer la source "Shopify" si elle n'existe pas encore
    const hasShopifySource = orderSources.some(os => os.metadata?.type === 'shopify' || os.type === 'shopify');
    if (!hasShopifySource) {
      try {
        const adminUser = await EcomUser.findOne({
          workspaceId: req.workspaceId,
          role: { $in: ['ecom_admin', 'super_admin'] },
          isActive: true
        }).select('_id').lean();
        if (adminUser) {
          const created = await OrderSource.create({
            name: 'Shopify',
            description: 'Commandes reçues via Shopify',
            color: '#95BF47',
            icon: '🛍️',
            type: 'shopify',
            workspaceId: req.workspaceId,
            createdBy: adminUser._id,
            isActive: true,
            metadata: { type: 'shopify', createdAt: new Date() }
          });
          orderSources.push(created.toObject());
          console.log(`📦 [Assignments] Source Shopify auto-créée pour workspace ${req.workspaceId}`);
        }
      } catch (seedErr) {
        console.error('❌ [Assignments] Erreur auto-création Shopify:', seedErr.message);
      }
    }

    // OrderSource : Scalor Store, webhooks nommés, Shopify
    for (const os of orderSources) {
      allSources.push({
        _id: os._id.toString(),
        sourceType: os.type || 'webhook',
        name: os.name,
        description: os.description || '',
        color: os.color || '#6366F1',
        icon: os.icon || '🔗',
        isActive: os.isActive,
        workspaceId: req.workspaceId,
        metadata: os.metadata || {}
      });
    }

    res.json({ success: true, data: allSources });
  } catch (error) {
    console.error('Erreur liste sources:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une nouvelle source
router.post('/sources', requireEcomAuth, async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nom requis' });
    }

    const source = new OrderSource({
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#3B82F6',
      icon: icon || '📱',
      workspaceId: req.workspaceId,
      createdBy: req.ecomUser._id
    });

    await source.save();

    res.status(201).json({
      success: true,
      message: 'Source créée avec succès',
      data: source
    });
  } catch (error) {
    console.error('Erreur création source:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Modifier une source
router.put('/sources/:id', requireEcomAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, isActive } = req.body;

    const source = await OrderSource.findOne({ 
      _id: id, 
      workspaceId: req.workspaceId 
    });

    if (!source) {
      return res.status(404).json({ success: false, message: 'Source non trouvée' });
    }

    if (name) source.name = name.trim();
    if (description !== undefined) source.description = description.trim();
    if (color) source.color = color;
    if (icon) source.icon = icon;
    if (isActive !== undefined) source.isActive = isActive;

    await source.save();

    res.json({
      success: true,
      message: 'Source mise à jour avec succès',
      data: source
    });
  } catch (error) {
    console.error('Erreur modification source:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ===== GESTION DES AFFECTATIONS CLOSEUSES =====

// Lister toutes les affectations du workspace
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const [assignments, settings, orderSources] = await Promise.all([
      CloseuseAssignment.find({ workspaceId: req.workspaceId, isActive: true })
        .populate('closeuseId', 'name email')
        .populate('orderSources.assignedBy', 'name email')
        
        .populate('productAssignments.assignedBy', 'name email')
        .populate('cityAssignments.assignedBy', 'name email')
        .sort({ 'closeuseId.name': 1 })
        .lean(),
      WorkspaceSettings.findOne({ workspaceId: req.workspaceId }).lean(),
      OrderSource.find({ workspaceId: req.workspaceId, isActive: true }).lean()
    ]);

    // Construire un map sourceId → {name, icon, color} pour enrichir orderSources
    const sourceMap = {};
    if (settings?.googleSheets?.spreadsheetId) {
      sourceMap['legacy'] = { name: 'Commandes Zendo', icon: '📊', color: '#10B981' };
    }
    (settings?.sources || []).forEach(s => {
      sourceMap[s._id.toString()] = { name: s.name, icon: s.icon || '📱', color: s.color || '#3B82F6' };
    });
    orderSources.forEach(os => {
      sourceMap[os._id.toString()] = { name: os.name, icon: os.icon || '🔗', color: os.color || '#6366F1' };
    });

    // Enrichir chaque assignment avec les infos de source
    const enriched = assignments.map(a => ({
      ...a,
      orderSources: (a.orderSources || []).map(os => ({
        ...os,
        sourceInfo: sourceMap[String(os.sourceId)] || { name: String(os.sourceId), icon: '❓', color: '#9CA3AF' }
      }))
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Erreur liste affectations:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir l'affectation d'une closeuse spécifique
router.get('/closeuse/:closeuseId', requireEcomAuth, async (req, res) => {
  try {
    const { closeuseId } = req.params;

    const assignment = await CloseuseAssignment.findOne({ 
      closeuseId, 
      workspaceId: req.workspaceId, 
      isActive: true 
    })
    .populate('closeuseId', 'name email')
    .populate('orderSources.assignedBy', 'name email')
    
    .populate('productAssignments.assignedBy', 'name email')
    .populate('cityAssignments.assignedBy', 'name email');

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Affectation non trouvée' });
    }

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Erreur affectation closeuse:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer ou mettre à jour une affectation
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { closeuseId, orderSources, productAssignments, cityAssignments, notes, commission, commissionType } = req.body;

    if (!closeuseId) {
      return res.status(400).json({ success: false, message: 'ID closeuse requis' });
    }

    // Vérifier que la closeuse existe et a le bon rôle
    const closeuse = await EcomUser.findOne({ 
      _id: closeuseId, 
      role: 'ecom_closeuse',
      $or: [
        { workspaceId: req.workspaceId },
        { workspaces: { $elemMatch: { workspaceId: req.workspaceId, status: 'active' } } }
      ]
    });

    if (!closeuse) {
      return res.status(404).json({ success: false, message: 'Closeuse non trouvée dans ce workspace' });
    }

    // Chercher une affectation existante
    let assignment = await CloseuseAssignment.findOne({ 
      closeuseId, 
      workspaceId: req.workspaceId 
    });

    // Filtrer les sourceId vides pour éviter les erreurs de cast ObjectId
    const validOrderSources = (orderSources || [])
      .filter(s => s.sourceId && (s.sourceId === 'legacy' || s.sourceId.length >= 24))
      .map(source => ({
        sourceId: source.sourceId,
        assignedBy: req.ecomUser._id,
        assignedAt: new Date()
      }));

    const validProductAssignments = (productAssignments || [])
      .filter(pa => pa.sourceId && (pa.sourceId === 'legacy' || pa.sourceId.length >= 24))
      .map(pa => {
        const allIds = pa.productIds || [];
        const objectIds = [];
        const sheetNames = [];
        for (const id of allIds) {
          try {
            const oid = new mongoose.Types.ObjectId(String(id));
            objectIds.push(oid);
          } catch(e) {
            const s = String(id).trim();
            if (s) sheetNames.push(s);
          }
        }
        console.log(`📦 [PA POST] sourceId=${pa.sourceId} allIds=${allIds.length} typeof0="${typeof allIds[0]}" sample="${String(allIds[0]||'')}" objectIds=${objectIds.length}`);
        return {
          sourceId: pa.sourceId,
          productIds: objectIds,
          sheetProductNames: sheetNames,
          assignedBy: req.ecomUser._id,
          assignedAt: new Date()
        };
      });

    const validCityAssignments = (cityAssignments || [])
      .filter(ca => ca.sourceId && ca.sourceId.length >= 24)
      .map(ca => ({
        sourceId: ca.sourceId,
        cityNames: ca.cityNames || [],
        assignedBy: req.ecomUser._id,
        assignedAt: new Date()
      }));

    if (assignment) {
      // Mettre à jour l'affectation existante
      assignment.orderSources = validOrderSources;
      assignment.productAssignments = validProductAssignments;
      assignment.cityAssignments = validCityAssignments;
      if (notes !== undefined) assignment.notes = notes.trim();
      if (commission !== undefined) assignment.commission = Number(commission) || 0;
      if (commissionType !== undefined) assignment.commissionType = commissionType;
      assignment.isActive = true;
    } else {
      // Créer une nouvelle affectation
      assignment = new CloseuseAssignment({
        workspaceId: req.workspaceId,
        closeuseId,
        orderSources: validOrderSources,
        productAssignments: validProductAssignments,
        cityAssignments: validCityAssignments,
        notes: notes?.trim() || '',
        commission: Number(commission) || 0,
        commissionType: commissionType || 'percentage',
        isActive: true
      });
    }

    await assignment.save();

    // Recharger avec les populations
    const populatedAssignment = await CloseuseAssignment.findById(assignment._id)
      .populate('closeuseId', 'name email')
      .populate('orderSources.assignedBy', 'name email')
      
      .populate('productAssignments.assignedBy', 'name email');

    // Notifier la closeuse en temps réel
    const io = getIO();
    if (io) {
      io.to(`user:${closeuseId}`).emit('assignment:updated', {
        assignmentId: assignment._id,
        action: 'created',
        workspaceId: req.workspaceId
      });
    }

    res.json({
      success: true,
      message: 'Affectation enregistrée avec succès',
      data: populatedAssignment
    });
  } catch (error) {
    console.error('Erreur création affectation:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour une affectation existante
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const { closeuseId, orderSources, productAssignments, notes, commission, commissionType } = req.body;

    const assignment = await CloseuseAssignment.findOne({
      _id: id,
      workspaceId: req.workspaceId,
      isActive: true
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Affectation non trouvée' });
    }

    if (closeuseId) {
      assignment.closeuseId = closeuseId;
    }

    if (Array.isArray(orderSources)) {
      assignment.orderSources = orderSources.map(source => ({
        sourceId: source.sourceId,
        assignedBy: req.ecomUser._id,
        assignedAt: new Date()
      }));
    }

    if (Array.isArray(productAssignments)) {
      assignment.productAssignments = productAssignments
        .filter(item => item.sourceId && (item.sourceId === 'legacy' || item.sourceId.length >= 24))
        .map(item => {
          const allIds = item.productIds || [];
          const objectIds = [];
          const sheetNames = [];
          for (const id of allIds) {
            try {
              const oid = new mongoose.Types.ObjectId(String(id));
              objectIds.push(oid);
            } catch(e) {
              const s = String(id).trim();
              if (s) sheetNames.push(s);
            }
          }
          console.log(`📦 [PA PUT] sourceId=${item.sourceId} allIds=${allIds.length} typeof0="${typeof allIds[0]}" sample="${String(allIds[0]||'')}" objectIds=${objectIds.length} sheetNames=${sheetNames.length}`);
          return {
            sourceId: item.sourceId,
            productIds: objectIds,
            sheetProductNames: sheetNames,
            assignedBy: req.ecomUser._id,
            assignedAt: new Date()
          };
        });
    }

    if (notes !== undefined) {
      assignment.notes = typeof notes === 'string' ? notes.trim() : '';
    }

    if (commission !== undefined) {
      assignment.commission = Number(commission) || 0;
    }

    if (commissionType !== undefined) {
      assignment.commissionType = commissionType;
    }

    await assignment.save();

    const populatedAssignment = await CloseuseAssignment.findById(assignment._id)
      .populate('closeuseId', 'name email')
      .populate('orderSources.assignedBy', 'name email')
      
      .populate('productAssignments.assignedBy', 'name email');

    // Notifier la closeuse en temps réel
    const io = getIO();
    if (io) {
      const targetCloseuseId = String(assignment.closeuseId);
      io.to(`user:${targetCloseuseId}`).emit('assignment:updated', {
        assignmentId: assignment._id,
        action: 'updated',
        workspaceId: req.workspaceId
      });
    }

    res.json({
      success: true,
      message: 'Affectation mise à jour avec succès',
      data: populatedAssignment
    });
  } catch (error) {
    console.error('Erreur mise à jour affectation:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer une affectation
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const assignment = await CloseuseAssignment.findOne({ 
      _id: id, 
      workspaceId: req.workspaceId 
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Affectation non trouvée' });
    }

    const targetCloseuseId = String(assignment.closeuseId);
    assignment.isActive = false;
    await assignment.save();

    // Notifier la closeuse en temps réel
    const io = getIO();
    if (io) {
      io.to(`user:${targetCloseuseId}`).emit('assignment:updated', {
        assignmentId: assignment._id,
        action: 'deleted',
        workspaceId: req.workspaceId
      });
    }

    res.json({
      success: true,
      message: 'Affectation supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur suppression affectation:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ===== VUE POUR LA CLOSEUSE =====

// Obtenir les sources assignées à la closeuse connectée (pour OrdersList)
router.get('/my-sources', requireEcomAuth, async (req, res) => {
  try {
    // Uniquement pour les closeuses
    if (req.ecomUserRole !== 'ecom_closeuse') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux closeuses' });
    }

    // Find ALL assignments for this closeuse (one per source is possible)
    const allAssignments = await CloseuseAssignment.find({ 
      closeuseId: req.ecomUser._id, 
      workspaceId: req.workspaceId, 
      isActive: true 
    });

    if (!allAssignments || allAssignments.length === 0) {
      return res.json({
        success: true,
        data: { sources: [] }
      });
    }

    // Récupérer les sources depuis WorkspaceSettings + OrderSource
    const [settings, orderSources] = await Promise.all([
      WorkspaceSettings.findOne({ workspaceId: req.workspaceId }),
      OrderSource.find({ workspaceId: req.workspaceId, isActive: true }).lean()
    ]);

    // Merge all assigned source IDs from all assignments
    const assignedSourceIds = [...new Set(
      allAssignments.flatMap(a => (a.orderSources || []).map(os => String(os.sourceId)).filter(Boolean))
    )];

    const matchingSources = [];
    
    // Legacy source
    if (assignedSourceIds.includes('legacy') && settings?.googleSheets?.spreadsheetId) {
      matchingSources.push({
        _id: 'legacy',
        name: 'Commandes Zendo',
        spreadsheetId: settings.googleSheets.spreadsheetId,
        sheetName: settings.googleSheets.sheetName || 'Sheet1',
        lastSyncAt: settings.googleSheets.lastSyncAt,
        detectedHeaders: settings.googleSheets.detectedHeaders || [],
        detectedColumns: settings.googleSheets.detectedColumns || {}
      });
    }

    // Custom Google Sheets sources from WorkspaceSettings
    if (settings?.sources && settings.sources.length > 0) {
      settings.sources.forEach(source => {
        if (source.isActive && assignedSourceIds.includes(source._id.toString())) {
          matchingSources.push({
            _id: source._id.toString(),
            name: source.name,
            spreadsheetId: source.spreadsheetId,
            sheetName: source.sheetName || 'Sheet1',
            lastSyncAt: source.lastSyncAt,
            detectedHeaders: source.detectedHeaders || [],
            detectedColumns: source.detectedColumns || {}
          });
        }
      });
    }

    // OrderSource entries (Scalor Store, Shopify, webhooks, etc.)
    if (orderSources && orderSources.length > 0) {
      orderSources.forEach(os => {
        if (assignedSourceIds.includes(os._id.toString())) {
          matchingSources.push({
            _id: os._id.toString(),
            name: os.name,
            sourceType: os.type || 'webhook',
            description: os.description || '',
            color: os.color || '#6366F1',
            icon: os.icon || '🔗',
            metadata: os.metadata || {}
          });
        }
      });
    }

    res.json({
      success: true,
      data: { sources: matchingSources }
    });
  } catch (error) {
    console.error('Erreur mes sources:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir les sources et produits assignés à la closeuse connectée
router.get('/my-assignments', requireEcomAuth, async (req, res) => {
  try {
    // Uniquement pour les closeuses
    if (req.ecomUserRole !== 'ecom_closeuse') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux closeuses' });
    }

    const allAssignments = await CloseuseAssignment.find({ 
      closeuseId: req.ecomUser._id, 
      workspaceId: req.workspaceId, 
      isActive: true 
    })
    ;

    if (!allAssignments || allAssignments.length === 0) {
      return res.json({
        success: true,
        data: {
          orderSources: [],
          productAssignments: []
        }
      });
    }

    // Merge all assignments
    const orderSources = allAssignments.flatMap(a => a.orderSources || []);
    const productAssignments = allAssignments.flatMap(a => a.productAssignments || []);

    res.json({
      success: true,
      data: {
        orderSources,
        productAssignments
      }
    });
  } catch (error) {
    console.error('Erreur mes affectations:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /assignments/my — retourne l'assignment + commission de la closeuse connectée
router.get('/my', requireEcomAuth, async (req, res) => {
  try {
    const assignment = await CloseuseAssignment.findOne({
      closeuseId: req.ecomUser._id,
      workspaceId: req.workspaceId,
      isActive: true
    }).lean();

    if (!assignment) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        commission: assignment.commission || 0,
        commissionType: assignment.commissionType || 'percentage',
        orderSources: assignment.orderSources || [],
        notes: assignment.notes || ''
      }
    });
  } catch (error) {
    console.error('Erreur /my:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
