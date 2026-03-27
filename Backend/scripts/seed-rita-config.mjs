#!/usr/bin/env node
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import RitaConfig from '../models/RitaConfig.js';

async function seedRitaConfig() {
  try {
    await connectDB();
    console.log('🌱 Seeding RitaConfig...\n');

    // Exemple de config propre pour les tests
    const testConfig = {
      userId: '676d8e9c1234567890abcdef', // Remplacez par un vrai userId
      enabled: true,
      instanceId: '', // À remplir avec une vraie instance
      agentName: 'Rita Premium Market',
      welcomeMessage: 'Bonjour 👋 Bienvenue chez Premium Market ! Quel produit vous intéresse ?',
      productCatalog: [
        {
          name: 'Montre Connectée',
          price: '25000 FCFA',
          description: 'Montre intelligente avec suivi cardiaque et notifications',
          category: 'Électronique',
          images: [],
          videos: [],
          features: ['Écran tactile', 'Batterie 7j', 'Résistance à l\'eau'],
          inStock: true,
          quantityOffers: [
            { minQuantity: 2, unitPrice: '23000 FCFA', totalPrice: '46000 FCFA', label: '2+ -8%' },
            { minQuantity: 5, unitPrice: '20000 FCFA', totalPrice: '100000 FCFA', label: '5+ -20%' },
          ],
        },
        {
          name: 'Casque Bluetooth',
          price: '15000 FCFA',
          description: 'Casque audio sans fil avec micro intégré',
          category: 'Audio',
          images: [],
          videos: [],
          features: ['Autonomie 30h', 'Réduction bruit', 'Microphone'],
          inStock: true,
          quantityOffers: [
            { minQuantity: 3, unitPrice: '13000 FCFA', totalPrice: '39000 FCFA', label: '3+ -13%' },
          ],
        },
        {
          name: 'Gummies Intimes',
          price: '8000 FCFA',
          description: 'Complément naturel pour la santé intime',
          category: 'Santé',
          images: [],
          videos: [],
          features: ['100% naturel', 'Saveur orange', 'Formule exclusive'],
          inStock: true,
          quantityOffers: [
            { minQuantity: 10, unitPrice: '7000 FCFA', totalPrice: '70000 FCFA', label: '10+ -12%' },
          ],
        },
      ],
      bossPhone: '', // À remplir si besoin
      bossNotifications: false,
      notifyOnOrder: true,
    };

    const created = await RitaConfig.findOneAndUpdate(
      { userId: testConfig.userId },
      testConfig,
      { upsert: true, new: true }
    );

    console.log('✅ RitaConfig créée avec succès:');
    console.log(`   - userId: ${created.userId}`);
    console.log(`   - agentName: ${created.agentName}`);
    console.log(`   - produits: ${created.productCatalog.length}`);
    console.log(`   - enabled: ${created.enabled}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

seedRitaConfig();
