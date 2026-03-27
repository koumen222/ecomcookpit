import mongoose from 'mongoose';
import Workspace from './models/Workspace.js';

const TOKEN_TO_CHECK = 'dd37ea3955330f0be2e3093c56f88779f6f95e51';
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecomcookpit';

async function main() {
  try {
    console.log('🔍 Checking webhook token...\n');
    
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB\n');

    // Search for the specific token
    const workspace = await Workspace.findOne({ 
      shopifyWebhookToken: TOKEN_TO_CHECK 
    });

    if (workspace) {
      console.log('✅ TOKEN FOUND!\n');
      console.log('Workspace Details:');
      console.log('  Name:', workspace.name);
      console.log('  ID:', workspace._id);
      console.log('  Token:', workspace.shopifyWebhookToken);
      console.log('  Active:', workspace.isActive);
      console.log('\nWebhook URL:');
      console.log(`  https://api.scalor.net/api/webhooks/shopify/orders/${workspace.shopifyWebhookToken}`);
    } else {
      console.log('❌ TOKEN NOT FOUND\n');
      
      // List all workspaces with tokens
      const allWorkspaces = await Workspace.find({
        shopifyWebhookToken: { $exists: true, $ne: null }
      }).select('name shopifyWebhookToken isActive');

      console.log('Available workspaces with Shopify tokens:');
      if (allWorkspaces.length === 0) {
        console.log('  (none found)\n');
      } else {
        allWorkspaces.forEach(ws => {
          console.log(`  - ${ws.name}`);
          console.log(`    Token: ${ws.shopifyWebhookToken}`);
          console.log(`    Active: ${ws.isActive}`);
          console.log(`    URL: https://api.scalor.net/api/webhooks/shopify/orders/${ws.shopifyWebhookToken}\n`);
        });
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();
