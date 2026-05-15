/**
 * Caddy On-Demand TLS Validation Endpoint
 * 
 * Caddy calls GET /api/caddy/check-domain?domain=<hostname>
 * Returns 200 if the domain is a registered custom domain → Caddy issues cert
 * Returns 404 otherwise → Caddy refuses to issue cert
 * 
 * Security: Protected by a shared secret (CADDY_AUTH_TOKEN env var)
 * to prevent abuse (anyone could otherwise trigger cert issuance).
 */

import { Router } from 'express';
import Workspace from '../models/Workspace.js';
import Store from '../models/Store.js';

const router = Router();

router.get('/check-domain', async (req, res) => {
  const { domain } = req.query;

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'domain query parameter required' });
  }

  // Optional: verify shared secret from Caddy
  const authToken = process.env.CADDY_AUTH_TOKEN;
  if (authToken) {
    const provided = req.headers['x-caddy-token'] || req.query.token;
    if (provided !== authToken) {
      console.warn(`🔒 [caddy] Unauthorized check-domain request for ${domain}`);
      return res.status(403).json({ error: 'unauthorized' });
    }
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^www\./, '');

  // Sous-domaines scalor.net → toujours autorisés
  if (cleanDomain.endsWith('.scalor.net') || cleanDomain === 'scalor.net') {
    return res.status(200).json({ ok: true, domain: cleanDomain });
  }

  try {
    // Helper : cherche un domaine dans Store (multi-boutique) puis Workspace (legacy)
    async function isDomainRegistered(domainToCheck) {
      const [store, workspace] = await Promise.all([
        Store.findOne({
          'storeDomains.customDomain': domainToCheck,
          isActive: { $ne: false }
        }).select('_id subdomain').lean(),
        Workspace.findOne({
          'storeDomains.customDomain': domainToCheck,
          isActive: { $ne: false }
        }).select('_id subdomain').lean()
      ]);
      if (store) return { found: true, source: 'store', id: store._id, subdomain: store.subdomain };
      if (workspace) return { found: true, source: 'workspace', id: workspace._id, subdomain: workspace.subdomain };
      return { found: false };
    }

    // Vérifier le domaine exact
    const result = await isDomainRegistered(cleanDomain);
    if (result.found) {
      console.log(`✅ [caddy] Domain ${cleanDomain} → ${result.source} ${result.id} (${result.subdomain})`);
      return res.status(200).json({ ok: true, domain: cleanDomain });
    }

    // Vérifier la variante www
    const wwwResult = await isDomainRegistered(`www.${cleanDomain}`);
    if (wwwResult.found) {
      console.log(`✅ [caddy] Domain www.${cleanDomain} → ${wwwResult.source} ${wwwResult.id}`);
      return res.status(200).json({ ok: true, domain: cleanDomain });
    }

    console.log(`❌ [caddy] Domain ${cleanDomain} not found in Store or Workspace`);
    return res.status(404).json({ error: 'domain not registered' });

  } catch (error) {
    console.error(`❌ [caddy] Error checking domain ${cleanDomain}:`, error.message);
    return res.status(404).json({ error: 'internal error' });
  }
});

export default router;
