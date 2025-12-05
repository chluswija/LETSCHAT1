/**
 * LETSCHAT Firebase Cloud Functions
 * Handles notifications, scheduled tasks, and server-side operations
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ============================================
// PUSH NOTIFICATIONS
// ============================================

/**
 * Send push notification when a new message is created
 */
export const onNewMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const { chatId, messageId } = context.params;
    const message = snapshot.data();

    if (!message) return;

    // Get chat details
    const chatDoc = await db.collection('chats').doc(chatId).get();
    const chat = chatDoc.data();

    if (!chat) return;

    // Get sender info
    const senderDoc = await db.collection('users').doc(message.senderId).get();
    const sender = senderDoc.data();

    if (!sender) return;

    // Get recipients (all participants except sender)
    const recipients = chat.participants.filter((uid: string) => uid !== message.senderId);

    // Send notification to each recipient
    const notifications = recipients.map(async (recipientId: string) => {
      const recipientDoc = await db.collection('users').doc(recipientId).get();
      const recipient = recipientDoc.data();

      if (!recipient?.pushToken) return;

      // Check if recipient has notifications enabled
      if (!recipient.settings?.notifications?.messages) return;

      // Check if chat is muted
      if (chat.mutedBy?.includes(recipientId)) return;

      // Build notification content
      let body = message.content;
      if (message.type === 'image') body = '📷 Photo';
      else if (message.type === 'video') body = '🎥 Video';
      else if (message.type === 'audio') body = '🎵 Audio';
      else if (message.type === 'document') body = '📄 Document';
      else if (message.type === 'location') body = '📍 Location';

      // Truncate message
      if (body.length > 100) {
        body = body.substring(0, 100) + '...';
      }

      // Hide preview if disabled
      if (!recipient.settings?.notifications?.showPreview) {
        body = 'New message';
      }

      const notification: admin.messaging.Message = {
        token: recipient.pushToken,
        notification: {
          title: chat.type === 'group' ? `${sender.displayName} @ ${chat.name}` : sender.displayName,
          body,
        },
        data: {
          type: 'message',
          chatId,
          messageId,
          senderId: message.senderId,
        },
        webpush: {
          fcmOptions: {
            link: `https://letschat.app/chat/${chatId}`,
          },
          notification: {
            icon: sender.photoURL || '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: chatId, // Group notifications by chat
            renotify: true,
          },
        },
      };

      try {
        await messaging.send(notification);
        console.log(`Notification sent to ${recipientId} for message ${messageId}`);
      } catch (error) {
        console.error(`Error sending notification to ${recipientId}:`, error);
        // If token is invalid, remove it
        if ((error as any).code === 'messaging/registration-token-not-registered') {
          await db.collection('users').doc(recipientId).update({
            pushToken: admin.firestore.FieldValue.delete(),
          });
        }
      }
    });

    await Promise.all(notifications);
  });

/**
 * Send notification for incoming call
 */
export const onCallCreated = functions.firestore
  .document('calls/{callId}')
  .onCreate(async (snapshot) => {
    const call = snapshot.data();
    if (!call) return;

    const callerDoc = await db.collection('users').doc(call.callerId).get();
    const caller = callerDoc.data();

    if (!caller) return;

    // Notify all participants except caller
    const recipients = call.participants.filter((uid: string) => uid !== call.callerId);

    for (const recipientId of recipients) {
      const recipientDoc = await db.collection('users').doc(recipientId).get();
      const recipient = recipientDoc.data();

      if (!recipient?.pushToken) continue;
      if (!recipient.settings?.notifications?.calls) continue;

      const notification: admin.messaging.Message = {
        token: recipient.pushToken,
        notification: {
          title: `Incoming ${call.type} call`,
          body: caller.displayName,
        },
        data: {
          type: 'call',
          callId: snapshot.id,
          callType: call.type,
          callerId: call.callerId,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'calls',
            priority: 'max',
          },
        },
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            icon: caller.photoURL || '/icon-192x192.png',
            requireInteraction: true,
            tag: 'call',
          },
        },
      };

      try {
        await messaging.send(notification);
      } catch (error) {
        console.error(`Error sending call notification to ${recipientId}:`, error);
      }
    }
  });

// ============================================
// SCHEDULED TASKS
// ============================================

/**
 * Clean up expired statuses (run every hour)
 */
