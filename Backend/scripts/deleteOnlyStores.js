#!/usr/bin/env node

/**
 * Script de suppression des données des STORES PUBLICS uniquement
 * ⚠️ Ce script supprime UNIQUEMENT les données des boutiques publiques
 * Les WORKSPACES sont CONSERVÉS (utilisateurs, campagnes, clients, etc.)
 * 
 * Usage (depuis le dossier Backend):
 *   node scripts/deleteOnlyStores.js --dry-run
 *   node scripts/deleteOnlyStores.js --confirm
 */

import mongoose from 'mongoose';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Charger les variables d'environnement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Import des modèles STORES uniquement
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import Workspace from '../models/Workspace.js';

// Configuration
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ecom-cockpit';
const LOG_FILE = join(__dirname, 'deletion-stores-log.txt');

// Arguments de ligne de commande
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isConfirmed = args.includes('--confirm');

// Statistiques de suppression
let deletionStats = {
  storeProducts: 0,
  storeOrders: 0,
  workspacesUpdated: 0,
  errors: []
};

/**
 * Logger avec timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  
  console.log(logMessage);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error('Erreur écriture log:', error.message);
  }
}

/**
 * Confirmation interactive
 */
async function askConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  ATTENTION: Cette action va supprimer les données des STORES PUBLICS!');
    console.log('📋 Données qui seront supprimées:');
    console.log('   ✅ Produits des boutiques publiques (StoreProduct)');
    console.log('   ✅ Commandes des boutiques publiques (StoreOrder)');
    console.log('   ✅ Configurations de pages des boutiques\n');
    console.log('📋 Données qui seront CONSERVÉES:');
    console.log('   ✅ Workspaces (boutiques)');
    console.log('   ✅ Utilisateurs');
    console.log('   ✅ Clients');
    console.log('   ✅ Commandes internes');
    console.log('   ✅ Campagnes');
    console.log('   ✅ Analytics');
    console.log('   ✅ Toutes les autres données\n');
    
    rl.question('❓ Confirmer la suppression des STORES uniquement? Tapez "SUPPRIMER STORES" pour confirmer: ', (answer) => {
      rl.close();
      resolve(answer === 'SUPPRIMER STORES');
    });
  });
}

/**
 * Suppression sécurisée d'une collection
 */
async function deleteCollection(Model, collectionName) {
  try {
    if (isDryRun) {
      const count = await Model.countDocuments({});
      log(`[DRY RUN] ${collectionName}: ${count} documents seraient supprimés`);
      return count;
    } else {
      const result = await Model.deleteMany({});
      log(`✅ ${collectionName}: ${result.deletedCount} documents supprimés`);
      return result.deletedCount;
    }
  } catch (error) {
    const errorMsg = `❌ Erreur suppression ${collectionName}: ${error.message}`;
    log(errorMsg, 'error');
    deletionStats.errors.push(errorMsg);
    return 0;
  }
}

/**
 * Réinitialiser les configurations de pages des workspaces
 */
async function resetWorkspacePages() {
  try {
    const workspaces = await Workspace.find({}).lean();
    log(`📊 Trouvé ${workspaces.length} workspaces à réinitialiser`);

    if (isDryRun) {
      const workspacesWithPages = workspaces.filter(w => 
        w.settings?.storefront?.pages || 
        w.settings?.storefront?.sections ||
        w.settings?.theme
      );
      log(`[DRY RUN] ${workspacesWithPages.length} workspaces auraient leurs pages réinitialisées`);
      return workspacesWithPages.length;
    } else {
      let updated = 0;
      for (const workspace of workspaces) {
        const updateFields = {};
        
        // Réinitialiser les pages/sections si elles existent
        if (workspace.settings?.storefront?.pages) {
          updateFields['settings.storefront.pages'] = [];
        }
        if (workspace.settings?.storefront?.sections) {
          updateFields['settings.storefront.sections'] = [];
        }
        
        if (Object.keys(updateFields).length > 0) {
          await Workspace.updateOne(
            { _id: workspace._id },
            { $set: updateFields }
          );
          updated++;
          log(`  ✅ Réinitialisé: ${workspace.name} (${workspace.slug})`);
        }
      }
      
      log(`✅ ${updated} workspaces réinitialisés`);
      return updated;
    }
  } catch (error) {
    const errorMsg = `❌ Erreur réinitialisation workspaces: ${error.message}`;
    log(errorMsg, 'error');
    deletionStats.errors.push(errorMsg);
    return 0;
  }
}

