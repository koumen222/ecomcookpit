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

  try {
    // Check if this domain is registered as a custom domain by any workspace
    const workspace = await Workspace.findOne({
      'storeDomains.customDomain': cleanDomain,
      isActive: { $ne: false }
    }).select('_id subdomain').lean();

    if (workspace) {
      console.log(`✅ [caddy] Domain ${cleanDomain} → workspace ${workspace._id} (${workspace.subdomain})`);
      return res.status(200).json({ ok: true, domain: cleanDomain });
    }

    // Also check www variant
    const wwwWorkspace = await Workspace.findOne({
      'storeDomains.customDomain': `www.${cleanDomain}`,
      isActive: { $ne: false }
    }).select('_id').lean();

    if (wwwWorkspace) {
      console.log(`✅ [caddy] Domain www.${cleanDomain} → workspace ${wwwWorkspace._id}`);
      return res.status(200).json({ ok: true, domain: cleanDomain });
    }

    console.log(`❌ [caddy] Domain ${cleanDomain} not found in any workspace`);
    return res.status(404).json({ error: 'domain not registered' });

  } catch (error) {
    console.error(`❌ [caddy] Error checking domain ${cleanDomain}:`, error.message);
    // Return 404 on error to prevent cert issuance for unknown domains
    return res.status(404).json({ error: 'internal error' });
  }
});

export default router;
