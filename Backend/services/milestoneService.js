// ─────────────────────────────────────────────────────────────────────────────
// JALONS MARCHANDS — première commande, 100e commande, 1 000 000 FCFA de CA…
//
// PRINCIPES
// · Une table DÉCLARATIVE : ajouter un palier = ajouter une ligne, rien d'autre.
// · Un jalon ne se déclenche qu'UNE fois par workspace, même sous concurrence :
//   l'idempotence repose sur un updateOne conditionnel atomique
//   ({ reachedMilestones: { $ne: key } } + $addToSet) — le premier appel gagne,
//   tous les autres voient modifiedCount = 0 et se taisent. Pas de verrou, pas
//   de cache mémoire à perdre au restart.
// · Le CA suit la DÉFINITION CANONIQUE des dashboards (routes/orders.js) :
//   commandes `delivered` uniquement, price × quantity, converti dans la devise
//   d'affichage FCFA (XAF) — un marchand multi-devises compte juste.
// · Tout est fire-and-forget : une erreur ici ne doit JAMAIS faire échouer la
//   création d'une commande. Chaque entrée est loguée, jamais relancée.
//
// POINTS D'ACCROCHE (voir models/Order.js et notificationHelper.js) :
// · création de commande  → checkMilestones(wsId, { families: ['orders'] })
// · commande livrée       → checkMilestones(wsId, { families: ['revenue'] })
// · après un import en masse (bulkWrite, hors hooks Mongoose) → les routes
//   d'import appellent checkMilestones(wsId) explicitement.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Workspace from '../models/Workspace.js';
import { createNotification } from './notificationHelper.js';
import { sendPushNotification } from './pushService.js';
import { convertCurrency } from '../utils/currencyConvert.js';

const FCFA = 'XAF';
const fmt = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// ── LA TABLE ─────────────────────────────────────────────────────────────────
// key       : identifiant persisté dans Workspace.reachedMilestones — NE JAMAIS
//             renommer une clé déjà en production (le jalon se redéclencherait).
// threshold : seuil numérique de la famille.
// push      : envoie aussi une notification push (les jalons majeurs).
// title/msg : ce que le marchand lit. Le ton est celui d'une victoire — c'est
//             la seule notification du produit qui n'est ni une tâche ni une
//             alerte, elle peut se permettre d'être chaleureuse.
export const MILESTONES = {
  orders: [
    { key: 'orders_1', threshold: 1, push: true,
      title: '🎉 Ta première commande !',
      message: (v) => 'Ça y est — ta boutique a vendu. La première commande est toujours la plus dure : celle-ci prouve que ça marche.' },
    { key: 'orders_10', threshold: 10, push: true,
      title: '🔟 10 commandes !',
      message: () => 'Dix clients t’ont fait confiance. Le produit trouve son public — continue.' },
    { key: 'orders_50', threshold: 50, push: true,
      title: '🚀 50 commandes !',
      message: () => 'Cinquante commandes. Ce n’est plus un test, c’est un vrai business.' },
    { key: 'orders_100', threshold: 100, push: true,
      title: '💯 100 commandes !',
      message: () => 'Cent commandes ! Tu fais officiellement partie des boutiques qui tournent.' },
    { key: 'orders_500', threshold: 500, push: true,
      title: '🏆 500 commandes !',
      message: () => 'Cinq cents commandes. Peu de marchands arrivent ici — bravo.' },
    { key: 'orders_1000', threshold: 1000, push: true,
      title: '👑 1 000 commandes !',
      message: () => 'Mille commandes. Ta boutique est une machine — chapeau.' },
    { key: 'orders_5000', threshold: 5000, push: true,
      title: '🌟 5 000 commandes !',
      message: () => 'Cinq mille commandes. À ce niveau, ce n’est plus une boutique, c’est une référence.' },
  ],
  revenue: [
    { key: 'revenue_100k', threshold: 100_000, push: true,
      title: '💰 100 000 FCFA de ventes livrées !',
      message: (v) => `Ton chiffre d’affaires livré vient de passer ${fmt(v)}. Les premières centaines de milliers sont les plus dures.` },
    { key: 'revenue_500k', threshold: 500_000, push: true,
      title: '💰 500 000 FCFA de ventes livrées !',
      message: (v) => `${fmt(v)} de commandes livrées. Le million est en vue.` },
    { key: 'revenue_1m', threshold: 1_000_000, push: true,
      title: '🥇 1 MILLION de FCFA !',
      message: (v) => `Ton chiffre d’affaires livré dépasse ${fmt(v)}. Millionnaire en ventes — c’est un cap que la plupart ne passent jamais. Fier de toi.` },
    { key: 'revenue_5m', threshold: 5_000_000, push: true,
      title: '💎 5 millions de FCFA !',
      message: (v) => `${fmt(v)} livrés. Ta boutique change d’échelle.` },
    { key: 'revenue_10m', threshold: 10_000_000, push: true,
      title: '🏅 10 millions de FCFA !',
      message: (v) => `${fmt(v)} de ventes livrées. Dix millions — ton sérieux paie, littéralement.` },
    { key: 'revenue_25m', threshold: 25_000_000, push: true,
      title: '🚁 25 millions de FCFA !',
      message: (v) => `${fmt(v)} livrés. Un quart de cent millions — la barre des grands.` },
    { key: 'revenue_50m', threshold: 50_000_000, push: true,
      title: '🦁 50 millions de FCFA !',
      message: (v) => `${fmt(v)} de chiffre livré. Ta boutique joue dans la cour des lions.` },
    { key: 'revenue_100m', threshold: 100_000_000, push: true,
      title: '🌍 100 MILLIONS de FCFA !',
      message: (v) => `${fmt(v)}. Cent millions de FCFA livrés — une success story, tout simplement. Merci de la construire avec Scalor.` },
  ],
};

