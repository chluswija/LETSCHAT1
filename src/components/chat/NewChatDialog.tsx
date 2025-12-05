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
import { Search, Loader2, UserPlus, MessageCircle } from 'lucide-react';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewChatDialog = ({ open, onOpenChange }: NewChatDialogProps) => {
  const { user: currentUser } = useAuthStore();
  const { setActiveChat, chats } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Search for users by email or display name
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        
        // Search by email (exact match for now)
        const emailQuery = query(usersRef, where('email', '==', searchQuery.toLowerCase()));
        const emailSnapshot = await getDocs(emailQuery);
        
        const users: User[] = [];
        emailSnapshot.forEach((doc) => {
          const userData = { ...doc.data(), uid: doc.id } as User;
          // Don't show current user
          if (userData.uid !== currentUser?.uid) {
            users.push(userData);
          }
        });

        // Also try searching by partial email
        if (users.length === 0 && searchQuery.includes('@')) {
          const allUsersSnapshot = await getDocs(usersRef);
          allUsersSnapshot.forEach((doc) => {
            const userData = { ...doc.data(), uid: doc.id } as User;
            if (
              userData.uid !== currentUser?.uid &&
              userData.email.toLowerCase().includes(searchQuery.toLowerCase())
            ) {
              users.push(userData);
            }
          });
        }

        // Search by display name
        if (users.length === 0) {
          const allUsersSnapshot = await getDocs(usersRef);
          allUsersSnapshot.forEach((doc) => {
            const userData = { ...doc.data(), uid: doc.id } as User;
            if (
              userData.uid !== currentUser?.uid &&
              userData.displayName.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
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
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </button>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No users found</p>
                <p className="text-sm">Try searching by email address</p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Search for users</p>
                <p className="text-sm">Enter email or name to find contacts</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
