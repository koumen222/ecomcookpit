/**
 * Google Sheets Polling Service
 * Automatically polls Google Sheets for new orders and sends notifications
 */

import WorkspaceSettings from '../models/WorkspaceSettings.js';
import Order from '../models/Order.js';
import { fetchSheetData, parseOrderRow, autoDetectColumns } from './googleSheetsImport.js';
import { notifyNewOrder } from './notificationHelper.js';

const POLLING_INTERVALS = {
  '1min': 60 * 1000,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1hour': 60 * 60 * 1000
};

let pollingTimers = new Map(); // workspaceId -> timer
let isRunning = false;

/**
 * Poll a single workspace for new orders from Google Sheets
 */
async function pollWorkspace(workspaceId) {
  try {
    const settings = await WorkspaceSettings.findOne({ workspaceId });
    if (!settings || !settings.autoSync?.enabled) {
      return;
    }

    // Check each configured source
    for (const source of settings.sources || []) {
      if (!source.isActive || !source.spreadsheetId) continue;

      try {
        console.log(`📊 [POLL] Checking ${source.name} for workspace ${workspaceId}`);
        
        // Fetch sheet data
        const sheetData = await fetchSheetData(source.spreadsheetId, source.sheetName);
        if (!sheetData.rows || sheetData.rows.length === 0) continue;

        // Get last known row count
        const lastRowCount = source.lastRowCount || 0;
        const currentRowCount = sheetData.rows.length - (sheetData.dataStartIndex || 0);

        // If we have more rows than before, there are new orders
        if (currentRowCount > lastRowCount) {
          console.log(`🆕 [POLL] ${currentRowCount - lastRowCount} new rows detected in ${source.name}`);
          
          // Parse only new rows
          const newRows = sheetData.rows.slice(sheetData.dataStartIndex + lastRowCount);
          const columnMap = source.detectedColumns || autoDetectColumns(sheetData.headers);
          
          for (let i = 0; i < newRows.length; i++) {
            const rowIndex = lastRowCount + i;
            const parsed = parseOrderRow(newRows[i], rowIndex, columnMap, sheetData.headers, source.name);
            
            if (parsed.success && parsed.data) {
              // Check if order already exists by orderId
              const existingOrder = await Order.findOne({
                workspaceId,
                orderId: parsed.data.orderId
              });
              
              if (!existingOrder) {
                // Send notification for new order
                if (settings.autoSync?.notifyOnChanges !== false) {
                  await notifyNewOrder(workspaceId, {
                    _id: parsed.data.orderId,
                    clientName: parsed.data.clientName,
                    product: parsed.data.product,
                    quantity: parsed.data.quantity
                  });
                  console.log(`🔔 [POLL] Notification sent for new order: ${parsed.data.orderId}`);
                }
              }
            }
          }

          // Update last row count
          source.lastRowCount = currentRowCount;
          source.lastSyncAt = new Date();
        }
      } catch (sourceError) {
        console.error(`❌ [POLL] Error polling source ${source.name}:`, sourceError.message);
      }
    }

    // Save updated settings
    settings.autoSync.lastRunAt = new Date();
    await settings.save();

  } catch (error) {
    console.error(`❌ [POLL] Error polling workspace ${workspaceId}:`, error.message);
  }
}

/**
 * Start polling for a workspace
 */
function startWorkspacePolling(workspaceId, interval) {
  const intervalMs = POLLING_INTERVALS[interval] || POLLING_INTERVALS['5min'];
  
  // Clear existing timer if any
  if (pollingTimers.has(workspaceId)) {
    clearInterval(pollingTimers.get(workspaceId));
  }

  console.log(`⏰ [POLL] Starting polling for workspace ${workspaceId} every ${intervalMs / 1000}s`);
  
  // Do initial poll
  pollWorkspace(workspaceId);
  
  // Set up recurring poll
  const timer = setInterval(() => {
    pollWorkspace(workspaceId);
  }, intervalMs);
  
  pollingTimers.set(workspaceId, timer);
}

/**
 * Stop polling for a workspace
 */
function stopWorkspacePolling(workspaceId) {
  if (pollingTimers.has(workspaceId)) {
    clearInterval(pollingTimers.get(workspaceId));
    pollingTimers.delete(workspaceId);
    console.log(`🛑 [POLL] Stopped polling for workspace ${workspaceId}`);
  }
}

/**
 * Initialize polling for all workspaces with autoSync enabled
 */
async function initializePolling() {
  if (isRunning) return;
  
  console.log('🚀 [POLL] Initializing Google Sheets polling service...');
  
  try {
    const allSettings = await WorkspaceSettings.find({
      'autoSync.enabled': true
    });

    for (const settings of allSettings) {
      if (settings.workspaceId) {
        startWorkspacePolling(
          settings.workspaceId.toString(),
          settings.autoSync.interval || '5min'
        );
      }
    }

    isRunning = true;
    console.log(`✅ [POLL] Polling initialized for ${allSettings.length} workspaces`);
  } catch (error) {
    console.error('❌ [POLL] Error initializing polling:', error.message);
  }
}

/**
 * Add or update polling for a workspace (call when settings change)
 */
export async function updateWorkspacePolling(workspaceId) {
  try {
    const settings = await WorkspaceSettings.findOne({ workspaceId });
    
    if (!settings || !settings.autoSync?.enabled) {
      stopWorkspacePolling(workspaceId);
      return;
    }

    startWorkspacePolling(workspaceId, settings.autoSync.interval || '5min');
  } catch (error) {
    console.error('❌ [POLL] Error updating polling:', error.message);
  }
}

/**
 * Stop all polling (for server shutdown)
 */
export function stopAllPolling() {
  console.log('🛑 [POLL] Stopping all polling...');
  for (const [workspaceId, timer] of pollingTimers) {
    clearInterval(timer);
    console.log(`  - Stopped workspace ${workspaceId}`);
  }
  pollingTimers.clear();
  isRunning = false;
}

// Auto-initialize when module is imported (but only after DB is ready)
export function startPollingService() {
  // Give DB connection time to establish
  setTimeout(() => {
    initializePolling();
  }, 5000);
}

export default {
  startPollingService,
  updateWorkspacePolling,
  stopAllPolling
};
