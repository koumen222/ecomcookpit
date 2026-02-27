import { PrismaClient } from '@prisma/client';

// Créer le client Prisma avec reconnexion automatique
const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'pretty',
});

// État de la connexion
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 secondes

// Fonction de reconnexion
const reconnectPrisma = async () => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
    return;
  }
  
  reconnectAttempts++;
  console.log(`🔄 Tentative de reconnexion PostgreSQL (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  try {
    await prisma.$disconnect();
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
    await prisma.$connect();
    isConnected = true;
    reconnectAttempts = 0;
    console.log('✅ PostgreSQL reconnecté avec succès');
  } catch (error) {
    console.error('❌ Échec de la reconnexion:', error.message);
    setTimeout(() => reconnectPrisma(), RECONNECT_DELAY);
  }
};

// Middleware pour intercepter les erreurs de connexion
prisma.$use(async (params, next) => {
  try {
    const result = await next(params);
    isConnected = true;
    return result;
  } catch (error) {
    if (error.message?.includes('connection') || error.message?.includes('closed') || error.code === 'P1001' || error.code === 'P1002') {
      console.error('⚠️ Erreur de connexion PostgreSQL détectée:', error.message);
      isConnected = false;
      // Tenter une reconnexion en arrière-plan
      if (reconnectAttempts === 0) {
        reconnectPrisma();
      }
    }
    throw error;
  }
});

// Gestion de la connexion
export const connectPrisma = async () => {
  try {
    console.log('🔄 Tentative de connexion à PostgreSQL (Supabase)...');
    
    // Test de connexion avec retry
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await prisma.$connect();
        isConnected = true;
        reconnectAttempts = 0;
        console.log('✅ PostgreSQL connecté avec succès');
        console.log('📊 Base de données: Supabase PostgreSQL');
        return prisma;
      } catch (err) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`⏳ Tentative ${attempts}/${maxAttempts} échouée, nouvelle tentative dans 3s...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          throw err;
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:');
    console.error('   Type:', error.name);
    console.error('   Message:', error.message);
    
    if (error.message.includes('Can\'t reach database server')) {
      console.error('   Cause: Impossible de se connecter au serveur PostgreSQL');
      console.error('   Solutions possibles:');
      console.error('     1. Vérifiez que l\'URL DATABASE_URL est correcte dans .env');
      console.error('     2. Vérifiez que votre IP est autorisée dans Supabase:');
      console.error('        - Allez dans Settings > Database > Connection Pooling');
      console.error('        - Ajoutez votre IP ou utilisez 0.0.0.0/0 pour autoriser toutes les IP');
      console.error('     3. Vérifiez que le mot de passe est correctement encodé (@ devient %40)');
      console.error('     4. Vérifiez votre connexion internet');
    } else if (error.message.includes('authentication failed')) {
      console.error('   Cause: Authentification échouée');
      console.error('   Vérifiez le username et password dans DATABASE_URL');
    }
    
    console.error('\n   URL utilisée (masquée):', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***:***@'));
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.error('\n⚠️  Mode développement: Le serveur continuera mais PostgreSQL n\'est pas connecté');
      console.error('   Relancez le serveur après avoir corrigé le problème\n');
    }
  }
};

// Déconnexion propre
export const disconnectPrisma = async () => {
  await prisma.$disconnect();
  console.log('🔌 Connexion PostgreSQL fermée');
};

// Gestion des signaux de fermeture
process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectPrisma();
  process.exit(0);
});

export default prisma;
