/**
 * Centralized error message parser — translates backend/network errors
 * into clear, user-friendly French messages.
 */

const HTTP_STATUS_MESSAGES = {
  400: 'Les informations envoyées sont incorrectes. Vérifiez les champs et réessayez.',
  401: 'Votre session a expiré. Veuillez vous reconnecter.',
  403: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
  404: 'La ressource demandée est introuvable.',
  408: 'La requête a pris trop de temps. Vérifiez votre connexion et réessayez.',
  409: 'Un conflit a été détecté. Cette ressource existe peut-être déjà.',
  422: 'Les données soumises sont invalides. Vérifiez les champs.',
  429: 'Trop de tentatives. Attendez quelques secondes puis réessayez.',
  500: 'Une erreur est survenue sur le serveur. Contactez le support si le problème persiste.',
  502: 'Le serveur est temporairement indisponible. Réessayez dans quelques instants.',
  503: 'Le service est en maintenance. Réessayez dans quelques instants.',
  504: 'Le serveur met trop de temps à répondre. Vérifiez votre connexion.',
};

const NETWORK_ERROR_MESSAGES = {
  'Network Error': 'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
  'timeout': 'La connexion a expiré. Vérifiez votre connexion internet et réessayez.',
  'ECONNABORTED': 'La connexion a été interrompue. Réessayez.',
};

const DOMAIN_ERROR_MESSAGES = {
  // Auth
  'Email ou mot de passe incorrect': 'Email ou mot de passe incorrect.',
  'Compte désactivé': 'Votre compte est désactivé. Contactez un administrateur.',
  'Token expiré': 'Votre session a expiré. Veuillez vous reconnecter.',
  'Token invalide': 'Session invalide. Veuillez vous reconnecter.',
  'Utilisateur non trouvé': 'Aucun compte trouvé avec cette adresse email.',
  // Workspace
  'Code d\'invitation invalide': 'Ce code d\'invitation est invalide ou a expiré.',
  'Vous êtes déjà membre': 'Vous êtes déjà membre de cet espace.',
  'Workspace non trouvé': 'Cet espace de travail est introuvable.',
  // Users
  'Email déjà utilisé': 'Cette adresse email est déjà associée à un compte.',
  'Permission insuffisante': 'Vous n\'avez pas les droits pour effectuer cette action.',
  // Orders
  'Commande non trouvée': 'Cette commande est introuvable ou a été supprimée.',
  // Products
  'Produit non trouvé': 'Ce produit est introuvable ou a été supprimé.',
  // Generic
  'Confirmation invalide': 'La confirmation ne correspond pas. Vérifiez et réessayez.',
};

const PLAN_LABELS = {
  free: 'Gratuit',
  starter: 'Scalor',
  pro: 'Scalor + IA',
  ultra: 'Scalor IA Pro',
  trial: 'Essai gratuit',
};

const RESOURCE_LABELS = {
  orders: 'commandes',
  customers: 'clients',
  products: 'produits',
  stores: 'boutiques',
  whatsappInstances: 'instances WhatsApp',
};

function formatPlanLabel(planKey, fallbackLabel = '') {
  return fallbackLabel || PLAN_LABELS[planKey] || planKey || 'Gratuit';
}

function getPlanRestrictionMessage(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return '';

  const hasPlanMarker = Boolean(
    data.upgradeUrl
    || data.requiresPlan
    || data.requiredPlan
    || ['PLAN_LIMIT_REACHED', 'FEATURE_NOT_AVAILABLE', 'upgrade_required', 'limit_reached'].includes(data.error)
  );

  if (!hasPlanMarker) return '';

  const planLabel = formatPlanLabel(data.plan, data.planLabel);
  const requiredPlanLabel = formatPlanLabel(data.requiredPlan || data.requiresPlan, data.requiredPlanLabel);
  const resourceLabel = data.resourceLabel || RESOURCE_LABELS[data.resource] || 'ressources';
  const serverMessage = typeof data.message === 'string' ? data.message.trim() : '';

  if (data.error === 'PLAN_LIMIT_REACHED') {
    return serverMessage || `Votre plan ${planLabel} a atteint sa limite pour ${resourceLabel}. Passez au plan ${requiredPlanLabel || 'supérieur'} pour continuer.`;
  }

  if (data.error === 'FEATURE_NOT_AVAILABLE' || data.requiresPlan) {
    return serverMessage || `Cette fonctionnalité n'est pas disponible sur votre plan ${planLabel}. Elle nécessite le plan ${requiredPlanLabel || 'supérieur'}.`;
  }

  if (data.error === 'upgrade_required' || data.error === 'limit_reached') {
    return serverMessage || `Cette action n'est pas disponible sur votre plan actuel. Passez au plan ${requiredPlanLabel || 'supérieur'} pour continuer.`;
  }

  return serverMessage;
}

