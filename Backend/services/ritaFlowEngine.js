/**
 * Rita Flow Engine — Moteur de décision data-driven
 * Évalue les règles configurées et exécute les actions correspondantes.
 *
 * Pipeline :  Message → Conditions → Actions → Logs
 */

import RitaFlow from '../models/RitaFlow.js';
import RitaContact from '../models/RitaContact.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from './evolutionApiService.js';
import { logRitaActivity } from './ritaBossReportService.js';

// ══════════════════════════════════════════════════════════════════════════════
// 1. Évaluation des conditions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si une condition est remplie pour un contexte donné.
 * @param {object} condition - { type, value }
 * @param {object} ctx       - { text, messageCount, hasOrdered, tags, inactivitySec, contact }
 * @returns {boolean}
 */
function matchCondition(condition, ctx) {
  switch (condition.type) {
    case 'keyword': {
      const keywords = Array.isArray(condition.value) ? condition.value : [condition.value];
      const lower = (ctx.text || '').toLowerCase();
      return keywords.some(k => lower.includes(String(k).toLowerCase()));
    }
    case 'keyword_not': {
      const keywords = Array.isArray(condition.value) ? condition.value : [condition.value];
      const lower = (ctx.text || '').toLowerCase();
      return !keywords.some(k => lower.includes(String(k).toLowerCase()));
    }
    case 'inactivity': {
      const duration = Number(condition.value) || 3600;
      return (ctx.inactivitySec || 0) >= duration;
    }
    case 'message_count_gt':
      return (ctx.messageCount || 0) > (Number(condition.value) || 0);
    case 'message_count_lt':
      return (ctx.messageCount || 0) < (Number(condition.value) || 999);
    case 'has_ordered':
      return !!ctx.hasOrdered;
    case 'has_not_ordered':
      return !ctx.hasOrdered;
    case 'tag_is': {
      const tag = String(condition.value || '').toLowerCase();
      return (ctx.tags || []).some(t => t.toLowerCase() === tag);
    }
    case 'always':
      return true;
    default:
      return false;
  }
}

/**
 * Évalue toutes les règles d'un flow et retourne les actions de la première règle qui matche.
 * Les règles sont triées par priorité décroissante.
 */
function evaluateRules(rules, ctx) {
  const sorted = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const rule of sorted) {
    if (matchCondition(rule.condition, ctx)) {
      return rule.actions || [];
    }
  }
  return [];
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Exécution des actions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère l'instance WhatsApp active pour un userId.
 */
async function getActiveInstance(userId) {
  const inst = await WhatsAppInstance.findOne({ userId, isActive: true }).lean();
  if (!inst) return null;
  return { instanceName: inst.instanceName, instanceToken: inst.instanceToken };
}

/**
 * Trouve ou crée un groupe dans la config pour un userId.
 */
async function resolveGroupInviteUrl(flowConfig, groupJid, inst) {
  const managed = flowConfig.groups?.find(g => g.groupJid === groupJid);
  if (managed?.inviteUrl) return managed.inviteUrl;

  // Générer le lien
  const result = await evolutionApiService.getGroupInviteCode(inst.instanceName, inst.instanceToken, groupJid);
  if (result.success && result.inviteUrl) {
    // Persister le lien
    await RitaFlow.updateOne(
      { userId: flowConfig.userId, 'groups.groupJid': groupJid },
      { $set: { 'groups.$.inviteUrl': result.inviteUrl } }
    );
    return result.inviteUrl;
  }
  return null;
}

/**
 * Exécute un tableau d'actions séquentiellement.
 * @param {Array} actions
 * @param {object} ctx  - Contexte complet (userId, phone, text, inst, flowConfig…)
 */
