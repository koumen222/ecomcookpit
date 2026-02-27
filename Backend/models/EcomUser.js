import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ecomUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() { return !this.googleId; },
    minlength: 6
  },
  googleId: {
    type: String,
    default: null,
    sparse: true
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  avatar: {
    type: String,
    trim: true,
    default: ''
  },
  role: {
    type: String,
    enum: ['super_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur', null],
    default: null
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null
  },
  workspaces: [{
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomWorkspace',
      required: true
    },
    role: {
      type: String,
      enum: ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser',
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'active'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  currency: {
    type: String,
    default: 'XAF',
    enum: [
      // Afrique Centrale
      'XAF', 'CDF',
      // Afrique de l'Ouest
      'XOF', 'NGN', 'GHS', 'GNF', 'LRD', 'SLL',
      // Afrique du Nord
      'MAD', 'TND', 'DZD', 'EGP', 'LYD',
      // Afrique de l'Est
      'KES', 'UGX', 'TZS', 'RWF', 'BIF', 'ETB', 'SOS', 'SDG', 'SSP', 'ERN', 'DJF',
      // Afrique Australe
      'ZAR', 'BWP', 'NAD', 'ZMW', 'MZN', 'MWK', 'SZL', 'LSL', 'AOA', 'ZWL',
      // Internationales
      'USD', 'EUR', 'GBP', 'CAD', 'CNY'
    ]
  },
  deviceToken: {
    type: String,
    default: null
  },
  deviceInfo: {
    deviceId: String,
    userAgent: String,
    platform: String,
    lastSeen: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'ecom_users',
  timestamps: true
});

// Hash password avant sauvegarde
ecomUserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Méthode de vérification du mot de passe
ecomUserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour ajouter un workspace à l'utilisateur
ecomUserSchema.methods.addWorkspace = function(workspaceId, role, invitedBy = null) {
  // Vérifier si l'utilisateur n'est pas déjà dans ce workspace
  const existingWorkspace = this.workspaces.find(w => 
    w.workspaceId.toString() === workspaceId.toString()
  );
  
  if (existingWorkspace) {
    return false; // Déjà membre
  }
  
  this.workspaces.push({
    workspaceId,
    role,
    invitedBy,
    joinedAt: new Date(),
    status: 'active'
  });
  
  return true;
};

// Méthode pour vérifier si l'utilisateur a accès à un workspace
ecomUserSchema.methods.hasWorkspaceAccess = function(workspaceId) {
  if (!workspaceId) return false;
  return this.workspaces.some(w => 
    w.workspaceId && w.workspaceId.toString() === workspaceId.toString() && 
    w.status === 'active'
  );
};

// Méthode pour obtenir le rôle dans un workspace spécifique
ecomUserSchema.methods.getRoleInWorkspace = function(workspaceId) {
  if (!workspaceId) return null;
  const workspace = this.workspaces.find(w => 
    w.workspaceId && w.workspaceId.toString() === workspaceId.toString() && 
    w.status === 'active'
  );
  
  return workspace ? workspace.role : null;
};

// Méthode pour obtenir tous les workspaces actifs de l'utilisateur
ecomUserSchema.methods.getActiveWorkspaces = function() {
  return this.workspaces.filter(w => w.status === 'active');
};

// Méthode pour quitter un workspace
ecomUserSchema.methods.leaveWorkspace = function(workspaceId) {
  this.workspaces = this.workspaces.filter(w => 
    w.workspaceId.toString() !== workspaceId.toString()
  );
  
  // Si c'était le workspace principal, le mettre à null
  if (this.workspaceId && this.workspaceId.toString() === workspaceId.toString()) {
    const remainingWorkspaces = this.getActiveWorkspaces();
    this.workspaceId = remainingWorkspaces.length > 0 ? remainingWorkspaces[0].workspaceId : null;
  }
  
  return true;
};

// Méthode pour obtenir les permissions
ecomUserSchema.methods.getPermissions = function() {
  const permissions = {
    super_admin: ['admin:read', 'admin:write', '*'], // Super admin a accès à tout
    ecom_admin: ['*'],
    ecom_closeuse: ['orders:read', 'orders:write'],
    ecom_compta: ['finance:read'],
    ecom_livreur: ['orders:read']
  };
  
  return permissions[this.role] || [];
};

// Méthode pour vérifier une permission spécifique
ecomUserSchema.methods.hasPermission = function(permission) {
  const userPermissions = this.getPermissions();
  return userPermissions.includes('*') || userPermissions.includes(permission);
};

export default mongoose.model('EcomUser', ecomUserSchema);