/**
 * Sauvegarde avant suppression
 */
async function createBackup() {
  if (isDryRun) {
    log('[DRY RUN] Sauvegarde serait créée');
    return;
  }

  try {
    const backupDir = join(__dirname, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = join(backupDir, `backup-stores-${timestamp}.json`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const counts = {
      storeProducts: await StoreProduct.countDocuments(),
      storeOrders: await StoreOrder.countDocuments(),
      workspaces: await Workspace.countDocuments(),
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(backupFile, JSON.stringify(counts, null, 2));
    log(`💾 Sauvegarde des métadonnées créée: ${backupFile}`);
  } catch (error) {
    log(`⚠️  Erreur création sauvegarde: ${error.message}`, 'warning');
  }
}

/**
 * Suppression principale
 */
async function deleteStoresOnly() {
  log('🚀 Début du processus de suppression des STORES PUBLICS');
  
  await createBackup();

  // Suppression des produits des boutiques publiques
  log('\n📦 Suppression des produits des boutiques publiques...');
  deletionStats.storeProducts = await deleteCollection(StoreProduct, 'Produits boutiques (StoreProduct)');

  // Suppression des commandes des boutiques publiques
  log('\n🛒 Suppression des commandes des boutiques publiques...');
  deletionStats.storeOrders = await deleteCollection(StoreOrder, 'Commandes boutiques (StoreOrder)');

  // Réinitialisation des pages des workspaces
  log('\n🔄 Réinitialisation des configurations de pages...');
  deletionStats.workspacesUpdated = await resetWorkspacePages();

  // Statistiques finales
  log('\n📈 RÉSUMÉ DE LA SUPPRESSION:');
  log(`   📦 Produits boutiques: ${deletionStats.storeProducts}`);
  log(`   🛒 Commandes boutiques: ${deletionStats.storeOrders}`);
  log(`   🔄 Workspaces réinitialisés: ${deletionStats.workspacesUpdated}`);
  
  if (deletionStats.errors.length > 0) {
    log(`\n❌ Erreurs rencontrées: ${deletionStats.errors.length}`);
    deletionStats.errors.forEach(error => log(`   • ${error}`));
  }

  const totalDeleted = deletionStats.storeProducts + deletionStats.storeOrders;
  
  log(`\n🎯 TOTAL: ${totalDeleted} documents ${isDryRun ? 'seraient supprimés' : 'supprimés'}`);
  log(`📊 ${deletionStats.workspacesUpdated} workspaces ${isDryRun ? 'seraient réinitialisés' : 'réinitialisés'}`);
  
  if (isDryRun) {
    log('\n💡 Ceci était un test! Aucune donnée n\'a été supprimée.');
    log('   Pour exécuter réellement: node scripts/deleteOnlyStores.js --confirm');
  } else {
    log('\n✅ Suppression des stores terminée avec succès!');
    log('ℹ️  Les workspaces, utilisateurs et autres données sont conservés.');
  }
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           🏪 SUPPRESSION DES STORES PUBLICS UNIQUEMENT        ║');
    console.log('║                                                              ║');
    console.log('║  ℹ️  Ce script supprime UNIQUEMENT les données des stores   ║');
    console.log('║      Les WORKSPACES et autres données sont CONSERVÉS        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (isDryRun) {
      log('🧪 MODE TEST activé - Aucune suppression réelle ne sera effectuée');
    } else if (!isConfirmed) {
      const confirmed = await askConfirmation();
      if (!confirmed) {
        log('❌ Suppression annulée par l\'utilisateur');
        process.exit(0);
      }
    }

    log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log('✅ Connecté à MongoDB');

    const storeProductCount = await StoreProduct.countDocuments();
    const storeOrderCount = await StoreOrder.countDocuments();
    
    if (storeProductCount === 0 && storeOrderCount === 0) {
      log('ℹ️  Aucune donnée de store trouvée à supprimer');
      process.exit(0);
    }

    log(`📊 Trouvé ${storeProductCount} produits et ${storeOrderCount} commandes de stores`);

    await deleteStoresOnly();

  } catch (error) {
    log(`💥 Erreur fatale: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      log('🔌 Connexion MongoDB fermée');
    }
  }
}

// Gestion des signaux
process.on('SIGINT', async () => {
  log('\n🛑 Interruption détectée, fermeture...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('\n🛑 Arrêt demandé, fermeture...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

// Exécuter le script
main();
