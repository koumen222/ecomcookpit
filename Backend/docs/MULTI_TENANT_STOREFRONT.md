# Multi-Tenant Storefront Architecture

> **Last updated**: 2026-02-28  
> **Status**: Production-ready  
> **Scale target**: 10,000+ stores

## DNS & Routing Matrix

```
┌──────────────────────────┬───────────────┬────────────────────────────────────┐
│ Domain                   │ Target        │ Behavior                           │
├──────────────────────────┼───────────────┼────────────────────────────────────┤
│ scalor.net               │ Cloudflare    │ Main SaaS frontend (Pages)         │
│ www.scalor.net           │ Cloudflare    │ Redirect → scalor.net              │
│ api.scalor.net           │ Railway       │ API only (JSON responses)          │
│ *.scalor.net             │ Railway       │ Store SPA (React build + API)      │
│ *.railway.app            │ Railway       │ Internal (health checks)           │
└──────────────────────────┴───────────────┴────────────────────────────────────┘
```

## Request Flow — Store Visit

```
User opens: https://koumen.scalor.net

1. DNS: *.scalor.net → Cloudflare proxy → Railway
2. Railway → Express server
3. extractSubdomain middleware:
   - Host: koumen.scalor.net
   - req.subdomain = "koumen"
   - req.isStoreDomain = true
4. publicStorefront.js router:
   - Skips /api/* paths
   - Serves React build static files (JS, CSS, images)
   - SPA fallback: returns index.html for all routes
5. React app loads in browser:
   - useSubdomain() → "koumen"
   - Calls: GET https://api.scalor.net/api/store/koumen
   - Receives: store config + products + categories (single call)
   - Renders storefront dynamically
```

## Request Flow — API Call

```
React app calls: GET https://api.scalor.net/api/store/koumen/products?page=2

1. DNS: api.scalor.net → Railway
2. extractSubdomain middleware:
   - Host: api.scalor.net
   - req.isApiDomain = true
   - req.subdomain = null (not a store)
3. publicStorefront.js: SKIPPED (isApiDomain)
4. Route: /api/store/:subdomain/products
5. resolveStore("koumen"):
   - Check in-memory cache (5min TTL)
   - If miss: MongoDB query with compound index
   - Returns workspace with storeSettings
6. Query products: workspaceId-scoped, paginated, .lean()
7. Return JSON response
```

## Files Modified

| File | Change |
|------|--------|
| `Backend/middleware/subdomain.js` | Added `isApiDomain`, `isStoreDomain` flags; system subdomain detection |
| `Backend/routes/publicStorefront.js` | **Rewritten**: serves React build + SPA fallback for store subdomains |
| `Backend/routes/storeApi.js` | **New**: unified `/api/store/:subdomain` endpoints |
| `Backend/server.js` | UTF-8 fix (API-only), CORS update, new route mount, store-aware 404 |
| `src/ecom/services/storeApi.js` | API base URL → `api.scalor.net` in production |
| `src/ecom/pages/StoreFront.jsx` | Single API call instead of 3 parallel calls |
| `.env.production` | Added `VITE_STORE_API_URL` |
| `nixpacks.toml` | Frontend build + copy to Backend/client/build |

## API Endpoints

### Public Store API (no auth)

Base: `https://api.scalor.net/api/store`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:subdomain` | Store config + products + categories (initial load) |
| GET | `/:subdomain/products` | Paginated products with search/filter |
| GET | `/:subdomain/products/:slug` | Product detail |
| GET | `/:subdomain/categories` | Available categories |
| POST | `/:subdomain/orders` | Guest checkout |

### Query Parameters (products)

- `page` — Page number (default: 1)
- `limit` — Items per page (default: 20, max: 50)
- `category` — Filter by category
- `search` — Search name, description, tags
- `sort` — Sort field (default: `-createdAt`)

## Performance

### Caching Strategy

| Layer | TTL | What |
|-------|-----|------|
| Workspace cache | 5 min | Subdomain → workspace lookup |
| Static assets | 1 year | JS, CSS, images (content-hashed by Vite) |
| index.html | no-cache | Always fresh (instant deploy updates) |
| Cloudflare | varies | DNS + proxy caching |

### Optimizations

- **Single initial call**: Store config + products + categories in 1 request
- **Lean queries**: `.lean()` on all MongoDB reads
- **Compound indexes**: `{ subdomain, isActive, storeSettings.isStoreEnabled }`
- **Compression**: gzip/brotli via `compression()` middleware
- **Helmet**: Security headers
- **Static file immutability**: Vite hashed filenames = infinite cache

## Deployment Checklist

### Cloudflare DNS (do NOT modify if already set)

```
scalor.net      → CNAME → Cloudflare Pages
*.scalor.net    → CNAME → Railway app URL
api.scalor.net  → CNAME → Railway app URL (or covered by wildcard)
```

### Railway

1. Deploy pushes trigger nixpacks build
2. Frontend builds (Vite → dist/)
3. dist/ copied to Backend/client/build/
4. Backend starts and detects the build
5. Store subdomains serve the React SPA
6. API subdomains serve JSON

### Verify

```bash
# Store loads SPA
curl -I https://koumen.scalor.net
# → Content-Type: text/html

# API returns JSON  
curl https://api.scalor.net/api/store/koumen
# → { success: true, data: { store: {...}, products: [...] } }

# Root redirects
curl -I https://scalor.net  
# → 301 → Cloudflare Pages (if hitting Railway)

# Health check
curl https://api.scalor.net/health
# → { status: "ok" }
```

## Scaling Notes

- **10,000+ stores**: Each store is just a workspace row in MongoDB. No separate deployments.
- **Memory**: Workspace cache is bounded (entries expire after 5min, cleanup every 10min).
- **Static files**: Same React build served to all stores. No per-store builds.
- **Database**: Compound index ensures O(1) workspace lookups.
- **CDN**: Cloudflare sits in front — most static asset requests won't hit Railway.
