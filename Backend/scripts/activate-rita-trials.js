/**
 * activate-rita-trials.js
 * 
 * Script pour activer l'essai gratuit de 14 jours pour tous les utilisateurs
 * qui ont déjà activé Rita IA, et leur envoyer un email de bienvenue.
 * 
 * Usage:
 *   node Backend/scripts/activate-rita-trials.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement depuis le dossier Backend
dotenv.config({ path: join(__dirname, '../.env') });

import RitaConfig from '../models/RitaConfig.js';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import { sendNotificationEmail } from '../core/notifications/email.service.js';
import { connectDB } from '../config/database.js';

const TRIAL_DURATION_DAYS = 14;

async function activateRitaTrials() {
  try {
    console.log('🚀 Démarrage du script activate-rita-trials...\n');

    // Connexion à MongoDB via la config existante
    await connectDB();
    console.log('✅ Connecté à MongoDB\n');

    // 1. Trouver tous les RitaConfig avec enabled: true
    const ritaConfigs = await RitaConfig.find({ enabled: true }).lean();
    console.log(`📊 ${ritaConfigs.length} configurations Rita actives trouvées\n`);

    if (ritaConfigs.length === 0) {
      console.log('ℹ️  Aucun utilisateur Rita trouvé. Script terminé.');
      await mongoose.disconnect();
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 2. Traiter chaque configuration Rita
    for (const config of ritaConfigs) {
      try {
        const userId = config.userId;
        
        if (!userId) {
          console.log(`⚠️  Config ${config._id} sans userId - ignorée`);
          skipCount++;
          continue;
        }

        // 3. Récupérer l'utilisateur
        const user = await EcomUser.findById(userId).populate('workspaceId');
        
        if (!user) {
          console.log(`⚠️  Utilisateur ${userId} non trouvé - ignoré`);
          skipCount++;
          continue;
        }

        if (!user.email) {
          console.log(`⚠️  Utilisateur ${userId} (${user.name}) sans email - ignoré`);
          skipCount++;
          continue;
        }

        // 4. Récupérer le workspace
        const workspace = user.workspaceId || await Workspace.findOne({ owner: user._id });
        
        if (!workspace) {
          console.log(`⚠️  Workspace non trouvé pour ${user.email} - ignoré`);
          skipCount++;
          continue;
        }

        // 5. Vérifier si le trial est déjà actif
        if (workspace.trialStartedAt && workspace.trialEndsAt && workspace.trialEndsAt > Date.now()) {
          console.log(`ℹ️  ${user.email} - Trial déjà actif, expire le ${new Date(workspace.trialEndsAt).toLocaleDateString('fr-FR')}`);
          skipCount++;
          continue;
        }

        // 6. Activer le trial
        const now = new Date();
        const endsAt = new Date(now.getTime() + (TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000));

        workspace.trialStartedAt = now;
        workspace.trialEndsAt = endsAt;
        workspace.trialUsed = true;
        workspace.trialExpiryNotifiedAt = null; // Reset notifications
        workspace.trialExpiredNotifiedAt = null;

        await workspace.save();

        console.log(`✅ ${user.email} - Trial activé jusqu'au ${endsAt.toLocaleDateString('fr-FR')}`);

        // 7. Envoyer l'email de bienvenue
        try {
          await sendNotificationEmail({
            to: user.email,
            templateKey: 'rita_trial_started',
            data: {
              name: user.name || 'Utilisateur',
              workspaceName: workspace.name || 'Votre espace',
              trialDays: TRIAL_DURATION_DAYS,
              trialEndsAt: endsAt.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })
            },
            userId: user._id,
            workspaceId: workspace._id,
            eventType: 'rita_trial_started'
          });

          console.log(`   📧 Email envoyé à ${user.email}`);
          successCount++;
        } catch (emailError) {
          console.error(`   ❌ Erreur envoi email à ${user.email}:`, emailError.message);
          errorCount++;
        }

        console.log(''); // Ligne vide pour la lisibilité

      } catch (userError) {
        console.error(`❌ Erreur pour config ${config._id}:`, userError.message);
        errorCount++;
      }
    }

    // 8. Résumé
    console.log('\n═══════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Succès        : ${successCount}`);
    console.log(`⚠️  Ignorés       : ${skipCount}`);
    console.log(`❌ Erreurs       : ${errorCount}`);
    console.log(`📋 Total configs : ${ritaConfigs.length}`);
    console.log('═══════════════════════════════════════\n');

    await mongoose.disconnect();
    console.log('✅ Déconnecté de MongoDB');
    console.log('🎉 Script terminé avec succès !');

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Exécuter le script
activateRitaTrials();
