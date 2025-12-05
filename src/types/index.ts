// ============================================
// LETSCHAT - Complete Type Definitions
// Production-ready WhatsApp Clone
// ============================================

// ==================== USER TYPES ====================
export interface User {
  uid: string;
  phone: string;
  displayName: string;
  photoURL: string | null;
  about: string;
  email?: string;
  
  // Presence
  online: boolean;
  lastSeen: Date;
  
  // Privacy Settings
  privacy: UserPrivacy;
  
  // Contacts & Blocking
  contacts: string[];
  blockedUsers: string[];
  blockedBy: string[];
  
  // FCM Tokens (per device)
  fcmTokens: FCMToken[];
  
  // Account
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  banReason?: string;
}

export interface UserPrivacy {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  about: 'everyone' | 'contacts' | 'nobody';
  status: 'everyone' | 'contacts' | 'selected';
  statusExclude: string[];
  readReceipts: boolean;
  groupsAdd: 'everyone' | 'contacts' | 'nobody';
}

export interface FCMToken {
  token: string;
  device: string;
  platform: 'web' | 'android' | 'ios';
  createdAt: Date;
  lastUsed: Date;
}

export interface UserPublic {
  uid: string;
  displayName: string;
  photoURL: string | null;
  about: string;
  online: boolean;
  lastSeen: Date;
}

// ==================== CONVERSATION TYPES ====================
export interface Conversation {
  id: string;
  type: 'private' | 'group';
  participants: string[];
  
  // Last message preview
  lastMessage?: MessagePreview;
  lastMessageAt?: Date;
  
  // Per-user settings
  unreadCount: Record<string, number>;
  pinnedBy: string[];
  archivedBy: string[];
  mutedBy: string[];
  mutedUntil: Record<string, Date | null>;
  
  // Typing indicators
  typing: Record<string, boolean>;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface PrivateConversation extends Conversation {
  type: 'private';
}

export interface GroupConversation extends Conversation {
  type: 'group';
  name: string;
  description: string;
  photoURL: string | null;
  
  // Group management
  admins: string[];
  createdBy: string;
  
  // Group settings
  settings: GroupSettings;
  
  // Invite link
  inviteLink?: string;
  inviteLinkCreatedAt?: Date;
  inviteLinkCreatedBy?: string;
}

export interface GroupSettings {
  onlyAdminsCanMessage: boolean;
  onlyAdminsCanEditInfo: boolean;
  onlyAdminsCanAddMembers: boolean;
  approvalRequired: boolean;
  maxMembers: number;
}

export interface MessagePreview {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  timestamp: Date;
}

// ==================== MESSAGE TYPES ====================
export type MessageType = 
  | 'text' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'voice' 
  | 'document' 
  | 'location' 
  | 'contact' 
  | 'sticker' 
  | 'gif'
  | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  
  // Content
  type: MessageType;
  content: string;
  
  // Media (if applicable)
  media?: MediaAttachment;
  
  // Link preview
  linkPreview?: LinkPreview;
  
  // Reply/Forward
  replyTo?: ReplyReference;
  forwardedFrom?: ForwardReference;
  
  // Status & Receipts
  status: MessageStatus;
  deliveredTo: Record<string, Date>;
  seenBy: Record<string, Date>;
  
  // Reactions
  reactions: Record<string, string>; // userId -> emoji
  
  // Editing & Deletion
  isEdited: boolean;
  editedAt?: Date;
  editHistory?: EditHistoryItem[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedFor: string[]; // soft delete per user
  deletedForEveryone: boolean;
  
  // Starring
  starredBy: string[];
  
  // Metadata
  timestamp: Date;
  createdAt: Date;
  
  // E2EE (optional)
  encrypted?: boolean;
  encryptedContent?: string;
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'voice' | 'document';
  
  // Cloudinary data
  publicId: string;
  secureUrl: string;
  resourceType: string;
  format: string;
  
  // Dimensions (for images/videos)
  width?: number;
  height?: number;
  
  // Duration (for audio/video)
  duration?: number;
  
  // Thumbnails
  thumbnail?: string;
  thumbnailPublicId?: string;
  
  // File info
  fileName?: string;
  fileSize: number;
  mimeType: string;
  
  // Upload metadata
  uploadedAt: Date;
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image?: string;
  siteName?: string;
  fetchedAt: Date;
}

export interface ReplyReference {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  media?: {
    type: string;
    thumbnail?: string;
  };
}

export interface ForwardReference {
  originalMessageId: string;
  originalConversationId: string;
  originalSenderId: string;
  forwardCount: number;
}

export interface EditHistoryItem {
  content: string;
  editedAt: Date;
}

// ==================== STATUS/STORIES TYPES ====================
export interface Status {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto: string | null;
  
