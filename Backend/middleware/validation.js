// Validation middleware pour les données e-commerce

// Validation email
export const validateEmail = (req, res, next) => {
  const { email } = req.body;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email requis'
    });
  }
  
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Format email invalide'
    });
  }
  
  next();
};

// Validation mot de passe
export const validatePassword = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Mot de passe requis'
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Le mot de passe doit contenir au moins 6 caractères'
    });
  }
  
  next();
};

// Validation produit
export const validateProduct = (req, res, next) => {
  console.log('🔍 validateProduct appelé');
  console.log('📋 Corps de la requête:', req.body);
  
  // Accepter les noms de champs du frontend
  const {
    name,
    price,              // Frontend envoie "price"
    costPrice,          // Frontend envoie "costPrice"
    deliveryCost,
    avgAdsCost,
    stockQuantity,      // Frontend envoie "stockQuantity"
    minStockAlert,      // Frontend envoie "minStockAlert"
    // Aussi accepter les noms originaux du backend
    sellingPrice,
    productCost,
    stock,
    reorderThreshold
  } = req.body;
  
  // Utiliser les champs du frontend avec fallback vers les champs du backend
  const finalSellingPrice = price || sellingPrice;
  const finalProductCost = costPrice || productCost;
  const finalStock = stockQuantity || stock;
  const finalReorderThreshold = minStockAlert || reorderThreshold;
  
  const errors = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Nom du produit requis');
  }
  
  if (name && name.length > 100) {
    errors.push('Nom du produit trop long (max 100 caractères)');
  }
  
  if (!finalSellingPrice || finalSellingPrice <= 0) {
    errors.push('Prix de vente requis et doit être positif');
  }
  
  if (!finalProductCost || finalProductCost < 0) {
    errors.push('Coût produit requis et doit être positif ou nul');
  }
  
  // Rendre deliveryCost et avgAdsCost optionnels avec valeur par défaut 0
  const finalDeliveryCost = deliveryCost || 0;
  const finalAvgAdsCost = avgAdsCost || 0;
  
  if (finalDeliveryCost < 0) {
    errors.push('Coût livraison doit être positif ou nul');
  }
  
  if (finalAvgAdsCost < 0) {
    errors.push('Coût publicitaire moyen doit être positif ou nul');
  }
  
  if (finalStock === undefined || finalStock < 0) {
    errors.push('Stock requis et doit être positif ou nul');
  }
  
  if (!finalReorderThreshold || finalReorderThreshold < 0) {
    errors.push('Seuil de réapprovisionnement requis et doit être positif ou nul');
  }
  
  if (finalSellingPrice <= finalProductCost + finalDeliveryCost + finalAvgAdsCost) {
    errors.push('Le prix de vente doit être supérieur au coût total pour être rentable');
  }
  
  console.log('❌ Erreurs de validation:', errors);
  
  if (errors.length > 0) {
    console.log('🚫 Validation échouée avec erreurs:', errors);
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors
    });
  }
  
  // Transformer les champs du frontend vers les champs du backend
  req.body.sellingPrice = finalSellingPrice;
  req.body.productCost = finalProductCost;
  req.body.deliveryCost = finalDeliveryCost;
  req.body.avgAdsCost = finalAvgAdsCost;
  req.body.stock = finalStock;
  req.body.reorderThreshold = finalReorderThreshold;
  
  console.log('✅ Validation réussie, champs transformés');
  next();
};

// validation rapport quotidien
export const validateDailyReport = (req, res, next) => {
  console.log('🔍 validateDailyReport appelé');
  console.log('📋 Corps reçu:', req.body);
  
  const {
    date,
    productId,
    ordersReceived,
    ordersDelivered,
    adSpend
  } = req.body;
  
  const errors = [];
  
  if (!date) {
    errors.push('Date requise');
  }
  
  if (!productId) {
    errors.push('ID produit requis');
  }
  
  if (ordersReceived === undefined || ordersReceived < 0) {
    errors.push('Nombre de commandes reçues requis et doit être positif ou nul');
  }
  
  if (ordersDelivered === undefined || ordersDelivered < 0) {
    errors.push('Nombre de commandes livrées requis et doit être positif ou nul');
  }
  
  if (adSpend === undefined || adSpend < 0) {
    errors.push('Dépenses publicitaires requises et doivent être positives ou nulles');
  }
  
  if (ordersDelivered > ordersReceived) {
    errors.push('Le nombre de commandes livrées ne peut pas dépasser le nombre de commandes reçues');
  }
  
  if (errors.length > 0) {
    console.log('❌ Erreurs de validation rapport:', errors);
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors
    });
  }
  
  console.log('✅ Validation rapport réussie');
  next();
};

// Validation commande de stock
export const validateStockOrder = (req, res, next) => {
  const {
    productName,
    sourcing,
    quantity,
    weightKg,
    pricePerKg,
    purchasePrice,
    sellingPrice
  } = req.body;
  
  const errors = [];
  
  if (!productName || productName.trim().length === 0) {
    errors.push('Nom du produit requis');
  }
  
  if (!sourcing || !['local', 'chine'].includes(sourcing)) {
    errors.push('Sourcing requis (local ou chine)');
  }
  
  if (!quantity || quantity <= 0) {
    errors.push('Quantité requise et doit être positive');
  }
  
  if (weightKg === undefined || weightKg < 0) {
    errors.push('Poids en kg requis et doit être positif ou nul');
  }
  
  if (pricePerKg === undefined || pricePerKg < 0) {
    errors.push('Prix par kg requis et doit être positif ou nul');
  }
  
  if (!purchasePrice || purchasePrice <= 0) {
    errors.push('Prix d\'achat requis et doit être positif');
  }
  
  if (!sellingPrice || sellingPrice <= 0) {
    errors.push('Prix de vente requis et doit être positif');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors
    });
  }
  
  next();
};

// Validation décision
export const validateDecision = (req, res, next) => {
  const {
    productId,
    decisionType,
    reason,
    priority
  } = req.body;
  
  const errors = [];
  
  if (!productId) {
    errors.push('ID produit requis');
  }
  
  if (!decisionType || !['continue', 'scale', 'stop', 'reorder'].includes(decisionType)) {
    errors.push('Type de décision invalide (continue, scale, stop, reorder)');
  }
  
  if (!reason || reason.trim().length === 0) {
    errors.push('Motif de décision requis');
  }
  
  if (reason && reason.length > 1000) {
    errors.push('Motif trop long (max 1000 caractères)');
  }
  
  if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
    errors.push('Priorité invalide (low, medium, high, urgent)');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors
    });
  }
  
  next();
};
