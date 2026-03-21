#!/usr/bin/env node

/**
 * Script de suppression de toutes les boutiques
 * ⚠️ ATTENTION: Ce script supprime TOUTES les données des boutiques de manière IRRÉVERSIBLE
 * 
 * Usage (depuis le dossier Backend):
 *   node scripts/deleteAllStores.js
 *   node scripts/deleteAllStores.js --confirm
 *   node scripts/deleteAllStores.js --dry-run
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

// Import des modèles
import Workspace from '../models/Workspace.js';
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import EcomUser from '../models/EcomUser.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import AnalyticsSession from '../models/AnalyticsSession.js';
import Client from '../models/Client.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Campaign from '../models/Campaign.js';
import EmailCampaign from '../models/EmailCampaign.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
import Notification from '../models/Notification.js';
import Transaction from '../models/Transaction.js';

// Configuration
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ecom-cockpit';
const LOG_FILE = join(__dirname, 'deletion-log.txt');

// Arguments de ligne de commande
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isConfirmed = args.includes('--confirm');
const isForced = args.includes('--force');

// Statistiques de suppression
let deletionStats = {
  workspaces: 0,
  users: 0,
  products: 0,
  orders: 0,
  storeOrders: 0,
  clients: 0,
  campaigns: 0,
  analytics: 0,
  transactions: 0,
  notifications: 0,
  whatsappLogs: 0,
  errors: []
};

/**
 * Logger avec timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  
  console.log(logMessage);
  
  // Écrire dans le fichier de log
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
    console.log('\n⚠️  ATTENTION: Cette action va supprimer TOUTES les boutiques et données associées!');
    console.log('📋 Données qui seront supprimées:');
    console.log('   • Tous les workspaces (boutiques)');
    console.log('   • Tous les utilisateurs e-commerce');
    console.log('   • Tous les produits des boutiques');
    console.log('   • Toutes les commandes');
    console.log('   • Tous les clients');
    console.log('   • Toutes les campagnes');
    console.log('   • Toutes les données d\'analytics');
    console.log('   • Toutes les transactions');
    console.log('   • Toutes les notifications');
    console.log('   • Tous les logs WhatsApp\n');
    
    rl.question('❓ Êtes-vous ABSOLUMENT SÛR de vouloir continuer? Tapez "SUPPRIMER TOUT" pour confirmer: ', (answer) => {
      rl.close();
      resolve(answer === 'SUPPRIMER TOUT');
    });
  });
}

/**
 * Suppression sécurisée d'une collection
 */
