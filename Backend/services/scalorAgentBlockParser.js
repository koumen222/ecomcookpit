const ACTION_BLOCK_PATTERN = /<scalor_actions?>\s*([\s\S]*?)\s*<\/scalor_actions?>/gi;

/**
 * Parse les blocs d'actions structurés produits par le modèle.
 *
 * Le prompt demande `<scalor_actions>`, mais les LLM peuvent parfois employer
 * la variante singulière `<scalor_action>`. Les deux formes sont acceptées afin
 * qu'une action valide soit exécutée au lieu d'être affichée comme texte brut.
 * Tout bloc reconnu est retiré de la réponse, même si son JSON est invalide.
 */
export function parseScalorAgentActionBlocks(rawReply = '') {
  const source = String(rawReply || '');
  const actions = [];
  const matcher = new RegExp(ACTION_BLOCK_PATTERN.source, ACTION_BLOCK_PATTERN.flags);
  let match;

  while ((match = matcher.exec(source)) !== null && actions.length < 3) {
    try {
      const parsed = JSON.parse(match[1]);
      const blockActions = Array.isArray(parsed) ? parsed : [parsed];
      for (const action of blockActions) {
        if (action && typeof action === 'object' && actions.length < 3) actions.push(action);
      }
    } catch {
      // Bloc technique invalide : ne pas l'exécuter, mais ne pas l'afficher.
    }
  }

  return {
    actions,
    reply: source
      .replace(ACTION_BLOCK_PATTERN, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  };
}
