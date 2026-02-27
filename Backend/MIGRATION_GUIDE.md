# Guide de Migration MongoDB → PostgreSQL (Supabase)

## 📋 État actuel

- ✅ **Prisma installé** : `prisma`, `@prisma/client`, `pg`
- ✅ **Schéma Prisma créé** : `prisma/schema.prisma` (33 modèles)
- ✅ **Client Prisma généré** : `node_modules/@prisma/client`
- ⚠️ **Migration en attente** : Connexion à Supabase à configurer

## 🔧 Configuration Supabase

### 1. Vérifier l'URL de connexion

L'URL PostgreSQL doit être au format :
```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

**Important** : Les caractères spéciaux dans le mot de passe doivent être encodés :
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- etc.

**Votre URL actuelle** :
```env
DATABASE_URL="postgresql://postgres:Koumen%402022@db.jaufeaezvhvnktaofkbb.supabase.co:5432/postgres"
```

### 2. Autoriser votre IP dans Supabase

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Settings** → **Database**
4. Section **Connection Pooling** ou **Network Restrictions**
5. Ajoutez votre IP ou `0.0.0.0/0` pour autoriser toutes les IP (développement uniquement)

### 3. Vérifier les credentials

Assurez-vous que :
- Le nom d'utilisateur est correct (`postgres` par défaut)
- Le mot de passe est correct
- Le host est correct (`db.jaufeaezvhvnktaofkbb.supabase.co`)
- Le port est `5432`

## 🚀 Étapes de migration

### Étape 1 : Tester la connexion

```bash
cd Backend
npx prisma db pull
```

Si la connexion fonctionne, cela va récupérer le schéma actuel de la base de données.

### Étape 2 : Créer la migration initiale

```bash
npx prisma migrate dev --name init
```

Cela va :
- Créer toutes les tables dans PostgreSQL
- Générer le fichier de migration dans `prisma/migrations/`
- Appliquer la migration à la base de données

### Étape 3 : Adapter le serveur

Remplacer MongoDB par Prisma dans `server.js` :

```javascript
// Ancien (MongoDB)
import { connectDB } from './config/database.js';

// Nouveau (Prisma)
import { connectPrisma } from './config/prismaClient.js';

// Dans startServer()
await connectPrisma();
```

### Étape 4 : Migrer les routes (progressivement)

#### Exemple : Conversion d'une route produits

**Avant (Mongoose)** :
```javascript
import Product from '../models/Product.js';

// Créer un produit
const product = await Product.create({
  name: 'Mon produit',
  workspaceId: req.user.workspaceId,
  // ...
});

// Trouver des produits
const products = await Product.find({ workspaceId })
  .sort({ createdAt: -1 })
  .limit(10);
```

**Après (Prisma)** :
```javascript
import prisma from '../config/prismaClient.js';

// Créer un produit
const product = await prisma.product.create({
  data: {
    name: 'Mon produit',
    workspaceId: req.user.workspaceId,
    // ...
  }
});

// Trouver des produits
const products = await prisma.product.findMany({
  where: { workspaceId },
  orderBy: { createdAt: 'desc' },
  take: 10
});
```

## 📊 Modèles disponibles dans Prisma

Tous les modèles Mongoose ont été convertis en Prisma :

### Core
- `EcomUser` - Utilisateurs
- `Workspace` - Workspaces
- `WorkspaceMember` - Membres des workspaces
- `WorkspaceInvite` - Invitations
- `WorkspaceSettings` - Paramètres

### Produits & Stock
- `Product` - Produits
- `ProductResearch` - Recherche de produits
- `StockLocation` - Emplacements de stock
- `StockOrder` - Commandes de stock

### Commandes & Clients
- `Order` - Commandes
- `OrderSource` - Sources de commandes
- `Client` - Clients
- `CloseuseAssignment` - Affectations closeuses

### Finance
- `Transaction` - Transactions
- `DailyReport` - Rapports journaliers
- `Goal` - Objectifs

### Décisions & Tâches
- `Decision` - Décisions

### Marketing
- `Campaign` - Campagnes

### Notifications & Messaging
- `Notification` - Notifications
- `Subscription` - Abonnements push
- `DirectMessage` - Messages directs

### Agent & IA
- `AgentConversation` - Conversations agent
- `AgentMessage` - Messages agent

### Analytics
- `AnalyticsEvent` - Événements analytics
- `AnalyticsSession` - Sessions analytics

### Import
- `ImportHistory` - Historique des imports

## 🔄 Migration des données (optionnel)

Si vous avez des données dans MongoDB à migrer vers PostgreSQL :

### Option 1 : Script de migration personnalisé

Créer un script `scripts/migrate-data.js` :

```javascript
import mongoose from 'mongoose';
import prisma from '../config/prismaClient.js';
import Product from '../models/Product.js'; // Mongoose model

