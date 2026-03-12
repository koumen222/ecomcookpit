/**
 * Script de migration pour corriger les clés Base64URL des subscriptions push
 * 
 * Ce script normalise toutes les clés auth et p256dh en Base64URL
 * pour éviter l'erreur "use maximum of 32 characters from the URL or filename-safe Base64 characters set"
 * 
 * Usage: node Backend/scripts/fixPushSubscriptions.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Subscription from '../models/Subscription.js';
import { base64ToBase64Url, validateAndNormalizeSubscription } from '../utils/vapidUtils.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI manquant dans .env');
  process.exit(1);
}

async function fixPushSubscriptions() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');
    
    // Récupérer toutes les subscriptions
    const subscriptions = await Subscription.find({});
    console.log(`\n📊 ${subscriptions.length} subscriptions trouvées`);
    
    let fixed = 0;
    let deleted = 0;
    let alreadyValid = 0;
    let errors = 0;
    
    for (const sub of subscriptions) {
      try {
        // Vérifier si les clés sont déjà valides
        const currentAuth = sub.keys.auth;
        const currentP256dh = sub.keys.p256dh;
        
        // Normaliser les clés
        const normalizedAuth = base64ToBase64Url(currentAuth);
        const normalizedP256dh = base64ToBase64Url(currentP256dh);
        
        // Vérifier si la normalisation a changé quelque chose
        if (currentAuth === normalizedAuth && currentP256dh === normalizedP256dh) {
          // Valider quand même pour s'assurer que c'est correct
          try {
            validateAndNormalizeSubscription({
              endpoint: sub.endpoint,
              keys: {
                auth: normalizedAuth,
                p256dh: normalizedP256dh
              }
            });
            alreadyValid++;
            console.log(`✓ Subscription ${sub._id}: déjà valide`);
          } catch (validationError) {
            // Invalide, supprimer
            console.log(`🗑️ Subscription ${sub._id}: invalide, suppression`);
            await Subscription.findByIdAndDelete(sub._id);
            deleted++;
          }
        } else {
          // Mettre à jour avec les clés normalisées
          try {
            // Valider avant de sauvegarder
            validateAndNormalizeSubscription({
              endpoint: sub.endpoint,
              keys: {
                auth: normalizedAuth,
                p256dh: normalizedP256dh
              }
            });
            
            sub.keys.auth = normalizedAuth;
            sub.keys.p256dh = normalizedP256dh;
            await sub.save();
            
            fixed++;
            console.log(`🔧 Subscription ${sub._id}: clés normalisées`);
            console.log(`   - auth: ${currentAuth.substring(0, 10)}... → ${normalizedAuth.substring(0, 10)}...`);
            console.log(`   - p256dh: ${currentP256dh.substring(0, 10)}... → ${normalizedP256dh.substring(0, 10)}...`);
          } catch (validationError) {
            // Invalide même après normalisation, supprimer
            console.log(`🗑️ Subscription ${sub._id}: invalide après normalisation, suppression`);
            console.log(`   Erreur: ${validationError.message}`);
            await Subscription.findByIdAndDelete(sub._id);
            deleted++;
          }
        }
      } catch (error) {
        console.error(`❌ Erreur pour subscription ${sub._id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(60));
    console.log(`✅ Déjà valides:      ${alreadyValid}`);
    console.log(`🔧 Corrigées:         ${fixed}`);
    console.log(`🗑️ Supprimées:        ${deleted}`);
    console.log(`❌ Erreurs:           ${errors}`);
    console.log(`📊 Total:             ${subscriptions.length}`);
    console.log('='.repeat(60));
    
    if (fixed > 0 || deleted > 0) {
      console.log('\n✅ Migration terminée avec succès!');
      console.log('💡 Les notifications push devraient maintenant fonctionner correctement.');
    } else if (alreadyValid === subscriptions.length) {
      console.log('\n✅ Toutes les subscriptions sont déjà valides!');
    } else {
      console.log('\n⚠️ Migration terminée avec des erreurs.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
fixPushSubscriptions();
