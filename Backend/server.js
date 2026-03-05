import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { connectDB } from './config/database.js';
import { extractSubdomain } from './middleware/subdomain.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://ecomcookpit.site",
  "https://www.ecomcookpit.site",
  "https://scalor.net",
  "https://www.scalor.net",
  "https://api.scalor.net",
  "http://ecomcookpit.site",
  "http://www.ecomcookpit.site",
  "https://ecomcookpit.pages.dev",
  "https://ecomcookpit-production.up.railway.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:3000",
  "http://localhost:8081"
];

const corsOptions = {
  origin: function (origin, callback) {
    const debugCors = process.env.DEBUG_CORS === 'true';
    if (debugCors) {
      console.log('🌐 CORS Request from origin:', origin);
    }
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      if (debugCors) {
        console.log('✅ CORS Allowed (explicit):', origin);
      }
      return callback(null, true);
    }
    if (origin.endsWith(".ecomcookpit.pages.dev")) {
      if (debugCors) {
        console.log('✅ CORS Allowed (pages.dev):', origin);
      }
      return callback(null, true);
    }
    if (origin.endsWith(".scalor.net")) {
      if (debugCors) {
        console.log('✅ CORS Allowed (scalor.net):', origin);
      }
      return callback(null, true);
    }
    // Allow all *.scalor.app subdomains (public stores)
    if (origin.endsWith(".scalor.app")) {
      if (debugCors) {
        console.log('✅ CORS Allowed (scalor.app):', origin);
      }
      return callback(null, true);
    }
    console.log('❌ CORS Blocked:', origin);
    callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Session-Id", "X-Workspace-Id"],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Request Logger (PRODUCTION DEBUG) ────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  // Log request details
  console.log(`🚀 ${req.method} ${req.path}`);
  console.log(`   Headers: Authorization=${req.headers.authorization ? '[Bearer]' : 'NONE'}, X-Workspace-Id=${req.headers['x-workspace-id'] || 'NONE'}`);
  console.log(`   Origin: ${req.headers.origin || 'NONE'}, User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'NONE'}...`);
  
  // Override res.send to log response
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`� Response ${res.statusCode} in ${duration}ms`);
    
    // Log error responses in detail
    if (res.statusCode >= 400) {
      console.log(`❌ ERROR RESPONSE:`, typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data, null, 2).substring(0, 300));
    }
    
    originalSend.call(this, data);
  };
  
  next();
});

