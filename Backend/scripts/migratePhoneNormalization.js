import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env depuis le dossier parent (Backend/)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Order from '../models/Order.js';
import { normalizePhone } from '../utils/phoneUtils.js';

/**
 * Script de migration pour normaliser tous les numéros de téléphone existants
 * Ajoute le champ phoneNormalized aux Clients et clientPhoneNormalized aux Orders
 */

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/scalor';

async function migratePhoneNormalization() {
  try {
    console.log('🚀 Démarrage de la migration de normalisation des téléphones...\n');
    
    // Connexion à MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // ========== MIGRATION DES CLIENTS ==========
    console.log('📋 Migration des Clients...');
    const clients = await Client.find({}).lean();
    console.log(`   Trouvé ${clients.length} clients à traiter`);
    
    let clientsUpdated = 0;
    let clientsSkipped = 0;
    let clientsInvalid = 0;

    for (const client of clients) {
      if (!client.phone || !client.phone.trim()) {
        clientsSkipped++;
        continue;
      }

      const normalized = normalizePhone(client.phone);
      
      if (!normalized) {
        console.log(`   ⚠️  Client ${client._id}: numéro invalide "${client.phone}"`);
        clientsInvalid++;
        continue;
      }

      // Mettre à jour uniquement si différent
      if (client.phoneNormalized !== normalized) {
        await Client.updateOne(
          { _id: client._id },
          { $set: { phoneNormalized: normalized } }
        );
        clientsUpdated++;
        
        if (clientsUpdated % 100 === 0) {
          console.log(`   ⏳ ${clientsUpdated} clients mis à jour...`);
        }
      }
    }

    console.log(`\n✅ Migration Clients terminée:`);
    console.log(`   - ${clientsUpdated} clients mis à jour`);
    console.log(`   - ${clientsSkipped} clients sans téléphone`);
    console.log(`   - ${clientsInvalid} clients avec numéro invalide\n`);

    // ========== MIGRATION DES COMMANDES ==========
    console.log('📦 Migration des Commandes...');
    const orders = await Order.find({}).lean();
    console.log(`   Trouvé ${orders.length} commandes à traiter`);
    
    let ordersUpdated = 0;
    let ordersSkipped = 0;
    let ordersInvalid = 0;

    for (const order of orders) {
      if (!order.clientPhone || !order.clientPhone.trim()) {
        ordersSkipped++;
        continue;
      }

      const normalized = normalizePhone(order.clientPhone);
      
      if (!normalized) {
        console.log(`   ⚠️  Commande ${order._id}: numéro invalide "${order.clientPhone}"`);
        ordersInvalid++;
        continue;
      }

      // Mettre à jour uniquement si différent
      if (order.clientPhoneNormalized !== normalized) {
        await Order.updateOne(
          { _id: order._id },
          { $set: { clientPhoneNormalized: normalized } }
        );
        ordersUpdated++;
        
        if (ordersUpdated % 100 === 0) {
          console.log(`   ⏳ ${ordersUpdated} commandes mises à jour...`);
        }
      }
    }

    console.log(`\n✅ Migration Commandes terminée:`);
    console.log(`   - ${ordersUpdated} commandes mises à jour`);
    console.log(`   - ${ordersSkipped} commandes sans téléphone`);
    console.log(`   - ${ordersInvalid} commandes avec numéro invalide\n`);

    // ========== VÉRIFICATION ==========
    console.log('🔍 Vérification des index...');
    
    const clientIndexes = await Client.collection.getIndexes();
    const hasClientPhoneNormalizedIndex = Object.keys(clientIndexes).some(
      key => key.includes('phoneNormalized')
    );
    
    const orderIndexes = await Order.collection.getIndexes();
    const hasOrderPhoneNormalizedIndex = Object.keys(orderIndexes).some(
      key => key.includes('clientPhoneNormalized')
    );

    if (hasClientPhoneNormalizedIndex) {
      console.log('   ✅ Index Client.phoneNormalized existe');
    } else {
      console.log('   ⚠️  Index Client.phoneNormalized manquant - sera créé au redémarrage');
    }

    if (hasOrderPhoneNormalizedIndex) {
      console.log('   ✅ Index Order.clientPhoneNormalized existe');
    } else {
      console.log('   ⚠️  Index Order.clientPhoneNormalized manquant - sera créé au redémarrage');
    }

    // ========== STATISTIQUES FINALES ==========
    console.log('\n📊 Statistiques finales:');
    
    const totalClientsWithNormalized = await Client.countDocuments({ 
      phoneNormalized: { $exists: true, $ne: null } 
    });
    const totalOrdersWithNormalized = await Order.countDocuments({ 
      clientPhoneNormalized: { $exists: true, $ne: null } 
    });

    console.log(`   - ${totalClientsWithNormalized} clients avec phoneNormalized`);
    console.log(`   - ${totalOrdersWithNormalized} commandes avec clientPhoneNormalized`);

    // Exemples de numéros normalisés
    console.log('\n📞 Exemples de numéros normalisés:');
    const sampleClients = await Client.find({ 
      phoneNormalized: { $exists: true, $ne: null } 
    })
      .select('phone phoneNormalized')
      .limit(5)
      .lean();

    sampleClients.forEach(c => {
      console.log(`   "${c.phone}" → "${c.phoneNormalized}"`);
    });

    console.log('\n✅ Migration terminée avec succès!\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

// Exécuter la migration
migratePhoneNormalization();
