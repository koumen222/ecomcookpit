import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import ScalorUser from '../models/ScalorUser.js';
import ScalorApiKey from '../models/ScalorApiKey.js';

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

const companies = [
  'AfriShop', 'MaliCommerce', 'DakarTech', 'SenegalExpress', 'BamakoStore',
  'AbidjanDigital', 'ConakyTrade', 'OuagaMarket', 'NiameyShop', 'LoméBusiness',
  'CotonoStore', 'FreetownHub', 'MonroviaNet', 'AccraDigital', 'LagosCommerce',
  'DoualaShop', 'YaoundéTech', 'LibrevilleStore', 'BrazzaMarket', 'KinshasaShop',
  'DakarStore', 'BamakoDigital', 'AbidjanShop', 'ConakryDigital', 'OuagaDigital',
  null, null, null, null, null
];

const domains = [
  'gmail.com', 'yahoo.fr', 'outlook.com', 'hotmail.com', 'orange.ml',
  'afribone.net', 'yahoo.com', 'protonmail.com', 'icloud.com', 'live.fr'
];

const plans = ['starter', 'starter', 'starter', 'pro', 'pro', 'business', 'enterprise'];

const PLAN_CONFIGS = {
  starter:    { maxInstances: 1,  dailyMessageLimit: 500,   monthlyMessageLimit: 10000 },
  pro:        { maxInstances: 5,  dailyMessageLimit: 5000,  monthlyMessageLimit: 100000 },
  business:   { maxInstances: 20, dailyMessageLimit: 50000, monthlyMessageLimit: 500000 },
  enterprise: { maxInstances: -1, dailyMessageLimit: -1,    monthlyMessageLimit: -1 },
};

function randomPhone() {
  const prefixes = ['+223', '+221', '+225', '+224', '+226', '+227', '+228', '+229', '+237', '+241'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(Math.random() * 90000000 + 10000000);
  return `${prefix}${num}`;
}

async function seed() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    const existingCount = await ScalorUser.countDocuments();
    console.log(`📊 Utilisateurs Scalor existants: ${existingCount}`);

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < 100; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const email = `${firstName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${lastName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}${i}@${domain}`;
      const name = `${firstName} ${lastName}`;
      const company = companies[Math.floor(Math.random() * companies.length)];
      const phone = randomPhone();
      const plan = plans[Math.floor(Math.random() * plans.length)];
      const planConfig = PLAN_CONFIGS[plan];

      const existing = await ScalorUser.findOne({ email });
      if (existing) {
        skipped++;
        continue;
      }

      const user = await ScalorUser.create({
        email,
        password: 'Scalor2024!',
        name,
        company,
        phone,
        plan,
        ...planConfig,
        isActive: true,
        isVerified: Math.random() > 0.3,
      });

      const { keyHash, keyPrefix } = ScalorApiKey.generateKey('live');
      await ScalorApiKey.create({
        userId: user._id,
        keyHash,
        keyPrefix,
        name: 'Default API Key',
        rateLimit: plan === 'enterprise' ? 600 : plan === 'business' ? 300 : plan === 'pro' ? 120 : 30
      });

      created++;
      if ((i + 1) % 10 === 0) {
        console.log(`  ⏳ ${i + 1}/100 traités...`);
      }
    }

    const totalCount = await ScalorUser.countDocuments();
    console.log(`\n✅ Terminé!`);
    console.log(`   → ${created} utilisateurs créés`);
    console.log(`   → ${skipped} ignorés (email existant)`);
    console.log(`   → Total utilisateurs Scalor: ${totalCount}`);
    console.log(`\n🔑 Mot de passe par défaut: Scalor2024!`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

seed();