// ─── Compression (disabled for SSE routes to prevent buffering) ──────────────
app.use(compression({
  filter: (req, res) => {
    // NEVER compress SSE — gzip buffering breaks streaming events
    const path = req.path || '';
    if (path.includes('alibaba-import') || path.includes('product-generator')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ─── Security with Helmet ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    xFrameOptions: { action: 'sameorigin' }
  })
);

// ─── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Subdomain extraction (GLOBAL - runs on every request) ─────────────────
// Must be BEFORE all other middleware that depends on req.subdomain / req.isApiDomain
app.use(extractSubdomain);

// ─── Defensive API path normalization (stale bundle compatibility) ──────────
// Some old frontend bundles may accidentally call:
// - /api/ecom/api/ai/...
// - /api/ecom/api/ecom/...
// Rewrite them to the canonical routes so requests still succeed.
app.use((req, _res, next) => {
  const originalUrl = req.url || '';
  let normalizedUrl = originalUrl;

  if (normalizedUrl.startsWith('/api/ecom/api/ecom/')) {
    normalizedUrl = normalizedUrl.replace('/api/ecom/api/ecom/', '/api/ecom/');
  }
  if (normalizedUrl.startsWith('/api/ecom/api/')) {
    normalizedUrl = normalizedUrl.replace('/api/ecom/api/', '/api/');
  }

  if (normalizedUrl !== originalUrl) {
    req.url = normalizedUrl;
  }

  next();
});

// ✅ FORCE UTF-8 for API routes only — store subdomains serve HTML, not JSON
// Must be AFTER extractSubdomain so req.isApiDomain is available
app.use((req, res, next) => {
  res.charset = 'utf-8';
  // Only set JSON Content-Type for API routes
  // Store subdomains serve HTML (React build) — don't override their Content-Type
  // Skip for SSE routes — they manage their own Content-Type via res.writeHead
  const path = req.path || '';
  const isSSERoute = path.includes('alibaba-import') || path.includes('product-generator');
  if (!isSSERoute && (path.startsWith('/api') || req.isApiDomain)) {
    res.set('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Debug encoding ──────────────────────────────────────────────────────────
app.get('/debug-encoding', (req, res) => {
  const text = "école à Douala";
  
  console.log("BACKEND:", text);
  
  res.json({
    text
  });
});

// ─── Web Push config (optional) ──────────────────────────────────────────────
try {
  const { configureWebPush } = await import('./config/push.js');
  configureWebPush();
} catch (error) {
  console.warn('⚠️ Web Push non configuré:', error.message);
}

// ─── WhatsApp service init (optional) ────────────────────────────────────────
// WhatsApp est maintenant géré dynamiquement par instances utilisateur
// Plus besoin d'initialiser un service global au démarrage

// ─── Start server ────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // Connexion MongoDB uniquement
    await connectDB();
    console.log('💡 Mode MongoDB activé');

    console.log('\n🚀 Build timestamp:', new Date().toISOString());

    // ─── Route map: file → mount path ──────────────────────────────────
    const routes = [
      ['./routes/auth.js',                    '/api/ecom/auth'],
      ['./routes/products.js',                '/api/ecom/products'],
      ['./routes/productResearch.js',         '/api/ecom/products-research'],
      ['./routes/goals.js',                   '/api/ecom/goals'],
      ['./routes/reports.js',                 '/api/ecom/reports'],
      ['./routes/stock.js',                   '/api/ecom/stock'],
      ['./routes/stockLocations.js',          '/api/ecom/stock-locations'],
      ['./routes/decisions.js',               '/api/ecom/decisions'],
      ['./routes/transactions.js',            '/api/ecom/transactions'],
      ['./routes/notificationPreferences.js', '/api/ecom/notification-preferences'],
      ['./routes/users.js',                   '/api/ecom/users'],
      ['./routes/superAdmin.js',              '/api/ecom/super-admin'],
      ['./routes/superAdminPush.js',          '/api/ecom/super-admin/push'],
      ['./routes/analytics.js',               '/api/ecom/analytics'],
      ['./routes/marketing.js',               '/api/ecom/marketing'],
      ['./routes/import.js',                  '/api/ecom/import'],
      ['./routes/clients.js',                 '/api/ecom/clients'],
      ['./routes/orders.js',                  '/api/ecom/orders'],
      ['./routes/campaigns.js',               '/api/ecom/campaigns'],
      ['./routes/ecore.js',                   '/api/ecom/ecore'],
      ['./routes/push.js',                    '/api/ecom/push'],
      ['./routes/notifications.js',           '/api/ecom/notifications'],
      ['./routes/workspaces.js',              '/api/ecom/workspaces'],
      ['./routes/messages.js',                '/api/ecom/messages'],
      ['./routes/dm.js',                      '/api/ecom/dm'],
      ['./routes/media.js',                   '/api/ecom/media'],
      ['./routes/contact.js',                 '/api/ecom/contact'],
      ['./routes/assignments.js',             '/api/ecom/assignments'],
      ['./routes/autoSync.js',                '/api/ecom/auto-sync'],
      ['./routes/agent.js',                   '/api/ecom/agent'],
      ['./routes/agentCommands.js',           '/api/ecom/agent/commands'],
      // ─── Store / Storefront routes ──────────────────────────────────
      ['./routes/storeProducts.js',           '/api/ecom/store-products'],
      ['./routes/storeOrders.js',             '/api/ecom/store-orders'],
      ['./routes/storeManagement.js',         '/api/ecom/store-manage'],
      ['./routes/storeAdmin.js',              '/api/ecom/store'],
      ['./routes/publicStore.js',             '/api/public/store'],
      // ─── New unified Store API (called by SPA on *.scalor.net via api.scalor.net) ──
      ['./routes/storeApi.js',                '/api/store'],
      // ─── Alibaba AI Import ────────────────────────────────────────────────
      ['./routes/alibabaImport.js',           '/api/ecom/alibaba-import'],
      // ─── WhatsApp Configuration ──────────────────────────────────────
      ['./routes/whatsappConfig.js',          '/api/ecom/whatsapp-config'],
      ['./routes/whatsappInstances.js',       '/api/ecom/whatsapp-instances'],
      ['./routes/whatsappIntegration.js',     '/api/ecom/integrations/whatsapp'],
      // ─── AI Product Page Generator ───────────────────────────────────
      ['./routes/productPageGenerator.js',    '/api/ai/product-generator'],
      // ─── Diagnostics ──────────────────────────────────────────────────────
      ['./routes/diagnostics.js',             '/api/ecom/diagnostics'],
      // ─── Sourcing ────────────────────────────────────────────────────────
      ['./routes/sourcing.js',                '/api/ecom/sourcing'],
      ['./routes/sourcingStats.js',           '/api/ecom/sourcing/stats'],
    ];

    for (const [file, mountPath] of routes) {
      try {
        const mod = await import(file);
        app.use(mountPath, mod.default);
        console.log(`✅ ${mountPath}`);
      } catch (err) {
        console.error(`⚠️ ${file}: ${err.message}`);
      }
    }

    // ─── Public Storefront Routes (MUST BE LAST) ───────────────────────
    // These handle subdomain-based store access (e.g., koumen.scalor.net)
    // Mounted AFTER all API routes to prevent intercepting API calls
    try {
      const publicStorefrontMod = await import('./routes/publicStorefront.js');
      app.use('/', publicStorefrontMod.default);
      console.log('✅ / (Public Storefront - Subdomain System - Fallback)');
    } catch (err) {
      console.error('⚠️ Public Storefront routes failed:', err.message);
    }

    // ─── Agent cron jobs ─────────────────────────────────────────────────
    try {
      const { startAgentCronJobs } = await import('./services/agentCronService.js');
      startAgentCronJobs();
    } catch (err) {
      console.warn('⚠️ Agent cron non démarré:', err.message);
    }

    // ─── Auto-sync Google Sheets ─────────────────────────────────────────
    try {
      const autoSyncMod = await import('./services/googleSheetsImport.js');
      if (autoSyncMod.startAutoSyncService) {
        autoSyncMod.startAutoSyncService();
      }
    } catch (err) {
      console.warn('⚠️ Auto-sync non démarré:', err.message);
    }

    // ─── Push scheduled notifications + automations ──────────────────────
    try {
      const { startPushSchedulerJobs } = await import('./services/pushSchedulerService.js');
      await startPushSchedulerJobs();
      console.log('✅ Push scheduler démarré');
    } catch (err) {
      console.warn('⚠️ Push scheduler non démarré:', err.message);
    }

    // ─── WebSocket ───────────────────────────────────────────────────────
    const http = await import('http');
    const server = http.createServer(app);

    try {
      const { initSocketServer } = await import('./services/socketService.js');
      initSocketServer(server);
      console.log('✅ WebSocket server initialisé');
    } catch (err) {
      console.warn('⚠️ WebSocket non initialisé:', err.message);
    }

    // ─── Centralized error handler ───────────────────────────────────────
    app.use((err, req, res, next) => {
      console.error('💥 UNHANDLED ERROR:');
      console.error('   Method:', req.method, 'URL:', req.path);
      console.error('   Headers:', JSON.stringify(req.headers, null, 2));
      console.error('   Body:', JSON.stringify(req.body, null, 2));
      console.error('   Error:', err);
      console.error('   Stack:', err.stack);
      
      res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message || 'Internal server error',
        debug: process.env.NODE_ENV !== 'production' ? {
          method: req.method,
          path: req.path,
          error: err.message
        } : undefined
      });
    });

    // ─── 404 handler ─────────────────────────────────────────────────────
    // Note: store subdomains should never reach here — the SPA fallback in
    // publicStorefront.js catches all non-API routes with '*'.
    // This 404 only fires for unknown /api/* routes or api.scalor.net paths.
    app.use((req, res) => {
      // If it's a store domain and somehow got here, redirect to store root
      if (req.isStoreDomain && !req.path.startsWith('/api')) {
        return res.redirect('/');
      }
      
      res.status(404).json({
        success: false,
        error: `Route non trouvée: ${req.method} ${req.originalUrl}`,
        hint: req.isApiDomain
          ? 'api.scalor.net — Check the API route path.'
          : req.subdomain
            ? `Subdomain "${req.subdomain}" detected. Make sure the store exists.`
            : 'No subdomain detected. This is the root SaaS domain.'
      });
    });

    connectDB().then(() => {
      console.log('✅ MongoDB connected successfully');
      console.log(`🚀 Server starting on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔍 Debug mode: ENABLED (all requests logged)`);
      
      app.listen(PORT, () => {
        console.log(`🌐 Server ready on port ${PORT}`);
        console.log(`📡 API: http://localhost:${PORT}/api`);
        console.log(`🏪 Stores: http://localhost:${PORT}/store/:subdomain`);
      });
    }).catch(err => {
      console.error('💥 MongoDB connection failed:');
      console.error('   Error:', err.message);
      console.error('   Stack:', err.stack);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Impossible de démarrer le serveur:', error);
    process.exit(1);
  }
};

startServer();
