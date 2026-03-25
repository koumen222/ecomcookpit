/**
 * Import Routes - Dedicated routes for Google Sheets order import.
 * Separated from orders.js for clarity and maintainability.
 */

import express from 'express';
import { EventEmitter } from 'events';
import Order from '../models/Order.js';
import ImportHistory from '../models/ImportHistory.js';
import WorkspaceSettings from '../models/WorkspaceSettings.js';
import { memCache } from '../services/memoryCache.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { notifyImportCompleted, notifyNewOrder } from '../services/notificationHelper.js';
import {
  validateSpreadsheet,
  fetchSheetData,
  autoDetectColumns,
  validateColumnMapping,
  parseOrderRow,
  generatePreview
} from '../services/googleSheetsImport.js';

const router = express.Router();
const importProgressEmitter = new EventEmitter();
importProgressEmitter.setMaxListeners(50);

// Active import locks (in-memory, fast)
const activeImports = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────────

function emitProgress(workspaceId, sourceId, data) {
  importProgressEmitter.emit('progress', { workspaceId, sourceId, ...data });
}

function isImportLocked(workspaceId, sourceId) {
  const key = `${workspaceId}_${sourceId}`;
  const lock = activeImports.get(key);
  if (!lock) return false;
  // Auto-expire after 3 minutes
  if (Date.now() - lock.startedAt > 180000) {
    activeImports.delete(key);
    return false;
  }
  return true;
}

function acquireImportLock(workspaceId, sourceId, userId) {
  const key = `${workspaceId}_${sourceId}`;
  if (isImportLocked(workspaceId, sourceId)) return false;
  activeImports.set(key, { startedAt: Date.now(), userId });
  return true;
}

function releaseImportLock(workspaceId, sourceId) {
  activeImports.delete(`${workspaceId}_${sourceId}`);
}

// ─── SSE: Import Progress ───────────────────────────────────────────────────

