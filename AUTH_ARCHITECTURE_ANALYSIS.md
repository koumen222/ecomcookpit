# Ecom Cockpit - Architecture d'Authentification & Providers

**Date d'analyse:** 21 Mars 2026  
**Analysé par:** GitHub Copilot  
**Codebase:** ecomcookpit-main

---

## 📋 TABLE DES MATIÈRES

1. [Architecture Actuelle](#architecture-actuelle)
2. [Authentification: Flux & Tokens](#authentification--flux--tokens)
3. [Modèles Utilisateurs](#modèles-utilisateurs)
4. [Gestion des Workspaces/Instances](#gestion-des-workspacesinstances)
5. [Système de Rôles & Permissions](#système-de-rôles--permissions)
6. [Middleware d'Authentification](#middleware-dauthentification)
7. [Providers OAuth Actuels](#providers-oauth-actuels)
8. [Patterns pour Ajouter un Nouveau Provider](#patterns-pour-ajouter-un-nouveau-provider)
9. [Schéma Architectural](#schéma-architectural)

---

## Architecture Actuelle

### 🌍 Vue d'Ensemble
```
Frontend (SPA)
    ├── Login Page (email/password ou Google)
    └── Dashboard (authenticated, workspace-scoped)
          ↓
Backend (Node.js/Express)
    ├── Auth Routes (/api/ecom/auth/*)
    ├── Protected Routes (requireEcomAuth + requireWorkspace)
    └── MongoDB
          ├── EcomUser (utilisateurs système)
          ├── EcomWorkspace (instances multi-tenant)
          ├── Client (CRM clients)
          └── [50+ autres modèles]
```

### 🔐 Layers de Sécurité
1. **JWT Verification** - Signature token avec ECOM_JWT_SECRET
2. **User Cache** - 60s cache pour éviter requête DB à chaque request
3. **Workspace Resolution** - Déterminer workspace actif + role utilisateur dans ce workspace
4. **Role-Based Access Control** - RBAC avec 5 rôles définis
5. **Permission Validation** - Granular resource:action permissions

---

## Authentification : Flux & Tokens

### Token Types

| Type | Prefix | TTL | Usage |
|------|--------|-----|-------|
| Session | `ecom:` | 30 days | Requêtes API normales |
| Permanent | `perm:` | 365 days | "Remember me" sur appareil |

**Format Bearer:**
```
Authorization: Bearer ecom:eyJhbGc...
Authorization: Bearer perm:eyJhbGc...
```

### JWT Payload
```javascript
{
  id: "507f1f77bcf86cd799439011",        // MongoDB ObjectId
  email: "user@example.com",
  role: "ecom_admin",                     // Rôle global
  workspaceId: "507f1f77bcf86cd799439012",
  deviceId?: "device_abc123xyz...",       // Si token permanent
  type?: "permanent"                      // Si token permanent
}
```

**Secret:** `ECOM_JWT_SECRET` (env var, ≠ JWT_SECRET du système principal)

### Endpoints d'Authentification

| Method | Endpoint | Payload | Response |
|--------|----------|---------|----------|
| `POST` | `/auth/login` | `{ email, password, rememberDevice?, deviceInfo? }` | `{ token, user, workspace }` |
| `POST` | `/auth/register` | `{ email, password, name, phone, acceptPrivacy }` | `{ token, user }` |
| `POST` | `/auth/google` | `{ credential (idToken) }` | `{ token, user, isNewUser, workspace }` |
| `POST` | `/auth/refresh` | *(Bearer token in header)* | `{ token, user, workspace }` |
| `POST` | `/auth/register-device` | `{ deviceInfo }` | `{ permanentToken, deviceInfo }` |
| `GET` | `/auth/device-status` | *(Bearer token in header)* | `{ isAuthenticated, isPermanent, deviceInfo }` |
| `POST` | `/auth/revoke-device` | *(Bearer token: perm:)* | `{ message }` |
| `POST` | `/auth/send-otp` | `{ email }` | `{ message }` (code sent) |
| `POST` | `/auth/verify-otp` | `{ email, code }` | `{ message }` (verified) |
| `GET` | `/auth/health` | - | `{ nodeEnv, hasGoogleClientId, hasJwtSecret }` |

### Flux Login Standard

```
User submits email/password
        ↓
POST /auth/login
        ↓
1. Find user by email (case-insensitive, trimmed)
2. Verify isActive=true
3. BCrypt compare password
4. Update lastLogin timestamp
5. Get/create workspace if exists
        ↓
If rememberDevice=true:
   ├─ generatePermanentToken() → perm:...
   └─ Store deviceInfo (ua, platform, deviceId)
Else:
   └─ generateEcomToken() → ecom:... (30d TTL)
        ↓
Response: { token, user, workspace, isPermanent }
```

### Flux OAuth Google

```
1. Frontend loads Google SDK, user clicks "Sign in with Google"
2. Google returns id_token (JWT signed by Google)
3. Frontend sends: POST /auth/google { credential: idToken }
4. Backend verifies signature with OAuth2Client(GOOGLE_CLIENT_ID)
        ↓
5. Extract: sub (googleId), email, name, picture from payload
        ↓
6. Find user by email OR googleId
   
   a) If exists:
      ├─ Update googleId if missing
      ├─ Update name/avatar if missing & provided
      ├─ Set lastLogin = now()
      └─ Save
   
   b) If new user:
      ├─ Create EcomUser with:
      │  ├─ email
      │  ├─ googleId: string
      │  ├─ name: string (from Google)
      │  ├─ avatar: string (picture URL from Google)
      │  ├─ role: null (no workspace yet)
      │  └─ workspaceId: null
      ├─ Save
      ├─ Send welcome email
      └─ isNewUser = true
        ↓
7. Generate token, load workspace, return response
```

---

## Modèles Utilisateurs

### EcomUser Schema

**File:** [Backend/models/EcomUser.js](Backend/models/EcomUser.js)

```javascript
{
  _id: ObjectId,
  
  // Identity
  email: String (unique, lowercase, trimmed),
  password: String (bcrypt hash, optional si googleId),
  googleId: String (sparse unique, optional),
  
  // Profile
  name: String,
  phone: String,
  avatar: String (picture URL),
  
  // Authorization
  role: enum ['super_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur', null],
  workspaceId: ObjectId (workspace par défaut),
  workspaces: [{
    workspaceId: ObjectId (ref EcomWorkspace),
    role: enum ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
    joinedAt: Date,
    invitedBy: ObjectId (ref EcomUser),
    status: enum ['active', 'pending', 'suspended']
  }],
  
  // Account Management
  isActive: Boolean (default: true),
  lastLogin: Date,
  
  // Settings
  currency: String (enum: African currencies + USD/EUR/GBP/CAD/CNY),
  
  // Device Management (for permanent tokens)
  deviceToken: String (perm: JWT),
  deviceInfo: {
    deviceId: String,
    userAgent: String,
    platform: String,
    lastSeen: Date
  },
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

### EcomUser Methods

```javascript
// Password Verification
user.comparePassword(candidatePassword: string): Promise<boolean>

// Workspace Management
user.addWorkspace(wsId, role, invitedBy?): boolean
user.hasWorkspaceAccess(wsId): boolean
user.getRoleInWorkspace(wsId): string | null
user.getActiveWorkspaces(): array
user.leaveWorkspace(wsId): boolean

// Permissions
user.getPermissions(): string[]
user.hasPermission(permission: string): boolean
```

### Client Model (Distinct)

**File:** [Backend/models/Client.js](Backend/models/Client.js)

Attention: **Client** est pour les clients/prospects CRM, **PAS** un utilisateur système.

```javascript
{
  workspaceId: ObjectId,
  firstName: String,
  lastName: String,
  phone: String,
  phoneNormalized: String,
  email: String,
  city: String,
  address: String,
  source: enum ['facebook', 'instagram', 'tiktok', 'whatsapp', 'site', 'referral', 'other'],
  status: String (default: 'prospect'),
  totalOrders: Number,
  totalSpent: Number,
  notes: String,
  products: [String],
  tags: [String],
  assignedTo: ObjectId (ref EcomUser),
  createdBy: ObjectId (ref EcomUser),
  lastContactAt: Date,
  // timestamps
}
```

---

## Gestion des Workspaces/Instances

### Workspace Model

**File:** [Backend/models/Workspace.js](Backend/models/Workspace.js)

```javascript
{
  name: String,
  slug: String (unique),
  owner: ObjectId (ref EcomUser),
  inviteCode: String (unique),
  
  // Configuration
  settings: Mixed,
  
  // Storefront (Public)
  subdomain: String (unique → https://{subdomain}.scalor.net),
  storeSettings: {
    isStoreEnabled: Boolean,
    storeName: String,
    storeDescription: String,
    storeLogo: String,
    storeBanner: String,
    storePhone: String,
    storeWhatsApp: String,
    storeThemeColor: String,
    storeCurrency: String
  },
  
  // Theme & Customization
  storeTheme: Mixed (colors, font, border-radius, template),
  storePages: Mixed (sections ordered list),
  storePixels: Mixed (tracking IDs),
  storePayments: Mixed (payment provider configs),
  storeDomains: Mixed (custom domain, SSL),
  
  // Delivery
  storeDelivery: Mixed (zones config)
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

### Multi-Workspace User Flow

**Scenario:** User1 belongs to 3 workspaces

```
User1 default workspace: WS_A (role: ecom_admin)
        ├─ WS_A: ecom_admin
        ├─ WS_B: ecom_closeuse (invited by User0)
        └─ WS_C: ecom_livreur (invited by User2)
```

**Request Resolution:**

```
GET /api/orders                    // Use default WS_A
GET /api/orders?workspaceId=WS_B   // Switch to WS_B
GET /api/orders?workspaceId=WS_C   // Switch to WS_C
X-Workspace-Id: WS_C               // Header override
```

Middleware `requireEcomAuth` resolves:
1. Vérifier requête pour `workspaceId` (query/body/header)
2. Si trouvé ET user a accès → utiliser
3. Sinon → fallback sur `user.workspaceId` par défaut
4. Définir `req.workspaceId` et `req.ecomUserRole` (role dans ce workspace)

---

## Système de Rôles & Permissions

### Rôles Définies

| Rôle | Contexte | Permissions |
|------|----------|-------------|
| **super_admin** | Global (all systems) | Accès total `*` |
| **ecom_admin** | Workspace level | Accès total `*` au workspace |
| **ecom_closeuse** | Workspace level | Orders (R/W), Reports, Products (R), Campaigns (R/W) |
| **ecom_compta** | Workspace level | Finance (R/W), Reports, Products (R) |
| **ecom_livreur** | Workspace level | Orders (R) - view only |
| **(null)** | No role | Needs invite to workspace |

### Permission Matrix

```javascript
const accessRules = {
  'super_admin': ['admin:read', 'admin:write', '*'],
  'ecom_admin': ['*'],
  'ecom_closeuse': [
    'orders:read', 'orders:write',
    'reports:read', 'reports:write',
    'products:read',
    'campaigns:read', 'campaigns:write'
  ],
  'ecom_compta': [
    'finance:read', 'finance:write',
    'reports:read', 'reports:write',
    'products:read'
  ],
  'ecom_livreur': ['orders:read']
}
```

### How to Check Permissions

```javascript
// Method 1: hasPermission
if (user.hasPermission('orders:write')) { /* OK */ }

// Method 2: Middleware
router.put('/orders/:id', requireEcomAuth, validateEcomAccess('orders', 'write'), handler)

// Method 3: Inside route
const userRole = req.ecomUserRole || req.ecomUser.role
if (userRole !== 'ecom_admin' && userRole !== 'super_admin') {
  return res.status(403).json({ message: 'Permission insuffisante' })
}
```

---

## Middleware d'Authentification

**File:** [Backend/middleware/ecomAuth.js](Backend/middleware/ecomAuth.js)

### Exported Functions

#### `requireEcomAuth` (Main)
```javascript
export const requireEcomAuth = async (req, res, next)
```
**Does:**
1. Extract JWT from `Authorization: Bearer <token>`
2. Verify signature with ECOM_JWT_SECRET
3. Fetch user from DB (or cache) by decoded.id
4. Check isActive = true
5. Resolve workspace:
   - Check query/body/header for workspaceId
   - Verify user access
   - Set `req.workspaceId` and `req.ecomUserRole`
6. Attach to request:
   - `req.user` = decoded JWT payload
   - `req.ecomUser` = full user object
   - `req.workspaceId` = active workspace
   - `req.ecomUserRole` = role in workspace

#### `requireWorkspace`
```javascript
export const requireWorkspace = (req, res, next)
```
**Does:** Verify `req.workspaceId` exists (reject 403 if missing)

#### `requireSuperAdmin`
```javascript
export const requireSuperAdmin = (req, res, next)
```
**Does:** Verify `req.ecomUser.role === 'super_admin'`

#### `requireEcomRole(role)`
```javascript
export const requireEcomRole = (requiredRole: string) => (req, res, next)
```
**Does:** Verify `req.ecomUser.role === requiredRole`

#### `requireEcomPermission(permission)`
```javascript
export const requireEcomPermission = (permission: string) => (req, res, next)
```
**Does:** Verify via `user.hasPermission(permission)`

#### `validateEcomAccess(resource, action)`
```javascript
export const validateEcomAccess = (resource: string, action: string) => (req, res, next)
```
**Does:** Check `resource:action` permission against permission matrix

#### `generateEcomToken(user)`
```javascript
export const generateEcomToken = (user) => string
```
**Returns:** `ecom:<JWT>` with 30 days TTL

#### `generatePermanentToken(user, deviceInfo)`
```javascript
export const generatePermanentToken = async (user, deviceInfo) => string
```
**Returns:** `perm:<JWT>` with 365 days TTL + stores deviceInfo

#### `logEcomAction(action)`
```javascript
export const logEcomAction = (action: string) => (req, res, next)
```
**Does:** Log authenticated action (optional)

#### `invalidateUserCache(userId)`
```javascript
export const invalidateUserCache = (userId) => void
```
**Does:** Clear user from 60-second cache

### Cache Strategy
```javascript
const userCache = new Map()
const USER_CACHE_TTL = 60000 // 60 seconds

function getCachedUser(userId) { ... }
function setCachedUser(userId, user) { ... }

// Auto cleanup every 5 minutes
setInterval(() => { /* prune expired entries */ }, 5 * 60 * 1000)
```

### Usage Pattern

```javascript
// Public endpoint
router.get('/store/:subdomain/products', resolveStoreBySubdomain, handler)

// Authenticated + workspace
router.get('/orders', requireEcomAuth, requireWorkspace, handler)

// Role-based
router.post('/users', 
  requireEcomAuth, 
  requireWorkspace, 
  requireEcomRole('ecom_admin'), 
  handler)

// Permission-based
router.put('/orders/:id',
  requireEcomAuth,
  requireWorkspace,
  validateEcomAccess('orders', 'write'),
  handler)
```

---

## Providers OAuth Actuels

### 1. Google OAuth (✅ Implemented)

**Status:** Fully implemented and working

**Configuration:**
- Environment variable: `GOOGLE_CLIENT_ID`
- Client library: `google-auth-library` (npm)

**Implementation:**
```javascript
// File: Backend/routes/auth.js (line 586)
router.post('/google', async (req, res) => {
  const { credential } = req.body // id_token from Google SDK
  
  const { OAuth2Client } = await import('google-auth-library')
  const client = new OAuth2Client(GOOGLE_CLIENT_ID)
  
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID
  })
  
  const payload = ticket.getPayload()
  const { sub: googleId, email, name, picture } = payload
  
  // Find or create user
  let user = await EcomUser.findOne({ $or: [{ email }, { googleId }] })
  if (user) {
    // Update existing
    user.googleId = googleId
    user.lastLogin = new Date()
    await user.save()
  } else {
    // Create new
    user = new EcomUser({
      email,
      googleId,
      name: name || '',
      avatar: picture || '',
      role: null,
      workspaceId: null
    })
    await user.save()
    notifyUserRegistered(user, null) // Welcome email
  }
  
  const token = generateEcomToken(user)
  // Response: { token, user, workspace, isNewUser }
})
```

**Error Handling:**
- Audience mismatch → GOOGLE_CLIENT_ID doesn't match token issuer
- Token expired → User retries on frontend
- Invalid token → Signature verification failed

**User Model Changes:**
```javascript
googleId: { type: String, default: null, sparse: true }
// Make password optional when googleId exists
```

### 2. Email OTP (✅ Implemented)

**Status:** Fully implemented

**Configuration:**
- Provider: Resend API (`RESEND_API_KEY`)
- Fallback: Log to console in dev

**Implementation:**
```javascript
router.post('/send-otp', async (req, res) => {
  const code = Math.random().toString().slice(2, 8) // 6 digits
  
  otpStore.set(email, {
    code,
    expiresAt: Date.now() + 10*60*1000,
    attempts: 0
  })
  
  // Send via Resend if API key exists
  if (RESEND_API_KEY) {
    const resend = new Resend(RESEND_API_KEY)
    await resend.emails.send({
      from: 'Safitech <noreply@infomania.store>',
      to: email,
      subject: `${code} — Votre code de vérification`,
      html: /* email template */
    })
  }
})

router.post('/verify-otp', async (req, res) => {
  const entry = otpStore.get(email)
  
  // Check expiry, attempts, code match
  if (entry.code === code.trim()) {
    entry.verified = true
    return res.json({ success: true })
  }
})
```

**Rate Limiting:**
- 10 minute TTL per code
- Max 5 attempts per code
- In-memory cleanup every 5 minutes

---

## Patterns pour Ajouter un Nouveau Provider

### Template: Add Facebook OAuth

#### Step 1: Update EcomUser Model

**File:** [Backend/models/EcomUser.js](Backend/models/EcomUser.js)

```javascript
const ecomUserSchema = new mongoose.Schema({
  // ... existing fields
  
  // Add new provider field
  facebookId: {
    type: String,
    default: null,
    sparse: true  // Allows null multiple times
  }
  
  // Can add multiple providers:
  // githubId, linkedinId, githubCopilotId, etc.
})
```

#### Step 2: Create OAuth Verification Helper

**File:** [Backend/middleware/oauthValidators.js](Backend/middleware/oauthValidators.js) **(NEW)**

```javascript
export const verifyFacebookToken = async (accessToken) => {
  try {
    const response = await fetch('https://graph.facebook.com/me?fields=id,email,name,picture&access_token=' + accessToken)
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error.message)
    }
    
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      avatar: data.picture?.data?.url
    }
  } catch (error) {
    throw new Error('Facebook token verification failed: ' + error.message)
  }
}

// Pattern for other providers:
export const verifyGithubToken = async (accessToken) => { ... }
export const verifyLinkedInToken = async (idToken) => { ... }
```

#### Step 3: Create Auth Endpoint

**File:** [Backend/routes/auth.js](Backend/routes/auth.js) **(ADD)**

```javascript
import { verifyFacebookToken } from '../middleware/oauthValidators.js'

// POST /api/ecom/auth/facebook - Facebook OAuth sign-in/sign-up
router.post('/facebook', async (req, res) => {
  try {
    const { accessToken } = req.body
    
    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Token Facebook manquant' })
    }
    
    // 1. Verify token with Facebook
    let facebookProfile
    try {
      facebookProfile = await verifyFacebookToken(accessToken)
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token Facebook invalide: ' + error.message 
      })
    }
    
    const { id: facebookId, email, name, avatar } = facebookProfile
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email non disponible depuis Facebook' 
      })
    }
    
    // 2. Find or create user
    let user = await EcomUser.findOne({ $or: [{ email }, { facebookId }] })
    let isNewUser = false
    
    if (user) {
      // Existing user
      if (!user.facebookId) user.facebookId = facebookId
      if (!user.name && name) user.name = name
      if (!user.avatar && avatar) user.avatar = avatar
      user.lastLogin = new Date()
      await user.save()
    } else {
      // New user
      user = new EcomUser({
        email,
        facebookId,
        name: name || '',
        avatar: avatar || '',
        role: null,
        workspaceId: null
      })
      await user.save()
      isNewUser = true
      
      notifyUserRegistered(user, null).catch(err => {
        console.warn('[notif] facebook-register:', err.message)
      })
    }
    
    // 3. Generate token
    const token = generateEcomToken(user)
    
    // 4. Load workspace
    let workspace = null
    if (user.workspaceId) {
      workspace = await Workspace.findById(user.workspaceId)
    }
    
    // 5. Response
    res.json({
      success: true,
      message: isNewUser ? 'Compte créé avec succès via Facebook' : 'Connexion réussie via Facebook',
      data: {
        token,
        isNewUser,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          currency: user.currency,
          workspaceId: user.workspaceId
        },
        workspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug
        } : null
      }
    })
    
  } catch (error) {
    console.error('Erreur Facebook auth:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    })
  }
})
```

#### Step 4: Update Server.js to Register Route

**File:** [Backend/server.js](Backend/server.js)

```javascript
// In route registration section:
import authRoutes from './routes/auth.js'
app.use('/api/ecom/auth', authRoutes)

// The new /facebook endpoint is now available at:
// POST /api/ecom/auth/facebook
```

#### Step 5: Frontend Integration

```typescript
// Frontend (React/Vue)
async function loginWithFacebook() {
  try {
    // Get access token from Facebook SDK
    const response = await FB.login()
    const { accessToken } = response.authResponse
    
    // Send to backend
    const res = await fetch('/api/ecom/auth/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken })
    })
    
    const data = await res.json()
    
    if (data.success) {
      // Store token
      localStorage.setItem('authToken', data.data.token)
      
      // Redirect based on user state
      if (data.data.isNewUser) {
        navigate('/onboarding')
      } else if (data.data.workspace) {
        navigate('/dashboard')
      } else {
        navigate('/workspace-selection')
      }
    }
  } catch (error) {
    console.error('Facebook login error:', error)
  }
}
```

### Generic Provider Checklist

When adding a new OAuth provider:

- [ ] Add `<providerName>Id` field to EcomUser schema
- [ ] Create `verify<Provider>Token()` function in oauthValidators.js
- [ ] Create POST `/auth/<provider>` endpoint in auth.js
- [ ] Handle both existing user + new user flows
- [ ] Send welcome email for new users
- [ ] Generate JWT token uniquely
- [ ] Handle provider-specific error cases
- [ ] Document environment variables needed
- [ ] Test: existing email account merge strategy
- [ ] Test: provider offline/unavailable scenarios
- [ ] Add frontend integration

---

## Schéma Architectural

### Call Flow: Authenticated Request

```
┌─────────────────────────────────────────┐
│ Frontend                                │
│ fetch('/api/orders', {                  │
│   headers: {                            │
│     Authorization: 'Bearer ecom:...'    │
│   }                                     │
│ })                                      │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│ Express Router                          │
│ GET /api/orders                         │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│ Middleware Chain                        │
│ 1. requireEcomAuth                      │
│    ├─ Extract token from header         │
│    ├─ Verify JWT signature              │
│    ├─ Fetch user from cache/DB          │
│    ├─ Resolve workspace                 │
│    └─ Attach req.ecomUser, req.ecomUserRole
│                                         │
│ 2. requireWorkspace                     │
│    └─ Verify req.workspaceId exists     │
│                                         │
│ 3. validateEcomAccess('orders', 'read') │
│    └─ Check user role permissions       │
└────────────────┬────────────────────────┘
                 │
                 ↓ (if all pass)
┌─────────────────────────────────────────┐
│ Route Handler                           │
│ const orders = await Order.find({       │
│   workspaceId: req.workspaceId          │
│ })                                      │
│ res.json({ data: orders })              │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│ Response to Frontend                    │
│ 200 OK { data: [...] }                  │
└─────────────────────────────────────────┘
```

---

## 🎯 Key Takeaways

1. **JWT-based** authentication with two token types (session + permanent)
2. **Multi-workspace** architecture with role-per-workspace
3. **Five defined roles** with granular permission system
4. **Google OAuth** already implemented - follow pattern for other providers
5. **Email OTP** for alternative auth flows
6. **User caching** for performance (60s TTL)
7. **Device tracking** for "remember me" functionality
8. **Workspace resolution** automatic on every request (headers/query/default)

---

## 📚 Quick Reference

### Relevant Files
- **Models:** `Backend/models/EcomUser.js`, `Backend/models/Workspace.js`
- **Middleware:** `Backend/middleware/ecomAuth.js`, `Backend/middleware/storeAuth.js`
- **Routes:** `Backend/routes/auth.js`
- **Validators:** `Backend/middleware/validation.js`, `Backend/middleware/security.js`

### Environment Variables Required
```bash
ECOM_JWT_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
RESEND_API_KEY=your-resend-api-key (optional, OTP email)
```

### Development Notes
- Password hashing: bcrypt (salt=12)
- OTP storage: In-memory Map (not persistent)
- Token validation: signature-only (no revocation list, expired tokens return 401)
- Database: MongoDB with Mongoose ODM
- Cache cleanup: Automatic every 5 minutes

