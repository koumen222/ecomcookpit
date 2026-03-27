import mongoose from 'mongoose';

// ── Action dans un flow ──────────────────────────────────────────────────────
const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'SEND_GROUP_INVITE_LINK',
      'ADD_TO_GROUP',
      'SEND_MESSAGE',
      'TAG_CONTACT',
      'WAIT',
      'END_FLOW',
    ],
  },
  groupId: { type: String, default: '' },       // JID du groupe (@g.us)
  groupName: { type: String, default: '' },      // Nom lisible
  message: { type: String, default: '' },        // Texte pour SEND_MESSAGE
  tag: { type: String, default: '' },            // Label pour TAG_CONTACT
  waitSeconds: { type: Number, default: 0 },     // Durée pour WAIT
}, { _id: false });

// ── Condition (rule) ─────────────────────────────────────────────────────────
const conditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'keyword',          // Message contient un ou plusieurs mots-clés
      'keyword_not',      // Message ne contient PAS les mots-clés
      'inactivity',       // Aucun message depuis X secondes
      'message_count_gt', // Nombre de messages > N
      'message_count_lt', // Nombre de messages < N
      'has_ordered',      // Le client a commandé
      'has_not_ordered',  // Le client n'a pas commandé
      'tag_is',           // Le contact a un tag précis
      'always',           // Condition toujours vraie (fallback/default)
    ],
  },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  // keyword → ["oui","intéressé"]  |  inactivity → 3600  |  message_count_gt → 3
}, { _id: false });

// ── Règle = condition + actions ──────────────────────────────────────────────
const ruleSchema = new mongoose.Schema({
  condition: { type: conditionSchema, required: true },
  actions: [actionSchema],
  priority: { type: Number, default: 0 },        // Plus haut = évalué en premier
}, { _id: false });

// ── Post planifié (animation de groupe) ──────────────────────────────────────
const scheduledPostSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'product'], default: 'text' },
  content: { type: String, default: '' },         // Texte ou URL image
  productName: { type: String, default: '' },     // Pour type=product → pioche dans le catalogue
  cronExpression: { type: String, default: '' },  // ex: "0 9 * * 1-5" (9h en semaine)
  days: [{ type: String }],                       // ['lundi','mardi',…]
  hour: { type: String, default: '09:00' },       // Alternative simple au cron
  enabled: { type: Boolean, default: true },
  lastSentAt: { type: Date, default: null },
}, { _id: false });

// ── Groupe géré ──────────────────────────────────────────────────────────────
const managedGroupSchema = new mongoose.Schema({
  groupJid: { type: String, required: true },     // 120363XXX@g.us
  name: { type: String, default: '' },
  inviteUrl: { type: String, default: '' },
  role: { type: String, enum: ['clients', 'prospects', 'vip', 'custom'], default: 'custom' },
  autoCreated: { type: Boolean, default: false },
  scheduledPosts: [scheduledPostSchema],
}, { _id: false });

// ══════════════════════════════════════════════════════════════════════════════
// Modèle principal : RitaFlow
// ══════════════════════════════════════════════════════════════════════════════

const ritaFlowSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  enabled: { type: Boolean, default: true },

  // ─── Flows (règles de qualification) ───
  flows: [{
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    triggers: [{
      type: String,
      enum: [
        'message_received',    // Chaque message entrant
        'conversation_end',    // Fin détectée (inactivité longue)
        'order_confirmed',     // Commande confirmée par Rita
        'keyword_detected',    // Mot-clé détecté
        'inactivity',          // Timeout inactivité
      ],
    }],
    rules: [ruleSchema],
  }],

  // ─── Groupes gérés ───
  groups: [managedGroupSchema],

  // ─── Paramètres globaux ───
  settings: {
    defaultInactivitySeconds: { type: Number, default: 3600 },
    autoCreateGroupPerProduct: { type: Boolean, default: false },
    groupNameTemplate: { type: String, default: '🛒 {productName} — Clients' },
  },

}, {
  timestamps: true,
  collection: 'rita_flows',
});

ritaFlowSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model('RitaFlow', ritaFlowSchema);
