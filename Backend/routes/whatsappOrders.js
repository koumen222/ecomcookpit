import express from 'express';
import WhatsAppOrder from '../models/WhatsAppOrder.js';
import { updateContactStatus, updateContactSalesStats } from '../services/ritaFollowUpService.js';

const router = express.Router();

/**
 * GET /api/ecom/whatsapp-orders
 * Obtenir les commandes WhatsApp
 */
router.get('/', async (req, res) => {
  try {
    const { userId, status, limit = 50, skip = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const query = { userId };
    if (status) query.status = status;

    const orders = await WhatsAppOrder.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await WhatsAppOrder.countDocuments(query);

    res.json({ orders, total });
  } catch (error) {
    console.error('Erreur récupération commandes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/ecom/whatsapp-orders/:id/status
 * Mettre à jour le statut d'une commande et tracker automatiquement
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { status, userId } = req.body;
    const { id } = req.params;

    if (!status || !userId) {
      return res.status(400).json({ error: 'status et userId requis' });
    }

    const order = await WhatsAppOrder.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Mettre à jour le statut
    order.previousStatus = order.status;
    order.status = status;
    await order.save();

    // Mettre à jour les stats du contact
    await updateContactSalesStats(userId, order.customerPhone);
    await updateContactStatus(userId, order.customerPhone);

    res.json(order);
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/ecom/whatsapp-orders/:id
 * Mettre à jour une commande complète
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const order = await WhatsAppOrder.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Si le statut change, mettre à jour les stats
    if (updates.status && updates.userId) {
      await updateContactSalesStats(updates.userId, order.customerPhone);
      await updateContactStatus(updates.userId, order.customerPhone);
    }

    res.json(order);
  } catch (error) {
    console.error('Erreur mise à jour commande:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/ecom/whatsapp-orders/:id
 * Supprimer une commande
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    const order = await WhatsAppOrder.findByIdAndDelete(id);
    
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Mettre à jour les stats du contact
    if (userId) {
      await updateContactSalesStats(userId, order.customerPhone);
      await updateContactStatus(userId, order.customerPhone);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression commande:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
