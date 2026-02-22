import express from 'express';
import Client from '../models/Client.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

// DELETE /api/ecom/clients/bulk - Supprimer tous les clients
router.delete('/bulk', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const filter = { workspaceId: req.workspaceId };
    const result = await Client.deleteMany(filter);
    res.json({ 
      success: true, 
      message: `${result.deletedCount} client(s) supprimé(s)`, 
      data: { deletedCount: result.deletedCount } 
    });
  } catch (error) {
    console.error('Erreur suppression bulk clients:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/clients - Liste des clients
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { status, source, search, assignedTo, city, product, tag, page = 1, limit = 50 } = req.query;
    const filter = { workspaceId: req.workspaceId };

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (product) filter.products = { $regex: product, $options: 'i' };
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { products: { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await Client.find(filter)
      .populate('assignedTo', 'email')
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Client.countDocuments(filter);

    // Stats
    const allClients = await Client.find({ workspaceId: req.workspaceId });
    const stats = {
      total: allClients.length,
      prospects: allClients.filter(c => c.status === 'prospect').length,
      confirmed: allClients.filter(c => c.status === 'confirmed').length,
      delivered: allClients.filter(c => c.status === 'delivered').length,
      returned: allClients.filter(c => c.status === 'returned').length,
      blocked: allClients.filter(c => c.status === 'blocked').length
    };

    res.json({
      success: true,
      data: {
        clients,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur get clients:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/clients/:id - Détail d'un client
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
      .populate('assignedTo', 'email')
      .populate('createdBy', 'email');

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client non trouvé' });
    }

    res.json({ success: true, data: client });
  } catch (error) {
    console.error('Erreur get client:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/clients - Créer un client
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, city, address, source, status, notes, tags, assignedTo } = req.body;

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ success: false, message: 'Le prénom est requis' });
    }

    const client = new Client({
      workspaceId: req.workspaceId,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || '',
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      city: city?.trim() || '',
      address: address?.trim() || '',
      source: source || 'other',
      status: status || 'prospect',
      notes: notes?.trim() || '',
      tags: tags || [],
      assignedTo: assignedTo || undefined,
      createdBy: req.ecomUser._id
    });

    await client.save();

    const populated = await Client.findById(client._id)
      .populate('assignedTo', 'email')
      .populate('createdBy', 'email');

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: populated
    });
  } catch (error) {
    console.error('Erreur create client:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/clients/:id - Modifier un client
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client non trouvé' });
    }

    const allowedFields = ['firstName', 'lastName', 'phone', 'email', 'city', 'address', 'source', 'status', 'notes', 'tags', 'assignedTo', 'totalOrders', 'totalSpent', 'lastContactAt'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        client[field] = req.body[field];
      }
    });

    await client.save();

    const populated = await Client.findById(client._id)
      .populate('assignedTo', 'email')
      .populate('createdBy', 'email');

    res.json({
      success: true,
      message: 'Client modifié avec succès',
      data: populated
    });
  } catch (error) {
    console.error('Erreur update client:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/clients/:id - Supprimer un client (admin seulement)
router.delete('/:id',
  requireEcomAuth,
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const client = await Client.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client non trouvé' });
      }
      res.json({ success: true, message: 'Client supprimé' });
    } catch (error) {
      console.error('Erreur delete client:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

export default router;
