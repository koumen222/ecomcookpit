import express from 'express';
import ProductResearch from '../models/ProductResearch.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

// POST /api/ecom/products/research - Créer un produit de recherche
router.post('/research', requireEcomAuth, async (req, res) => {
  try {
    console.log('🔍 POST /api/ecom/products/research - Création produit recherche');
    console.log('� Données reçues:', req.body);
    
    const productData = {
      ...req.body,
      workspaceId: req.workspaceId,
      createdBy: req.ecomUser._id
    };

    // Calculer les financiers automatiquement
    const product = new ProductResearch(productData);
    product.calculateFinancials();
    
    await product.save();
    console.log('✅ Produit recherche créé avec ID:', product._id);

    const populatedProduct = await ProductResearch.findById(product._id)
      .populate('createdBy', 'email');

    res.status(201).json({
      success: true,
      message: 'Produit de recherche créé avec succès',
      data: populatedProduct
    });
  } catch (error) {
    console.error('Erreur create product research:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/products/research - Lister les produits de recherche
router.get('/research', requireEcomAuth, async (req, res) => {
  try {
    console.log('📋 GET /api/ecom/products/research - Liste produits recherche');

    const { 
      status, 
      category, 
      minOpportunityScore, 
      minMargin,
      search,
      limit = 50,
      sortBy = 'researchDate',
      sortOrder = 'desc'
    } = req.query;
    
    const filter = { workspaceId: req.workspaceId };
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (minOpportunityScore) filter.opportunityScore = { $gte: parseInt(minOpportunityScore) };
    if (minMargin) filter.margin = { $gte: parseFloat(minMargin) };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { creative: { $regex: search, $options: 'i' } },
        { websiteUrl: { $regex: search, $options: 'i' } }
      ];
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const products = await ProductResearch.find(filter)
      .populate('createdBy', 'email')
      .sort(sortOptions)
      .limit(parseInt(limit));

    console.log('📊 Produits recherche trouvés:', products.length);

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Erreur get products research:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/products/research/stats - Statistiques des produits de recherche
router.get('/research/stats', requireEcomAuth, async (req, res) => {
  try {
    console.log('📊 GET /api/ecom/products/research/stats - Statistiques');
    
    const stats = await ProductResearch.getStats(req.workspaceId);
    
    // Statistiques supplémentaires
    const highOpportunity = await ProductResearch.countDocuments({
      workspaceId: req.workspaceId,
      opportunityScore: { $gte: 4 },
      status: { $ne: 'rejected' }
    });
    
    const highMargin = await ProductResearch.countDocuments({
      workspaceId: req.workspaceId,
      margin: { $gte: 40 },
      status: { $ne: 'rejected' }
    });
    
    const recentlyAdded = await ProductResearch.find({
      workspaceId: req.workspaceId
    })
    .sort({ researchDate: -1 })
    .limit(5)
    .select('name opportunityScore margin status researchDate');

    res.json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, avgMargin: 0, avgOpportunityScore: 0 },
        highOpportunity,
        highMargin,
        recentlyAdded
      }
    });
  } catch (error) {
    console.error('Erreur get research stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/products-research/research/:id - Détail d'un produit de recherche
router.get('/research/:id', requireEcomAuth, async (req, res) => {
  try {
    console.log('🔍 GET /api/ecom/products-research/research/:id - Détail produit');
    console.log('📋 ID produit:', req.params.id);
    
    const product = await ProductResearch.findOne({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    })
    .populate('createdBy', 'email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit de recherche non trouvé'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Erreur get product research:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// PUT /api/ecom/products-research/research/:id - Modifier un produit de recherche
router.put('/research/:id', requireEcomAuth, async (req, res) => {
  try {
    console.log('📝 PUT /api/ecom/products-research/research/:id - Modification produit');
    console.log('📋 ID produit:', req.params.id);
    console.log('📋 Données reçues:', req.body);
    
    const product = await ProductResearch.findOne({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit de recherche non trouvé'
      });
    }

    // Mettre à jour les champs
    Object.assign(product, req.body);
    
    // Recalculer les financiers si les prix ont changé
    if (req.body.sourcingPrice || req.body.sellingPrice || req.body.shippingUnitCost || req.body.cogs) {
      product.calculateFinancials();
    }
    
    await product.save();

    const updatedProduct = await ProductResearch.findById(product._id)
      .populate('createdBy', 'email');

    res.json({
      success: true,
      message: 'Produit de recherche mis à jour avec succès',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Erreur update product research:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// PUT /api/ecom/products-research/research/:id/status - Mettre à jour le statut
router.put('/research/:id/status', requireEcomAuth, async (req, res) => {
  try {
    const { status, reason } = req.body;
    
    if (!['research', 'testing', 'validated', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }
    const product = await ProductResearch.findOne({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit de recherche non trouvé'
      });
    }

    await product.updateStatus(status, reason);

    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: product
    });
  } catch (error) {
    console.error('Erreur update status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// DELETE /api/ecom/products/research/:id - Supprimer un produit de recherche
router.delete('/research/:id', requireEcomAuth, async (req, res) => {
  try {
    const product = await ProductResearch.findOne({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit de recherche non trouvé'
      });
    }

    await ProductResearch.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Produit de recherche supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur delete product research:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;
