/**
 * Test direct de la génération d'images OpenAI (text-to-image + image-to-image).
 * Usage : node scripts/test-openai-image.js
 * Affiche l'erreur brute d'OpenAI (quota, paramètre, modèle…) ou l'URL R2 finale.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const { generateOpenAiImage, generateOpenAiImageEdit, isOpenAiImageConfigured } = await import('../services/openaiImageService.js');

if (!isOpenAiImageConfigured()) {
  console.error('❌ OPENAI_IMAGE_API_KEY / OPENAI_API_KEY absente du .env');
  process.exit(1);
}

console.log('— Test 1 : text-to-image (gpt-image-2, 1:1, medium)…');
try {
  const url = await generateOpenAiImage('Un mug de café beige sur une table en bois clair, photo produit studio, fond neutre', '1:1');
  console.log('✅ text-to-image OK →', url);
} catch (e) {
  console.error('❌ text-to-image ÉCHEC →', e.message);
  process.exit(1);
}

console.log('— Test 2 : image-to-image (référence = image générée au test 1)…');
try {
  // On réutilise une petite image publique comme référence
  const refUrl = 'https://placehold.co/512x512/e5e7eb/9ca3af.jpg?text=Produit';
  const url = await generateOpenAiImageEdit('Place ce produit sur un fond de studio vert élégant avec une ombre douce', [refUrl], '4:5');
  console.log('✅ image-to-image OK →', url);
} catch (e) {
  console.error('❌ image-to-image ÉCHEC →', e.message);
  process.exit(1);
}

console.log('🎉 Chaîne complète OpenAI → R2 fonctionnelle.');
process.exit(0);
