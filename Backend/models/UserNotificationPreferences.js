import mongoose from 'mongoose';

const userNotificationPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    unique: true,
    index: true
  },
  // Catégories d'emails
  authEmails: { type: Boolean, default: true },       // Inscription, reset, connexion suspecte
  securityEmails: { type: Boolean, default: true },   // Toujours envoyés (non désactivable côté logique)
  financeEmails: { type: Boolean, default: true },    // Budgets, transactions, rapports
  teamEmails: { type: Boolean, default: true },       // Invitations, changements de rôle
  productEmails: { type: Boolean, default: true },    // Stock faible, rupture
  businessEmails: { type: Boolean, default: true },   // Pics, records, alertes business
  weeklyDigest: { type: Boolean, default: true },     // Résumé hebdomadaire
  monthlyDigest: { type: Boolean, default: true }     // Résumé mensuel
}, {
  collection: 'ecom_notification_preferences',
  timestamps: true
});

export default mongoose.model('UserNotificationPreferences', userNotificationPreferencesSchema);
