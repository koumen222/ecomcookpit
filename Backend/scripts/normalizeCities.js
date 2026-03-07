/**
 * Script de migration pour normaliser toutes les villes dans la base de données
 * Usage: node Backend/scripts/normalizeCities.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { normalizeCity } from '../utils/cityNormalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env depuis Backend/
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecomcookpit';

if (!process.env.MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI non trouvé dans .env, utilisation de la valeur par défaut');
}

async function normalizeCitiesInDatabase() {
  try {
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Normaliser les villes dans les commandes
    console.log('\n📦 Normalisation des villes dans les commandes...');
    const orders = await Order.find({ city: { $exists: true, $ne: '' } }).lean();
    console.log(`   Trouvé ${orders.length} commandes avec une ville`);

    let orderUpdated = 0;
    for (const order of orders) {
      const normalized = normalizeCity(order.city);
      if (normalized && normalized !== order.city) {
        await Order.updateOne({ _id: order._id }, { $set: { city: normalized } });
        orderUpdated++;
        if (orderUpdated % 100 === 0) {
          console.log(`   ⏳ ${orderUpdated} commandes mises à jour...`);
        }
      }
    }
    console.log(`✅ ${orderUpdated} commandes mises à jour`);

    // Normaliser les villes dans les clients
    console.log('\n👥 Normalisation des villes dans les clients...');
    const clients = await Client.find({ city: { $exists: true, $ne: '' } }).lean();
    console.log(`   Trouvé ${clients.length} clients avec une ville`);

    let clientUpdated = 0;
    for (const client of clients) {
      const normalized = normalizeCity(client.city);
      if (normalized && normalized !== client.city) {
        await Client.updateOne({ _id: client._id }, { $set: { city: normalized } });
        clientUpdated++;
        if (clientUpdated % 100 === 0) {
          console.log(`   ⏳ ${clientUpdated} clients mis à jour...`);
        }
      }
    }
    console.log(`✅ ${clientUpdated} clients mis à jour`);

    // Statistiques finales
    console.log('\n📊 Statistiques de normalisation:');
    console.log(`   - Commandes mises à jour: ${orderUpdated}/${orders.length}`);
    console.log(`   - Clients mis à jour: ${clientUpdated}/${clients.length}`);
    
    // Afficher les villes uniques après normalisation
    const uniqueCities = await Order.distinct('city');
    console.log(`\n🏙️  ${uniqueCities.length} villes uniques après normalisation:`);
    uniqueCities.sort().forEach(city => console.log(`   - ${city}`));

    console.log('\n✅ Migration terminée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

normalizeCitiesInDatabase();
