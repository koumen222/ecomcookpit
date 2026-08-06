// ─────────────────────────────────────────────────────────────────────────────
//  Photos des avatars UGC prédéfinis, générées UNE SEULE FOIS pour toute la
//  plateforme puis ré-hébergées sur R2.
//
//  Pourquoi une collection et pas un cache mémoire : le cache précédent était
//  un `let _avatarCache = null` dans le module de la route. Il disparaissait à
//  chaque redémarrage du process et à chaque déploiement, et n'était pas
//  partagé entre instances — donc les 10 (maintenant 20) images étaient
//  régénérées régulièrement, avec l'attente et le coût API que ça implique.
//  Ici, une image générée l'est pour de bon.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';

const creativeAvatarPresetSchema = new mongoose.Schema({
  // Identifiant stable du préréglage (aicha, kwame, …) : c'est LUI qui relie
  // la photo au préréglage côté studio, pas la position dans la liste.
  presetId: { type: String, required: true, unique: true, index: true },
  image: { type: String, default: '' }, // URL R2 définitive
  // Empreinte du prompt : si la consigne visuelle change, l'image est
  // regénérée au prochain appel au lieu de rester périmée pour toujours.
  promptHash: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'ecom_creative_avatar_presets',
});

export default mongoose.models.CreativeAvatarPreset
  || mongoose.model('CreativeAvatarPreset', creativeAvatarPresetSchema);
