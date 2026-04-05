const defaultConfig = {
  theme: 'classic',
  general: {
    formType: 'popup',
    sections: [
      { id: 'heroSlogan',        label: 'Slogan marketing IA',       enabled: true  },
      { id: 'heroBaseline',      label: 'Phrase de réassurance IA',   enabled: true  },
      { id: 'reviews',           label: 'Avis clients',              enabled: true  },
      { id: 'orderForm',         label: '🛒 Bouton / Formulaire',    enabled: true  },
      { id: 'statsBar',          label: 'Barre de stats sociales',   enabled: true  },
      { id: 'stockCounter',      label: 'Compteur de stock',         enabled: true  },
      { id: 'urgencyBadge',      label: 'Badge d\'urgence',          enabled: true  },
      { id: 'urgencyElements',   label: 'Éléments d\'urgence',       enabled: true  },
      { id: 'benefitsBullets',   label: 'Bénéfices produit',         enabled: true  },
      { id: 'conversionBlocks',  label: 'Blocs de réassurance',      enabled: true  },
      { id: 'offerBlock',        label: 'Bloc garantie / offre',     enabled: true  },
      { id: 'description',       label: 'Description produit',       enabled: true  },
      { id: 'problemSection',    label: 'Section Problème',          enabled: true  },
      { id: 'solutionSection',   label: 'Section Solution',          enabled: true  },
      { id: 'faq',               label: 'Section FAQ',               enabled: true  },
      { id: 'testimonials',      label: 'Témoignages clients',       enabled: true  },
      { id: 'relatedProducts',   label: 'Produits similaires',       enabled: true  },
      { id: 'stickyOrderBar',    label: 'Barre de commande fixe',    enabled: true  },
      { id: 'upsell',            label: 'Upsell',                    enabled: true  },
      { id: 'orderBump',         label: 'Order Bump',                enabled: true  },
    ],
  },
  conversion: {
    quantities: [1, 2, 3],
    offersEnabled: false,
    offers: [
      { qty: 1, price: 0, comparePrice: 0, badge: '', selected: true },
      { qty: 2, price: 0, comparePrice: 0, badge: 'Le plus populaire', selected: false },
      { qty: 3, price: 0, comparePrice: 0, badge: 'Meilleure offre', selected: false },
    ],
  },
  automation: {
    whatsapp: {
      enabled: false,
      number: '',
      message: 'Bonjour {{name}}, votre commande {{product}} est confirmée.',
    },
  },
  design: {
    buttonColor: '#ff6600',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    badgeColor: '#EF4444',
    borderRadius: '8px',
    shadow: true,
    fontBase: 14,
    fontWeight: '600',
  },
  button: {
    text: 'Commander maintenant',
    subtext: 'Paiement à la livraison',
    icon: 'cart',
    animation: 'none',
  },
  form: {
    fields: [
      { name: 'fullname', label: 'Nom complet', enabled: true },
      { name: 'phone', label: 'Téléphone', enabled: true },
      { name: 'address', label: 'Adresse', enabled: true },
      { name: 'note', label: 'Note', enabled: false },
    ],
  },
  // Custom testimonials — overrides product._pageData.testimonials and defaults when set
  testimonials: [],
};

export default defaultConfig;