// ── MÉTRIQUES ────────────────────────────────────────────────────────────────
// Compte total de commandes : toutes sources, tous statuts — « ta première
// commande » se fête à la commande, pas à la livraison.
async function countOrders(workspaceId) {
  return Order.countDocuments({ workspaceId });
}

// CA livré en FCFA : agrégé par devise côté Mongo (une ligne par devise, pas
// un chargement de toutes les commandes), converti ensuite — même logique que
// le dashboard stats, sans son coût mémoire.
async function deliveredRevenueFcfa(workspaceId) {
  const rows = await Order.aggregate([
    { $match: { workspaceId: new mongoose.Types.ObjectId(String(workspaceId)), status: 'delivered' } },
    { $group: {
      _id: { $ifNull: ['$currency', FCFA] },
      total: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } },
    } },
  ]);
  return rows.reduce((sum, r) => {
    try { return sum + convertCurrency(r.total || 0, r._id || FCFA, FCFA); }
    catch { return sum + (r.total || 0); }
  }, 0);
}

// ── DÉCLENCHEMENT ────────────────────────────────────────────────────────────
// Revendique le jalon de façon atomique. true = ce processus est LE premier.
async function claim(workspaceId, key) {
  const res = await Workspace.updateOne(
    { _id: workspaceId, reachedMilestones: { $ne: key } },
    { $addToSet: { reachedMilestones: key } },
  );
  return (res.modifiedCount ?? res.nModified ?? 0) === 1;
}

async function fire(workspaceId, family, m, value) {
  const message = m.message(value);
  await createNotification({
    workspaceId,
    type: 'milestone',
    title: m.title,
    message,
    icon: 'milestone',
    link: '/ecom/stats',
    metadata: { milestone: m.key, family, threshold: m.threshold, value: Math.round(value) },
  });
  if (m.push) {
    // tag 'new-order…' à dessein : il route vers le canal « orders » et son
    // ka-ching (expoPushService) — le bon son pour une bonne nouvelle d'argent.
    sendPushNotification(workspaceId, {
      title: m.title,
      body: message,
      tag: `new-order-milestone-${m.key}`,
      data: { type: 'milestone', milestone: m.key, link: '/ecom/stats' },
    }).catch(() => {});
  }
  console.log(`🏆 [Milestone] ${workspaceId} → ${m.key} (${Math.round(value)})`);
}

/**
 * Vérifie et déclenche les jalons d'un workspace.
 * @param {string|ObjectId} workspaceId
 * @param {{families?: Array<'orders'|'revenue'>}} opts — limiter aux familles
 *        dont la métrique a réellement pu bouger (perf) ; défaut : toutes.
 * Fire-and-forget par construction : attrape TOUT, ne throw jamais.
 */
export async function checkMilestones(workspaceId, { families } = {}) {
  try {
    if (!workspaceId) return;
    const fams = Array.isArray(families) && families.length
      ? families.filter((f) => MILESTONES[f])
      : Object.keys(MILESTONES);

    // Un seul fetch de l'état : évite N updateOne perdants sur des jalons
    // déjà acquis (le claim atomique reste la vraie barrière).
    const ws = await Workspace.findById(workspaceId).select('reachedMilestones').lean();
    if (!ws) return;
    const reached = new Set(ws.reachedMilestones || []);

    for (const family of fams) {
      const pending = MILESTONES[family].filter((m) => !reached.has(m.key));
      if (!pending.length) continue;

      const value = family === 'orders'
        ? await countOrders(workspaceId)
        : await deliveredRevenueFcfa(workspaceId);

      // Rattrapage inclus : un workspace qui déboule à 620 commandes (import)
      // reçoit 1, 10, 50, 100 et 500 d'un coup — l'historique est honoré, dans
      // l'ordre croissant pour que le fil de notifications raconte l'ascension.
      for (const m of pending.sort((a, b) => a.threshold - b.threshold)) {
        if (value < m.threshold) break;
        if (await claim(workspaceId, m.key)) {
          await fire(workspaceId, family, m, value);
        }
      }
    }
  } catch (e) {
    console.error('❌ [Milestone] check:', e.message);
  }
}

export default { checkMilestones, MILESTONES };
