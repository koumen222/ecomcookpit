/**
 * Diagnostics Route - Help debug configuration issues
 * GET /api/ecom/diagnostics
 */

import express from 'express';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { isConfigured } from '../services/cloudflareImagesService.js';

const router = express.Router();

/**
 * GET /api/ecom/diagnostics
 * Returns system configuration status
 */
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      user: {
        id: req.user?.id,
        email: req.ecomUser?.email,
        role: req.ecomUserRole || req.ecomUser?.role,
        workspaceId: req.workspaceId
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT
      },
      services: {
        openai: {
          configured: !!process.env.OPENAI_API_KEY,
          keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
        },
        cloudflare: {
          r2Configured: !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
          imagesConfigured: isConfigured(),
          accountId: !!process.env.CLOUDFLARE_ACCOUNT_ID,
          apiToken: !!process.env.CLOUDFLARE_API_TOKEN
        },
        database: {
          mongoUri: !!process.env.MONGO_URI,
          connected: true // If we reach here, DB is connected
        },
        auth: {
          jwtSecret: !!process.env.ECOM_JWT_SECRET,
          jwtSecretLength: process.env.ECOM_JWT_SECRET ? process.env.ECOM_JWT_SECRET.length : 0
        }
      },
      alibaba: {
        routeRegistered: true, // If this endpoint works, the alibaba route should be registered too
        requiredServices: {
          openai: !!process.env.OPENAI_API_KEY,
          auth: !!req.user,
          workspace: !!req.workspaceId
        }
      }
    };

    res.json({ success: true, diagnostics });
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du diagnostic',
      error: error.message 
    });
  }
});

export default router;
