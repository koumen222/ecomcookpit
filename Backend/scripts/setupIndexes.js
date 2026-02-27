import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { config } from 'dotenv';

// Charger les variables d'environnement
config();

const setupIndexes = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('🔗 Connecté à MongoDB');

    // Obtenir la collection pour créer les indexes manuellement
    const db = mongoose.connection.db;
    const collection = db.collection('ecom_orders');

    // Liste des indexes à créer
    const indexes = [
      // Index simples
      { key: { workspaceId: 1 }, name: 'workspaceId_1' },
      { key: { status: 1 }, name: 'status_1' },
      { key: { date: -1 }, name: 'date_-1' },
      { key: { city: 1 }, name: 'city_1' },
      { key: { product: 1 }, name: 'product_1' },
      { key: { price: 1 }, name: 'price_1' },
      { key: { source: 1 }, name: 'source_1' },
      { key: { tags: 1 }, name: 'tags_1' },
      { key: { updatedAt: -1 }, name: 'updatedAt_-1' },
      { key: { clientPhone: 1 }, name: 'clientPhone_1' },
      
      // Index composés pour les requêtes fréquentes
      { key: { workspaceId: 1, status: 1, date: -1 }, name: 'workspaceId_1_status_1_date_-1' },
      { key: { workspaceId: 1, city: 1, status: 1 }, name: 'workspaceId_1_city_1_status_1' },
      { key: { workspaceId: 1, product: 1, status: 1 }, name: 'workspaceId_1_product_1_status_1' },
      { key: { workspaceId: 1, date: -1, status: 1 }, name: 'workspaceId_1_date_-1_status_1' },
      { key: { workspaceId: 1, updatedAt: -1 }, name: 'workspaceId_1_updatedAt_-1' },
      { key: { workspaceId: 1, source: 1, date: -1 }, name: 'workspaceId_1_source_1_date_-1' },
      { key: { workspaceId: 1, tags: 1, status: 1 }, name: 'workspaceId_1_tags_1_status_1' },
      
      // Index uniques
      { key: { workspaceId: 1, sheetRowId: 1 }, name: 'workspaceId_1_sheetRowId_1', unique: true, sparse: true },
      { key: { workspaceId: 1, orderId: 1 }, name: 'workspaceId_1_orderId_1' },
      
      // Index pour le polling
      { key: { workspaceId: 1, updatedAt: -1 }, name: 'workspaceId_1_updatedAt_-1_polling' }
    ];

    console.log('📊 Création des indexes...');

    // Créer chaque index
    for (const index of indexes) {
      try {
        await collection.createIndex(index.key, { 
          name: index.name,
          unique: index.unique,
          sparse: index.sparse,
          background: true // Créer en arrière-plan pour ne pas bloquer
        });
        console.log(`✅ Index créé: ${index.name}`);
      } catch (error) {
        if (error.code === 85) {
          console.log(`⚠️ Index déjà existant: ${index.name}`);
        } else {
          console.error(`❌ Erreur création index ${index.name}:`, error.message);
        }
      }
    }

    // Créer l'index textuel pour la recherche
    try {
      await collection.createIndex(
        {
          clientName: 'text',
          clientPhone: 'text',
          city: 'text',
          product: 'text',
          address: 'text'
        },
        {
          name: 'orders_search_index',
          weights: {
            clientName: 10,
            clientPhone: 8,
            city: 5,
            product: 5,
            address: 2
          },
          background: true
        }
      );
      console.log('✅ Index textuel créé: orders_search_index');
    } catch (error) {
      if (error.code === 85) {
        console.log('⚠️ Index textuel déjà existant: orders_search_index');
      } else {
        console.error('❌ Erreur création index textuel:', error.message);
      }
    }

    // Afficher les statistiques des indexes
    console.log('\n📈 Statistiques des indexes:');
    const indexStats = await collection.indexStats();
    
    indexStats.forEach(stat => {
      console.log(`📊 ${stat.name}: ${stat.size} bytes, ${stat.usageCount || 0} utilisations`);
    });

    // Analyser les requêtes lentes (si disponible)
    try {
      const slowQueries = await db.admin().command({
        profile: 2
      });
      
      if (slowQueries && slowQueries.ops) {
        console.log('\n🐌 Requêtes lentes détectées:');
        slowQueries.ops.slice(0, 5).forEach(op => {
          console.log(`⏱️ ${op.ns}: ${op.command.find || op.command.aggregate} (${op.millis}ms)`);
        });
      }
    } catch (error) {
      // Le profiling n'est peut-être pas activé
      console.log('ℹ️ Profiling des requêtes non disponible');
    }

    console.log('\n🎉 Setup des indexes terminé !');
    console.log('💡 Pour activer le profiling des requêtes lentes:');
    console.log('   db.setProfilingLevel(2, { slowms: 100 })');
    
  } catch (error) {
    console.error('❌ Erreur lors du setup des indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
};

// Script pour analyser les performances des requêtes
const analyzePerformance = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    
    const db = mongoose.connection.db;
    const collection = db.collection('ecom_orders');
    
    console.log('📊 Analyse des performances...');
    
    // Statistiques de la collection
    const stats = await collection.stats();
    console.log(`📈 Collection: ${stats.count} documents, ${stats.size} bytes`);
    
    // Index usage
    const indexStats = await collection.indexStats();
    console.log('\n📊 Utilisation des indexes:');
    indexStats.forEach(stat => {
      const usage = stat.usageCount || 0;
      const efficiency = usage > 0 ? `${usage} utilisations` : 'Non utilisé';
      console.log(`🔍 ${stat.name}: ${efficiency}`);
    });
    
    // Suggestions d'optimisation
    console.log('\n💡 Suggestions d\'optimisation:');
    
    // Vérifier les indexes non utilisés
    const unusedIndexes = indexStats.filter(stat => !stat.usageCount || stat.usageCount === 0);
    if (unusedIndexes.length > 0) {
      console.log('⚠️ Index non utilisés (à considérer pour suppression):');
      unusedIndexes.forEach(stat => {
        console.log(`   - ${stat.name}`);
      });
    }
    
    // Vérifier les requêtes sans index
    const explainResult = await collection.find({ workspaceId: new mongoose.Types.ObjectId() }).explain('executionStats');
    if (explainResult.executionStats.totalDocsExamined > explainResult.executionStats.totalDocsReturned) {
      console.log('⚠️ Certaines requêtes scannent plus de documents que nécessaire');
    }
    
  } catch (error) {
    console.error('❌ Erreur analyse performance:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Gestion des arguments de ligne de commande
const command = process.argv[2];

if (command === 'analyze') {
  analyzePerformance();
} else if (command === 'setup' || !command) {
  setupIndexes();
} else {
  console.log('Usage:');
  console.log('  node setupIndexes.js setup   - Créer les indexes');
  console.log('  node setupIndexes.js analyze - Analyser les performances');
  process.exit(1);
}
