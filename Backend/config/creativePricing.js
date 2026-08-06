// ─────────────────────────────────────────────────────────────────────────────
//  Grille tarifaire du Creative Center — SOURCE UNIQUE de vérité.
//  Tout débit de crédits (routes builderAi, creativeGenerator, videoTranslation)
//  et tout affichage de prix (front via GET /billing/creative-pricing) part d'ici.
//  1 crédit = PRICE_PER_CREDIT_FCFA (aligné sur /billing/buy-creative).
// ─────────────────────────────────────────────────────────────────────────────

export const PRICE_PER_CREDIT_FCFA = 100; // aligné sur les packs (100 crédits = 10 000 FCFA)

// ── CALIBRAGE UGC : les tarifs à la scène ci-dessous sont calculés pour que
//    la vidéo UGC complète tombe SUR un prix rond, au nombre de scènes que
//    le studio impose par offre (voir TALK_ENGINES.targetScenes côté front) :
//
//      Éco  : 7 scènes × 2 + assemblage 1 = 15 crédits = 1 500 FCFA
//      Pro  : 4 scènes × 6 + assemblage 1 = 25 crédits = 2 500 FCFA
//
//    À 100 FCFA le crédit, l'assemblage à 1 est la SEULE valeur qui marche :
//    avec 2, il resterait 13 crédits à répartir sur 7 scènes et 23 sur 4 —
//    aucun des deux n'est divisible.
//
//    Changer un de ces trois nombres (tarif scène, assemblage, scènes cibles)
//    casse le prix rond — les trois se tiennent.
// key → { credits, label, unit } — unit = ce que couvre UN débit.
export const CREATIVE_PRICING = {
  text:        { credits: 0, label: 'Texte marketing',           unit: 'par génération' },
  image:       { credits: 1, label: 'Affiche publicitaire',      unit: 'par format généré' },
  voice:       { credits: 0, label: 'Voix off',                  unit: 'par audio généré' },
  video:       { credits: 2, label: 'Vidéo IA Éco (scène 6 s)',  unit: 'par scène générée' },
  video_pro:   { credits: 6, label: 'Vidéo IA Pro (scène 10 s)', unit: 'par scène générée' },
  broll:       { credits: 2, label: 'B-roll (vidéo ou image)',   unit: 'par b-roll généré' },
  avatar:      { credits: 5, label: 'Avatar UGC généré',         unit: 'par personnage généré' },
  montage:     { credits: 1, label: 'Montage vidéo',             unit: 'par montage rendu' },
  clone:       { credits: 2, label: 'Clone de page produit',     unit: 'par page clonée' },
  lipsync:     { credits: 4, label: 'Avatar parlant (lip sync)', unit: 'par vidéo avatar' },
  translation: { credits: 4, label: 'Traduction vidéo',          unit: 'par vidéo doublée' },
  auto_montage: { credits: 4, label: 'Montage automatique IA',   unit: 'par vidéo montée' },
  // Générations IA du builder / pages produits : image (dont personnage
  // avatar), description produit, thème builder — 1 crédit chacune.
  builder_ai:  { credits: 1, label: 'Génération builder (image, description, thème)', unit: 'par génération' },
};

/** Coût en crédits d'une fonctionnalité (0 si inconnue ou gratuite). */
export function featureCost(key) {
  return CREATIVE_PRICING[key]?.credits ?? 0;
}

// ── PACKS DE RECHARGE ────────────────────────────────────────────────────────
// Une remise RÉELLE sur le prix unitaire — sinon « offre » ne veut rien dire.
// C'est ici que vit le montant : /buy-creative l'applique quand la quantité
// correspond exactement, et le front affiche le même. Hors pack, le crédit
// est vendu au prix normal (PRICE_PER_CREDIT_FCFA).
// Repère produit : une vidéo UGC Éco coûte 15 crédits, une Pro 25.
export const CREDIT_PACKS = [
  { quantity: 100, price: 10000 },  // 100 F/crédit — prix normal
  { quantity: 250, price: 20000 },  //  80 F/crédit — remise 20 %
  { quantity: 700, price: 50000 },  //  71 F/crédit — remise 29 %
];

/** Montant d'un pack si la quantité correspond exactement, sinon null. */
export function packPrice(quantity) {
  const q = Number(quantity);
  return CREDIT_PACKS.find((p) => p.quantity === q)?.price ?? null;
}
