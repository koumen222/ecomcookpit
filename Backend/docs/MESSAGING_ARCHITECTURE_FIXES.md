# Messaging System - Architecture Issues & Fixes

## 🔴 Critical Issues Identified

### 1. **Nouveau message → ton propre nom apparaît**
**Root Cause:** Frontend doesn't filter out current user from team members list
- Location: `TeamChat.jsx` lines 156-164 (`loadMembers` function)
- The API returns ALL workspace members including the current user
- Frontend displays all members without filtering

### 2. **Groupe → tous voient tout**
**Root Cause:** No conversation_participants table - missing proper access control
- Current schema: `Channel` model has no participant list
- Messages in channels are visible to ALL workspace members
- No way to restrict channel access to specific users

### 3. **Pas de notification message**
**Root Cause:** Notifications sent to ALL workspace members globally
- Location: `routes/messages.js` lines 216-243
- Sends push notifications to ALL active members except sender
- No per-user notification preferences
- No check if user is actually a participant in the conversation

### 4. **Session notifications partagée entre membres**
**Root Cause:** Global notification broadcast without user isolation
- Notifications use workspace-level queries
- No user-specific notification filtering
- WebSocket events broadcast to entire workspace

## 🏗️ Current Architecture Problems

### Database Schema Issues

#### Current Schema:
```
DirectMessage {
  workspaceId
  participants: [userId1, userId2]  // ✅ Good for DM
  senderId
  content
  readBy: [{ userId, readAt }]
}

Message {
  workspaceId
  senderId
  content
  channel: String  // ❌ Just a string, no access control
  readBy: [{ userId, readAt }]
}

Channel {
  workspaceId
  name
  slug
  emoji
  // ❌ NO participants field!
  // ❌ NO access control!
}
```

#### Problems:
1. **No conversation_participants table** - Can't manage group membership
2. **Channel has no participants** - Everyone sees everything
3. **No proper conversation abstraction** - DM and channels are separate systems
4. **Notifications are global** - Sent to entire workspace

## ✅ Proper Architecture Solution

### New Database Schema

```javascript
// 1. Conversations (unified for DM and groups)
Conversation {
  _id: ObjectId
  workspaceId: ObjectId
  type: 'dm' | 'group' | 'channel'
  name: String (null for DM)
  emoji: String
  createdBy: ObjectId
  isActive: Boolean
  metadata: {
    lastMessageAt: Date
    messageCount: Number
  }
  timestamps
}

// 2. ConversationParticipants (pivot table - CRITICAL!)
ConversationParticipant {
  _id: ObjectId
  conversationId: ObjectId -> Conversation
  userId: ObjectId -> EcomUser
  role: 'owner' | 'admin' | 'member'
  joinedAt: Date
  lastReadAt: Date
  notificationsEnabled: Boolean
  isMuted: Boolean
}

// 3. Messages (unified)
Message {
  _id: ObjectId
  conversationId: ObjectId -> Conversation
  senderId: ObjectId -> EcomUser
  senderName: String
  content: String
  messageType: 'text' | 'image' | 'audio' | 'video'
  mediaUrl: String
  replyTo: ObjectId -> Message
  metadata: {
    reactions: {}
    mentions: [ObjectId]
  }
  readBy: [{ userId, readAt }]
  deleted: Boolean
  timestamps
}

// 4. Notifications (per-user)
Notification {
  _id: ObjectId
  userId: ObjectId -> EcomUser  // ✅ Per user!
  workspaceId: ObjectId
  type: 'new_message' | 'mention' | 'dm'
  conversationId: ObjectId
  messageId: ObjectId
  title: String
  body: String
  read: Boolean
  readAt: Date
  timestamps
}
```

### Key Improvements

1. **Unified Conversation Model**
   - Single table for DM, groups, and channels
   - Consistent access control

2. **ConversationParticipants Table** (CRITICAL)
   - Explicit membership management
   - Per-user notification settings
   - Role-based permissions
   - Last read tracking

3. **Per-User Notifications**
   - Notifications tied to specific userId
   - No global broadcasts
   - Respects mute settings

4. **Proper Access Control**
   - Check participant membership before showing messages
   - Filter conversations by user participation
   - Prevent unauthorized access

## 🔧 Implementation Steps

### Backend Changes

1. **Create New Models**
   - `models/Conversation.js`
   - `models/ConversationParticipant.js`
   - Update `models/Message.js` to use conversationId

