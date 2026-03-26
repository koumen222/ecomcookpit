/**
 * Routes API — Rita Statuts WhatsApp automatiques
 * Mount: /api/ecom/v1/rita-status
 */

import express from 'express';
import RitaStatusSchedule from '../models/RitaStatusSchedule.js';
import RitaConfig from '../models/RitaConfig.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from '../services/evolutionApiService.js';
import { requireEcomAuth, requireRitaAgentAccess } from '../middleware/ecomAuth.js';
import Workspace from '../models/Workspace.js';

const router = express.Router();

async function resolveUserId(req) {
  if (req.ecomUser?.role === 'super_admin') {
    return req.body?.userId || req.query?.userId || String(req.ecomUser._id);
  }
  const wsId = req.workspaceId || req.ecomUser?.workspaceId;
  if (wsId) {
    try {
      const ws = await Workspace.findById(wsId).select('owner').lean();
      if (ws?.owner) return String(ws.owner);
    } catch { }
  }
  return String(req.ecomUser?._id || '');
}

// ─── GET /schedules — liste tous les statuts planifiés ───────────────────────
router.get('/schedules', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const { agentId } = req.query;
    const query = agentId ? { agentId } : { userId };
    const schedules = await RitaStatusSchedule.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /schedules — créer un statut planifié ──────────────────────────────
router.post('/schedules', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const { agentId, name, type, caption, mediaUrl, productName, backgroundColor, scheduleType, sendTime, weekDays, cronExpression } = req.body;
    const schedule = await RitaStatusSchedule.create({
      userId,
      agentId: agentId || undefined,
      name: name || 'Statut automatique',
      type: type || 'text',
      caption: caption || '',
      mediaUrl: mediaUrl || '',
      productName: productName || '',
      backgroundColor: backgroundColor || '#0F6B4F',
      scheduleType: scheduleType || 'daily',
      sendTime: sendTime || '09:00',
      weekDays: weekDays || [],
      cronExpression: cronExpression || '',
      enabled: true,
    });
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /schedules/:id — modifier un statut planifié ────────────────────────
router.put('/schedules/:id', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const schedule = await RitaStatusSchedule.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: { ...req.body, updatedAt: new Date() } },
      { new: true }
    );
    if (!schedule) return res.status(404).json({ success: false, error: 'Statut introuvable' });
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /schedules/:id ───────────────────────────────────────────────────
router.delete('/schedules/:id', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    await RitaStatusSchedule.findOneAndDelete({ _id: req.params.id, userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /schedules/:id/send-now — publier immédiatement ───────────────────
router.post('/schedules/:id/send-now', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const schedule = await RitaStatusSchedule.findOne({ _id: req.params.id, userId }).lean();
    if (!schedule) return res.status(404).json({ success: false, error: 'Statut introuvable' });

    // Résoudre l'instance
    const configQuery = schedule.agentId ? { agentId: schedule.agentId } : { userId };
    const config = await RitaConfig.findOne(configQuery).lean();
    if (!config?.instanceId) return res.status(400).json({ success: false, error: 'Aucune instance WhatsApp configurée' });
    const instance = await WhatsAppInstance.findById(config.instanceId).lean();
    if (!instance?.instanceName) return res.status(400).json({ success: false, error: 'Instance WhatsApp introuvable' });

    // Résoudre le contenu
    let mediaUrl = schedule.mediaUrl;
    let caption = schedule.caption;
    let type = schedule.type;

    if (schedule.type === 'product' && schedule.productName) {
      const product = (config.productCatalog || []).find(
        p => p.name?.toLowerCase() === schedule.productName.toLowerCase()
      );
      if (product) {
        mediaUrl = product.images?.[0] || '';
        const priceText = product.price ? ` — ${product.price}` : '';
        caption = caption?.trim() || `${product.name}${priceText}\n${product.description || ''}\n\n📦 Disponible maintenant ! Écris-moi pour commander.`;
        type = mediaUrl ? 'image' : 'text';
      }
    }

    const result = await evolutionApiService.sendStatus(
      instance.instanceName,
      instance.instanceToken,
      { type, mediaUrl, caption, backgroundColor: schedule.backgroundColor }
    );

    if (result.success) {
      await RitaStatusSchedule.findByIdAndUpdate(schedule._id, {
        $set: { lastSentAt: new Date() },
        $inc: { sentCount: 1 },
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
