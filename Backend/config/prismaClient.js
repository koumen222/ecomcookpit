  import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Créer le pool PostgreSQL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Créer l'adapter
const adapter = new PrismaPg(pool);

// Créer le client Prisma avec l'adapter
const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty',
});

// Gestion de la connexion
export const connectPrisma = async () => {
  try {
    console.log('🔄 Tentative de connexion à PostgreSQL (Supabase)...');
    
    // Test de connexion
    await prisma.$connect();
    
    console.log('✅ PostgreSQL connecté avec succès');
    console.log('📊 Base de données: Supabase PostgreSQL');
    
    return prisma;
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