2. **Update Routes**
   - `routes/conversations.js` - New unified route
   - Update `routes/dm.js` to use new schema
   - Update `routes/messages.js` to check participants

3. **Fix Notifications**
   - Query ConversationParticipants before sending
   - Send only to actual participants
   - Respect mute settings

### Frontend Changes

1. **Fix Team Members List**
   ```javascript
   // TeamChat.jsx - loadMembers function
   const loadMembers = async () => {
     const data = await fetch('/api/ecom/messages/team/members');
     if (data.success) {
       // ✅ Filter out current user
       const filtered = data.members.filter(m => m._id !== user._id);
       setMembers(filtered);
     }
   };
   ```

2. **Update Conversation Loading**
   - Load only conversations where user is participant
   - Check participant status before displaying

3. **Fix WebSocket Events**
   - Emit only to conversation participants
   - Not to entire workspace

## 📋 Migration Strategy

### Phase 1: Add New Models (Non-Breaking)
- Create Conversation, ConversationParticipant models
- Keep existing DirectMessage, Message, Channel models

### Phase 2: Migrate Data
- Create Conversation records from existing Channels
- Create ConversationParticipant records
- Link existing Messages to Conversations

### Phase 3: Update Code
- Update routes to use new models
- Update frontend to use new API
- Test thoroughly

### Phase 4: Cleanup
- Remove old models
- Remove old routes
- Update documentation

## 🎯 Immediate Quick Fixes (Without Full Migration)

### Fix 1: Filter Own Name from New Message List
```javascript
// src/ecom/pages/TeamChat.jsx:156-164
const loadMembers = useCallback(async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/ecom/messages/team/members`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      // ✅ Filter out current user
      const filtered = (data.members || []).filter(m => m._id.toString() !== user._id.toString());
      setMembers(filtered);
    }
  } catch (e) { console.error(e); }
}, [token, user._id]);
```

### Fix 2: Add Participants to Channel Model
```javascript
// Backend/models/Channel.js
const channelSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  emoji: { type: String, default: '💬' },
  description: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
  // ✅ Add participants
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    notificationsEnabled: { type: Boolean, default: true }
  }],
  isActive: { type: Boolean, default: true }
});
```

### Fix 3: Check Participants Before Sending Notifications
```javascript
// Backend/routes/messages.js - POST /:channel
// Instead of sending to ALL workspace members:
const members = await EcomUser.find({ workspaceId, isActive: true, _id: { $ne: req.ecomUser._id } });

// ✅ Send only to channel participants:
const channel = await Channel.findOne({ workspaceId, slug: req.params.channel });
const participantIds = channel.participants
  .filter(p => p.notificationsEnabled && p.userId.toString() !== req.ecomUser._id.toString())
  .map(p => p.userId);

await Promise.allSettled(
  participantIds.map(userId => sendPushNotificationToUser(userId, { ... }))
);
```

### Fix 4: Per-User Notification Creation
```javascript
// Backend/services/notificationHelper.js
export async function notifyNewMessage(workspaceId, channelSlug, messageData) {
  const channel = await Channel.findOne({ workspaceId, slug: channelSlug });
  
  // ✅ Create notification for each participant
  const notifications = channel.participants
    .filter(p => p.userId.toString() !== messageData.senderId.toString())
    .map(p => ({
      userId: p.userId,  // ✅ Per user!
      workspaceId,
      type: 'new_message',
      title: `💬 #${channelSlug} — ${messageData.senderName}`,
      body: messageData.content,
      metadata: { channelSlug, messageId: messageData.messageId },
      read: false
    }));
  
  await Notification.insertMany(notifications);
}
```

## 🚀 Priority Order

1. **IMMEDIATE** - Fix own name appearing in new message list (Frontend only)
2. **HIGH** - Add participants field to Channel model
3. **HIGH** - Update notification logic to check participants
4. **MEDIUM** - Create ConversationParticipant model
5. **MEDIUM** - Migrate to unified Conversation architecture
6. **LOW** - Full schema migration

## 📝 Testing Checklist

- [ ] Own name doesn't appear in "New Message" list
- [ ] Group messages only visible to participants
- [ ] Notifications only sent to conversation participants
- [ ] Each user has separate notification state
- [ ] Muting a conversation stops notifications
- [ ] Leaving a group removes access to messages
- [ ] DM conversations remain private (2 participants only)
