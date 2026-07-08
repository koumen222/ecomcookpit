/**
 * Ticket — Module de service client interne avec analyse automatique par Claude.
 *
 * Cycle de vie :
 *   nouveau → analyse_en_cours → patch_propose → en_review → deploye
 *                              ↘ escalade                  ↘ escalade
 *   ferme (terminal, depuis n'importe quel statut)
 *
 * claudeAnalysis est rempli par le job d'analyse asynchrone (bug_technique
 * uniquement). proposedFix ne contient JAMAIS un patch auto-mergé : la branche
 * fix/ticket-{id} attend une approbation humaine explicite (approve-patch).
 */

import mongoose from 'mongoose';

const TICKET_CATEGORIES = ['bug_technique', 'question', 'plainte_livraison', 'autre'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TICKET_STATUSES = ['nouveau', 'analyse_en_cours', 'patch_propose', 'en_review', 'deploye', 'escalade', 'ferme'];
const RISK_LEVELS = ['low', 'medium', 'high'];
const ANALYSIS_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'];

const historyEntrySchema = new mongoose.Schema({
  action: { type: String, required: true },            // ex: 'creation', 'analyse_lancee', 'patch_propose', 'patch_approuve', 'patch_rejete', 'statut_change', 'tests_echoues'
  by: { type: String, default: 'system' },             // userId ou 'system' / 'claude'
  at: { type: Date, default: Date.now },
  note: { type: String, default: '' },
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true },

  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 8000 },
  category: { type: String, enum: TICKET_CATEGORIES, required: true, index: true },
  priority: { type: String, enum: TICKET_PRIORITIES, default: 'medium', index: true },

  // ── Contexte enrichi automatiquement à la création ─────────────────────────
  context: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null }, // client concerné (lookup téléphone/email)
    userSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },             // {name, phone, email, ordersCount…} figé à la création
    relatedSentryIssues: { type: [mongoose.Schema.Types.Mixed], default: [] },      // [{issueId, title, url, lastSeen}] — Sentry non branché à ce jour, rempli manuellement ou par intégration future
    recentUserActions: { type: [mongoose.Schema.Types.Mixed], default: [] },        // dernières commandes + FeatureUsageLog
    screenshotUrl: { type: String, default: '' },
  },

  // ── Analyse Claude (job asynchrone, bug_technique uniquement) ──────────────
  claudeAnalysis: {
    status: { type: String, enum: ANALYSIS_STATUSES, default: 'pending' },
    diagnosis: { type: String, default: '' },
    confidenceScore: { type: Number, min: 0, max: 1, default: null },
    riskLevel: { type: String, enum: [...RISK_LEVELS, null], default: null },
    recommendedAction: { type: String, enum: ['auto_patch', 'human_review', 'escalate_urgent', null], default: null },
    blacklistTriggered: { type: [String], default: [] }, // règles de la liste noire qui ont forcé riskLevel=high
    proposedFix: {
      branch: { type: String, default: '' },             // fix/ticket-{id}
      prUrl: { type: String, default: '' },              // URL de la PR ouverte par Claude
      diff: { type: String, default: '' },               // diff unifié complet
      filesChanged: { type: [String], default: [] },
      testResults: { type: mongoose.Schema.Types.Mixed, default: null }, // {passed, total, failed, output}
    },
    error: { type: String, default: '' },
    analyzedAt: { type: Date, default: null },
  },

  status: { type: String, enum: TICKET_STATUSES, default: 'nouveau', index: true },

  history: { type: [historyEntrySchema], default: [] },
}, { timestamps: true });

// Listing par workspace, tri récent d'abord
ticketSchema.index({ workspaceId: 1, createdAt: -1 });
// Filtre par niveau de risque (badge liste)
ticketSchema.index({ workspaceId: 1, 'claudeAnalysis.riskLevel': 1 });

ticketSchema.statics.CATEGORIES = TICKET_CATEGORIES;
ticketSchema.statics.PRIORITIES = TICKET_PRIORITIES;
ticketSchema.statics.STATUSES = TICKET_STATUSES;
ticketSchema.statics.RISK_LEVELS = RISK_LEVELS;

export default mongoose.model('Ticket', ticketSchema);
