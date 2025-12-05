import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { User, Chat } from '@/types/chat';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2, UserPlus, MessageCircle, Phone } from 'lucide-react';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Format phone number for display
const formatPhoneDisplay = (phone: string) => {
  if (!phone) return '';
  // Remove all non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    // International format: +1 234 567 8900
    if (cleaned.length > 10) {
      const countryCode = cleaned.slice(0, cleaned.length - 10);
      const rest = cleaned.slice(-10);
      return `${countryCode} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
  }
  return phone;
};

export const NewChatDialog = ({ open, onOpenChange }: NewChatDialogProps) => {
  const { user: currentUser } = useAuthStore();
  const { setActiveChat, chats } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Search for users by phone number (like WhatsApp)
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        const users: User[] = [];
        
        // Normalize the search query (remove spaces, dashes)
        const normalizedQuery = searchQuery.replace(/[\s\-()]/g, '');
        
        // Search by phone number (primary method like WhatsApp)
        if (normalizedQuery.match(/^\+?\d+$/)) {
          // It's a phone number search
          const allUsersSnapshot = await getDocs(usersRef);
          allUsersSnapshot.forEach((doc) => {
            const userData = { ...doc.data(), uid: doc.id } as User;
            const userPhone = (userData.phone || '').replace(/[\s\-()]/g, '');
            if (
              userData.uid !== currentUser?.uid &&
              userPhone.includes(normalizedQuery)
            ) {
              users.push(userData);
            }
          });
        } else {
          // Search by display name as fallback
          const allUsersSnapshot = await getDocs(usersRef);
          allUsersSnapshot.forEach((doc) => {
            const userData = { ...doc.data(), uid: doc.id } as User;
            if (
              userData.uid !== currentUser?.uid &&
              userData.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
            ) {
              users.push(userData);
            }
          });
        }

        setSearchResults(users);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUser?.uid]);

  const startChat = async (otherUser: User) => {
    if (!currentUser?.uid || isCreating) return;

    setIsCreating(true);
    try {
      // Check if chat already exists
      const existingChat = chats.find(
        (chat) =>
          chat.type === 'private' &&
          chat.participants.includes(currentUser.uid) &&
          chat.participants.includes(otherUser.uid)
      );

      if (existingChat) {
        // Chat exists, just open it
        const otherUserDoc = await getDoc(doc(db, 'users', otherUser.uid));
        if (otherUserDoc.exists()) {
          setActiveChat(existingChat);
        }
        onOpenChange(false);
        return;
      }

      // Create new chat
      const chatData = {
        type: 'private',
        participants: [currentUser.uid, otherUser.uid],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [otherUser.uid]: 0,
        },
        pinnedBy: [],
        archivedBy: [],
        mutedBy: [],
        typing: {},
      };

      const chatRef = await addDoc(collection(db, 'chats'), chatData);
      
      const newChat: Chat = {
        id: chatRef.id,
        type: 'private',
        participants: [currentUser.uid, otherUser.uid],
        createdAt: new Date(),
        lastMessageAt: new Date(),
        unreadCount: {
          [currentUser.uid]: 0,
          [otherUser.uid]: 0,
        },
        pinnedBy: [],
        archivedBy: [],
        mutedBy: [],
        typing: {},
      };

      setActiveChat(newChat);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            New Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Enter phone number (e.g. +1234567890)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
              type="tel"
            />
          </div>

          {/* Search Results */}
          <div className="max-h-[300px] overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => startChat(user)}
                    disabled={isCreating}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.photoURL || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{user.displayName}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhoneDisplay(user.phone || '')}
                      </p>
                    </div>
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </button>
                ))}
              </div>
            ) : searchQuery.length >= 3 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No users found</p>
                <p className="text-sm">Make sure the phone number is correct</p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Search by phone number</p>
                <p className="text-sm">Enter a phone number to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
