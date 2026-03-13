/**
 * simpleWhatsappService.js — Stub
 * Redirige vers le service WhatsApp principal (evolutionApiService + whatsappService).
 * Ce fichier empêche le crash de routes/agent.js au démarrage.
 */

export async function handleIncomingMessage(body) {
  console.warn('⚠️ [SimpleWhatsApp] handleIncomingMessage non implémenté — utiliser agentWhatsappService');
  return { success: false, message: 'Service non configuré' };
}

export function initWhatsApp() {
  console.log('ℹ️ [SimpleWhatsApp] initWhatsApp — le service WhatsApp est géré par evolutionApiService');
}
