# Shopify Webhook Token Diagnostic Report
**Date:** 22 mars 2026  
**Token:** `dd37ea3955330f0be2e3093c56f88779f6f95e51`

## Issue Summary
The Shopify webhook endpoint is **active and accessible**, but the provided token does **NOT** exist in the database. This means orders sent to this webhook will be received and acknowledged (200 OK) but will not be processed because no matching workspace is found.

## Test Results

### ✅ Webhook Infrastructure Status
| Test | Result | Details |
|------|--------|---------|
| Endpoint `/api/webhooks/shopify/test` | **200 OK** | Webhook service is running |
| POST `/api/webhooks/shopify/orders/:token` | **200 OK** | Endpoint accepts POST requests |
| HMAC Validation | ⚠️ **Disabled** | `hmacConfigured: false` — Secret not set |
| Token Validity | ❌ **Not Found** | Token not registered to any workspace |

### Response Flow
```
POST https://api.scalor.net/api/webhooks/shopify/orders/dd37ea3955330f0be2e3093c56f88779f6f95e51
    ↓
✅ [200 OK] { success: true, received: true }
    ↓
🔍 Backend searches for workspace with this token
    ↓
❌ No workspace found
    ↓
📝 Log: "Token invalide: dd37ea3955330f0be2e3093c56f88779f6f95e51"
    ↓
❌ Order is NOT processed (silently dropped)
```

## Problem Root Cause

The token exists in the URL but not in the database. The workflow expects:

1. **Frontend** calls `POST /api/webhooks/shopify/generate-token` (requires auth)
2. **Backend** generates unique token for workspace: `crypto.randomBytes(20).toString('hex')`
3. **Token stored** in workspace document: `workspace.shopifyWebhookToken`
4. **Return** webhook URL to frontend: `https://api.scalor.net/api/webhooks/shopify/orders/{token}`
5. **User configures** this URL in Shopify dashboard
6. **Shopify sends orders** to that URL
7. **Backend validates** token against database ✅

**Current status:** Step 1-4 were never completed for this token.

## Solutions

### Option 1: Generate Token via API (Recommended)
A new workspace owner should:
1. Log into the dashboard
2. Navigate to Shopify integration settings
3. Click "Generate Webhook Token"
4. Copy the returned webhook URL
5. Configure it in Shopify dashboard

**Endpoint:**
```bash
POST https://api.scalor.net/api/webhooks/shopify/generate-token
Headers:
  Authorization: Bearer {userToken}
  x-workspace-id: {workspaceId}
```

### Option 2: Direct Database Assignment (For Testing)
If you have database access, assign the token directly to a workspace:

```javascript
// MongoDB
db.workspaces.updateOne(
  { _id: ObjectId("YOUR_WORKSPACE_ID") },
  { $set: { shopifyWebhookToken: "dd37ea3955330f0be2e3093c56f88779f6f95e51" } }
)
```

Then test with:
```bash
POST https://api.scalor.net/api/webhooks/shopify/orders/dd37ea3955330f0be2e3093c56f88779f6f95e51
Content-Type: application/json

{
  "id": 123456789,
  "order_number": "#1001",
  "email": "customer@example.com",
  "total_price": "99.99",
  "currency": "USD",
  "line_items": []
}
```

### Option 3: Generate New Token (Cleanest)
```bash
# In Node.js
const crypto = require('crypto');
const newToken = crypto.randomBytes(20).toString('hex');
// Then use this token and assign it to a workspace in the database

// Or use the API endpoint (Option 1)
```

## Next Steps

### To fix this specific token:
1. **Identify the workspace** this token should belong to
2. **Use Option 1 or 2** above to assign the token properly
3. **Test** with a POST request
4. **Monitor logs** for successful order processing

### To prevent future token issues:
- Always use the `POST /api/webhooks/shopify/generate-token` endpoint
- Verify tokens are saved in the database before using them
- Add logging to confirm workspace is found during webhook processing
- Consider adding a webhook validation endpoint that confirms token validity

## Code References

**Webhook Controller:** `Backend/controllers/shopifyWebhookController.js`
- Token validation logic (line 92)
- Token generation logic (line 165+)

**Workspace Model:** `Backend/models/Workspace.js`
- Schema field: `shopifyWebhookToken` (unique, sparse, indexed)

**Routes:** `Backend/routes/shopifyWebhooks.js`
- `POST /api/webhooks/shopify/orders/:webhookToken`
- `POST /api/webhooks/shopify/generate-token`

## Security Notes

⚠️ **HMAC Verification is Disabled** (`hmacConfigured: false`)  
The webhook is **not validating signatures** from Shopify. To enable:
1. Set `SHOPIFY_WEBHOOK_SECRET` environment variable
2. Provide it in Shopify webhook configuration
3. Backend will then verify `X-Shopify-Hmac-Sha256` header

Without HMAC verification, any request to the webhook endpoint will be processed.
