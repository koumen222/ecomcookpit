import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const providerSchema = new mongoose.Schema({
  // Identité du provider
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Authentification API
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  apiToken: {
    type: String,
    unique: true,
    sparse: true,
    default: () => `prov_${crypto.randomBytes(32).toString('hex')}`
  },
  tokenExpiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 an
  },
  tokenRefreshCount: {
    type: Number,
    default: 0
  },
  
  // Permissions
  permissions: {
    type: [String],
    enum: ['instances:create', 'instances:read', 'instances:update', 'instances:delete', 'instances:manage'],
    default: ['instances:create', 'instances:read', 'instances:update', 'instances:delete', 'instances:manage']
  },
  
  // Instances gérées par ce provider
  instances: [{
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomWorkspace',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active'
    }
  }],
  
  // Limites et quotas
  instanceLimit: {
    type: Number,
    default: 10 // Nombre max d'instances
  },
  activeInstances: {
    type: Number,
    default: 0
  },
  
  // Statut du provider
  status: {
    type: String,
    enum: ['pending', 'verified', 'active', 'suspended', 'inactive'],
    default: 'pending'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpiresAt: {
    type: Date,
    default: null
  },
  
  // Logs d'activité
  lastLogin: {
    type: Date,
    default: null
  },
  lastTokenRefresh: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Métadonnées
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Hash password avant sauvegarde
providerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les passwords
providerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour générer un nouveau token API
providerSchema.methods.generateNewApiToken = function() {
  this.apiToken = `prov_${crypto.randomBytes(32).toString('hex')}`;
  this.tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an
  this.tokenRefreshCount += 1;
  this.lastTokenRefresh = new Date();
  return this.apiToken;
};

// Méthode pour ajouter une instance
providerSchema.methods.addInstance = function(workspaceId) {
  if (this.activeInstances >= this.instanceLimit) {
    throw new Error(`Instance limit (${this.instanceLimit}) reached`);
  }
  
  if (this.instances.find(inst => inst.workspaceId.toString() === workspaceId.toString())) {
    throw new Error('Instance already exists');
  }
  
  this.instances.push({ workspaceId, status: 'active' });
  this.activeInstances += 1;
  return this;
};

// Méthode pour supprimer une instance
providerSchema.methods.removeInstance = function(workspaceId) {
  const index = this.instances.findIndex(inst => 
    inst.workspaceId.toString() === workspaceId.toString()
  );
  
  if (index === -1) {
    throw new Error('Instance not found');
  }
  
  this.instances.splice(index, 1);
  this.activeInstances = Math.max(0, this.activeInstances - 1);
  return this;
};

// Virtuel pour nombre d'instances actives
providerSchema.virtual('stats').get(function() {
  return {
    totalInstances: this.instances.length,
    activeInstances: this.instances.filter(i => i.status === 'active').length,
    suspendedInstances: this.instances.filter(i => i.status === 'suspended').length,
    canCreateMoreInstances: this.activeInstances < this.instanceLimit
  };
});

export default mongoose.model('Provider', providerSchema);
