#!/usr/bin/env node

/**
 * Script de test pour la suppression des boutiques
 * Teste le script en mode dry-run pour vérifier qu'il fonctionne
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Test du script de suppression en mode dry-run...\n');

// Exécuter le script principal en mode dry-run
const deleteScript = join(__dirname, 'deleteAllStores.js');
const child = spawn('node', [deleteScript, '--dry-run'], {
  stdio: 'inherit',
  cwd: dirname(__dirname)
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Test terminé avec succès!');
    console.log('📋 Le script de suppression est prêt à être utilisé.');
  } else {
    console.log(`\n❌ Test échoué avec le code: ${code}`);
  }
});

child.on('error', (error) => {
  console.error('❌ Erreur lors du test:', error.message);
});
