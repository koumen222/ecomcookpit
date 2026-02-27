// Script pour générer toutes les tailles d'icônes à partir du SVG
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgSource = path.join(__dirname, 'public', 'icon.svg');
const publicDir = path.join(__dirname, 'public');
const iconsDir = path.join(publicDir, 'icons');

async function generateIcons() {
  try {
    console.log('📸 Génération des icônes depuis SVG...');
    
    // Lire le SVG
    const svgBuffer = await fs.readFile(svgSource);
    
    // Créer le dossier icons s'il n'existe pas
    await fs.mkdir(iconsDir, { recursive: true });
    
    // Générer l'icône principale 512x512
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon.png'));
    
    console.log('✅ icon.png (512x512)');
    
    // Générer toutes les tailles
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ icon-${size}x${size}.png`);
    }
    
    console.log('\n🎉 Toutes les icônes ont été générées avec succès !');
    console.log(`📁 Icône principale: ${path.join(publicDir, 'icon.png')}`);
    console.log(`📁 Autres tailles: ${iconsDir}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

generateIcons();
