/**
 * Server.js Integration Example
 * 
 * Shows how to integrate the multi-tenant subdomain system
 * into your existing Express server.
 * 
 * Add these imports and routes to your server.js
 */

// ─── NEW IMPORTS ─────────────────────────────────────────────────────────────
import publicStorefrontRoutes from './routes/publicStorefront.js';
import dashboardProductRoutes from './routes/dashboardProducts.js';

// ─── MOUNT ROUTES ────────────────────────────────────────────────────────────

// 1. Public Storefront (MUST be mounted on root path)
// This handles both root domain (SaaS landing) and subdomains (stores)
// Place BEFORE other routes to catch subdomain requests first
app.use('/', publicStorefrontRoutes);

// 2. Dashboard Product Management (authenticated)
// Protected routes for workspace owners to manage their products
app.use('/api/dashboard/products', dashboardProductRoutes);

// ─── EXAMPLE: Full server.js structure ──────────────────────────────────────

/*
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB } from './config/database.js';

// Import new routes
import publicStorefrontRoutes from './routes/publicStorefront.js';
import dashboardProductRoutes from './routes/dashboardProducts.js';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    // Allow all *.scalor.net subdomains
    if (origin.endsWith(".scalor.net")) return callback(null, true);
    callback(null, false);
  },
  credentials: true
}));

app.use(helmet());
app.use(express.json());

// ─── Database ────────────────────────────────────────────────────────────────
await connectDB();

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Public storefront (FIRST - catches subdomains)
app.use('/', publicStorefrontRoutes);

// Dashboard routes (authenticated)
app.use('/api/dashboard/products', dashboardProductRoutes);

// Your existing routes
app.use('/api/ecom/auth', authRoutes);
app.use('/api/ecom/orders', orderRoutes);
app.use('/api/ecom/clients', clientRoutes);
// ... other routes

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Multi-tenant system active`);
  console.log(`🌐 Subdomains: *.scalor.net`);
});
*/

// ─── IMPORTANT NOTES ─────────────────────────────────────────────────────────

/**
 * 1. Route Order Matters
 * 
 * Place public storefront routes BEFORE other routes:
 * 
 * ✅ CORRECT:
 * app.use('/', publicStorefrontRoutes);        // First
 * app.use('/api/ecom/orders', orderRoutes);    // After
 * 
 * ❌ WRONG:
 * app.use('/api/ecom/orders', orderRoutes);    // First
 * app.use('/', publicStorefrontRoutes);        // After (won't catch subdomains)
 */

/**
 * 2. CORS Configuration
 * 
 * Ensure CORS allows *.scalor.net subdomains:
 * 
 * corsOptions = {
 *   origin: function (origin, callback) {
 *     if (origin.endsWith(".scalor.net")) return callback(null, true);
 *     callback(null, false);
 *   }
 * }
 */

/**
 * 3. Environment Variables
 * 
 * Add to .env:
 * 
 * DOMAIN=scalor.net
 * WORKSPACE_CACHE_TTL=300000  # 5 minutes in ms
 * MAX_PAGINATION_LIMIT=100
 */

/**
 * 4. Testing Locally
 * 
 * Edit /etc/hosts (Mac/Linux) or C:\Windows\System32\drivers\etc\hosts (Windows):
 * 
 * 127.0.0.1  nike.scalor.net
 * 127.0.0.1  boutique123.scalor.net
 * 
 * Then access: http://nike.scalor.net:8080/
 */

/**
 * 5. Production Deployment
 * 
 * Cloudflare DNS:
 * - Type: CNAME
 * - Name: *
 * - Target: your-server.railway.app (or your hosting)
 * - Proxy: ON
 * - SSL: Full
 * 
 * No code changes needed - works automatically!
 */

export default {
  // This file is for documentation only
  // Copy the relevant parts to your server.js
};