async function deleteCollection(Model, collectionName, workspaceIds = null) {
  try {
    let filter = {};
    
    // Si on a des workspaceIds spécifiques, filtrer par ça
    if (workspaceIds && workspaceIds.length > 0) {
      filter = { workspaceId: { $in: workspaceIds } };
    }

    if (isDryRun) {
      const count = await Model.countDocuments(filter);
      log(`[DRY RUN] ${collectionName}: ${count} documents seraient supprimés`);
      return count;
    } else {
      const result = await Model.deleteMany(filter);
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
    const backupFile = join(backupDir, `backup-${timestamp}.json`);

    // Créer le dossier de sauvegarde
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Compter les documents avant suppression
    const counts = {
      workspaces: await Workspace.countDocuments(),
      users: await EcomUser.countDocuments(),
      products: await StoreProduct.countDocuments(),
      orders: await Order.countDocuments(),
      storeOrders: await StoreOrder.countDocuments(),
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
async function deleteAllStores() {
  log('🚀 Début du processus de suppression');
  
  // Créer une sauvegarde des métadonnées
  await createBackup();

  // Récupérer tous les workspaceIds avant suppression
  const workspaces = await Workspace.find({}, '_id name slug owner').lean();
  const workspaceIds = workspaces.map(w => w._id);
  
  log(`📊 Trouvé ${workspaces.length} boutiques à supprimer`);
  
  if (workspaces.length > 0) {
    log('🏪 Boutiques à supprimer:');
    workspaces.forEach(ws => {
      log(`   • ${ws.name} (${ws.slug}) - ID: ${ws._id}`);
    });
  }

  // Suppression des données associées aux workspaces
  log('\n📦 Suppression des données associées...');
  
  deletionStats.products = await deleteCollection(StoreProduct, 'Produits boutique', workspaceIds);
  deletionStats.storeOrders = await deleteCollection(StoreOrder, 'Commandes boutique', workspaceIds);
  deletionStats.clients = await deleteCollection(Client, 'Clients', workspaceIds);
  deletionStats.orders = await deleteCollection(Order, 'Commandes', workspaceIds);
  deletionStats.campaigns = await deleteCollection(Campaign, 'Campagnes', workspaceIds);
  
  // Suppression des données par workspaceId
  deletionStats.analytics += await deleteCollection(AnalyticsEvent, 'Événements analytics', workspaceIds);
  deletionStats.analytics += await deleteCollection(AnalyticsSession, 'Sessions analytics', workspaceIds);
  deletionStats.transactions = await deleteCollection(Transaction, 'Transactions', workspaceIds);
  deletionStats.notifications = await deleteCollection(Notification, 'Notifications', workspaceIds);
  deletionStats.whatsappLogs = await deleteCollection(WhatsAppLog, 'Logs WhatsApp', workspaceIds);

  // Suppression des produits internes
  try {
    const productResult = isDryRun 
      ? await Product.countDocuments({ workspaceId: { $in: workspaceIds } })
      : await Product.deleteMany({ workspaceId: { $in: workspaceIds } });
    
    const count = isDryRun ? productResult : productResult.deletedCount;
    deletionStats.products += count;
    log(`✅ Produits internes: ${count} documents ${isDryRun ? 'seraient supprimés' : 'supprimés'}`);
  } catch (error) {
    log(`❌ Erreur suppression produits internes: ${error.message}`, 'error');
  }

  // Suppression des campagnes email
  try {
    const emailResult = isDryRun
      ? await EmailCampaign.countDocuments({ workspaceId: { $in: workspaceIds } })
      : await EmailCampaign.deleteMany({ workspaceId: { $in: workspaceIds } });
    
    const count = isDryRun ? emailResult : emailResult.deletedCount;
    deletionStats.campaigns += count;
    log(`✅ Campagnes email: ${count} documents ${isDryRun ? 'seraient supprimés' : 'supprimés'}`);
  } catch (error) {
    log(`❌ Erreur suppression campagnes email: ${error.message}`, 'error');
  }

  // Suppression des utilisateurs ecom (propriétaires des workspaces)
  log('\n👥 Suppression des utilisateurs...');
  const ownerIds = workspaces.map(w => w.owner).filter(Boolean);
  if (ownerIds.length > 0) {
    try {
      const userResult = isDryRun
        ? await EcomUser.countDocuments({ _id: { $in: ownerIds } })
        : await EcomUser.deleteMany({ _id: { $in: ownerIds } });
      
      deletionStats.users = isDryRun ? userResult : userResult.deletedCount;
      log(`✅ Utilisateurs: ${deletionStats.users} ${isDryRun ? 'seraient supprimés' : 'supprimés'}`);
    } catch (error) {
      log(`❌ Erreur suppression utilisateurs: ${error.message}`, 'error');
    }
  }

  // Suppression des workspaces en dernier
  log('\n🏪 Suppression des boutiques...');
  deletionStats.workspaces = await deleteCollection(Workspace, 'Boutiques (Workspaces)');

  // Statistiques finales
  log('\n📈 RÉSUMÉ DE LA SUPPRESSION:');
  log(`   🏪 Boutiques: ${deletionStats.workspaces}`);
  log(`   👥 Utilisateurs: ${deletionStats.users}`);
  log(`   📦 Produits: ${deletionStats.products}`);
  log(`   🛒 Commandes: ${deletionStats.orders + deletionStats.storeOrders}`);
  log(`   👤 Clients: ${deletionStats.clients}`);
  log(`   📧 Campagnes: ${deletionStats.campaigns}`);
  log(`   📊 Analytics: ${deletionStats.analytics}`);
  log(`   💰 Transactions: ${deletionStats.transactions}`);
  log(`   🔔 Notifications: ${deletionStats.notifications}`);
  log(`   💬 Logs WhatsApp: ${deletionStats.whatsappLogs}`);
  
  if (deletionStats.errors.length > 0) {
    log(`\n❌ Erreurs rencontrées: ${deletionStats.errors.length}`);
    deletionStats.errors.forEach(error => log(`   • ${error}`));
  }

  const totalDeleted = Object.values(deletionStats).reduce((sum, val) => 
    typeof val === 'number' ? sum + val : sum, 0
  );
  
  log(`\n🎯 TOTAL: ${totalDeleted} documents ${isDryRun ? 'seraient supprimés' : 'supprimés'}`);
  
  if (isDryRun) {
    log('\n💡 Ceci était un test! Aucune donnée n\'a été supprimée.');
    log('   Pour exécuter réellement: node scripts/deleteAllStores.js --confirm');
  } else {
    log('\n✅ Suppression terminée avec succès!');
  }
}

/**
 * Fonction principale
 */
async function main() {
  try {
    // Bannière
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                🗑️  SUPPRESSION DES BOUTIQUES                  ║');
    console.log('║                                                              ║');
    console.log('║  ⚠️  ATTENTION: Ce script supprime TOUTES les données       ║');
    console.log('║      des boutiques de manière IRRÉVERSIBLE!                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Vérifier le mode
    if (isDryRun) {
      log('🧪 MODE TEST activé - Aucune suppression réelle ne sera effectuée');
    } else if (!isConfirmed && !isForced) {
      const confirmed = await askConfirmation();
      if (!confirmed) {
        log('❌ Suppression annulée par l\'utilisateur');
        process.exit(0);
      }
    }

    // Connexion à MongoDB
    log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log('✅ Connecté à MongoDB');

    // Vérifier qu'il y a des données à supprimer
    const workspaceCount = await Workspace.countDocuments();
    if (workspaceCount === 0) {
      log('ℹ️  Aucune boutique trouvée à supprimer');
      process.exit(0);
    }

    // Lancer la suppression
    await deleteAllStores();

  } catch (error) {
    log(`💥 Erreur fatale: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    // Fermer la connexion
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      log('🔌 Connexion MongoDB fermée');
    }
  }
}

// Gestion des signaux pour une fermeture propre
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
