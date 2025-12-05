import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  MessageCircle, 
  Search, 
  MoreVertical, 
  Users, 
  CircleDot,
  Archive,
  Settings,
  LogOut,
  Plus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ChatListItem } from './ChatListItem';
import { Chat, User } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

// Demo data for UI showcase
const demoChats: (Chat & { otherUser: User })[] = [
  {
    id: '1',
    type: 'private',
    participants: ['1', '2'],
    lastMessage: {
      id: 'm1',
      chatId: '1',
      senderId: '2',
      content: 'Hey! How are you doing? 😊',
      type: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      status: 'seen',
      forwarded: false,
      deletedForEveryone: false,
      deletedFor: [],
      reactions: {},
    },
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 5),
    createdAt: new Date(),
    unreadCount: { '1': 2 },
    pinnedBy: ['1'],
    archivedBy: [],
    mutedBy: [],
    typing: {},
    otherUser: {
      uid: '2',
      email: 'sarah@example.com',
      displayName: 'Sarah Wilson',
      photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      about: 'Living my best life ✨',
      lastSeen: new Date(Date.now() - 1000 * 60 * 2),
      online: true,
      blockedUsers: [],
      createdAt: new Date(),
    },
  },
  {
    id: '2',
    type: 'private',
    participants: ['1', '3'],
    lastMessage: {
      id: 'm2',
      chatId: '2',
      senderId: '1',
      content: 'Let me know when you arrive',
      type: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      status: 'delivered',
      forwarded: false,
      deletedForEveryone: false,
      deletedFor: [],
      reactions: {},
    },
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 30),
    createdAt: new Date(),
    unreadCount: {},
    pinnedBy: [],
    archivedBy: [],
    mutedBy: [],
    typing: {},
    otherUser: {
      uid: '3',
      email: 'mike@example.com',
      displayName: 'Mike Chen',
      photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      about: 'Coffee enthusiast ☕',
      lastSeen: new Date(Date.now() - 1000 * 60 * 15),
      online: false,
      blockedUsers: [],
      createdAt: new Date(),
    },
  },
  {
    id: '3',
    type: 'private',
    participants: ['1', '4'],
    lastMessage: {
      id: 'm3',
      chatId: '3',
      senderId: '4',
      content: 'Thanks for your help! 🙏',
      type: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: 'seen',
      forwarded: false,
      deletedForEveryone: false,
      deletedFor: [],
      reactions: {},
    },
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    createdAt: new Date(),
    unreadCount: {},
    pinnedBy: [],
    archivedBy: [],
    mutedBy: [],
    typing: { '4': true },
    otherUser: {
      uid: '4',
      email: 'emma@example.com',
      displayName: 'Emma Davis',
      photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      about: 'Designer & Creator',
      lastSeen: new Date(),
      online: true,
      blockedUsers: [],
      createdAt: new Date(),
    },
  },
];

export const ChatSidebar = () => {
  const { user, logout } = useAuthStore();
  const { activeChat, setActiveChat, searchQuery, setSearchQuery } = useChatStore();
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'groups'>('chats');

  const handleLogout = async () => {
    await signOut(auth);
    logout();
  };

  const filteredChats = demoChats.filter((chat) =>
    chat.otherUser.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={user?.photoURL || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-foreground text-sm">{user?.displayName}</h2>
            <p className="text-xs text-muted-foreground">{user?.about?.slice(0, 25)}...</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-muted rounded-full transition-colors">
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <Users className="w-4 h-4" />
              New Group
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Archive className="w-4 h-4" />
              Archived
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: 'chats', icon: MessageCircle, label: 'Chats' },
          { id: 'status', icon: CircleDot, label: 'Status' },
          { id: 'groups', icon: Users, label: 'Groups' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all relative ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredChats.map((chat, index) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            user={chat.otherUser}
            isActive={activeChat?.id === chat.id}
            onClick={() => setActiveChat(chat)}
            style={{ animationDelay: `${index * 0.05}s` }}
          />
        ))}
      </div>

      {/* New Chat FAB */}
      <div className="absolute bottom-6 right-6">
        <button className="w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg shadow-primary/25 flex items-center justify-center transition-all hover:scale-105">
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
