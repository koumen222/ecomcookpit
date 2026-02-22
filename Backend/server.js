import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/database.js';
import { connectPrisma } from './config/prismaClient.js';
import prisma from './config/prismaClient.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://ecomcookpit.site",
  "https://www.ecomcookpit.site",
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
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith(".ecomcookpit.pages.dev")) return callback(null, true);
    callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Session-Id"],
  credentials: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Web Push config (optional) ──────────────────────────────────────────────
try {
  const { configureWebPush } = await import('./config/push.js');
  configureWebPush();
} catch (error) {
  console.warn('⚠️ Web Push non configuré:', error.message);
}

// ─── WhatsApp service init (optional) ────────────────────────────────────────
try {
  const whatsappModule = await import('./services/whatsappService.js');
  if (whatsappModule.initWhatsAppService) {
    await whatsappModule.initWhatsAppService();
  }
} catch (error) {
  console.warn('⚠️ WhatsApp non configuré:', error.message);
}

// ─── Start server ────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // Connexion MongoDB (pour les données existantes)
    await connectDB();

    // Connexion PostgreSQL (pour les nouvelles données)
    try {
      await connectPrisma();
      console.log('💡 Mode hybride activé: MongoDB (anciennes données) + PostgreSQL (nouvelles données)');
    } catch (error) {
      console.warn('⚠️  PostgreSQL non connecté - Mode MongoDB uniquement');
      console.warn('   Les nouvelles données seront stockées dans MongoDB');
    }

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

    // ─── 404 handler ─────────────────────────────────────────────────────
    app.use((req, res) => {
      res.status(404).json({
        error: `Route non trouvée: ${req.method} ${req.originalUrl}`
      });
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Serveur ecom démarré sur le port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Impossible de démarrer le serveur:', error);
    process.exit(1);
  }
};

startServer();
