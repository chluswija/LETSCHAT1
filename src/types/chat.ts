// ============================================
// LETSCHAT - Complete Type Definitions
// WhatsApp-like Web Application
// ============================================

export interface User {
  uid: string;
  phone: string; // Primary identifier (required for phone auth)
  email?: string; // Optional linked email
  displayName: string;
  photoURL: string | null;
  about: string;
  lastSeen: Date;
  online: boolean;
  blockedUsers: string[];
  contacts: string[]; // User's saved contacts
  createdAt: Date;
  updatedAt?: Date;
  pushToken?: string; // FCM token for notifications
  settings: UserSettings;
}

export interface UserSettings {
  notifications: {
    messages: boolean;
    groups: boolean;
    calls: boolean;
    statusUpdates: boolean;
    sound: boolean;
    vibrate: boolean;
    showPreview: boolean;
  };
  privacy: {
    lastSeen: 'everyone' | 'contacts' | 'nobody';
    profilePhoto: 'everyone' | 'contacts' | 'nobody';
    about: 'everyone' | 'contacts' | 'nobody';
    status: 'everyone' | 'contacts' | 'nobody';
    readReceipts: boolean;
  };
  chat: {
    enterSendsMessage: boolean;
    mediaAutoDownload: 'wifi' | 'always' | 'never';
    fontSize: 'small' | 'medium' | 'large';
  };
  theme: 'light' | 'dark' | 'system';
  language: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'gif' | 'location' | 'contact' | 'poll' | 'system';
  mediaUrl?: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  caption?: string; // For media messages
  duration?: number; // For audio/video
  dimensions?: { width: number; height: number }; // For images/videos
  location?: { latitude: number; longitude: number; name?: string };
  contact?: { name: string; phone: string };
  poll?: Poll;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';
  seenBy?: { [userId: string]: Date }; // For group messages
  deliveredTo?: { [userId: string]: Date }; // For group messages
  replyTo?: {
    messageId: string;
    senderId: string;
    content: string;
    type: Message['type'];
  };
  forwarded: boolean;
  forwardCount?: number;
  deletedForEveryone: boolean;
  deletedFor: string[];
  editedAt?: Date;
  reactions: { [userId: string]: string }; // userId -> emoji
  starred: string[]; // userIds who starred this message
  mentions?: string[]; // userIds mentioned in this message
}

export interface Poll {
  question: string;
  options: { id: string; text: string; votes: string[] }[];
  allowMultiple: boolean;
  anonymous: boolean;
  expiresAt?: Date;
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  participants: string[];
  participantDetails?: { [userId: string]: { joinedAt: Date; addedBy?: string } };
  lastMessage?: Partial<Message>;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  unreadCount: { [userId: string]: number };
  pinnedBy: string[];
  archivedBy: string[];
  mutedBy: string[];
  mutedUntil?: { [userId: string]: Date | 'forever' };
  wallpaper?: { [userId: string]: string };
  typing: { [userId: string]: boolean };
  draft?: { [userId: string]: string }; // Saved draft messages
}

export interface Group extends Chat {
  type: 'group';
  name: string;
  description: string;
  photoURL: string | null;
  admins: string[];
  superAdmins: string[]; // Can't be removed, can manage other admins
  createdBy: string;
  inviteLink?: string;
  inviteLinkEnabled: boolean;
  settings: GroupSettings;
}

export interface GroupSettings {
  onlyAdminsCanPost: boolean;
  onlyAdminsCanEditInfo: boolean;
  onlyAdminsCanAddMembers: boolean;
  approvalRequired: boolean; // Admin approval for join requests
  maxParticipants: number;
}

export interface Status {
  id: string;
  ownerId: string;
  type: 'text' | 'image' | 'video';
  content?: string;
  mediaUrl?: string;
  thumbnail?: string;
  backgroundColor?: string;
  fontStyle?: string;
  caption?: string;
  timestamp: Date;
  expiresAt: Date; // 24 hours from creation
  viewedBy: { [userId: string]: Date };
  privacy: 'everyone' | 'contacts' | 'except' | 'only';
  privacyList?: string[]; // userIds for except/only
  muted: string[]; // Users who muted replies
}

export interface Call {
  id: string;
  type: 'voice' | 'video';
  callType: 'private' | 'group';
  callerId: string;
  participants: string[];
  status: 'initiating' | 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected' | 'busy' | 'failed';
  startedAt?: Date;
  answeredAt?: Date;
  endedAt?: Date;
  duration?: number;
  missedBy?: string[]; // For group calls
  declinedBy?: string[];
}

export interface CallLog extends Call {
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'group_invite' | 'call' | 'status' | 'mention' | 'reaction' | 'system';
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
  chatIds: string[];
  createdAt: Date;
}

export interface StarredMessage {
  id: string;
  userId: string;
  messageId: string;
  chatId: string;
  message: Message;
  starredAt: Date;
}

export interface MediaItem {
  id: string;
  chatId: string;
  messageId: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'link';
  url: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  senderId: string;
  timestamp: Date;
}

export interface SearchResult {
  type: 'message' | 'chat' | 'contact' | 'media';
  id: string;
  chatId?: string;
  preview: string;
  timestamp?: Date;
  highlight?: string;
}

// Firestore document references for denormalization
export interface UserConversation {
  odaUserId: string;
  chatId: string;
  chatType: 'private' | 'group';
  otherParticipants: string[];
  lastMessage?: Partial<Message>;
  lastMessageAt?: Date;
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  mutedUntil?: Date | 'forever';
  draft?: string;
  updatedAt: Date;
}

// For backup/export
export interface UserDataExport {
  user: User;
  chats: Chat[];
  messages: Message[];
  statuses: Status[];
  media: MediaItem[];
  exportedAt: Date;
}

