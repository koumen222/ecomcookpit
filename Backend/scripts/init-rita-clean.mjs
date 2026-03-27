#!/usr/bin/env node
/**
 * Script pour créer une config Rita propre de zéro
 * Utilisation: node init-rita-clean.mjs <userId>
 */
import mongoose from 'mongoose';
import RitaConfig from '../models/RitaConfig.js';

// Connexion directe
async function connectDB() {
  const uri = 'mongodb+srv://scalor:GJfKVWcdWfBLKk23@cluster0.amitjh7.mongodb.net/plateforme?retryWrites=true&w=majority&appName=Cluster0';
  return mongoose.connect(uri);
}

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Usage: node init-rita-clean.mjs <userId>');
  console.error('   Exemple: node init-rita-clean.mjs 676d8e9c1234567890abcdef');
  process.exit(1);
}

async function initRita() {
  try {
    await connectDB();
    console.log('🚀 Initialisation RitaConfig propre...\n');

    const config = {
      userId,
      enabled: false,
      instanceId: '',
      agentName: 'Rita',
      welcomeMessage: 'Bonjour 👋 Bienvenue ! Comment puis-je vous aider ?',
      productCatalog: [
        {
          name: 'Produit 1',
          price: '10000 FCFA',
          description: 'Description du produit 1',
          category: 'Catégorie 1',
          images: [],
          videos: [],
          features: ['Fonctionnalité 1', 'Fonctionnalité 2'],
          inStock: true,
          quantityOffers: [],
        },
        {
          name: 'Produit 2',
          price: '20000 FCFA',
          description: 'Description du produit 2',
          category: 'Catégorie 2',
          images: [],
          videos: [],
          features: ['Fonctionnalité A', 'Fonctionnalité B'],
          inStock: true,
          quantityOffers: [],
        },
      ],
      bossPhone: '',
      bossNotifications: false,
      notifyOnOrder: true,
    };

    const created = await RitaConfig.findOneAndUpdate(
      { userId },
      config,
      { upsert: true, new: true }
    );

    console.log('✅ Config Rita créée:\n');
    console.log(`   userId:          ${created.userId}`);
    console.log(`   agentName:       ${created.agentName}`);
    console.log(`   enabled:         ${created.enabled}`);
    console.log(`   instanceId:      ${created.instanceId || '(vide)'}`);
    console.log(`   welcomeMessage:  ${created.welcomeMessage}`);
    console.log(`   productCatalog:  ${created.productCatalog.length} produit(s)`);
    created.productCatalog.forEach((p, i) => {
      console.log(`      ${i + 1}. ${p.name} - ${p.price}`);
    });
    console.log(`   bossPhone:       ${created.bossPhone || '(vide)'}`);
    console.log(`   bossNotifications: ${created.bossNotifications}`);
    console.log('\n✨ Prêt à configurer via le frontend!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

initRita();
