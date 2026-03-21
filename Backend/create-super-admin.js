import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/plateforme';

async function createSuperAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    const db = mongoose.connection.db;
    const collection = db.collection('ecom_users');

    const email = 'koumenprive@gmail.com';
    const password = 'Koumen@22';

    // Vérifier si l'utilisateur existe déjà
    const existing = await collection.findOne({ email });
    if (existing) {
      // Mettre à jour en super_admin
      const salt = await bcrypt.genSalt(12);
      const hashed = await bcrypt.hash(password, salt);
      await collection.updateOne(
        { email },
        { $set: { role: 'super_admin', password: hashed, isActive: true } }
      );
      console.log(`✅ Utilisateur ${email} mis à jour en super_admin`);
    } else {
      // Créer le nouveau super admin
      const salt = await bcrypt.genSalt(12);
      const hashed = await bcrypt.hash(password, salt);
      await collection.insertOne({
        email,
        password: hashed,
        name: 'Koumen',
        role: 'super_admin',
        workspaceId: null,
        workspaces: [],
        isActive: true,
        currency: 'XAF',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Super admin créé : ${email}`);
    }

    console.log('🔑 Email:', email);
    console.log('🔑 Mot de passe: Koumen@22');
    console.log('🔑 Rôle: super_admin');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createSuperAdmin();
