import express from 'express';
import QuantityOffer from '../models/QuantityOffer.js';
import StoreProduct from '../models/StoreProduct.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

async function hydrateOfferProducts(offers, workspaceId) {
  const list = Array.isArray(offers) ? offers : [offers].filter(Boolean);
  const productIds = [...new Set(
    list
      .map((offer) => String(offer.productId || ''))
      .filter((value) => /^[0-9a-fA-F]{24}$/.test(value))
  )];

  if (productIds.length === 0) return list;

  const products = await StoreProduct.find({
    _id: { $in: productIds },
    workspaceId
  })
    .select('name images price currency sku')
    .lean();

  const productById = new Map(products.map((product) => [String(product._id), product]));

  return list.map((offer) => ({
    ...offer,
    productId: productById.get(String(offer.productId)) || offer.productId
  }));
}

// GET / — Liste des offres (toutes ou filtrées par produit)
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { productId, isActive } = req.query;
    const filter = { workspaceId: req.workspaceId };

    if (productId) filter.productId = productId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const offers = await QuantityOffer.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const hydratedOffers = await hydrateOfferProducts(offers, req.workspaceId);

    res.json({ success: true, data: hydratedOffers });
  } catch (error) {
    console.error('❌ Erreur liste offres quantité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /:id — Détail d'une offre
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const offer = await QuantityOffer.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    const [hydratedOffer] = await hydrateOfferProducts(offer, req.workspaceId);

    res.json({ success: true, data: hydratedOffer });
  } catch (error) {
    console.error('❌ Erreur détail offre quantité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST / — Créer une nouvelle offre
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { productId, name, isActive, offers, design } = req.body;

    if (!productId || !name || !offers || !Array.isArray(offers)) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis : productId, name, offers (array)'
      });
    }

    const newOffer = await QuantityOffer.create({
      workspaceId: req.workspaceId,
      createdBy: req.ecomUser._id,
      productId,
      name,
      isActive: isActive !== undefined ? isActive : true,
      offers,
      design: design || {}
    });

    res.status(201).json({ success: true, data: newOffer });
  } catch (error) {
    console.error('❌ Erreur création offre quantité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /:id — Modifier une offre
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    const { name, isActive, productId, offers, design } = req.body;
    const update = {};

    if (name !== undefined) update.name = name;
    if (isActive !== undefined) update.isActive = isActive;
    if (productId !== undefined) update.productId = productId;
    if (offers !== undefined) update.offers = offers;
    if (design !== undefined) update.design = design;

    const offer = await QuantityOffer.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { $set: update },
      { new: true }
    ).populate('productId', 'name images price currency');

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    res.json({ success: true, data: offer });
  } catch (error) {
    console.error('❌ Erreur modification offre quantité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /:id — Supprimer une offre
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const offer = await QuantityOffer.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId
    });

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    res.json({ success: true, message: 'Offre supprimée' });
  } catch (error) {
    console.error('❌ Erreur suppression offre quantité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /:id/duplicate — Dupliquer une offre
router.post('/:id/duplicate', requireEcomAuth, async (req, res) => {
  try {
    const source = await QuantityOffer.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    if (!source) {
      return res.status(404).json({ success: false, message: 'Offre source non trouvée' });
    }

    const { productId } = req.body; // optionnel : lier à un autre produit

    const duplicate = await QuantityOffer.create({
      workspaceId: req.workspaceId,
      createdBy: req.ecomUser._id,
      productId: productId || source.productId,
      name: `${source.name} (copie)`,
      isActive: false, // On la crée inactive par défaut
      offers: source.offers,
      design: source.design
    });

    res.status(201).json({ success: true, data: duplicate });
  } catch (error) {
    console.error('❌ Erreur duplication offre quantité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