  type: 'text' | 'image' | 'video';
  
  // Text status
  content?: string;
  backgroundColor?: string;
  fontStyle?: string;
  
  // Media status
  media?: MediaAttachment;
  caption?: string;
  
  // Privacy
  visibility: 'everyone' | 'contacts' | 'selected';
  visibleTo: string[]; // for 'selected' visibility
  excludedFrom: string[];
  
  // Engagement
  viewedBy: StatusView[];
  repliesCount: number;
  
  // Timestamps
  timestamp: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface StatusView {
  viewerId: string;
  viewerName: string;
  viewerPhoto: string | null;
  viewedAt: Date;
}

export interface StatusReply {
  id: string;
  statusId: string;
  statusOwnerId: string;
  senderId: string;
  content: string;
  type: 'text' | 'emoji';
  timestamp: Date;
  // This creates/opens a DM conversation
  conversationId: string;
}

// ==================== CALL TYPES ====================
export interface Call {
  id: string;
  type: 'voice' | 'video';
  callerId: string;
  callerName: string;
  
  // For 1:1 calls
  receiverId?: string;
  receiverName?: string;
  
  // For group calls
  conversationId?: string;
  participants: CallParticipant[];
  
  status: CallStatus;
  
  // Timestamps
  startedAt?: Date;
  answeredAt?: Date;
  endedAt?: Date;
  duration?: number;
  
  // Metadata
  createdAt: Date;
}

export interface CallParticipant {
  userId: string;
  joined: boolean;
  joinedAt?: Date;
  leftAt?: Date;
  muted: boolean;
  videoOff: boolean;
}

export type CallStatus = 
  | 'ringing'
  | 'ongoing'
  | 'ended'
  | 'missed'
  | 'rejected'
  | 'busy'
  | 'failed';

// ==================== NOTIFICATION TYPES ====================
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  image?: string;
  data: Record<string, string>;
  clickAction?: string;
}

export type NotificationType = 
  | 'new_message'
  | 'group_message'
  | 'status_reply'
  | 'incoming_call'
  | 'missed_call'
  | 'group_invite'
  | 'mention';

// ==================== REPORT/MODERATION TYPES ====================
export interface Report {
  id: string;
  reporterId: string;
  
  targetType: 'user' | 'message' | 'status' | 'group';
  targetId: string;
  targetOwnerId: string;
  
  reason: ReportReason;
  description: string;
  
  // Evidence
  screenshots?: string[];
  messageContent?: string;
  
  // Status
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: Date;
  action?: ModeratorAction;
  
  createdAt: Date;
}

export type ReportReason = 
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'violence'
  | 'nudity'
  | 'false_information'
  | 'scam'
  | 'other';

export type ModeratorAction = 
  | 'warning'
  | 'content_removed'
  | 'temporary_ban'
  | 'permanent_ban'
  | 'no_action';

// ==================== BACKUP TYPES ====================
export interface BackupRequest {
  id: string;
  userId: string;
  type: 'messages' | 'media' | 'full';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// ==================== SEARCH TYPES ====================
export interface SearchResult {
  type: 'message' | 'contact' | 'group' | 'media';
  id: string;
  conversationId?: string;
  title: string;
  subtitle: string;
  image?: string;
  timestamp?: Date;
  highlight?: string;
}

// ==================== HELPER TYPES ====================
export type ConversationWithUser = Conversation & {
  otherUser?: UserPublic;
  groupInfo?: GroupConversation;
};

export interface TypingIndicator {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface PresenceState {
  userId: string;
  online: boolean;
  lastSeen: Date;
  lastChanged: Date;
}

// ==================== API RESPONSE TYPES ====================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  lastDoc?: string;
  total?: number;
}
