/**
 * Import Routes - Dedicated routes for Google Sheets order import.
 * Separated from orders.js for clarity and maintainability.
 */

import express from 'express';
import { EventEmitter } from 'events';
import Order from '../models/Order.js';
import ImportHistory from '../models/ImportHistory.js';
import WorkspaceSettings from '../models/WorkspaceSettings.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { notifyImportCompleted } from '../services/notificationHelper.js';
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
    const { spreadsheetId, sheetName, sourceId } = req.body;

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
    const preview = generatePreview(sheetData, 5);

    res.json({ success: true, data: preview });
  } catch (error) {
    console.error('Erreur preview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /run - Execute the import ─────────────────────────────────────────

router.post('/run', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  const startTime = Date.now();
  const { sourceId, spreadsheetId: manualSpreadsheetId, sheetName: manualSheetName, sourceName: requestedSourceName } = req.body;

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

    // Column detection
    const columnMap = autoDetectColumns(headers);
    const colValidation = validateColumnMapping(columnMap);
    importRecord.detectedHeaders = headers.filter(h => h);
    importRecord.columnMapping = columnMap;
    importRecord.totalRows = totalDataRows;

    if (!colValidation.valid) {
      importRecord.status = 'failed';
      importRecord.errors = [{ row: 0, field: 'columns', message: `Colonnes manquantes: ${colValidation.missing.join(', ')}` }];
      importRecord.completedAt = new Date();
      importRecord.duration = Math.floor((Date.now() - startTime) / 1000);
      await importRecord.save();

      releaseImportLock(req.workspaceId, sourceId);
      emitProgress(req.workspaceId, sourceId, { percentage: 100, status: `Colonnes requises manquantes: ${colValidation.missing.join(', ')}`, completed: true, current: 0, total: totalDataRows });

      return res.status(400).json({
        success: false,
        message: `Colonnes requises manquantes: ${colValidation.missing.join(', ')}`,
        data: { validation: colValidation, importId: importRecord._id }
      });
    }

    emitProgress(req.workspaceId, sourceId, { percentage: 30, status: 'Traitement des commandes...', current: 0, total: totalDataRows });

    // Parse all rows
    const parsedRows = [];
    const errors = [];
    let duplicateCount = 0;
    let skippedCount = 0;
    const seenPhones = new Set();

    for (let i = dataStartIndex; i < rows.length; i++) {
      const rowIdx = i - dataStartIndex;

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

      // Duplicate detection based on phone within same import
      const phoneKey = doc.clientPhone ? doc.clientPhone.replace(/\s/g, '') : '';
      if (phoneKey && seenPhones.has(phoneKey + '_' + doc.product)) {
        duplicateCount++;
      }
      if (phoneKey) seenPhones.add(phoneKey + '_' + doc.product);

      parsedRows.push({ doc, sheetRowId });
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
    const bulkOps = parsedRows.map(({ doc, sheetRowId }) => {
      const updateDoc = { ...doc };
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
              source: 'google_sheets'
            }
          },
          upsert: true
        }
      };
    });

    // Bulk write
    let successCount = 0;
    let updatedCount = 0;

    if (bulkOps.length > 0) {
      emitProgress(req.workspaceId, sourceId, { percentage: 75, status: 'Sauvegarde en base de données...', current: totalDataRows, total: totalDataRows });

      // Process in batches of 500 for very large imports
      const BATCH_SIZE = 500;
      for (let b = 0; b < bulkOps.length; b += BATCH_SIZE) {
        const batch = bulkOps.slice(b, b + BATCH_SIZE);
        const result = await Order.bulkWrite(batch);
        successCount += result.upsertedCount || 0;
        updatedCount += result.modifiedCount || 0;
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
      }
    }

    // Notifications for new orders
    if (successCount > 0) {
      emitProgress(req.workspaceId, sourceId, { percentage: 92, status: 'Envoi des notifications...', current: totalDataRows, total: totalDataRows });

      try {
        const { sendPushNotification } = await import('../../services/pushService.js');
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

export default router;
