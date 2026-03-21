# Gestion du Stock - Documentation Technique

## Problème Identifié

### Incohérence Stock
**Symptôme** : Affichage de "10 kinoki en stock" mais alerte "limite atteinte" déclenchée

**Cause racine** : Deux sources de vérité non synchronisées
- `Product.stock` (champ unique sur le produit)
- `StockLocation.quantity` (stock réparti par ville/agence)

## Solution Implémentée

### Source de Vérité Unique
**`StockLocation` est la source de vérité**

```javascript
stock_actuel = SOMME(StockLocation.quantity)
```

### Fonction de Calcul

```javascript
// Backend/routes/stock.js
const calculateActualStock = async (productId, workspaceId) => {
  const locations = await StockLocation.find({ productId, workspaceId });
  return locations.reduce((total, loc) => total + (loc.quantity || 0), 0);
};
```

### Routes Modifiées

#### 1. GET /api/ecom/stock/alerts
- Calcule le stock réel depuis `StockLocation` pour chaque produit
- Compare avec `reorderThreshold` pour détecter les alertes
- Retourne `actualStock` au lieu de `Product.stock`

#### 2. POST /api/ecom/stock/sync (NOUVEAU)
Synchronise `Product.stock` depuis `StockLocation`

```bash
POST /api/ecom/stock/sync
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "3 produit(s) synchronisé(s)",
  "data": [
    {
      "productId": "...",
      "name": "Kinoki",
      "oldStock": 10,
      "newStock": 25,
      "diff": +15
    }
  ]
}
```

## Logique de Gestion

### Mouvements de Stock

**Entrées** (augmentation)
- Réception commande fournisseur → `StockLocation.quantity += quantité`
- Transfert entre emplacements → source `-=`, destination `+=`

**Sorties** (diminution)
- Vente livrée → `StockLocation.quantity -= quantité`
- Retour produit → `StockLocation.quantity += quantité`

### Calcul des Alertes

```javascript
const isLowStock = actualStock <= product.reorderThreshold;
const urgency = 
  actualStock === 0 ? 'critical' :
  actualStock <= reorderThreshold / 2 ? 'high' : 
  'medium';
```

## Recommandations

### 1. Synchronisation Automatique
Ajouter un hook Mongoose sur `StockLocation` pour auto-sync `Product.stock`

```javascript
stockLocationSchema.post('save', async function() {
  const actualStock = await calculateActualStock(this.productId, this.workspaceId);
  await Product.findByIdAndUpdate(this.productId, { stock: actualStock });
});
```

### 2. Audit Log (Optionnel)
Créer une table `stock_movements` pour tracer tous les mouvements

```javascript
const stockMovementSchema = new mongoose.Schema({
  workspaceId: ObjectId,
  productId: ObjectId,
  locationId: ObjectId,
  type: String, // 'in', 'out', 'transfer', 'adjustment'
  quantity: Number,
  reason: String,
  userId: ObjectId,
  timestamp: Date
});
```

### 3. Validation
- Interdire les stocks négatifs
- Vérifier disponibilité avant vente
- Logger toutes les modifications

## Migration

Pour corriger les données existantes :

```bash
# Synchroniser tous les produits
POST /api/ecom/stock/sync
```

## Tests

```javascript
// Test: Stock réparti sur plusieurs emplacements
StockLocation.create([
  { productId: 'kinoki', city: 'Douala', quantity: 10 },
  { productId: 'kinoki', city: 'Yaoundé', quantity: 15 }
]);

const actualStock = await calculateActualStock('kinoki');
// actualStock = 25 (10 + 15)
```

## Références

- `Backend/routes/stock.js` - Routes et logique stock
- `Backend/models/StockLocation.js` - Schéma emplacement
- `Backend/models/Product.js` - Schéma produit
- `Backend/services/stockService.js` - Service ajustement stock
