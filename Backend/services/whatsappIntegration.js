import {
  checkInstanceConnection,
  executeInstanceAction,
  sendInstanceMessage
} from './externalConnectorService.js';

/**
 * Compatibility wrapper used by existing routes.
 */
export async function verifyWhatsAppConfig({ instanceId, apiKey }) {
  const result = await checkInstanceConnection({ instanceId, apiKey });
  return result.data;
}

/**
 * Compatibility wrapper used by existing routes/campaigns.
 */
export async function sendWhatsAppMessageV2({ instanceId, apiKey }, number, text) {
  const result = await sendInstanceMessage({ instanceId, apiKey }, number, text);
  return result.data;
}

/**
 * Generic action executor for future use (status/info/send_message).
 */
export async function executeWhatsAppAction({ instanceId, apiKey }, action, params = {}) {
  const result = await executeInstanceAction({ instanceId, apiKey }, action, params);
  return result.data;
}
