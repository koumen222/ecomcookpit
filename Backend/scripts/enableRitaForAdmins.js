/**
 * Migration: Enable canAccessRitaAgent for all existing ecom_admin users
 * Run once on production to fix 403 errors on rita-config routes
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/plateforme';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const result = await mongoose.connection.db.collection('ecom_users').updateMany(
    { role: 'ecom_admin', canAccessRitaAgent: { $ne: true } },
    { $set: { canAccessRitaAgent: true } }
  );

  console.log(`✅ Updated ${result.modifiedCount} ecom_admin user(s) — canAccessRitaAgent set to true`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
