import mongoose from 'mongoose';

const ritaStatusScheduleSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  agentId: { type: String, index: true },

  // ─── Identité ───
  name: { type: String, default: 'Statut automatique' },
  enabled: { type: Boolean, default: true },

  // ─── Contenu ───
  type: { type: String, enum: ['image', 'text', 'product'], default: 'text' },
  // Si type='text' : caption est le texte complet
  // Si type='image' : mediaUrl + caption optionnel
  // Si type='product' : productName → on prend automatiquement l'image du produit + prix
  caption: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },         // URL image manuelle
  productName: { type: String, default: '' },      // Nom du produit (pour type=product)
  backgroundColor: { type: String, default: '#0F6B4F' }, // Pour statuts texte

  // ─── Planification ───
  // scheduleType: 'daily' | 'weekly' | 'custom'
  scheduleType: { type: String, enum: ['daily', 'weekly', 'custom'], default: 'daily' },
  // Heure d'envoi (format "HH:MM")
  sendTime: { type: String, default: '09:00' },
  // Jours de la semaine (0=dim, 1=lun ... 6=sam) — pour weekly
  weekDays: [{ type: Number }],
  // Expression cron custom (optionnel)
  cronExpression: { type: String, default: '' },

  // ─── Historique ───
  lastSentAt: { type: Date, default: null },
  sentCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'rita_status_schedules',
  timestamps: true,
});

ritaStatusScheduleSchema.index({ userId: 1, enabled: 1 });

export default mongoose.model('RitaStatusSchedule', ritaStatusScheduleSchema);
