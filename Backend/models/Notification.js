import mongoose from 'mongoose';

/**
 * Modèle de notification interne
 * 
 * Les notifications internes sont affichées dans l'interface utilisateur
 * et peuvent être déclenchées par différents événements (commentaires, messages, etc.)
 */
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['comment', 'message', 'system', 'course', 'payment', 'admin'],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  link: {
    type: String,
    default: null // URL à ouvrir au clic
  },
  icon: {
    type: String,
    default: '/img/logo.svg'
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  // Données supplémentaires pour le type de notification
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true // createdAt et updatedAt automatiques
});

// Index composé pour les requêtes fréquentes
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Méthode pour marquer comme lu
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Méthode statique pour créer une notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this({
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link || null,
    icon: data.icon || '/img/logo.svg',
    metadata: data.metadata || {}
  });
  
  return await notification.save();
};

// Méthode statique pour obtenir les notifications non lues d'un utilisateur
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ userId, read: false });
};

// Méthode statique pour obtenir les notifications d'un utilisateur
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    read = null, // null = tous, true = lus seulement, false = non lus seulement
    type = null // null = tous les types
  } = options;

  const query = { userId };
  
  if (read !== null) {
    query.read = read;
  }
  
  if (type) {
    query.type = type;
  }

  return await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

export default mongoose.model('Notification', notificationSchema);
