import mongoose from 'mongoose';

/**
 * GuestSession — visiteur non connecté du Creative Center.
 * Permet d'essayer la génération SANS compte : 1 génération gratuite par
 * session invité, résultat verrouillé côté serveur jusqu'à la connexion,
 * puis rattaché au compte via /api/ecom/guest/claim.
 */
const guestSessionSchema = new mongoose.Schema(
  {
    guestId: { type: String, required: true, unique: true, index: true },
    ip: { type: String, default: '', index: true },
    userAgent: { type: String, default: '' },
    // Quota : 1 génération d'affiches gratuite par invité
    generationsUsed: { type: Number, default: 0 },
    generationsLimit: { type: Number, default: 1 },
    // Quota voix off (page publique « Générer une voix off gratuitement »)
    voiceGenerationsUsed: { type: Number, default: 0 },
    voiceGenerationsLimit: { type: Number, default: 2 },
    // Rattachement après création de compte / connexion
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null },
    claimedWorkspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', default: null },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Nettoyage auto : une session invitée jamais réclamée expire après 30 jours
guestSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600, partialFilterExpression: { claimedBy: null } });

export default mongoose.model('GuestSession', guestSessionSchema);
