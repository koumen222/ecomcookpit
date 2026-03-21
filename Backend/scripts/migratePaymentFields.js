import mongoose from 'mongoose';
import StockOrder from '../models/StockOrder.js';

// Script pour ajouter les champs de paiement aux anciennes commandes
async function migratePaymentFields() {
  try {
    console.log('🔄 Début de la migration des champs de paiement...');
    
    // Connexion à la base de données
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scalor');
    console.log('✅ Connecté à MongoDB');

    // Trouver toutes les commandes qui n'ont pas les champs de paiement
    const ordersWithoutPaymentFields = await StockOrder.find({
      $or: [
        { paidPurchase: { $exists: false } },
        { paidTransport: { $exists: false } },
        { paid: { $exists: false } }
      ]
    });

    console.log(`📊 ${ordersWithoutPaymentFields.length} commandes à migrer`);

    let updatedCount = 0;
    let errorCount = 0;

    // Mettre à jour chaque commande
    for (const order of ordersWithoutPaymentFields) {
      try {
        // Ajouter les champs avec des valeurs par défaut
        const updateData = {};
        
        if (order.paidPurchase === undefined) {
          updateData.paidPurchase = false;
        }
        
        if (order.paidTransport === undefined) {
          updateData.paidTransport = false;
        }
        
        if (order.paid === undefined) {
          updateData.paid = false;
        }

        if (Object.keys(updateData).length > 0) {
          await StockOrder.updateOne(
            { _id: order._id },
            { $set: updateData }
          );
          updatedCount++;
          console.log(`✅ Commande ${order._id} mise à jour`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Erreur mise à jour commande ${order._id}:`, error.message);
      }
    }

    console.log(`\n🎉 Migration terminée:`);
    console.log(`   ✅ ${updatedCount} commandes mises à jour avec succès`);
    console.log(`   ❌ ${errorCount} erreurs`);
    
    if (errorCount === 0) {
      console.log(`\n🚀 Toutes les anciennes commandes sont maintenant compatibles avec les nouveaux champs de paiement!`);
    }

  } catch (error) {
    console.error('💥 Erreur lors de la migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

// Exécuter la migration
migratePaymentFields();
