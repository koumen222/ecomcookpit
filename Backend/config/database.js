import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/plateforme';

export const connectDB = async () => {
  try {
    console.log('🔄 Tentative de connexion à MongoDB...');
    console.log('📡 URI:', MONGO_URI.replace(/\/\/.*@/, '//***:***@')); // Masquer les credentials dans les logs
    
    // Options de connexion optimisées pour MongoDB Atlas
    const connectionOptions = {
      serverSelectionTimeoutMS: 30000, // 30s pour la sélection du serveur
      socketTimeoutMS: 60000, // 60s timeout socket
      connectTimeoutMS: 30000, // 30s timeout connexion
      heartbeatFrequencyMS: 10000, // Vérifier la connexion toutes les 10s
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      // Pour MongoDB Atlas spécifiquement
      ...(MONGO_URI.includes('mongodb.net') && {
        tls: true,
        tlsAllowInvalidCertificates: false,
      })
    };
    
    await mongoose.connect(MONGO_URI, connectionOptions);
    
    console.log('✅ MongoDB connecté avec succès');
    console.log('📊 Base de données:', mongoose.connection.db.databaseName);
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('🔌 Port:', mongoose.connection.port);

    // Supprimer l'index webhookToken_1 non-sparse s'il existe (cause E11000 sur null)
    try {
      await mongoose.connection.db.collection('order_sources').dropIndex('webhookToken_1');
      console.log('🗑️  Index webhookToken_1 supprimé (remplacé par index sparse)');
    } catch (e) {
      // Ignore si l'index n'existe pas
    }

    // Nettoyer les webhookToken:null existants (sparse index ignore undefined, pas null)
    try {
      const res = await mongoose.connection.db.collection('order_sources').updateMany(
        { webhookToken: null },
        { $unset: { webhookToken: '' } }
      );
      if (res.modifiedCount > 0) {
        console.log(`🧹 ${res.modifiedCount} OrderSource(s) avec webhookToken:null corrigé(s)`);
      }
    } catch (e) {
      // Ignore
    }

    // ── Multi-store migration ──────────────────────────────────────────────
    // For each workspace with a subdomain but no primaryStoreId yet,
    // create a Store document and link it back to the workspace.
    try {
      const Workspace = mongoose.model('EcomWorkspace');
      const Store = mongoose.model('Store');
      const workspacesToMigrate = await Workspace.find({
        subdomain: { $exists: true, $ne: null, $ne: '' },
        primaryStoreId: { $exists: false }
      }).select('_id name subdomain storeSettings storeTheme storePages storePixels storePayments storeDomains storeDeliveryZones whatsappAutoConfirm whatsappOrderTemplate whatsappAutoInstanceId whatsappAutoImageUrl whatsappAutoAudioUrl whatsappAutoVideoUrl whatsappAutoDocumentUrl whatsappAutoSendOrder whatsappAutoProductMediaRules shopifyWebhookToken orderWebhookToken orderWebhookFilters owner').lean();

      let migrated = 0;
      for (const ws of workspacesToMigrate) {
        const existing = await Store.findOne({ workspaceId: ws._id }).select('_id').lean();
        if (existing) {
          // Already has a store — just link it
          await Workspace.updateOne({ _id: ws._id }, { $set: { primaryStoreId: existing._id } });
          continue;
        }
        const store = await Store.create({
          workspaceId: ws._id,
          name: ws.storeSettings?.storeName || ws.name,
          subdomain: ws.subdomain,
          isActive: true,
          storeSettings: { ...ws.storeSettings, isStoreEnabled: ws.storeSettings?.isStoreEnabled ?? false },
          storeTheme: ws.storeTheme || {},
          storePages: ws.storePages || null,
          storePixels: ws.storePixels || {},
          storePayments: ws.storePayments || {},
          storeDomains: ws.storeDomains || {},
          storeDeliveryZones: ws.storeDeliveryZones || { countries: [], zones: [] },
          whatsappAutoConfirm: ws.whatsappAutoConfirm || false,
          whatsappOrderTemplate: ws.whatsappOrderTemplate || '',
          whatsappAutoInstanceId: ws.whatsappAutoInstanceId || null,
          whatsappAutoImageUrl: ws.whatsappAutoImageUrl || '',
          whatsappAutoAudioUrl: ws.whatsappAutoAudioUrl || '',
          whatsappAutoVideoUrl: ws.whatsappAutoVideoUrl || '',
          whatsappAutoDocumentUrl: ws.whatsappAutoDocumentUrl || '',
          whatsappAutoSendOrder: ws.whatsappAutoSendOrder || [],
          whatsappAutoProductMediaRules: ws.whatsappAutoProductMediaRules || [],
          createdBy: ws.owner
        });
        await Workspace.updateOne({ _id: ws._id }, { $set: { primaryStoreId: store._id } });
        // Also tag existing products/orders for this workspace with this storeId
        await mongoose.connection.db.collection('store_products').updateMany(
          { workspaceId: ws._id, storeId: { $exists: false } },
          { $set: { storeId: store._id } }
        );
        await mongoose.connection.db.collection('store_orders').updateMany(
          { workspaceId: ws._id, storeId: { $exists: false } },
          { $set: { storeId: store._id } }
        );
        migrated++;
      }
      if (migrated > 0) console.log(`🏪 Multi-store migration: ${migrated} workspace(s) migrés vers le modèle Store`);
    } catch (migErr) {
      console.error('⚠️ Multi-store migration error (non-fatal):', migErr.message);
    }
    // ──────────────────────────────────────────────────────────────────────
    
    // Suivi de déconnexion avec signalement périodique
    let disconnectedSince = null;
    let disconnectLogInterval = null;

    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err.message || err);
    });
    
    mongoose.connection.on('disconnected', () => {
      disconnectedSince = new Date();
      console.log('⚠️  MongoDB déconnecté — en attente de reconnexion...');
      // Signaler périodiquement sans arrêter
      if (!disconnectLogInterval) {
        disconnectLogInterval = setInterval(() => {
          if (disconnectedSince) {
            const sec = Math.round((Date.now() - disconnectedSince.getTime()) / 1000);
            console.log(`⏳ MongoDB toujours déconnecté depuis ${sec}s — le serveur continue de tourner...`);
          }
        }, 15000);
      }
    });
    
    mongoose.connection.on('reconnected', () => {
      const downtime = disconnectedSince ? Math.round((Date.now() - disconnectedSince.getTime()) / 1000) : 0;
      console.log(`🔄 MongoDB reconnecté${downtime > 0 ? ` (déconnecté pendant ${downtime}s)` : ''}`);
      disconnectedSince = null;
      if (disconnectLogInterval) {
        clearInterval(disconnectLogInterval);
        disconnectLogInterval = null;
      }
    });
    
    mongoose.connection.on('close', () => {
      console.log('🔌 Connexion MongoDB fermée');
    });
    
    // Health check périodique pour maintenir la connexion active
    const healthCheckInterval = setInterval(async () => {
      if (mongoose.connection.readyState === 1) { // 1 = connected
        try {
          await mongoose.connection.db.admin().ping();
        } catch (err) {
          console.error('⚠️ Health check MongoDB échoué:', err.message);
        }
      }
    }, 30000); // Ping toutes les 30 secondes
    
    // Nettoyer l'intervalle si la connexion se ferme
    mongoose.connection.on('close', () => {
      clearInterval(healthCheckInterval);
    });
    
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:');
    console.error('   Type:', error.name);
    console.error('   Message:', error.message);
    
    if (error.name === 'MongoServerSelectionError' || error.name === 'MongooseServerSelectionError') {
      console.error('   Cause: Impossible de se connecter au serveur MongoDB');
      if (MONGO_URI.includes('mongodb.net')) {
        console.error('   Vous utilisez MongoDB Atlas');
        console.error('   Solutions possibles:');
        console.error('     1. Autoriser votre IP dans MongoDB Atlas:');
        console.error('        - Allez dans Network Access > Add IP Address');
        console.error('        - Ajoutez "0.0.0.0/0" pour autoriser toutes les IP (développement)');
        console.error('        - Ou ajoutez votre IP spécifique');
        console.error('     2. Vérifiez que l\'URI de connexion est correcte');
        console.error('     3. Vérifiez votre connexion internet');
        console.error('     4. Vérifiez les credentials (username/password) dans l\'URI');
        console.error('     5. Attendez quelques secondes et réessayez (première connexion peut être lente)');
      } else {
        console.error('   Vérifiez que MongoDB est démarré localement');
        console.error('   Commande: mongod (ou service MongoDB démarré)');
      }
    } else if (error.name === 'MongoParseError') {
      console.error('   Cause: URI MongoDB invalide');
      console.error('   Vérifiez le format de MONGO_URI dans votre .env');
      console.error('   Format attendu: mongodb+srv://username:password@cluster.mongodb.net/database');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('   Cause: Impossible de résoudre le nom de domaine');
      console.error('   Vérifiez votre connexion internet et l\'URI MongoDB');
    } else if (error.message.includes('authentication failed')) {
      console.error('   Cause: Authentification échouée');
      console.error('   Vérifiez le username et password dans l\'URI MongoDB');
    }
    
    console.error('\n   URI utilisée (masquée):', MONGO_URI.replace(/\/\/.*@/, '//***:***@'));
    
    // Ne pas quitter immédiatement en développement, permettre les retries
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.error('\n⚠️  Mode développement: Le serveur continuera mais MongoDB n\'est pas connecté');
      console.error('   Relancez le serveur après avoir corrigé le problème\n');
    }
  }
};

