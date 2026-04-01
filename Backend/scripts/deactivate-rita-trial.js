/**
 * deactivate-rita-trial.js
 * 
 * Script pour désactiver l'essai gratuit Rita sur un compte spécifique.
 * 
 * Usage:
 *   node Backend/scripts/deactivate-rita-trial.js <email-ou-userId>
 * 
 * Exemples:
 *   node Backend/scripts/deactivate-rita-trial.js user@example.com
 *   node Backend/scripts/deactivate-rita-trial.js 507f1f77bcf86cd799439011
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement depuis le dossier Backend
dotenv.config({ path: join(__dirname, '../.env') });

import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import { connectDB } from '../config/database.js';

async function deactivateRitaTrial() {
  try {
    // Récupérer l'argument de ligne de commande
    const userIdentifier = process.argv[2];

    if (!userIdentifier) {
      console.log('\n❌ Erreur : Veuillez fournir un email ou un userId');
      console.log('\n📋 Usage :');
      console.log('   node Backend/scripts/deactivate-rita-trial.js <email-ou-userId>');
      console.log('\n📌 Exemples :');
      console.log('   node Backend/scripts/deactivate-rita-trial.js user@example.com');
      console.log('   node Backend/scripts/deactivate-rita-trial.js 507f1f77bcf86cd799439011\n');
      process.exit(1);
    }

    console.log('🚀 Démarrage du script deactivate-rita-trial...\n');

    // Connexion à MongoDB
    await connectDB();
    console.log('✅ Connecté à MongoDB\n');

    // Chercher l'utilisateur par email ou userId
    let user;
    if (mongoose.Types.ObjectId.isValid(userIdentifier)) {
      user = await EcomUser.findById(userIdentifier);
    } else {
      user = await EcomUser.findOne({ email: userIdentifier });
    }

    if (!user) {
      console.log(`❌ Utilisateur non trouvé : ${userIdentifier}\n`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`👤 Utilisateur trouvé : ${user.email} (${user.name || 'Sans nom'})`);
    console.log(`   🆔 ID : ${user._id}\n`);

    // Chercher le workspace de l'utilisateur
    const workspace = user.workspaceId || await Workspace.findOne({ owner: user._id });

    if (!workspace) {
      console.log(`❌ Workspace non trouvé pour ${user.email}\n`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`🏢 Workspace trouvé : ${workspace.name}`);
    console.log(`   🆔 ID : ${workspace._id}`);
    console.log(`   📋 Plan : ${workspace.plan || 'free'}\n`);

    // Vérifier si un trial est actif
    const now = new Date();
    const hasActiveTrial = workspace.trialEndsAt && workspace.trialEndsAt > now && workspace.trialUsed;

    if (!hasActiveTrial && !workspace.trialStartedAt) {
      console.log('ℹ️  Aucun essai gratuit trouvé sur ce compte.\n');
      await mongoose.disconnect();
      return;
    }

    // Afficher l'état actuel du trial
    console.log('📊 État actuel de l\'essai :');
    console.log(`   ▪️ Trial utilisé : ${workspace.trialUsed ? 'Oui' : 'Non'}`);
    if (workspace.trialStartedAt) {
      console.log(`   ▪️ Démarré le : ${new Date(workspace.trialStartedAt).toLocaleDateString('fr-FR')}`);
    }
    if (workspace.trialEndsAt) {
      const status = workspace.trialEndsAt > now ? '🟢 Actif' : '🔴 Expiré';
      console.log(`   ▪️ Expire le : ${new Date(workspace.trialEndsAt).toLocaleDateString('fr-FR')} ${status}`);
    }
    console.log('');

    // Désactiver le trial en réinitialisant les champs
    workspace.trialStartedAt = null;
    workspace.trialEndsAt = null;
    workspace.trialUsed = false;
    workspace.trialExpiryNotifiedAt = null;
    workspace.trialExpiredNotifiedAt = null;

    await workspace.save();

    console.log('✅ Essai gratuit désactivé avec succès !\n');
    console.log('═══════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════');
    console.log(`👤 Utilisateur : ${user.email}`);
    console.log(`🏢 Workspace   : ${workspace.name}`);
    console.log(`🔧 Action      : Trial désactivé`);
    console.log('═══════════════════════════════════════\n');

    await mongoose.disconnect();
    console.log('✅ Déconnecté de MongoDB');
    console.log('🎉 Script terminé avec succès !\n');

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignorer les erreurs de déconnexion
    }
    process.exit(1);
  }
}

// Exécuter le script
deactivateRitaTrial();
