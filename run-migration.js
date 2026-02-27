// Script pour exécuter la migration depuis Node.js
const token = process.argv[2];

if (!token) {
  console.error('❌ Usage: node run-migration.js <TOKEN>');
  console.error('Récupère le token depuis localStorage.getItem("ecomToken") dans la console du navigateur');
  process.exit(1);
}

fetch('http://localhost:8080/api/ecom/reports/migrate-financials', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  if (data.success) {
    console.log(`✅ Migration réussie !`);
    console.log(`   - ${data.data.updated} rapports mis à jour`);
    console.log(`   - ${data.data.errors} erreurs`);
    console.log(`   - ${data.data.total} total`);
  } else {
    console.error('❌ Erreur:', data.message);
  }
})
.catch(err => {
  console.error('❌ Erreur réseau:', err.message);
});
