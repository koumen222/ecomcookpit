/**
 * Rita Group Animator — Animation automatique des groupes WhatsApp
 * Envoie des messages/images/produits dans les groupes selon les posts planifiés.
 *
 * Lancé par un setInterval dans server.js (toutes les 60 sec).
 */

import RitaFlow from '../models/RitaFlow.js';
import RitaConfig from '../models/RitaConfig.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from './evolutionApiService.js';
import { logRitaActivity } from './ritaBossReportService.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MAP = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

function shouldRunNow(post) {
  if (!post.enabled) return false;

  const now = new Date();
  const tz = 'Africa/Douala';
  const localStr = now.toLocaleString('fr-FR', { timeZone: tz });

  // Vérifier le jour
  if (post.days?.length) {
    const todayIdx = new Date(now.toLocaleString('en-US', { timeZone: tz })).getDay();
    const allowedDays = post.days.map(d => DAY_MAP[d.toLowerCase()]).filter(d => d !== undefined);
    if (allowedDays.length && !allowedDays.includes(todayIdx)) return false;
  }

  // Vérifier l'heure (format "HH:mm")
  if (post.hour) {
    const [h, m] = post.hour.split(':').map(Number);
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const nowH = localDate.getHours();
    const nowM = localDate.getMinutes();
    // On accepte une fenêtre de 2 minutes
    if (nowH !== h || Math.abs(nowM - m) > 1) return false;
  }

  // Vérifier qu'on n'a pas déjà envoyé dans les 50 dernières minutes
  if (post.lastSentAt) {
    const diff = Date.now() - new Date(post.lastSentAt).getTime();
    if (diff < 50 * 60 * 1000) return false;
  }

  return true;
}

// ── Tick principal ───────────────────────────────────────────────────────────

export async function tickGroupAnimator() {
  try {
    const flowConfigs = await RitaFlow.find({ enabled: true, 'groups.scheduledPosts.0': { $exists: true } });

    for (const flowConfig of flowConfigs) {
      const inst = await WhatsAppInstance.findOne({ userId: flowConfig.userId, isActive: true }).lean();
      if (!inst) continue;

      for (const group of flowConfig.groups) {
        if (!group.groupJid || !group.scheduledPosts?.length) continue;

        for (let i = 0; i < group.scheduledPosts.length; i++) {
          const post = group.scheduledPosts[i];
          if (!shouldRunNow(post)) continue;

          try {
            let sent = false;

            if (post.type === 'text' && post.content) {
              const r = await evolutionApiService.sendGroupMessage(inst.instanceName, inst.instanceToken, group.groupJid, post.content);
              sent = r.success;
            }

            if (post.type === 'image' && post.content) {
              const r = await evolutionApiService.sendGroupMedia(inst.instanceName, inst.instanceToken, group.groupJid, post.content, '');
              sent = r.success;
            }

            if (post.type === 'product' && post.productName) {
              // Charger le produit depuis le catalogue Rita
              const ritaCfg = await RitaConfig.findOne({ userId: flowConfig.userId }).lean();
              const product = (ritaCfg?.productCatalog || []).find(
                p => p.name.toLowerCase() === post.productName.toLowerCase()
              );
              if (product) {
                const priceStr = product.price ? ` — ${product.price}` : '';
                const msg = `🛍️ *${product.name}*${priceStr}\n${product.description || ''}\n\n💬 Écris-nous en privé pour commander !`;
                await evolutionApiService.sendGroupMessage(inst.instanceName, inst.instanceToken, group.groupJid, msg);

                // Envoyer la première image du produit si dispo
                if (product.images?.length) {
                  let imgUrl = product.images[0];
                  if (imgUrl.startsWith('/')) imgUrl = `https://api.scalor.net${imgUrl}`;
                  await evolutionApiService.sendGroupMedia(inst.instanceName, inst.instanceToken, group.groupJid, imgUrl, product.name);
                }
                sent = true;
              }
            }

            if (sent) {
              // Marquer comme envoyé
              flowConfig.groups.id(group._id).scheduledPosts[i].lastSentAt = new Date();
              await flowConfig.save();
              console.log(`📢 [GroupAnimator] Post envoyé dans "${group.name}" (type=${post.type})`);
              logRitaActivity(flowConfig.userId, 'group_post_sent', { details: `${post.type} → ${group.name}` });
            }

          } catch (postErr) {
            console.error(`❌ [GroupAnimator] Erreur post dans ${group.name}:`, postErr.message);
          }
        }
      }
    }

  } catch (err) {
    console.error(`❌ [GroupAnimator] Erreur tick:`, err.message);
  }
}
