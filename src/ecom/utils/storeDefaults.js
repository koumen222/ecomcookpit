// Store creation defaults for empty page functionality

export const DEFAULT_EMPTY_STORE = {
  // Page structure starts empty - users build with drag & drop
  sections: [],
  
  // Basic theme defaults
  theme: {
    primaryColor: '#0F6B4F',
    ctaColor: '#059669', 
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
    secondaryColor: '#6B7280',
    font: 'inter',
    borderRadius: 'md',
  },
  
  // Store settings
  settings: {
    storeName: '',
    storeDescription: '',
    storeLogo: '',
    currency: 'XAF',
    whatsapp: '',
    email: '',
    address: '',
    
    // SEO defaults
    seoTitle: '',
    seoDescription: '',
    seoKeywords: [],
    
    // Social media
    facebook: '',
    instagram: '',
    twitter: '',
    
    // Business settings
    businessHours: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '16:00', closed: false },
      sunday: { open: '10:00', close: '16:00', closed: true }
    },
    
    // Features
    features: {
      whatsappCheckout: true,
      onlineCheckout: false,
      inventory: true,
      reviews: true,
      analytics: true,
      seo: true
    }
  }
};

// Helper to create a new empty store
export const createEmptyStore = (customSettings = {}) => {
  return {
    ...DEFAULT_EMPTY_STORE,
    settings: {
      ...DEFAULT_EMPTY_STORE.settings,
      ...customSettings
    }
  };
};

// Helper to validate store structure
export const validateStoreStructure = (store) => {
  const errors = [];
  
  if (!store.settings?.storeName?.trim()) {
    errors.push('Store name is required');
  }
  
  if (!store.settings?.currency) {
    errors.push('Currency is required');
  }
  
  if (store.settings?.whatsapp && !isValidWhatsApp(store.settings.whatsapp)) {
    errors.push('WhatsApp number format is invalid');
  }
  
  if (store.settings?.email && !isValidEmail(store.settings.email)) {
    errors.push('Email format is invalid');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validation helpers
const isValidWhatsApp = (phone) => {
  // Basic WhatsApp phone number validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sample sections for demo/example purposes
export const SAMPLE_SECTIONS = [
  {
    id: 'hero-sample',
    type: 'hero',
    visible: true,
    config: {
      title: 'Bienvenue dans notre boutique',
      subtitle: 'Découvrez nos produits de qualité livrés rapidement',
      ctaText: 'Voir nos produits',
      ctaLink: '#products',
      backgroundImage: '',
      alignment: 'center'
    }
  },
  {
    id: 'products-sample',
    type: 'products',
    visible: true,
    config: {
      title: 'Nos Produits Populaires',
      subtitle: 'Une sélection de nos meilleurs articles',
      layout: 'grid',
      columns: 3,
      showPrice: true,
      showAddToCart: true,
      limit: 6
    }
  },
  {
    id: 'contact-sample',
    type: 'contact',
    visible: true,
    config: {
      title: 'Contactez-nous',
      subtitle: 'Une question ? N\'hésitez pas à nous écrire !',
      whatsapp: '+237600000000',
      email: 'contact@example.com',
      showForm: true
    }
  }
];

// Helper to create a store with sample content
export const createStoreWithSamples = (customSettings = {}) => {
  return {
    ...DEFAULT_EMPTY_STORE,
    sections: [...SAMPLE_SECTIONS],
    settings: {
      ...DEFAULT_EMPTY_STORE.settings,
      ...customSettings
    }
  };
};
