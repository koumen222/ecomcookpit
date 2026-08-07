import mongoose from 'mongoose';

/**
 * Parcours de création sauvegardé — l'état complet d'un studio vidéo, nommé,
 * réouvrable depuis n'importe quel appareil.
 *
 * Complète le brouillon local, il ne le remplace pas. Les deux répondent à des
 * pannes différentes : le brouillon localStorage protège de l'onglet fermé par
 * accident et n'attend aucun réseau ; ce modèle-ci protège du vidage de cache,
 * du changement d'appareil et de la limite d'un seul brouillon par produit.
 * Ne garder que le serveur ferait perdre le travail en cours à chaque coupure.
 *
 * `state` est volontairement libre : c'est l'état du studio, qui change à
 * chaque évolution de l'éditeur. Le figer en schéma obligerait à migrer la
 * base à chaque champ ajouté dans l'interface, pour une donnée que seul le
 * studio relit.
 */
const creativeJourneySchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null, index: true },

  name: { type: String, required: true, trim: true, maxlength: 120 },
  family: { type: String, enum: ['ugc', 'spot', 'montage'], default: 'ugc', index: true },

  // Rattachement produit : l'id de la boutique quand il vient de là, sinon le
  // nom saisi à la main. Sert à regrouper les parcours d'un même produit.
  productId: { type: String, default: '', index: true },
  productName: { type: String, default: '' },
  productImage: { type: String, default: '' },

  // Résumé lisible sans ouvrir le parcours : le hook du script.
  headline: { type: String, default: '' },
  // Vidéo produite lors de la dernière session de ce parcours, si elle existe.
  lastVideoUrl: { type: String, default: '' },
  scenesCount: { type: Number, default: 0 },

  state: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'creative_journeys' });

creativeJourneySchema.index({ workspaceId: 1, updatedAt: -1 });
creativeJourneySchema.index({ workspaceId: 1, productId: 1, updatedAt: -1 });

export default mongoose.model('CreativeJourney', creativeJourneySchema);
