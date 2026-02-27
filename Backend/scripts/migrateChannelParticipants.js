/**
 * Migration Script: Add Participants to Existing Channels
 * 
 * This script migrates existing channels to the new participant-based architecture.
 * It adds all active workspace members as participants to channels that don't have any.
 * 
 * Run with: node Backend/scripts/migrateChannelParticipants.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Channel from '../models/Channel.js';
import EcomUser from '../models/EcomUser.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function migrateChannelParticipants() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all channels without participants
    const channelsWithoutParticipants = await Channel.find({
      $or: [
        { participants: { $exists: false } },
        { participants: { $size: 0 } }
      ],
      isActive: true
    });

    console.log(`\n📊 Found ${channelsWithoutParticipants.length} channels without participants\n`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const channel of channelsWithoutParticipants) {
      try {
        console.log(`\n🔧 Migrating channel: ${channel.name} (${channel.slug})`);
        console.log(`   Workspace: ${channel.workspaceId}`);

        // Get all active users in this workspace
        const workspaceUsers = await EcomUser.find({
          workspaceId: channel.workspaceId,
          isActive: true
        }).select('_id').lean();

        console.log(`   Found ${workspaceUsers.length} active users in workspace`);

        // Create participants array
        const participants = workspaceUsers.map(user => {
          // Make creator the owner, others are members
          const isOwner = user._id.toString() === channel.createdBy?.toString();
          
          return {
            userId: user._id,
            role: isOwner ? 'owner' : 'member',
            joinedAt: channel.createdAt || new Date(),
            lastReadAt: null,
            notificationsEnabled: true,
            isMuted: false
          };
        });

        // Update channel with participants
        channel.participants = participants;
        await channel.save();

        console.log(`   ✅ Added ${participants.length} participants`);
        console.log(`   Owner: ${participants.find(p => p.role === 'owner')?.userId || 'none'}`);
        migratedCount++;

      } catch (error) {
        console.error(`   ❌ Error migrating channel ${channel.slug}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount} channels`);
    console.log(`❌ Errors: ${errorCount} channels`);
    console.log(`📊 Total processed: ${channelsWithoutParticipants.length} channels`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration
migrateChannelParticipants()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
