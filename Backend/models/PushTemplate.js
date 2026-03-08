import mongoose from 'mongoose';

/**
 * Modèle pour les templates de notifications push prédéfinis
 */
const pushTemplateSchema = new mongoose.Schema({
  // Nom du template
  name: {
    type: String,
    required: true,
    maxlength: 100
  },

  // Description optionnelle
  description: {
    type: String,
    default: '',
    maxlength: 500
  },

  // Scope du template (global ou workspace spécifique)
  scope: {
    type: String,
    enum: ['global', 'workspace'],
    default: 'global',
    index: true
  },

  // Workspace ID si scope = workspace
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },

  // Contenu de la notification
  title: {
    type: String,
    required: true,
    maxlength: 120
  },

  body: {
    type: String,
    required: true,
    maxlength: 500
  },

  // URL à ouvrir au clic
  url: {
    type: String,
    default: ''
  },

  // Icône de la notification
  icon: {
    type: String,
    default: '/icons/icon-192x192.png'
  },

  // Badge (petite icône)
  badge: {
    type: String,
    default: '/icons/icon-72x72.png'
  },

  // Tag pour grouper les notifications
  tag: {
    type: String,
    default: 'template'
  },

  // Actions boutons sur la notification
  actions: [{
    action: { type: String, required: true },
    title: { type: String, required: true },
    icon: { type: String, default: '' }
  }],

  // Données additionnelles
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Options avancées
  options: {
    requireInteraction: { type: Boolean, default: false },
    silent: { type: Boolean, default: false },
    renotify: { type: Boolean, default: false }
  },

  // Catégorie pour organiser les templates
  category: {
    type: String,
    default: 'general',
    enum: ['general', 'orders', 'reports', 'marketing', 'system', 'custom'],
    index: true
  },

  // Template actif/inactif
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Nombre d'utilisations
  usageCount: {
    type: Number,
    default: 0
  },

  // Créateur
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  timestamps: true,
  collection: 'push_templates'
});

// Indexes pour les requêtes fréquentes
pushTemplateSchema.index({ scope: 1, workspaceId: 1, isActive: 1 });
pushTemplateSchema.index({ category: 1, isActive: 1 });
pushTemplateSchema.index({ createdBy: 1 });

const PushTemplate = mongoose.model('PushTemplate', pushTemplateSchema);

export default PushTemplate;
