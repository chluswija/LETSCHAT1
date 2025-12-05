export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  about: string;
  phone?: string;
  lastSeen: Date;
  online: boolean;
  blockedUsers: string[];
  createdAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'gif' | 'location' | 'contact';
  mediaUrl?: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'seen';
  replyTo?: string;
  forwarded: boolean;
  deletedForEveryone: boolean;
  deletedFor: string[];
  editedAt?: Date;
  reactions: { [userId: string]: string };
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  participants: string[];
  lastMessage?: Message;
  lastMessageAt?: Date;
  createdAt: Date;
  unreadCount: { [userId: string]: number };
  pinnedBy: string[];
  archivedBy: string[];
  mutedBy: string[];
  wallpaper?: { [userId: string]: string };
  typing: { [userId: string]: boolean };
}

export interface Group extends Chat {
  name: string;
  description: string;
  photoURL: string | null;
  admins: string[];
  createdBy: string;
}

export interface Status {
  id: string;
  ownerId: string;
  type: 'text' | 'image' | 'video';
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  caption?: string;
  timestamp: Date;
  expiresAt: Date;
  viewedBy: string[];
}

export interface Call {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
}
