import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import EcomUser from '../models/EcomUser.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/plateforme';

const firstNames = [
  'Amadou', 'Fatima', 'Ousmane', 'Aïcha', 'Ibrahim', 'Mariam', 'Moussa', 'Aminata',
  'Abdoulaye', 'Salimata', 'Mamadou', 'Fatoumata', 'Seydou', 'Kadiatou', 'Boubacar',
  'Rokia', 'Souleymane', 'Awa', 'Dramane', 'Djénéba', 'Modibo', 'Oumou', 'Cheick',
  'Bintou', 'Adama', 'Safiatou', 'Youssouf', 'Hawa', 'Bakary', 'Nana', 'Tidiane',
  'Fanta', 'Lamine', 'Sira', 'Demba', 'Coumba', 'Ibrahima', 'Mariama', 'Samba',
  'Djeneba', 'Oumar', 'Assétou', 'Kalilou', 'Sanata', 'Sékou', 'Tenin', 'Hamidou',
  'Kadidia', 'Drissa', 'Maïmouna'
];

const lastNames = [
  'Diallo', 'Traoré', 'Koné', 'Coulibaly', 'Touré', 'Cissé', 'Keïta', 'Bamba',
  'Sangaré', 'Dembélé', 'Camara', 'Sylla', 'Diarra', 'Fofana', 'Konaté',
  'Sissoko', 'Kanté', 'Ouattara', 'Samaké', 'Doumbia', 'Sacko', 'Bagayoko',
  'Sidibé', 'Maïga', 'Haidara', 'Dicko', 'Bah', 'Tall', 'Sow', 'Ndiaye'
];

const domains = [
  'gmail.com', 'yahoo.fr', 'outlook.com', 'hotmail.com', 'orange.ml',
  'afribone.net', 'yahoo.com', 'protonmail.com', 'icloud.com', 'live.fr'
];

const roles = ['ecom_admin', 'ecom_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'];

const currencies = ['XAF', 'XOF', 'XAF', 'XAF', 'XOF', 'MAD', 'NGN', 'GNF'];

const businessTypes = ['ecommerce', 'services', 'mode', 'alimentation', 'cosmétiques', 'électronique', 'artisanat'];
const ordersPerMonth = ['0-10', '10-50', '50-100', '100-500', '500+'];

function randomPhone() {
  const prefixes = ['+223', '+221', '+225', '+224', '+226', '+227', '+228', '+229', '+237', '+241'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(Math.random() * 90000000 + 10000000);
  return `${prefix}${num}`;
}

function randomDate(daysBack) {
  const now = Date.now();
  return new Date(now - Math.floor(Math.random() * daysBack * 86400000));
}

async function seed() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    const existingCount = await EcomUser.countDocuments();
    console.log(`📊 EcomUsers existants: ${existingCount}`);

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < 100; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const email = `${firstName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${lastName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${i + 1000}@${domain}`;
      const name = `${firstName} ${lastName}`;
      const role = roles[Math.floor(Math.random() * roles.length)];
      const phone = randomPhone();
      const currency = currencies[Math.floor(Math.random() * currencies.length)];
      const createdAt = randomDate(90);
      const isActive = Math.random() > 0.15;
      const hasLoggedIn = Math.random() > 0.3;
      const lastLogin = hasLoggedIn ? randomDate(30) : null;

      const existing = await EcomUser.findOne({ email });
      if (existing) {
        skipped++;
        continue;
      }

      await EcomUser.create({
        email,
        password: 'Scalor2024!',
        name,
        phone,
        role,
        isActive,
        lastLogin,
        currency,
        onboardingData: {
          businessType: businessTypes[Math.floor(Math.random() * businessTypes.length)],
          ordersPerMonth: ordersPerMonth[Math.floor(Math.random() * ordersPerMonth.length)],
          completed: Math.random() > 0.4
        },
        createdAt
      });

      created++;
      if ((i + 1) % 10 === 0) {
        console.log(`  ⏳ ${i + 1}/100 traités...`);
      }
    }

    const totalCount = await EcomUser.countDocuments();
    const activeCount = await EcomUser.countDocuments({ isActive: true });
    console.log(`\n✅ Terminé!`);
    console.log(`   → ${created} utilisateurs créés`);
    console.log(`   → ${skipped} ignorés (email existant)`);
    console.log(`   → Total EcomUsers: ${totalCount}`);
    console.log(`   → Actifs: ${activeCount}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.code === 11000) {
      console.error('   Doublon détecté, continuez...');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

seed();