async function executeActions(actions, ctx) {
  const { userId, phone, inst, flowConfig } = ctx;
  const results = [];

  for (const action of actions) {
    try {
      switch (action.type) {

        case 'SEND_GROUP_INVITE_LINK': {
          if (!action.groupId) { results.push({ type: action.type, ok: false, reason: 'groupId manquant' }); break; }
          const inviteUrl = await resolveGroupInviteUrl(flowConfig, action.groupId, inst);
          if (inviteUrl) {
            const groupName = action.groupName || 'notre groupe';
            const msg = `👋 Rejoins ${groupName} ici 👇\n${inviteUrl}`;
            await evolutionApiService.sendMessage(inst.instanceName, inst.instanceToken, phone, msg);
            results.push({ type: action.type, ok: true, inviteUrl });
            logRitaActivity(userId, 'flow_group_invite', { customerPhone: phone, details: `Lien envoyé: ${action.groupId}` });
          } else {
            results.push({ type: action.type, ok: false, reason: 'impossible de générer le lien' });
          }
          break;
        }

        case 'ADD_TO_GROUP': {
          if (!action.groupId) { results.push({ type: action.type, ok: false, reason: 'groupId manquant' }); break; }
          const addResult = await evolutionApiService.addGroupParticipants(
            inst.instanceName, inst.instanceToken, action.groupId, [phone]
          );
          results.push({ type: action.type, ok: addResult.success });
          if (addResult.success) {
            logRitaActivity(userId, 'flow_group_add', { customerPhone: phone, details: `Ajouté au groupe: ${action.groupId}` });
          }
          break;
        }

        case 'SEND_MESSAGE': {
          if (!action.message) break;
          await evolutionApiService.sendMessage(inst.instanceName, inst.instanceToken, phone, action.message);
          results.push({ type: action.type, ok: true });
          break;
        }

        case 'TAG_CONTACT': {
          if (!action.tag) break;
          await RitaContact.findOneAndUpdate(
            { userId, phone },
            { $addToSet: { tags: action.tag } }
          );
          results.push({ type: action.type, ok: true, tag: action.tag });
          logRitaActivity(userId, 'flow_tag', { customerPhone: phone, details: `Tag: ${action.tag}` });
          break;
        }

        case 'WAIT': {
          const ms = Math.min((action.waitSeconds || 5) * 1000, 60000);
          await new Promise(r => setTimeout(r, ms));
          results.push({ type: action.type, ok: true, waited: ms });
          break;
        }

        case 'END_FLOW':
          results.push({ type: action.type, ok: true });
          return results; // Arrêt immédiat

        default:
          results.push({ type: action.type, ok: false, reason: 'type inconnu' });
      }
    } catch (err) {
      console.error(`❌ [FlowEngine] Erreur action ${action.type}:`, err.message);
      results.push({ type: action.type, ok: false, reason: err.message });
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Point d'entrée principal
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Évalue tous les flows actifs d'un utilisateur pour un trigger donné.
 * Appelé depuis le pipeline de messages (externalWhatsapp.js).
 *
 * @param {string} userId
 * @param {string} trigger - ex: 'message_received', 'order_confirmed', 'inactivity'
 * @param {object} messageCtx - { text, phone, pushName }
 * @returns {Promise<{executed: boolean, results: Array}>}
 */
export async function processFlows(userId, trigger, messageCtx) {
  try {
    const flowConfig = await RitaFlow.findOne({ userId, enabled: true }).lean();
    if (!flowConfig || !flowConfig.flows?.length) return { executed: false, results: [] };

    const inst = await getActiveInstance(userId);
    if (!inst) return { executed: false, results: [] };

    const phone = (messageCtx.phone || '').replace(/@.*$/, '');

    // Charger le contact pour enrichir le contexte
    const contact = await RitaContact.findOne({ userId, phone }).lean();

    const ctx = {
      text: messageCtx.text || '',
      messageCount: contact?.messageCount || 0,
      hasOrdered: contact?.hasOrdered || false,
      tags: contact?.tags || [],
      inactivitySec: messageCtx.inactivitySec || 0,
      contact,
    };

    const allResults = [];

    for (const flow of flowConfig.flows) {
      if (!flow.enabled) continue;
      if (!flow.triggers?.includes(trigger)) continue;

      const actions = evaluateRules(flow.rules || [], ctx);
      if (actions.length === 0) continue;

      console.log(`🔄 [FlowEngine] Flow "${flow.name}" déclenché (trigger=${trigger}) → ${actions.length} action(s)`);

      const results = await executeActions(actions, {
        userId,
        phone,
        inst,
        flowConfig,
      });

      allResults.push({ flow: flow.name, results });
    }

    return { executed: allResults.length > 0, results: allResults };

  } catch (err) {
    console.error(`❌ [FlowEngine] Erreur processFlows:`, err.message);
    return { executed: false, results: [], error: err.message };
  }
}

/**
 * Crée automatiquement un groupe pour un produit si la config le demande.
 * @param {string} userId
 * @param {string} productName
 */
export async function autoCreateGroupForProduct(userId, productName) {
  try {
    const flowConfig = await RitaFlow.findOne({ userId, enabled: true });
    if (!flowConfig?.settings?.autoCreateGroupPerProduct) return null;

    // Vérifier si un groupe existe déjà pour ce produit
    const existing = flowConfig.groups?.find(g =>
      g.name.toLowerCase().includes(productName.toLowerCase())
    );
    if (existing) return existing;

    const inst = await getActiveInstance(userId);
    if (!inst) return null;

    const template = flowConfig.settings.groupNameTemplate || '🛒 {productName} — Clients';
    const groupName = template.replace('{productName}', productName);

    const result = await evolutionApiService.createGroup(
      inst.instanceName, inst.instanceToken, groupName, [], `Groupe ${productName}`
    );

    if (!result.success) return null;

    const groupJid = result.data?.id || result.data?.groupId || result.data?.jid;
    if (!groupJid) return null;

    // Récupérer le lien d'invitation
    let inviteUrl = '';
    const inviteResult = await evolutionApiService.getGroupInviteCode(inst.instanceName, inst.instanceToken, groupJid);
    if (inviteResult.success) inviteUrl = inviteResult.inviteUrl;

    const newGroup = {
      groupJid,
      name: groupName,
      inviteUrl,
      role: 'custom',
      autoCreated: true,
      scheduledPosts: [],
    };

    flowConfig.groups.push(newGroup);
    await flowConfig.save();

    console.log(`🆕 [FlowEngine] Groupe auto-créé: "${groupName}" (${groupJid})`);
    logRitaActivity(userId, 'group_auto_created', { details: groupName });

    return newGroup;

  } catch (err) {
    console.error(`❌ [FlowEngine] Erreur autoCreateGroupForProduct:`, err.message);
    return null;
  }
}

export { matchCondition, evaluateRules, executeActions };