router.get('/progress', (req, res) => {
  const { sourceId, workspaceId } = req.query;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ percentage: 0, status: 'Connexion établie...', current: 0, total: 0 })}\n\n`);

  const handler = (data) => {
    if (String(data.workspaceId) === String(workspaceId) && data.sourceId === sourceId) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (data.completed) setTimeout(() => res.end(), 1500);
    }
  };

  importProgressEmitter.on('progress', handler);

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);

  req.on('close', () => {
    importProgressEmitter.off('progress', handler);
    clearInterval(heartbeat);
  });

  // Auto-close after 3 minutes
  setTimeout(() => { if (!res.closed) res.end(); }, 180000);
});

// ─── POST /validate - Validate a spreadsheet URL/ID ─────────────────────────

router.post('/validate', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ success: false, message: 'ID ou URL du spreadsheet requis' });
    }

    const result = await validateSpreadsheet(spreadsheetId, sheetName);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur validation spreadsheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /preview - Fetch and preview sheet data with column detection ─────

router.post('/preview', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { spreadsheetId, sheetName, sourceId, sheetOrder } = req.body;

    let resolvedSpreadsheetId = spreadsheetId;
    let resolvedSheetName = sheetName;

    // If sourceId provided, resolve from settings
    if (sourceId && !spreadsheetId) {
      const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
      if (!settings) return res.status(404).json({ success: false, message: 'Paramètres non trouvés' });

      if (sourceId === 'legacy') {
        resolvedSpreadsheetId = settings.googleSheets?.spreadsheetId;
        resolvedSheetName = settings.googleSheets?.sheetName || 'Sheet1';
      } else {
        const source = settings.sources.id(sourceId);
        if (!source) return res.status(404).json({ success: false, message: 'Source non trouvée' });
        resolvedSpreadsheetId = source.spreadsheetId;
        resolvedSheetName = source.sheetName || 'Sheet1';
      }
    }

    if (!resolvedSpreadsheetId) {
      return res.status(400).json({ success: false, message: 'ID du spreadsheet requis' });
    }

    const sheetData = await fetchSheetData(resolvedSpreadsheetId, resolvedSheetName);
    const preview = generatePreview(sheetData, 5, sheetOrder);

    res.json({ success: true, data: preview });
  } catch (error) {
    console.error('Erreur preview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /run - Execute the import ─────────────────────────────────────────

router.post('/run', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  const startTime = Date.now();
  const { sourceId, spreadsheetId: manualSpreadsheetId, sheetName: manualSheetName, sourceName: requestedSourceName, sheetOrder } = req.body;

  if (!sourceId || typeof sourceId !== 'string') {
    return res.status(400).json({ success: false, message: 'sourceId requis' });
  }

  // Lock protection
  if (!acquireImportLock(req.workspaceId, sourceId, req.ecomUser?._id)) {
    return res.status(429).json({
      success: false,
      message: 'Un import est déjà en cours pour cette source. Veuillez patienter.'
    });
  }

  // Create import history record
  const importRecord = new ImportHistory({
    workspaceId: req.workspaceId,
    sourceId,
    status: 'in_progress',
    triggeredBy: req.ecomUser?._id,
    startedAt: new Date()
  });
  await importRecord.save();

  try {
    emitProgress(req.workspaceId, sourceId, { percentage: 2, status: 'Vérification des paramètres...', current: 0, total: 0 });

    // Resolve source
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });

    let sourceToSync = null;

    if (sourceId === 'manual') {
      // Manual input: create a persistent source entry
      if (!manualSpreadsheetId) throw new Error('ID du spreadsheet requis pour un import manuel');
      const resolvedSheetName = manualSheetName || 'Sheet1';

      // Find or create settings
      let ws = settings || new WorkspaceSettings({ workspaceId: req.workspaceId });

      // Check if a source with same spreadsheetId already exists
      const existingSource = ws.sources.find(s => s.spreadsheetId === manualSpreadsheetId);
      if (existingSource) {
        // Reuse existing source
        sourceToSync = existingSource;
      } else {
        // Create new source
        const importDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const finalName = (requestedSourceName && requestedSourceName.trim()) ? requestedSourceName.trim() : `Import ${importDate}`;
        ws.sources.push({
          name: finalName,
          type: 'google_sheets',
          spreadsheetId: manualSpreadsheetId,
          sheetName: resolvedSheetName,
          isActive: true
        });
        ws.markModified('sources');
        await ws.save();
        memCache.delByPrefix(`settings:${req.workspaceId}`);
        sourceToSync = ws.sources[ws.sources.length - 1];
      }
    } else if (sourceId === 'legacy') {
      if (!settings?.googleSheets?.spreadsheetId) {
        throw new Error('Source par défaut non configurée');
      }
      sourceToSync = {
        _id: 'legacy',
        name: 'Commandes Zendo',
        spreadsheetId: settings.googleSheets.spreadsheetId,
        sheetName: settings.googleSheets.sheetName || 'Sheet1'
      };
    } else {
      if (!settings) throw new Error('Paramètres du workspace introuvables');
      const source = settings.sources.id(sourceId);
      if (!source) throw new Error('Source non trouvée');
      if (!source.isActive) throw new Error('Source désactivée');
      sourceToSync = source;
    }

    importRecord.sourceId = String(sourceToSync._id);
    importRecord.sourceName = sourceToSync.name;
    importRecord.spreadsheetId = sourceToSync.spreadsheetId;

    emitProgress(req.workspaceId, sourceId, { percentage: 8, status: 'Connexion à Google Sheets...', current: 0, total: 0 });

    // Fetch data
    const sheetData = await fetchSheetData(sourceToSync.spreadsheetId, sourceToSync.sheetName);
    const { headers, rows, dataStartIndex } = sheetData;
    const totalDataRows = rows.length - dataStartIndex;

    if (totalDataRows <= 0) {
      importRecord.status = 'success';
      importRecord.totalRows = 0;
      importRecord.completedAt = new Date();
      importRecord.duration = Math.floor((Date.now() - startTime) / 1000);
      await importRecord.save();

      releaseImportLock(req.workspaceId, sourceId);
      emitProgress(req.workspaceId, sourceId, { percentage: 100, status: 'Spreadsheet vide, aucune commande à importer.', completed: true, current: 0, total: 0 });

      return res.json({
        success: true,
        message: 'Spreadsheet vide, rien à importer.',
        data: { successCount: 0, updatedCount: 0, errorCount: 0, duplicateCount: 0, errors: [], importId: importRecord._id }
      });
    }

    emitProgress(req.workspaceId, sourceId, { percentage: 20, status: `${totalDataRows} lignes détectées, analyse des colonnes...`, current: 0, total: totalDataRows });

    // Column detection - pass rows for content-based detection
    const columnMap = autoDetectColumns(headers, rows);
    const colValidation = validateColumnMapping(columnMap);
    importRecord.detectedHeaders = headers.filter(h => h);
    importRecord.columnMapping = columnMap;
    importRecord.totalRows = totalDataRows;

    emitProgress(req.workspaceId, sourceId, { percentage: 30, status: 'Traitement des commandes...', current: 0, total: totalDataRows });

    // Parse all rows - respecter l'ordre choisi
    const parsedRows = [];
    const errors = [];
    let duplicateCount = 0;
    let skippedCount = 0;
    const seenPhones = new Set();

    // Déterminer l'ordre de parcours des lignes
    const rowIndices = [];
    if (sheetOrder === 'oldest_first') {
      // Plus anciennes d'abord = partir du bas du sheet
      for (let i = rows.length - 1; i >= dataStartIndex; i--) {
        rowIndices.push(i);
      }
    } else {
      // Plus récentes d'abord (par défaut) = partir du haut
      for (let i = dataStartIndex; i < rows.length; i++) {
        rowIndices.push(i);
      }
    }

    for (let idx = 0; idx < rowIndices.length; idx++) {
      const i = rowIndices[idx];
      const rowIdx = idx; // Position dans l'ordre de traitement

      // Progress every 5%
      if (rowIdx % Math.max(1, Math.ceil(totalDataRows / 20)) === 0) {
        const pct = 30 + Math.floor((rowIdx / totalDataRows) * 40);
        emitProgress(req.workspaceId, sourceId, {
          percentage: pct,
          status: `Traitement ligne ${rowIdx + 1}/${totalDataRows}...`,
          current: rowIdx + 1,
          total: totalDataRows
        });
      }

      const parsed = parseOrderRow(rows[i], i + 1, columnMap, headers, sourceToSync.name);

      if (!parsed.success) {
        if (parsed.error !== 'Ligne vide') {
          errors.push({ row: parsed.row, field: '', message: parsed.error, rawData: parsed.rawData || {} });
        } else {
          skippedCount++;
        }
        continue;
      }

      const doc = parsed.data;
      const sheetRowId = `source_${sourceToSync._id}_row_${i + 1}`;
      const sheetRowIndex = i + 1; // Original row number from Google Sheet

      // Duplicate detection based on phone within same import
      const phoneKey = doc.clientPhone ? doc.clientPhone.replace(/\s/g, '') : '';
      if (phoneKey && seenPhones.has(phoneKey + '_' + doc.product)) {
        duplicateCount++;
      }
      if (phoneKey) seenPhones.add(phoneKey + '_' + doc.product);

      parsedRows.push({ doc, sheetRowId, sheetRowIndex });
    }

    // Batch lookup: find all orders that were manually modified (single query instead of N queries)
    emitProgress(req.workspaceId, sourceId, { percentage: 72, status: 'Vérification des modifications manuelles...', current: totalDataRows, total: totalDataRows });

    const allSheetRowIds = parsedRows.map(r => r.sheetRowId);
    const manuallyModifiedOrders = new Set();
    if (allSheetRowIds.length > 0) {
      const modified = await Order.find({
        workspaceId: req.workspaceId,
        sheetRowId: { $in: allSheetRowIds },
        statusModifiedManually: true
      }).select('sheetRowId').lean();
      modified.forEach(o => manuallyModifiedOrders.add(o.sheetRowId));
    }

    // Build bulk operations
    const bulkOps = parsedRows.map(({ doc, sheetRowId, sheetRowIndex }) => {
      const updateDoc = { ...doc };
      delete updateDoc.currency; // Ne pas utiliser la devise détectée
      if (manuallyModifiedOrders.has(sheetRowId)) {
        delete updateDoc.status;
      }
      return {
        updateOne: {
          filter: { workspaceId: req.workspaceId, sheetRowId },
          update: {
            $set: {
              ...updateDoc,
              workspaceId: req.workspaceId,
              sheetRowId,
              sheetRowIndex,
              source: 'google_sheets',
              currency: req.ecomUser?.currency || 'XAF'
            }
          },
          upsert: true
        }
      };
    });

    // Bulk write
    let successCount = 0;
    let updatedCount = 0;
    const newOrderIds = [];

    if (bulkOps.length > 0) {
      emitProgress(req.workspaceId, sourceId, { percentage: 75, status: 'Sauvegarde en base de données...', current: totalDataRows, total: totalDataRows });

      // Process in batches of 500 for very large imports
      const BATCH_SIZE = 500;
      for (let b = 0; b < bulkOps.length; b += BATCH_SIZE) {
        const batch = bulkOps.slice(b, b + BATCH_SIZE);
        const result = await Order.bulkWrite(batch);
        successCount += result.upsertedCount || 0;
        updatedCount += result.modifiedCount || 0;
        
        // Collecter les IDs des nouvelles commandes créées
        if (result.upsertedIds) {
          Object.values(result.upsertedIds).forEach(id => newOrderIds.push(id));
        }
      }

      emitProgress(req.workspaceId, sourceId, { percentage: 88, status: 'Mise à jour des métadonnées...', current: totalDataRows, total: totalDataRows });

      // Update source sync time
      const latestSettings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
      if (latestSettings) {
        if (sourceToSync._id === 'legacy') {
          latestSettings.googleSheets.lastSyncAt = new Date();
          latestSettings.markModified('googleSheets');
        } else {
          const s = latestSettings.sources.id(sourceToSync._id);
          if (s) {
            s.lastSyncAt = new Date();
            s.detectedHeaders = headers.filter(h => h);
            s.detectedColumns = columnMap;
          }
          latestSettings.markModified('sources');
        }
        await latestSettings.save();
        memCache.delByPrefix(`settings:${req.workspaceId}`);
      }
    }

    // Notifications pour chaque nouvelle commande
    if (newOrderIds.length > 0) {
      emitProgress(req.workspaceId, sourceId, { percentage: 92, status: 'Envoi des notifications...', current: totalDataRows, total: totalDataRows });

      try {
        // Récupérer les nouvelles commandes pour envoyer les notifications
        const newOrders = await Order.find({ _id: { $in: newOrderIds } })
          .select('clientName product quantity price city status')
          .limit(50) // Limiter à 50 notifications max pour éviter le spam
          .lean();
        
        console.log(`📱 Envoi de ${newOrders.length} notifications pour nouvelles commandes`);
        
        // Envoyer une notification pour chaque nouvelle commande (en parallèle)
        await Promise.allSettled(
          newOrders.map(order => notifyNewOrder(req.workspaceId, order))
        );
        
        console.log(`✅ ${newOrders.length} notifications envoyées`);
      } catch (notifErr) {
        console.error('Notification error (non-blocking):', notifErr.message);
      }
      
      // Notification globale d'import terminé
      try {
        const { sendPushNotification } = await import('../services/pushService.js');
        await sendPushNotification(req.workspaceId, {
          title: 'Import terminé',
          body: `${successCount} nouvelles commandes importées, ${updatedCount} mises à jour`,
          tag: 'import-completed',
          data: { type: 'import-completed', sourceId, imported: successCount, updated: updatedCount }
        });
      } catch (pushErr) {
        console.error('Push notification error (non-blocking):', pushErr.message);
      }
    }

    // Notification interne
    if (successCount > 0 || updatedCount > 0) {
      notifyImportCompleted(req.workspaceId, { imported: successCount, updated: updatedCount, errors: errors.length }).catch(() => {});
    }

    // Finalize import record
    const duration = Math.floor((Date.now() - startTime) / 1000);
    importRecord.successCount = successCount;
    importRecord.updatedCount = updatedCount;
    importRecord.errorCount = errors.length;
    importRecord.duplicateCount = duplicateCount;
    importRecord.skippedCount = skippedCount;
    importRecord.errors = errors.slice(0, 100); // Cap stored errors
    importRecord.completedAt = new Date();
    importRecord.duration = duration;
    importRecord.status = errors.length > 0 && successCount === 0 ? 'failed'
      : errors.length > 0 ? 'partial'
      : 'success';
    await importRecord.save();

    releaseImportLock(req.workspaceId, sourceId);

    emitProgress(req.workspaceId, sourceId, {
      percentage: 100,
      status: `Terminé ! ${successCount} nouvelles, ${updatedCount} mises à jour${errors.length > 0 ? `, ${errors.length} erreurs` : ''}`,
      completed: true,
      current: totalDataRows,
      total: totalDataRows
    });

    res.json({
      success: true,
      message: `Import terminé en ${duration}s: ${successCount} nouvelles commandes, ${updatedCount} mises à jour.`,
      data: {
        successCount,
        updatedCount,
        errorCount: errors.length,
        duplicateCount,
        skippedCount,
        totalRows: totalDataRows,
        duration,
        errors: errors.slice(0, 50),
        importId: importRecord._id,
        sourceId: String(sourceToSync._id),
        sourceName: sourceToSync.name
      }
    });

  } catch (error) {
    console.error('Erreur critique import:', error);

    importRecord.status = 'failed';
    importRecord.errors = [{ row: 0, field: '', message: error.message }];
    importRecord.completedAt = new Date();
    importRecord.duration = Math.floor((Date.now() - startTime) / 1000);
    await importRecord.save();

    releaseImportLock(req.workspaceId, sourceId);

    emitProgress(req.workspaceId, sourceId, {
      percentage: 100,
      status: `Erreur: ${error.message}`,
      completed: true,
      current: 0,
      total: 0
    });

    res.status(500).json({
      success: false,
      message: `Erreur import: ${error.message}`,
      data: { importId: importRecord._id }
    });
  }
});

// ─── GET /history - Import history ──────────────────────────────────────────

router.get('/history', requireEcomAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sourceId } = req.query;
    const filter = { workspaceId: req.workspaceId };
    if (sourceId) filter.sourceId = sourceId;

    const imports = await ImportHistory.find(filter)
      .populate('triggeredBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await ImportHistory.countDocuments(filter);

    res.json({
      success: true,
      data: {
        imports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Erreur history:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── GET /history/:id - Single import detail ────────────────────────────────

router.get('/history/:id', requireEcomAuth, async (req, res) => {
  try {
    const record = await ImportHistory.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).populate('triggeredBy', 'name email');

    if (!record) return res.status(404).json({ success: false, message: 'Import non trouvé' });
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Erreur history detail:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── POST /cleanup-apostrophes - Clean up existing orders with apostrophes ───

router.post('/cleanup-apostrophes', requireEcomAuth, async (req, res) => {
  try {
    console.log(`🧹 [CLEANUP] Starting apostrophe cleanup for workspace ${req.workspaceId}`);
    
    // Find all orders with apostrophes in phone or price fields
    const orders = await Order.find({
      workspaceId: req.workspaceId,
      $or: [
        { clientPhone: /^'/ },
        { clientPhone: /^\+'/ },
        { price: /^'/ },
        { 'rawData.Phone': /^'/ },
        { 'rawData.Phone': /^\+'/ },
        { 'rawData.Product Price': /^'/ }
      ]
    });

    console.log(`🧹 [CLEANUP] Found ${orders.length} orders with apostrophes`);
    
    let cleaned = 0;
    for (const order of orders) {
      let needsUpdate = false;
      
      // Clean phone
      if (order.clientPhone && order.clientPhone.startsWith("'")) {
        order.clientPhone = order.clientPhone.replace(/^'+/, '').replace(/\D/g, '');
        needsUpdate = true;
      }
      if (order.clientPhone && order.clientPhone.startsWith("+'")) {
        order.clientPhone = order.clientPhone.replace(/^\+'/, '+').replace(/\D/g, '');
        needsUpdate = true;
      }
      
      // Clean price
      if (order.price && typeof order.price === 'string' && order.price.startsWith("'")) {
        order.price = parseFloat(order.price.replace(/^'+/, '').replace(/[^0-9.,]/g, '')) || 0;
        needsUpdate = true;
      }
      
      // Clean rawData
      if (order.rawData) {
        for (const key of Object.keys(order.rawData)) {
          if (typeof order.rawData[key] === 'string' && order.rawData[key].startsWith("'")) {
            order.rawData[key] = order.rawData[key].replace(/^'+/, '');
            needsUpdate = true;
          }
        }
      }
      
      if (needsUpdate) {
        await order.save();
        cleaned++;
      }
    }
    
    console.log(`✅ [CLEANUP] Cleaned ${cleaned} orders`);
    res.json({ 
      success: true, 
      message: `${cleaned} commandes nettoyées`, 
      cleaned,
      total: orders.length 
    });
  } catch (error) {
    console.error('❌ [CLEANUP] Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