async function migrateProducts() {
  // Connecter à MongoDB
  await mongoose.connect(process.env.MONGO_URI);
  
  // Récupérer tous les produits MongoDB
  const mongoProducts = await Product.find({});
  
  console.log(`Migration de ${mongoProducts.length} produits...`);
  
  // Insérer dans PostgreSQL
  for (const product of mongoProducts) {
    await prisma.product.create({
      data: {
        id: product._id.toString(),
        workspaceId: product.workspaceId.toString(),
        name: product.name,
        status: product.status,
        sellingPrice: product.sellingPrice,
        productCost: product.productCost,
        deliveryCost: product.deliveryCost,
        avgAdsCost: product.avgAdsCost || 0,
        stock: product.stock,
        reorderThreshold: product.reorderThreshold,
        isActive: product.isActive,
        createdById: product.createdBy.toString(),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    });
  }
  
  console.log('✅ Migration terminée');
}

migrateProducts().catch(console.error);
```

### Option 2 : Export/Import CSV

1. Exporter depuis MongoDB en CSV
2. Importer dans PostgreSQL via Supabase Dashboard

## 🧪 Tests

Après migration, tester chaque fonctionnalité :

```bash
# Tester la connexion
npx prisma studio

# Lancer le serveur
npm start

# Tester les endpoints
curl http://localhost:8080/api/ecom/products
```

## 📝 Checklist de migration

- [ ] Connexion Supabase configurée et testée
- [ ] Migration initiale appliquée (`prisma migrate dev`)
- [ ] Client Prisma importé dans server.js
- [ ] Routes /auth migrées vers Prisma
- [ ] Routes /products migrées vers Prisma
- [ ] Routes /orders migrées vers Prisma
- [ ] Routes /clients migrées vers Prisma
- [ ] Routes /transactions migrées vers Prisma
- [ ] Routes /reports migrées vers Prisma
- [ ] Routes /decisions migrées vers Prisma
- [ ] Routes /campaigns migrées vers Prisma
- [ ] Routes /goals migrées vers Prisma
- [ ] Routes /stock migrées vers Prisma
- [ ] Routes /notifications migrées vers Prisma
- [ ] Routes /agent migrées vers Prisma
- [ ] Routes /analytics migrées vers Prisma
- [ ] Routes /import migrées vers Prisma
- [ ] Données migrées (si nécessaire)
- [ ] Tests fonctionnels passés
- [ ] Déploiement en production

## 🔗 Ressources

- [Documentation Prisma](https://www.prisma.io/docs)
- [Prisma avec PostgreSQL](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Migration depuis MongoDB](https://www.prisma.io/docs/guides/migrate-to-prisma/migrate-from-mongodb)
- [Supabase Documentation](https://supabase.com/docs)

## ⚠️ Points d'attention

1. **IDs** : MongoDB utilise ObjectId, PostgreSQL utilise UUID
2. **Relations** : Prisma gère les relations différemment
3. **Transactions** : Utiliser `prisma.$transaction()` pour les opérations atomiques
4. **Performances** : Optimiser les requêtes avec `select` et `include`
5. **Middleware** : Les hooks Mongoose doivent être réimplémentés

## 🆘 Dépannage

### Erreur "Can't reach database server"

- Vérifiez l'URL DATABASE_URL
- Vérifiez que votre IP est autorisée dans Supabase
- Testez la connexion avec `psql` ou un client PostgreSQL

### Erreur "Authentication failed"

- Vérifiez le username et password
- Vérifiez l'encodage des caractères spéciaux

### Erreur de migration

- Supprimez le dossier `prisma/migrations`
- Réinitialisez avec `npx prisma migrate reset`
- Relancez `npx prisma migrate dev --name init`
