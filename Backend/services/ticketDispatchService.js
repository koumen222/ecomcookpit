/**
 * Dispatch d'un ticket bug vers « ton Claude » (Claude Code) via GitHub Actions.
 *
 * On déclenche un repository_dispatch (event_type: 'ticket_fix') sur le repo GitHub.
 * Le workflow .github/workflows/ticket-fix.yml lance Claude Code avec ton token OAuth
 * Claude Code (secret GitHub CLAUDE_CODE_OAUTH_TOKEN), crée la branche fix/ticket-{id},
 * code le correctif, ouvre une PR vers `dev`, puis rappelle le backend
 * (POST /:id/analysis) avec le résultat.
 *
 * Variables d'environnement backend requises :
 *   - GITHUB_DISPATCH_TOKEN : token GitHub (fine-grained ou PAT) avec scope repo + workflow
 *   - GITHUB_DISPATCH_REPO  : "owner/repo" cible, ex "koumen222/ecomcookpit"
 *   - PUBLIC_BACKEND_URL     : URL publique du backend (pour le callback), ex "https://api.scalor.net"
 *   - TICKET_CALLBACK_SECRET : secret partagé pour sécuriser le callback GitHub Actions
 *   - TICKET_PR_BASE         : branche cible des PR (défaut "dev")
 */

import axios from 'axios';

export async function dispatchTicketToClaude(ticket) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO;
  if (!token || !repo) {
    throw new Error('GITHUB_DISPATCH_TOKEN et GITHUB_DISPATCH_REPO doivent être configurés pour envoyer le ticket à Claude');
  }

  const backendUrl = (process.env.PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
  const callbackUrl = backendUrl ? `${backendUrl}/api/ecom/tickets/${ticket._id}/analysis` : '';

  const clientPayload = {
    ticket_id: String(ticket._id),
    title: String(ticket.title || '').slice(0, 200),
    description: String(ticket.description || '').slice(0, 6000),
    category: ticket.category,
    priority: ticket.priority,
    base_branch: process.env.TICKET_PR_BASE || 'dev',
    callback_url: callbackUrl,
  };

  await axios.post(
    `https://api.github.com/repos/${repo}/dispatches`,
    { event_type: 'ticket_fix', client_payload: clientPayload },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'scalor-tickets',
      },
      timeout: 15000,
    },
  );

  return { dispatched: true, repo, callbackUrl };
}

export default { dispatchTicketToClaude };