export const cleanupExpiredStatuses = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    
    const expiredStatuses = await db
      .collection('statuses')
      .where('expiresAt', '<=', now)
      .get();

    const batch = db.batch();
    expiredStatuses.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${expiredStatuses.size} expired statuses`);
  });

/**
 * Clean up old messages (optional - run weekly)
 * Set message TTL based on chat settings
 */
export const cleanupOldMessages = functions.pubsub
  .schedule('every sunday 02:00')
  .onRun(async () => {
    // Get chats with message TTL enabled
    const chatsWithTTL = await db
      .collection('chats')
      .where('messageTTL', '>', 0)
      .get();

    for (const chatDoc of chatsWithTTL.docs) {
      const chat = chatDoc.data();
      const ttlDays = chat.messageTTL || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ttlDays);

      const oldMessages = await db
        .collection('chats')
        .doc(chatDoc.id)
        .collection('messages')
        .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .limit(500)
        .get();

      if (oldMessages.empty) continue;

      const batch = db.batch();
      oldMessages.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Deleted ${oldMessages.size} old messages from chat ${chatDoc.id}`);
    }
  });

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Clean up user data when account is deleted
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;

  // Delete user document
  await db.collection('users').doc(uid).delete();

  // Remove user from all chats
  const chats = await db
    .collection('chats')
    .where('participants', 'array-contains', uid)
    .get();

  for (const chatDoc of chats.docs) {
    const chat = chatDoc.data();
    const updatedParticipants = chat.participants.filter((p: string) => p !== uid);

    if (updatedParticipants.length === 0 || (chat.type === 'private' && updatedParticipants.length < 2)) {
      // Delete empty chats
      await chatDoc.ref.delete();
    } else {
      // Remove user from participants
      await chatDoc.ref.update({
        participants: admin.firestore.FieldValue.arrayRemove(uid),
        [`unreadCount.${uid}`]: admin.firestore.FieldValue.delete(),
      });
    }
  }

  // Delete user's statuses
  const statuses = await db
    .collection('statuses')
    .where('ownerId', '==', uid)
    .get();

  const batch = db.batch();
  statuses.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  console.log(`Cleaned up data for deleted user ${uid}`);
});

// ============================================
// DATA EXPORT (GDPR Compliance)
// ============================================

/**
 * Export user data (callable function)
 */
export const exportUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const uid = context.auth.uid;

  // Get user data
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();

  // Get user's chats
  const chats = await db
    .collection('chats')
    .where('participants', 'array-contains', uid)
    .get();

  const chatData = [];
  for (const chatDoc of chats.docs) {
    const messages = await chatDoc.ref
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();

    chatData.push({
      chat: chatDoc.data(),
      messages: messages.docs.map((m) => m.data()),
    });
  }

  // Get user's statuses
  const statuses = await db
    .collection('statuses')
    .where('ownerId', '==', uid)
    .get();

  return {
    user: userData,
    chats: chatData,
    statuses: statuses.docs.map((s) => s.data()),
    exportedAt: new Date().toISOString(),
  };
});

// ============================================
// MODERATION
// ============================================

/**
 * Report content (callable function)
 */
export const reportContent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { contentType, contentId, reason, details } = data;

  if (!contentType || !contentId || !reason) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  await db.collection('reports').add({
    reporterId: context.auth.uid,
    contentType, // 'message', 'user', 'group', 'status'
    contentId,
    reason, // 'spam', 'harassment', 'inappropriate', 'other'
    details: details || '',
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * Block user (updates both users' blocked lists)
 */
export const blockUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { targetUserId } = data;
  const uid = context.auth.uid;

  if (!targetUserId || targetUserId === uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid target user');
  }

  // Add to blocked list
  await db.collection('users').doc(uid).update({
    blockedUsers: admin.firestore.FieldValue.arrayUnion(targetUserId),
  });

  return { success: true };
});

// ============================================
// GROUP MANAGEMENT
// ============================================

/**
 * Create invite link for group
 */
export const createGroupInviteLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { chatId } = data;
  const uid = context.auth.uid;

  const chatDoc = await db.collection('chats').doc(chatId).get();
  const chat = chatDoc.data();

  if (!chat || chat.type !== 'group') {
    throw new functions.https.HttpsError('not-found', 'Group not found');
  }

  // Check if user is admin
  if (!chat.admins?.includes(uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Must be admin');
  }

  // Generate unique invite code
  const inviteCode = generateInviteCode();
  const inviteLink = `https://letschat.app/join/${inviteCode}`;

  await chatDoc.ref.update({
    inviteLink,
    inviteLinkEnabled: true,
  });

  return { inviteLink };
});

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 22; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Join group via invite link
 */
export const joinGroupViaInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { inviteCode } = data;
  const uid = context.auth.uid;

  const inviteLink = `https://letschat.app/join/${inviteCode}`;

  const groups = await db
    .collection('chats')
    .where('inviteLink', '==', inviteLink)
    .where('inviteLinkEnabled', '==', true)
    .limit(1)
    .get();

  if (groups.empty) {
    throw new functions.https.HttpsError('not-found', 'Invalid invite link');
  }

  const groupDoc = groups.docs[0];
  const group = groupDoc.data();

  // Check if already a member
  if (group.participants.includes(uid)) {
    return { chatId: groupDoc.id, alreadyMember: true };
  }

  // Check max participants
  if (group.participants.length >= (group.settings?.maxParticipants || 256)) {
    throw new functions.https.HttpsError('failed-precondition', 'Group is full');
  }

  // Add user to group
  await groupDoc.ref.update({
    participants: admin.firestore.FieldValue.arrayUnion(uid),
    [`participantDetails.${uid}`]: {
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: 'invite',
    },
  });

  // Add system message
  const userDoc = await db.collection('users').doc(uid).get();
  const user = userDoc.data();

  await groupDoc.ref.collection('messages').add({
    type: 'system',
    content: `${user?.displayName || 'Someone'} joined via invite link`,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    senderId: 'system',
  });

  return { chatId: groupDoc.id, alreadyMember: false };
});
