#!/usr/bin/env node
/**
 * Migration : nettoyer les descriptions HTML des produits existants
 * - Supprimer les boutons "Commander via WhatsApp" / "Confirmer via WhatsApp"
 * - Supprimer les liens "Retour à la boutique" / "← Retour"
 * - Supprimer border-radius sur les images
 * - Supprimer les anciens intro paragraphes avant les angles marketing
 *
 * Usage: node Backend/scripts/cleanProductDescriptions.mjs
 */

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ecom-cockpit';

// ── Schéma minimal pour éviter de charger tout le modèle ──────────────────────
const StoreProduct = mongoose.model('StoreProduct', new mongoose.Schema({
  description: String,
  workspaceId: mongoose.Schema.Types.Mixed,
  name: String,
}, { strict: false, collection: 'storeproducts' }));

function cleanDescription(html) {
  if (!html || typeof html !== 'string') return html;
  let cleaned = html;

  // 1. Supprimer les boutons / liens WhatsApp (wa.me ou text contenant WhatsApp)
  cleaned = cleaned.replace(/<a[^>]*href=["'][^"']*wa\.me[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
  cleaned = cleaned.replace(/<a[^>]*>[\s\S]*?([Cc]ommander|[Cc]onfirmer)[\s\S]*?[Ww]hat[sS]?[Aa]pp[\s\S]*?<\/a>/gi, '');
  cleaned = cleaned.replace(/<button[^>]*>[\s\S]*?[Ww]hat[sS]?[Aa]pp[\s\S]*?<\/button>/gi, '');

  // 2. Supprimer liens "Retour à la boutique" / "← Retour" / "Retour à l'accueil"
  cleaned = cleaned.replace(/<a[^>]*>[\s\S]*?[Rr]etour[\s\S]*?<\/a>/gi, '');
  cleaned = cleaned.replace(/<a[^>]*>[\s\S]*?←[\s\S]*?<\/a>/gi, '');

  // 3. Supprimer border-radius sur les images (les rendre carrées)
  cleaned = cleaned.replace(/(<img[^>]+style=["'][^"']*)border-radius\s*:\s*[^;'"]+;?\s*/gi, '$1');
  cleaned = cleaned.replace(/(<img[^>]+style=["'][^"']*)border-radius\s*:\s*[^;'"]+;?\s*/gi, '$1'); // 2e passe

  // 4. Ajouter aspect-ratio:1/1 et object-fit:cover sur les images qui n'en ont pas
  cleaned = cleaned.replace(
    /<img([^>]+style=["'])([^"']*)(["'][^>]*)>/gi,
    (match, before, styles, after) => {
      let s = styles;
      if (!s.includes('aspect-ratio')) s += ';aspect-ratio:1 / 1';
      if (!s.includes('object-fit')) s += ';object-fit:cover';
      // Retirer les anciens border-radius résiduels
      s = s.replace(/border-radius\s*:\s*[^;]+;?/gi, '');
      s = s.replace(/;;+/g, ';').replace(/^;/, '').replace(/;$/, '');
      return `<img${before}${s}${after}>`;
    }
  );

  // 5. Nettoyer les lignes vides multiples
  cleaned = cleaned.replace(/(\s*\n\s*){3,}/g, '\n\n');

  return cleaned.trim();
}

async function run() {
  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté');

  const products = await StoreProduct.find({
    description: { $exists: true, $ne: '', $regex: /<[^>]+>/ }
  }).select('_id name description').lean();

  console.log(`📦 ${products.length} produits avec description HTML trouvés`);

  let updated = 0, skipped = 0, errors = 0;

  for (const product of products) {
    try {
      const cleaned = cleanDescription(product.description);
      if (cleaned === product.description) {
        skipped++;
        continue;
      }
      await StoreProduct.updateOne({ _id: product._id }, { $set: { description: cleaned } });
      console.log(`  ✅ Nettoyé: ${product.name?.slice(0, 50)}`);
      updated++;
    } catch (err) {
      console.error(`  ❌ Erreur sur ${product.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Résultat: ${updated} nettoyés, ${skipped} inchangés, ${errors} erreurs`);
  await mongoose.disconnect();
  console.log('🔌 Déconnecté');
}

run().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
