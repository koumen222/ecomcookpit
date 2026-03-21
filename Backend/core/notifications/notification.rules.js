/**
 * notification.rules.js
 * Mappe chaque eventType vers :
 *  - templateKey  : clé dans email.service.js TEMPLATES
 *  - prefCategory : catégorie de préférence utilisateur à vérifier
 *  - buildData    : fonction qui transforme le payload brut en data pour le template
 *  - condition    : (payload) => bool — si false, l'email n'est pas envoyé
 *  - throttleKey  : (payload) => string — clé unique pour l'anti-spam
 *  - throttleMs   : durée minimale entre deux envois identiques (ms)
 */

const fmt = (amount, currency = 'XAF') => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
};

export const NOTIFICATION_RULES = {

  // ─── AUTH ──────────────────────────────────────────────────────────────────

  user_registered: {
    templateKey: 'welcome',
    prefCategory: 'authEmails',
    buildData: ({ user, workspace }) => ({
      name: user.name || user.email,
      workspaceName: workspace?.name
    }),
    throttleKey: ({ user }) => `welcome:${user._id}`,
    throttleMs: 24 * 60 * 60 * 1000 // 1 jour
  },

  forgot_password: {
    templateKey: 'forgot_password',
    prefCategory: 'authEmails',
    buildData: ({ user, resetUrl }) => ({
      name: user.name || user.email,
      resetUrl,
      expiresIn: '1 heure'
    }),
    throttleKey: ({ user }) => `forgot_password:${user._id}`,
    throttleMs: 5 * 60 * 1000 // 5 minutes
  },

  password_changed: {
    templateKey: 'password_changed',
    prefCategory: 'securityEmails',
    buildData: ({ user }) => ({
      name: user.name || user.email
    }),
    throttleKey: ({ user }) => `password_changed:${user._id}`,
    throttleMs: 60 * 1000 // 1 minute
  },

  suspicious_login: {
    templateKey: 'suspicious_login',
    prefCategory: 'securityEmails',
    buildData: ({ user, ip, device, location }) => ({
      name: user.name || user.email,
      ip,
      device,
      location,
      time: new Date().toLocaleString('fr-FR')
    }),
    throttleKey: ({ user, ip }) => `suspicious_login:${user._id}:${ip}`,
    throttleMs: 30 * 60 * 1000 // 30 minutes par IP
  },

  // ─── ÉQUIPE ────────────────────────────────────────────────────────────────

  team_invitation: {
    templateKey: 'team_invitation',
    prefCategory: 'teamEmails',
    buildData: ({ inviterName, workspace, role, inviteUrl }) => ({
      inviterName,
      workspaceName: workspace?.name || workspace,
      role,
      inviteUrl,
      expiresIn: '7 jours'
    }),
    throttleKey: ({ targetEmail, workspace }) => `invite:${targetEmail}:${workspace?._id || workspace}`,
    throttleMs: 60 * 60 * 1000 // 1 heure
  },

  role_changed: {
    templateKey: 'role_changed',
    prefCategory: 'teamEmails',
    buildData: ({ user, workspace, oldRole, newRole, changedBy }) => ({
      name: user.name || user.email,
      workspaceName: workspace?.name || workspace,
      oldRole,
      newRole,
      changedBy: changedBy?.name || changedBy?.email || changedBy
    }),
    throttleKey: ({ user, workspace }) => `role_changed:${user._id}:${workspace?._id || workspace}`,
    throttleMs: 5 * 60 * 1000
  },

  member_removed: {
    templateKey: 'member_removed',
    prefCategory: 'teamEmails',
    buildData: ({ user, workspace, removedBy }) => ({
      name: user.name || user.email,
      workspaceName: workspace?.name || workspace,
      removedBy: removedBy?.name || removedBy?.email || removedBy
    }),
    throttleKey: ({ user, workspace }) => `member_removed:${user._id}:${workspace?._id || workspace}`,
    throttleMs: 60 * 1000
  },

  // ─── FINANCE ───────────────────────────────────────────────────────────────

  budget_warning_70: {
    templateKey: 'budget_warning',
    prefCategory: 'financeEmails',
    condition: ({ budget }) => (budget.percentage || 0) >= 70 && (budget.percentage || 0) < 100,
    buildData: ({ budget, workspace, currency }) => ({
      budgetName: budget.name,
      category: budget.category,
      spent: fmt(budget.totalSpent, currency),
      limit: fmt(budget.amount, currency),
      percentage: Math.round(budget.percentage),
      workspaceName: workspace?.name || workspace
    }),
    throttleKey: ({ budget }) => `budget_warning_70:${budget._id}`,
    throttleMs: 12 * 60 * 60 * 1000 // 12h — une seule alerte par demi-journée
  },

  budget_warning_100: {
    templateKey: 'budget_warning',
    prefCategory: 'financeEmails',
    condition: ({ budget }) => (budget.percentage || 0) >= 100,
    buildData: ({ budget, workspace, currency }) => ({
      budgetName: budget.name,
      category: budget.category,
      spent: fmt(budget.totalSpent, currency),
      limit: fmt(budget.amount, currency),
      percentage: Math.round(budget.percentage),
      workspaceName: workspace?.name || workspace
    }),
    throttleKey: ({ budget }) => `budget_warning_100:${budget._id}`,
    throttleMs: 6 * 60 * 60 * 1000
  },

  budget_exceeded: {
    templateKey: 'budget_exceeded',
    prefCategory: 'financeEmails',
    condition: ({ budget }) => (budget.totalSpent || 0) > (budget.amount || 0),
    buildData: ({ budget, workspace, currency }) => ({
      budgetName: budget.name,
      category: budget.category,
      spent: fmt(budget.totalSpent, currency),
      limit: fmt(budget.amount, currency),
      overage: fmt(budget.totalSpent - budget.amount, currency),
      workspaceName: workspace?.name || workspace
    }),
    throttleKey: ({ budget }) => `budget_exceeded:${budget._id}`,
    throttleMs: 24 * 60 * 60 * 1000
  },

  critical_transaction: {
    templateKey: 'critical_transaction',
    prefCategory: 'financeEmails',
    condition: ({ transaction, threshold = 100000 }) => (transaction.amount || 0) >= threshold,
    buildData: ({ transaction, workspace, currency }) => ({
      amount: fmt(transaction.amount, currency),
      description: transaction.description,
      category: transaction.category,
      type: transaction.type,
      workspaceName: workspace?.name || workspace
    }),
    throttleKey: ({ transaction }) => `critical_tx:${transaction._id}`,
    throttleMs: 60 * 1000
  },

  weekly_report: {
    templateKey: 'weekly_report',
    prefCategory: 'weeklyDigest',
    buildData: ({ workspace, period, income, expenses, balance, topCategory, ordersCount, currency }) => ({
      workspaceName: workspace?.name || workspace,
      period,
      income: fmt(income, currency),
      expenses: fmt(expenses, currency),
      balance: fmt(balance, currency),
      topCategory,
      ordersCount
    }),
    throttleKey: ({ workspace, period }) => `weekly_report:${workspace?._id || workspace}:${period}`,
    throttleMs: 6 * 24 * 60 * 60 * 1000 // 6 jours
  },

  monthly_report: {
    templateKey: 'monthly_report',
    prefCategory: 'monthlyDigest',
    buildData: ({ workspace, month, income, expenses, balance, growth, budgetUsage, currency }) => ({
      workspaceName: workspace?.name || workspace,
      month,
      income: fmt(income, currency),
      expenses: fmt(expenses, currency),
      balance: fmt(balance, currency),
      growth,
      budgetUsage
    }),
    throttleKey: ({ workspace, month }) => `monthly_report:${workspace?._id || workspace}:${month}`,
    throttleMs: 25 * 24 * 60 * 60 * 1000 // 25 jours
  },

  // ─── PRODUITS ──────────────────────────────────────────────────────────────

  stock_low: {
    templateKey: 'stock_low',
    prefCategory: 'productEmails',
    condition: ({ product }) => (product.stock || 0) <= (product.reorderThreshold || 5) && (product.stock || 0) > 0,
    buildData: ({ product, workspace }) => ({
      productName: product.name,
      stock: product.stock,
      threshold: product.reorderThreshold || 5,
      workspaceName: workspace?.name || workspace
    }),
    throttleKey: ({ product }) => `stock_low:${product._id}`,
    throttleMs: 24 * 60 * 60 * 1000
  },

  stock_out: {
    templateKey: 'stock_out',
    prefCategory: 'productEmails',
    condition: ({ product }) => (product.stock || 0) === 0,
    buildData: ({ product, workspace }) => ({
      productName: product.name,
      workspaceName: workspace?.name || workspace
    }),
    throttleKey: ({ product }) => `stock_out:${product._id}`,
    throttleMs: 24 * 60 * 60 * 1000
  },

  // ─── BUSINESS ──────────────────────────────────────────────────────────────

  sales_spike: {
    templateKey: 'sales_spike',
    prefCategory: 'businessEmails',
    buildData: ({ workspace, ordersCount, period, revenue, currency }) => ({
      workspaceName: workspace?.name || workspace,
      ordersCount,
      period,
      revenue: fmt(revenue, currency)
    }),
    throttleKey: ({ workspace }) => `sales_spike:${workspace?._id || workspace}`,
    throttleMs: 4 * 60 * 60 * 1000 // 4h entre deux alertes pic
  },

  new_record: {
    templateKey: 'new_record',
    prefCategory: 'businessEmails',
    buildData: ({ workspace, metric, value, previousRecord, currency }) => ({
      workspaceName: workspace?.name || workspace,
      metric,
      value: typeof value === 'number' ? fmt(value, currency) : value,
      previousRecord: previousRecord != null ? (typeof previousRecord === 'number' ? fmt(previousRecord, currency) : previousRecord) : null
    }),
    throttleKey: ({ workspace, metric }) => `new_record:${workspace?._id || workspace}:${metric}`,
    throttleMs: 60 * 60 * 1000
  }
};
