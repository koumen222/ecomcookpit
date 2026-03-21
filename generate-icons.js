// Script pour générer toutes les tailles d'icônes à partir d'une image source
// Utilise sharp pour le redimensionnement

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const sourceImage = path.join(__dirname, 'public', 'icon-source.png');
const publicDir = path.join(__dirname, 'public');
const iconsDir = path.join(publicDir, 'icons');

async function generateIcons() {
  try {
    // Vérifier que l'image source existe
    await fs.access(sourceImage);
    
    console.log('📸 Génération des icônes...');
    
    // Créer le dossier icons s'il n'existe pas
    await fs.mkdir(iconsDir, { recursive: true });
    
    // Générer l'icône principale
    await sharp(sourceImage)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(publicDir, 'icon.png'));
    
    console.log('✅ icon.png (512x512)');
    
    // Générer toutes les tailles
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      await sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ icon-${size}x${size}.png`);
    }
    
    console.log('\n🎉 Toutes les icônes ont été générées avec succès !');
    console.log(`📁 Dossier: ${iconsDir}`);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Erreur: Fichier source introuvable');
      console.log('💡 Placez votre image dans: public/icon-source.png');
    } else {
      console.error('❌ Erreur:', error.message);
    }
    process.exit(1);
  }
}

generateIcons();
