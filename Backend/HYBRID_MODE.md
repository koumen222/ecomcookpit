# Mode Hybride MongoDB + PostgreSQL

## 🎯 Stratégie

Le backend utilise maintenant une **approche hybride** :
- **MongoDB** : Conserve toutes les données existantes
- **PostgreSQL** : Stocke toutes les nouvelles données

Cette approche permet une migration progressive sans interruption de service.

## 🔧 Configuration

### Connexions actives

Le serveur se connecte aux deux bases de données au démarrage :

```javascript
// MongoDB (données existantes)
await connectDB();

// PostgreSQL (nouvelles données)
await connectPrisma();
```

### Variables d'environnement

```env
# MongoDB (anciennes données)
MONGO_URI="mongodb+srv://..."

# PostgreSQL Supabase (nouvelles données)
DATABASE_URL="postgresql://postgres.jaufeaezvhvnktaofkbb:Koumen%402022@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
```

## 📊 Utilisation dans les routes

### Exemple : Route Products

```javascript
import Product from '../models/Product.js'; // Mongoose
import prisma from '../config/prismaClient.js'; // Prisma

// GET - Lire depuis MongoDB (données existantes)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ workspaceId: req.user.workspaceId });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Créer dans PostgreSQL (nouvelles données)
router.post('/', async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: {
        workspaceId: req.user.workspaceId,
        name: req.body.name,
        sellingPrice: req.body.sellingPrice,
        productCost: req.body.productCost,
        deliveryCost: req.body.deliveryCost,
        createdById: req.user.id,
      }
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Exemple : Route Orders

```javascript
import Order from '../models/Order.js'; // Mongoose
import prisma from '../config/prismaClient.js'; // Prisma

// GET - Combiner les données des deux bases
router.get('/', async (req, res) => {
  try {
    // Récupérer depuis MongoDB
    const mongoOrders = await Order.find({ 
      workspaceId: req.user.workspaceId 
    }).lean();

    // Récupérer depuis PostgreSQL
    const postgresOrders = await prisma.order.findMany({
      where: { workspaceId: req.user.workspaceId }
    });

    // Combiner et trier par date
    const allOrders = [...mongoOrders, ...postgresOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Créer dans PostgreSQL uniquement
router.post('/', async (req, res) => {
  try {
    const order = await prisma.order.create({
      data: {
        workspaceId: req.user.workspaceId,
        clientName: req.body.clientName,
        clientPhone: req.body.clientPhone,
        product: req.body.product,
        quantity: req.body.quantity,
        price: req.body.price,
        // ... autres champs
      }
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 🔄 Migration progressive

### Phase 1 : Mode Hybride (Actuel)
- ✅ MongoDB : Lecture des données existantes
- ✅ PostgreSQL : Écriture des nouvelles données
- ✅ Pas d'interruption de service

### Phase 2 : Migration des données (Optionnel)
- Migrer progressivement les données MongoDB → PostgreSQL
- Script de migration disponible : `scripts/migrate-to-postgres.js`

### Phase 3 : PostgreSQL uniquement (Futur)
- Désactiver MongoDB
- Utiliser uniquement PostgreSQL

## 📝 Checklist d'adaptation des routes

Pour chaque route, décider de la stratégie :

### Stratégie 1 : Lecture MongoDB + Écriture PostgreSQL
```javascript
// GET - MongoDB (données existantes)
const items = await MongooseModel.find({...});

// POST - PostgreSQL (nouvelles données)
const item = await prisma.model.create({...});
```

### Stratégie 2 : Lecture combinée
```javascript
// GET - Les deux bases
const mongoItems = await MongooseModel.find({...});
const postgresItems = await prisma.model.findMany({...});
const allItems = [...mongoItems, ...postgresItems];
```

### Stratégie 3 : PostgreSQL uniquement (nouvelles routes)
```javascript
// Toutes les opérations sur PostgreSQL
const items = await prisma.model.findMany({...});
const item = await prisma.model.create({...});
```

## 🎯 Routes à adapter

### Priorité Haute (Nouvelles données)
- [ ] `/api/ecom/orders` - POST (nouvelles commandes)
- [ ] `/api/ecom/clients` - POST (nouveaux clients)
- [ ] `/api/ecom/products` - POST (nouveaux produits)
- [ ] `/api/ecom/transactions` - POST (nouvelles transactions)

### Priorité Moyenne (Lecture combinée)
- [ ] `/api/ecom/orders` - GET (toutes les commandes)
- [ ] `/api/ecom/clients` - GET (tous les clients)
- [ ] `/api/ecom/products` - GET (tous les produits)
- [ ] `/api/ecom/analytics` - GET (statistiques)

### Priorité Basse (Anciennes données)
- [ ] `/api/ecom/reports` - Garder MongoDB
- [ ] `/api/ecom/decisions` - Garder MongoDB
- [ ] `/api/ecom/goals` - Garder MongoDB

## 🛠️ Utilitaires

### Fonction helper pour combiner les résultats

```javascript
// utils/dbHelper.js
export async function getCombinedData(mongooseModel, prismaModel, filter) {
  const [mongoData, postgresData] = await Promise.all([
    mongooseModel.find(filter).lean(),
    prismaModel.findMany({ where: filter })
  ]);

  return [...mongoData, ...postgresData];
}
```

### Middleware de détection de base

```javascript
// middleware/dbRouter.js
export function usePostgres(req, res, next) {
  req.usePostgres = true;
  next();
}

export function useMongo(req, res, next) {
  req.usePostgres = false;
  next();
}
```

## 📊 Monitoring

### Vérifier les connexions

```javascript
// Health check étendu
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  let postgresStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    postgresStatus = 'connected';
  } catch (error) {
    postgresStatus = 'error';
  }

  res.json({
    status: 'ok',
    databases: {
      mongodb: mongoStatus,
      postgresql: postgresStatus
    },
    timestamp: new Date().toISOString()
  });
});
```

## ⚠️ Points d'attention

1. **IDs différents** : MongoDB utilise ObjectId, PostgreSQL utilise UUID
2. **Relations** : Gérer les références entre les deux bases
3. **Transactions** : Impossible d'avoir des transactions cross-database
4. **Performances** : Combiner les résultats peut être lent pour de gros volumes
5. **Cohérence** : Assurer la cohérence des données entre les deux bases

## 🚀 Avantages

- ✅ Pas d'interruption de service
- ✅ Migration progressive
- ✅ Rollback facile si problème
- ✅ Données existantes préservées
- ✅ Nouvelles fonctionnalités sur PostgreSQL

## 📈 Métriques à suivre

- Nombre de requêtes MongoDB vs PostgreSQL
- Temps de réponse par base
- Taux d'erreur par base
- Volume de données par base
- Coût d'infrastructure

## 🔗 Ressources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Mongoose Documentation](https://mongoosejs.com/docs)
- [Migration Guide](./MIGRATION_GUIDE.md)
