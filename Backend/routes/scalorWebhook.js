import { Router } from 'express';
import axios from 'axios';
import ScalorInstance from '../models/ScalorInstance.js';

const router = Router();

// ═══════════════════════════════════════════════
// POST /evolution/:instanceId — Webhook from Evolution API
// This receives events from Evolution API and relays them to the user's webhook URL
// ═══════════════════════════════════════════════
router.post('/evolution/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const event = req.body;

    // Always respond 200 to Evolution API quickly
    res.status(200).json({ received: true });

    // Find the instance
    const instance = await ScalorInstance.findById(instanceId);
    if (!instance || !instance.isActive) return;

    // Handle connection.update events — update instance status
    if (event?.event === 'connection.update') {
      const state = event?.data?.state || event?.state;
      if (state === 'open') {
        instance.status = 'connected';
        instance.lastConnectedAt = new Date();
      } else if (state === 'close' || state === 'connecting') {
        instance.status = 'disconnected';
      }
      await instance.save();
    }

    // Relay to user's webhook URL if configured
    if (instance.webhookUrl) {
      try {
        await axios.post(instance.webhookUrl, {
          instanceId: instance._id,
          instanceName: instance.displayName,
          event: event?.event,
          data: event?.data || event
        }, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json', 'X-Scalor-Instance': instance.instanceName }
        });
      } catch (webhookErr) {
        console.warn(`⚠️ [Scalor Webhook] Failed to relay to ${instance.webhookUrl}: ${webhookErr.message}`);
      }
    }
  } catch (error) {
    console.error('❌ [Scalor Webhook] Error:', error.message);
    // Already responded 200
  }
});

export default router;
