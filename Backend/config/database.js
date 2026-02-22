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
      serverSelectionTimeoutMS: 0, // Pas de timeout — attend indéfiniment le serveur
      socketTimeoutMS: 0, // Pas de timeout socket
      connectTimeoutMS: 0, // Pas de timeout connexion
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

