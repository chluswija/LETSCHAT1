/**
 * LETSCHAT Firebase Cloud Messaging Service Worker
 * Handles background push notifications
 */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA0bprTG2j3rJcJJVbQb2fWz5pKGCqsT0c",
  authDomain: "letschat1-b6b25.firebaseapp.com",
  projectId: "letschat1-b6b25",
  storageBucket: "letschat1-b6b25.firebasestorage.app",
  messagingSenderId: "115473883439",
  appId: "1:115473883439:web:78c52e0a460c37dfeb1ea9",
  measurementId: "G-5M1ZYYPNCG"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const { title, body, icon, badge, tag, data } = payload.notification || {};
  
  const notificationOptions = {
    body: body || 'New notification',
    icon: icon || '/icon-192x192.png',
    badge: badge || '/badge-72x72.png',
    tag: tag || 'default',
    renotify: true,
    requireInteraction: data?.type === 'call',
    data: payload.data || {},
    actions: getNotificationActions(payload.data?.type),
    vibrate: [200, 100, 200],
  };

  return self.registration.showNotification(
    title || 'LETSCHAT',
    notificationOptions
  );
});

// Get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'message':
      return [
        { action: 'reply', title: 'Reply', icon: '/icons/reply.png' },
        { action: 'mark-read', title: 'Mark as Read', icon: '/icons/check.png' },
      ];
    case 'call':
      return [
        { action: 'answer', title: 'Answer', icon: '/icons/phone.png' },
        { action: 'decline', title: 'Decline', icon: '/icons/phone-off.png' },
      ];
    default:
      return [];
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();

  const { action } = event;
  const data = event.notification.data || {};

  // Handle actions
  if (action === 'reply') {
    // Open chat with reply focus
    const chatUrl = data.chatId 
      ? `/chat/${data.chatId}?reply=true`
      : '/';
    event.waitUntil(openOrFocusWindow(chatUrl));
  } else if (action === 'mark-read') {
    // Mark as read via API (handled by the app when focused)
    event.waitUntil(markAsRead(data.chatId, data.messageId));
  } else if (action === 'answer') {
    // Open call screen
    const callUrl = `/call/${data.callId}?answer=true`;
    event.waitUntil(openOrFocusWindow(callUrl));
  } else if (action === 'decline') {
    // Decline call via API
    event.waitUntil(declineCall(data.callId));
  } else {
    // Default: open the app or focus existing window
    const url = data.chatId 
      ? `/chat/${data.chatId}`
      : data.callId 
        ? `/call/${data.callId}`
        : '/';
    event.waitUntil(openOrFocusWindow(url));
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// Helper: Open or focus existing window
async function openOrFocusWindow(url) {
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  // Check if a window is already open
  for (const client of windowClients) {
    if (client.url.includes(self.location.origin) && 'focus' in client) {
      await client.focus();
      if (url !== '/') {
        client.navigate(url);
      }
      return;
    }
  }

  // Open new window
  if (self.clients.openWindow) {
    return self.clients.openWindow(url);
  }
}

// Helper: Mark message as read
async function markAsRead(chatId, messageId) {
  // This will be handled by the app when it becomes active
  // We can post a message to the client
  const windowClients = await self.clients.matchAll({ type: 'window' });
  
  for (const client of windowClients) {
    client.postMessage({
      type: 'MARK_AS_READ',
      chatId,
      messageId,
    });
  }
}

// Helper: Decline call
async function declineCall(callId) {
  // Post message to client to decline call
  const windowClients = await self.clients.matchAll({ type: 'window' });
  
  for (const client of windowClients) {
    client.postMessage({
      type: 'DECLINE_CALL',
      callId,
    });
  }
}

// Service worker lifecycle events
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message from app:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic sync for background data updates (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Sync unread message counts, etc.
  console.log('[SW] Syncing messages in background');
}
