import mongoose from 'mongoose';
import Order from './models/Order.js';

// Script de debugging pour vérifier les statuts des commandes
async function debugOrders() {
  try {
    // Connexion à la base de données (adapter selon votre config)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plateforme');
    
    console.log('🔍 Debug des commandes...\n');
    
    // 1. Vérifier tous les statuts uniques dans la base
    const uniqueStatuses = await Order.distinct('status');
    console.log('📊 Statuts uniques trouvés:', uniqueStatuses);
    
    // 2. Compter les commandes par statut
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } },
          sampleOrders: { $push: { orderId: '$orderId', clientName: '$clientName', price: '$price', quantity: '$quantity' } }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 Détail par statut:');
    statusCounts.forEach(stat => {
      console.log(`\n${stat._id}:`);
      console.log(`   Nombre: ${stat.count}`);
      console.log(`   Revenu: ${stat.totalRevenue} FCFA`);
      console.log(`   Exemples: ${stat.sampleOrders.slice(0, 3).map(o => `#${o.orderId} (${o.clientName})`).join(', ')}`);
    });
    
    // 3. Vérifier spécifiquement les commandes "livré" vs "delivered"
    const deliveredOrders = await Order.find({ 
      $or: [
        { status: 'delivered' },
        { status: 'livré' },
        { status: 'livre' },
        { status: /livr/i }
      ]
    }).limit(5);
    
    console.log('\n🎯 Commandes avec statut "livré" (variations):');
    deliveredOrders.forEach(order => {
      console.log(`   #${order.orderId} - Statut: "${order.status}" - ${order.clientName} - ${order.price * order.quantity} FCFA`);
    });
    
    // 4. Vérifier le revenu total des commandes livrées
    const deliveredRevenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } }, count: { $sum: 1 } } }
    ]);
    
    console.log('\n💰 Revenu total des commandes "delivered":');
    if (deliveredRevenue.length > 0) {
      console.log(`   ${deliveredRevenue[0].count} commandes = ${deliveredRevenue[0].totalRevenue} FCFA`);
    } else {
      console.log('   0 commandes trouvées avec status="delivered"');
    }
    
    // 5. Vérifier toutes les commandes avec prix > 0
    const ordersWithPrice = await Order.find({ price: { $gt: 0 } }).limit(5);
    console.log('\n💵 Exemples de commandes avec prix > 0:');
    ordersWithPrice.forEach(order => {
      console.log(`   #${order.orderId} - Statut: "${order.status}" - ${order.clientName} - ${order.price} FCFA x ${order.quantity}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugOrders();
