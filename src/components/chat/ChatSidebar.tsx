import { useState, useEffect } from 'react';
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
  Plus,
  Loader2,
  Phone,
  UserPlus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ChatListItem } from './ChatListItem';
import { NewChatDialog } from './NewChatDialog';
import { CreateGroupDialog } from './GroupComponents';
import { AddContactDialog } from './AddContactDialog';
import { StatusList } from '../status/StatusList';
import { CallHistory } from './CallHistory';
import { Chat, User } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

export const ChatSidebar = () => {
  const { user, logout } = useAuthStore();
  const { chats, setChats, activeChat, setActiveChat, searchQuery, setSearchQuery } = useChatStore();
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'calls'>('chats');
  const [chatUsers, setChatUsers] = useState<{ [chatId: string]: User }>({});
  const [savedContacts, setSavedContacts] = useState<{ [userId: string]: string }>({}); // userId -> saved name
  const [isLoading, setIsLoading] = useState(true);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);

  // Fetch saved contacts names
  useEffect(() => {
    if (!user?.uid) return;

    const contactsRef = collection(db, 'users', user.uid, 'contacts');
    const unsubscribe = onSnapshot(contactsRef, (snapshot) => {
      const contacts: { [userId: string]: string } = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        contacts[data.userId] = data.name;
      });
      setSavedContacts(contacts);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Update user online status
  useEffect(() => {
    if (!user?.uid) return;

    const updateOnlineStatus = async (online: boolean) => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          online,
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        console.error('Error updating online status:', error);
      }
    };

    // Set online when component mounts
    updateOnlineStatus(true);

    // Set offline when window closes or user leaves
    const handleBeforeUnload = () => updateOnlineStatus(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateOnlineStatus(false);
      } else {
        updateOnlineStatus(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      updateOnlineStatus(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.uid]);

  // Fetch chats from Firebase in real-time
  useEffect(() => {
    if (!user?.uid) return;

    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsData: Chat[] = [];
      const userPromises: Promise<void>[] = [];

      snapshot.forEach((docSnap) => {
        const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
        // Convert Firestore timestamps to Date
        if (chatData.lastMessageAt) {
          chatData.lastMessageAt = (chatData.lastMessageAt as any).toDate?.() || chatData.lastMessageAt;
        }
        if (chatData.createdAt) {
          chatData.createdAt = (chatData.createdAt as any).toDate?.() || chatData.createdAt;
        }
        if (chatData.lastMessage?.timestamp) {
          chatData.lastMessage.timestamp = (chatData.lastMessage.timestamp as any).toDate?.() || chatData.lastMessage.timestamp;
        }
        chatsData.push(chatData);

        // Fetch the other user's data for private chats
        if (chatData.type === 'private') {
          const otherUserId = chatData.participants.find(p => p !== user.uid);
          if (otherUserId && !chatUsers[chatData.id]) {
            const promise = getDoc(doc(db, 'users', otherUserId)).then((userDoc) => {
              if (userDoc.exists()) {
                const userData = userDoc.data() as User;
                // Convert timestamps
                if (userData.lastSeen) {
                  userData.lastSeen = (userData.lastSeen as any).toDate?.() || userData.lastSeen;
                }
                if (userData.createdAt) {
                  userData.createdAt = (userData.createdAt as any).toDate?.() || userData.createdAt;
                }
                setChatUsers(prev => ({ ...prev, [chatData.id]: userData }));
              }
            });
            userPromises.push(promise);
          }
        }
      });

      await Promise.all(userPromises);
      setChats(chatsData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching chats:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, setChats]);

  const handleLogout = async () => {
    await signOut(auth);
    logout();
  };

  const filteredChats = chats.filter((chat) => {
    const otherUser = chatUsers[chat.id];
    if (!otherUser) return false;
    // Also search by saved contact name
    const savedName = savedContacts[otherUser.uid] || '';
    return (
      otherUser.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      savedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (otherUser.phone || '').includes(searchQuery.replace(/[\s\-()]/g, ''))
    );
  });

  // Get display name for a user (prefer saved contact name)
  const getDisplayName = (otherUser: User) => {
    return savedContacts[otherUser.uid] || otherUser.displayName || otherUser.phone || 'Unknown';
  };

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
            <DropdownMenuItem className="gap-2" onClick={() => setShowAddContactDialog(true)}>
              <UserPlus className="w-4 h-4" />
              New Contact
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => setShowCreateGroupDialog(true)}>
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
          { id: 'calls', icon: Phone, label: 'Calls' },
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
      {activeTab === 'chats' && (
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
      )}

      {/* Content based on active tab */}
      {activeTab === 'chats' && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs">Start a new conversation</p>
            </div>
          ) : (
            filteredChats.map((chat, index) => {
              const otherUser = chatUsers[chat.id];
              if (!otherUser) return null;
              return (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  user={otherUser}
                  displayName={savedContacts[otherUser.uid]}
                  isActive={activeChat?.id === chat.id}
                  onClick={() => setActiveChat(chat)}
                  style={{ animationDelay: `${index * 0.05}s` }}
                />
              );
            })
          )}
        </div>
      )}

      {activeTab === 'status' && (
        <div className="flex-1 overflow-hidden relative">
          <StatusList />
        </div>
      )}

      {activeTab === 'calls' && (
        <div className="flex-1 overflow-hidden">
          <CallHistory />
        </div>
      )}

      {/* New Chat FAB */}
      {activeTab === 'chats' && (
        <div className="absolute bottom-6 right-6">
          <button 
            onClick={() => setShowNewChatDialog(true)}
            className="w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg shadow-primary/25 flex items-center justify-center transition-all hover:scale-105"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* New Chat Dialog */}
      <NewChatDialog 
        open={showNewChatDialog} 
        onOpenChange={setShowNewChatDialog} 
        onNewGroup={() => setShowCreateGroupDialog(true)}
      />
      
      {/* Create Group Dialog */}
      <CreateGroupDialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog} />
      
      {/* Add Contact Dialog */}
      <AddContactDialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog} />
    </div>
  );
};
