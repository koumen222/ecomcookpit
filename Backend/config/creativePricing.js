// ─────────────────────────────────────────────────────────────────────────────
//  Grille tarifaire du Creative Center — SOURCE UNIQUE de vérité.
//  Tout débit de crédits (routes builderAi, creativeGenerator, videoTranslation)
//  et tout affichage de prix (front via GET /billing/creative-pricing) part d'ici.
//  1 crédit = PRICE_PER_CREDIT_FCFA (aligné sur /billing/buy-creative).
// ─────────────────────────────────────────────────────────────────────────────

export const PRICE_PER_CREDIT_FCFA = 80;

// key → { credits, label, unit } — unit = ce que couvre UN débit.
export const CREATIVE_PRICING = {
  text:        { credits: 0, label: 'Texte marketing',           unit: 'par génération' },
  image:       { credits: 1, label: 'Affiche publicitaire',      unit: 'par format généré' },
  voice:       { credits: 0, label: 'Voix off',                  unit: 'par audio généré' },
  video:       { credits: 3, label: 'Vidéo IA (scène)',          unit: 'par scène générée' },
  montage:     { credits: 2, label: 'Montage vidéo',             unit: 'par montage rendu' },
  clone:       { credits: 2, label: 'Clone de page produit',     unit: 'par page clonée' },
  lipsync:     { credits: 4, label: 'Avatar parlant (lip sync)', unit: 'par vidéo avatar' },
  translation: { credits: 4, label: 'Traduction vidéo',          unit: 'par vidéo doublée' },
};

/** Coût en crédits d'une fonctionnalité (0 si inconnue ou gratuite). */
export function featureCost(key) {
  return CREATIVE_PRICING[key]?.credits ?? 0;
}
