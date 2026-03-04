// Example sections for testing the PageBuilder functionality
export const EXAMPLE_SECTIONS = [
  {
    id: 'hero-1',
    type: 'hero',
    visible: true,
    config: {
      title: 'Bienvenue dans notre boutique',
      subtitle: 'Découvrez nos produits de qualité livrés partout au Cameroun',
      backgroundImage: '/img/hero-bg.jpg',
      ctaText: 'Voir nos produits',
      ctaLink: '#products',
      overlay: true,
      alignment: 'center'
    }
  },
  {
    id: 'products-1',
    type: 'products',
    visible: true,
    config: {
      title: 'Nos Produits',
      subtitle: 'Une sélection de nos meilleurs articles',
      layout: 'grid',
      columns: 3,
      showPrice: true,
      showAddToCart: true,
      limit: 6
    }
  },
  {
    id: 'text-1',
    type: 'text',
    visible: true,
    config: {
      title: 'Pourquoi nous choisir ?',
      content: `
# Qualité garantie
Tous nos produits sont sélectionnés avec soin pour vous offrir la meilleure qualité.

# Livraison rapide
Nous livrons partout au Cameroun sous 24-72h selon votre zone.

# Service client
Notre équipe est à votre disposition pour répondre à toutes vos questions.
      `,
      alignment: 'center',
      backgroundColor: '#F9FAFB'
    }
  },
  {
    id: 'testimonials-1',
    type: 'testimonials',
    visible: true,
    config: {
      title: 'Ce que disent nos clients',
      items: [
        {
          name: 'Marie K.',
          location: 'Douala',
          content: 'Service excellent, livraison rapide. Je recommande !',
          rating: 5
        },
        {
          name: 'Jean P.',
          location: 'Yaoundé',
          content: 'Produits de qualité et équipe très professionnelle.',
          rating: 5
        },
        {
          name: 'Fatou M.',
          location: 'Bafoussam',
          content: 'Ma boutique en ligne préférée, jamais déçue !',
          rating: 5
        }
      ],
      layout: 'grid',
      showRating: true
    }
  },
  {
    id: 'faq-1',
    type: 'faq',
    visible: true,
    config: {
      title: 'Questions fréquentes',
      items: [
        {
          question: 'Comment passer commande ?',
          answer: 'Vous pouvez commander directement via WhatsApp ou utiliser notre checkout en ligne.'
        },
        {
          question: 'Quels sont les délais de livraison ?',
          answer: 'La livraison prend généralement entre 24h et 72h selon votre zone géographique.'
        },
        {
          question: 'Puis-je retourner un produit ?',
          answer: 'Oui, vous avez 7 jours pour retourner un produit non ouvert dans son emballage d\'origine.'
        },
        {
          question: 'Acceptez-vous les paiements mobiles ?',
          answer: 'Oui, nous acceptons Orange Money, MTN Mobile Money et tous les moyens de paiement usuels.'
        }
      ]
    }
  },
  {
    id: 'contact-1',
    type: 'contact',
    visible: true,
    config: {
      title: 'Contactez-nous',
      subtitle: 'Une question ? N\'hésitez pas à nous écrire !',
      whatsapp: '+237600000000',
      email: 'contact@example.com',
      address: 'Douala, Cameroun',
      showForm: true,
      backgroundColor: '#0F6B4F',
      textColor: '#FFFFFF'
    }
  }
];

// Default empty sections for new stores
export const DEFAULT_EMPTY_SECTIONS = [];

// Predefined block types for the PageBuilder
export const BLOCK_TYPES = {
  hero: {
    name: 'Hero Section',
    description: 'Grande bannière d\'accueil avec titre et bouton',
    icon: '🎯',
    category: 'Marketing',
    defaultConfig: {
      title: 'Votre titre ici',
      subtitle: 'Votre sous-titre ici',
      ctaText: 'Commander maintenant',
      ctaLink: '#products',
      backgroundImage: '',
      overlay: true,
      alignment: 'center'
    }
  },
  products: {
    name: 'Grille Produits',
    description: 'Affichage de vos produits en grille',
    icon: '🛍️',
    category: 'E-commerce',
    defaultConfig: {
      title: 'Nos Produits',
      subtitle: '',
      layout: 'grid',
      columns: 3,
      showPrice: true,
      showAddToCart: true,
      limit: 6
    }
  },
  text: {
    name: 'Bloc Texte',
    description: 'Section de contenu avec texte et mise en forme',
    icon: '📝',
    category: 'Contenu',
    defaultConfig: {
      title: 'Votre titre',
      content: 'Votre contenu ici...',
      alignment: 'left',
      backgroundColor: '#FFFFFF'
    }
  },
  image: {
    name: 'Image',
    description: 'Affichage d\'une image avec légende',
    icon: '🖼️',
    category: 'Contenu',
    defaultConfig: {
      src: '',
      alt: 'Image',
      caption: '',
      alignment: 'center',
      maxWidth: '100%'
    }
  },
  testimonials: {
    name: 'Témoignages',
    description: 'Avis et témoignages clients',
    icon: '⭐',
    category: 'Social Proof',
    defaultConfig: {
      title: 'Témoignages clients',
      items: [
        {
          name: 'Client satisfait',
          location: 'Ville',
          content: 'Excellent service !',
          rating: 5
        }
      ],
      layout: 'grid',
      showRating: true
    }
  },
  faq: {
    name: 'FAQ',
    description: 'Questions fréquemment posées',
    icon: '❓',
    category: 'Support',
    defaultConfig: {
      title: 'Questions fréquentes',
      items: [
        {
          question: 'Votre question ?',
          answer: 'Votre réponse ici...'
        }
      ]
    }
  },
  contact: {
    name: 'Contact',
    description: 'Informations de contact et formulaire',
    icon: '📞',
    category: 'Support',
    defaultConfig: {
      title: 'Contactez-nous',
      subtitle: 'Une question ? Écrivez-nous !',
      whatsapp: '',
      email: '',
      address: '',
      showForm: true,
      backgroundColor: '#F9FAFB',
      textColor: '#111827'
    }
  },
  button: {
    name: 'Bouton CTA',
    description: 'Bouton d\'appel à l\'action personnalisable',
    icon: '🔘',
    category: 'Marketing',
    defaultConfig: {
      text: 'Cliquez ici',
      link: '#',
      style: 'primary',
      size: 'medium',
      alignment: 'center'
    }
  },
  spacer: {
    name: 'Espacement',
    description: 'Espace vide pour aérer votre page',
    icon: '📏',
    category: 'Layout',
    defaultConfig: {
      height: 60,
      backgroundColor: 'transparent'
    }
  }
};

// Categories for organizing blocks
export const BLOCK_CATEGORIES = [
  { id: 'marketing', name: 'Marketing', color: '#EF4444' },
  { id: 'ecommerce', name: 'E-commerce', color: '#10B981' },
  { id: 'contenu', name: 'Contenu', color: '#3B82F6' },
  { id: 'social-proof', name: 'Social Proof', color: '#8B5CF6' },
  { id: 'support', name: 'Support', color: '#F59E0B' },
  { id: 'layout', name: 'Layout', color: '#6B7280' }
];
