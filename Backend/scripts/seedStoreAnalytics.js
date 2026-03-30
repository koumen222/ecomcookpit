import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import StoreAnalytics from '../models/StoreAnalytics.js';
import StoreOrder from '../models/StoreOrder.js';
import Workspace from '../models/Workspace.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecomcookpit';

async function seedStoreAnalytics() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Trouver un workspace avec une boutique
    const workspace = await Workspace.findOne({ storeSubdomain: { $exists: true, $ne: null } });
    
    if (!workspace) {
      console.log('❌ Aucun workspace avec boutique trouvé');
      process.exit(1);
    }

    console.log(`📦 Workspace trouvé: ${workspace.name} (${workspace.storeSubdomain})`);

    const workspaceId = workspace._id.toString();
    const subdomain = workspace.storeSubdomain;

    // Générer des événements analytics pour les 7 derniers jours
    const events = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Générer des sessions aléatoires pour chaque jour
      const sessionsCount = Math.floor(Math.random() * 50) + 20;
      
      for (let j = 0; j < sessionsCount; j++) {
        const sessionId = `session_${date.getTime()}_${j}`;
        const deviceTypes = ['mobile', 'desktop', 'tablet'];
        const device = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
        
        // Page view
        events.push({
          workspaceId,
          subdomain,
          eventType: 'page_view',
          page: { path: '/', title: 'Accueil' },
          visitor: {
            device,
            browser: 'Chrome',
            country: 'CM',
            city: 'Douala'
          },
          sessionId,
          timestamp: new Date(date.getTime() + j * 60000)
        });
        
        // 60% voient un produit
        if (Math.random() > 0.4) {
          events.push({
            workspaceId,
            subdomain,
            eventType: 'product_view',
            productId: `prod_${Math.floor(Math.random() * 10)}`,
            productName: `Produit ${Math.floor(Math.random() * 10)}`,
            productPrice: Math.floor(Math.random() * 50000) + 5000,
            visitor: { device, browser: 'Chrome', country: 'CM', city: 'Douala' },
            sessionId,
            timestamp: new Date(date.getTime() + j * 60000 + 30000)
          });
        }
        
        // 30% ajoutent au panier
        if (Math.random() > 0.7) {
          events.push({
            workspaceId,
            subdomain,
            eventType: 'add_to_cart',
            productId: `prod_${Math.floor(Math.random() * 10)}`,
            productName: `Produit ${Math.floor(Math.random() * 10)}`,
            productPrice: Math.floor(Math.random() * 50000) + 5000,
            visitor: { device, browser: 'Chrome', country: 'CM', city: 'Douala' },
            sessionId,
            timestamp: new Date(date.getTime() + j * 60000 + 60000)
          });
        }
        
        // 10% commencent le checkout
        if (Math.random() > 0.9) {
          events.push({
            workspaceId,
            subdomain,
            eventType: 'checkout_started',
            visitor: { device, browser: 'Chrome', country: 'CM', city: 'Douala' },
            sessionId,
            timestamp: new Date(date.getTime() + j * 60000 + 90000)
          });
        }
        
        // 5% passent commande
        if (Math.random() > 0.95) {
          const orderValue = Math.floor(Math.random() * 100000) + 10000;
          events.push({
            workspaceId,
            subdomain,
            eventType: 'order_placed',
            orderId: `order_${date.getTime()}_${j}`,
            orderValue,
            visitor: { device, browser: 'Chrome', country: 'CM', city: 'Douala' },
            sessionId,
            timestamp: new Date(date.getTime() + j * 60000 + 120000)
          });
        }
      }
    }

    console.log(`📊 Insertion de ${events.length} événements analytics...`);
    await StoreAnalytics.insertMany(events);
    console.log('✅ Événements analytics insérés');

    // Créer quelques commandes de test
    const orders = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(Math.random() * 7));
      
      const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      orders.push({
        workspaceId,
        subdomain,
        orderNumber: `ORD-${Date.now()}-${i}`,
        customerName: `Client ${i}`,
        phone: `+237600000${i}`,
        email: `client${i}@example.com`,
        address: `Adresse ${i}`,
        city: 'Douala',
        products: [{
          productId: `prod_${i}`,
          name: `Produit ${i}`,
          price: Math.floor(Math.random() * 50000) + 5000,
          quantity: Math.floor(Math.random() * 3) + 1
        }],
        total: Math.floor(Math.random() * 100000) + 10000,
        status,
        channel: 'store',
        createdAt: date,
        updatedAt: date
      });
    }

    console.log(`📦 Insertion de ${orders.length} commandes...`);
    await StoreOrder.insertMany(orders);
    console.log('✅ Commandes insérées');

    console.log('\n🎉 Données de test créées avec succès !');
    console.log(`   Workspace: ${workspace.name}`);
    console.log(`   Subdomain: ${subdomain}`);
    console.log(`   Événements: ${events.length}`);
    console.log(`   Commandes: ${orders.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

seedStoreAnalytics();