/**
 * Returns a human-readable error message from any error object.
 * @param {any} err - The caught error
 * @param {string} fallback - Optional fallback message
 * @returns {string}
 */
export function getErrorMessage(err, fallback = 'Une erreur inattendue est survenue. Réessayez.') {
  if (!err) return fallback;

  if (err?.userMessage) return err.userMessage;

  const planRestrictionMessage = getPlanRestrictionMessage(err);
  if (planRestrictionMessage) return planRestrictionMessage;

  // Axios response error — has server message
  const serverMessage = err?.response?.data?.message;
  if (serverMessage) {
    // Check for known domain messages to give a better translation
    for (const [key, msg] of Object.entries(DOMAIN_ERROR_MESSAGES)) {
      if (serverMessage.toLowerCase().includes(key.toLowerCase())) return msg;
    }
    // Return the server message as-is (it's already in French from our backend)
    return serverMessage;
  }

  // HTTP status code errors
  const status = err?.response?.status;
  if (status && HTTP_STATUS_MESSAGES[status]) {
    return HTTP_STATUS_MESSAGES[status];
  }

  // Network errors (no response)
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return NETWORK_ERROR_MESSAGES['timeout'];
  }
  if (err?.message === 'Network Error' || !err?.response) {
    return NETWORK_ERROR_MESSAGES['Network Error'];
  }

  // Plain string error
  if (typeof err === 'string') return err;

  // Error object message
  if (err?.message) {
    for (const [key, msg] of Object.entries(DOMAIN_ERROR_MESSAGES)) {
      if (err.message.toLowerCase().includes(key.toLowerCase())) return msg;
    }
    return err.message;
  }

  return fallback;
}

/**
 * Returns a specific error message for a given action context.
 * @param {any} err
 * @param {string} action - e.g. 'load_orders', 'save_product', 'delete_user'
 * @returns {string}
 */
export function getContextualError(err, action) {
  const CONTEXT_FALLBACKS = {
    load_orders: 'Impossible de charger les commandes. Vérifiez votre connexion.',
    load_products: 'Impossible de charger les produits. Vérifiez votre connexion.',
    load_transactions: 'Impossible de charger les transactions. Vérifiez votre connexion.',
    load_clients: 'Impossible de charger les clients. Vérifiez votre connexion.',
    load_users: 'Impossible de charger les utilisateurs. Vérifiez votre connexion.',
    load_stats: 'Impossible de charger les statistiques. Vérifiez votre connexion.',
    load_dashboard: 'Impossible de charger le tableau de bord. Vérifiez votre connexion.',
    save_order: 'Impossible de sauvegarder la commande. Vérifiez les informations et réessayez.',
    save_product: 'Impossible de sauvegarder le produit. Vérifiez les informations et réessayez.',
    save_transaction: 'Impossible de sauvegarder la transaction. Vérifiez les informations et réessayez.',
    save_client: 'Impossible de sauvegarder le client. Vérifiez les informations et réessayez.',
    save_user: 'Impossible de sauvegarder l\'utilisateur. Vérifiez les informations et réessayez.',
    delete_order: 'Impossible de supprimer la commande. Réessayez ou contactez le support.',
    delete_product: 'Impossible de supprimer le produit. Réessayez ou contactez le support.',
    delete_transaction: 'Impossible de supprimer la transaction. Réessayez ou contactez le support.',
    delete_user: 'Impossible de supprimer l\'utilisateur. Réessayez ou contactez le support.',
    login: 'Connexion impossible. Vérifiez vos identifiants et réessayez.',
    register: 'Inscription impossible. Vérifiez les informations et réessayez.',
    switch_workspace: 'Impossible de changer d\'espace de travail. Réessayez.',
    send_message: 'Message non envoyé. Vérifiez votre connexion et réessayez.',
    export: 'L\'export a échoué. Réessayez ou contactez le support.',
    import: 'L\'import a échoué. Vérifiez le format du fichier et réessayez.',
    upload: 'L\'envoi du fichier a échoué. Vérifiez la taille et le format.',
    generate_invite: 'Impossible de générer le lien d\'invitation. Réessayez.',
    reset_password: 'Impossible de réinitialiser le mot de passe. Réessayez.',
    update_settings: 'Impossible de sauvegarder les paramètres. Réessayez.',
  };

  const fallback = CONTEXT_FALLBACKS[action] || 'Une erreur inattendue est survenue. Réessayez.';
  return getErrorMessage(err, fallback);
}
