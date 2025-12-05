import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, onSnapshot } from 'firebase/firestore';
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
import { Search, Loader2, UserPlus, MessageCircle, Phone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddContactDialog } from './AddContactDialog';

interface SavedContact {
  oderId?: string;
  oderId2?: string;
  oderId3?: string;
  userId: string;
  name: string;
  phone: string;
  photoURL: string | null;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewGroup?: () => void;
}

// Format phone number for display
const formatPhoneDisplay = (phone: string) => {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    if (cleaned.length > 10) {
      const countryCode = cleaned.slice(0, cleaned.length - 10);
      const rest = cleaned.slice(-10);
      return `${countryCode} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
  }
  return phone;
};

export const NewChatDialog = ({ open, onOpenChange, onNewGroup }: NewChatDialogProps) => {
  const { user: currentUser } = useAuthStore();
  const { setActiveChat, chats } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  // Fetch saved contacts
  useEffect(() => {
    if (!currentUser?.uid || !open) return;

    setIsLoading(true);
    const contactsRef = collection(db, 'users', currentUser.uid, 'contacts');
    
    const unsubscribe = onSnapshot(contactsRef, async (snapshot) => {
      const contactsList: SavedContact[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Check if this is a real user on the platform
        const isRealUser = data.userId && !data.userId.startsWith('phone_');
        
        if (isRealUser) {
          // Fetch latest user data for users on platform
          try {
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              contactsList.push({
                oderId: data.userId,
                oderId2: data.userId,
                oderId3: data.userId,
                userId: data.userId,
                name: data.name, // Use saved contact name
                phone: userData.phone || data.phone,
                photoURL: userData.photoURL || data.photoURL,
              });
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        } else {
          // For contacts not on platform yet, just use saved data
          contactsList.push({
            oderId: data.userId,
            oderId2: data.userId,
            oderId3: data.userId,
            userId: data.userId,
            name: data.name, // Use saved contact name
            phone: data.phone,
            photoURL: data.photoURL || null,
          });
        }
      }
      
      // Sort alphabetically by name
      contactsList.sort((a, b) => a.name.localeCompare(b.name));
      setContacts(contactsList);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, open]);

  // Filter contacts by search
  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phone.includes(searchQuery.replace(/[\s\-()]/g, ''))
    );
  });

  // Start chat with contact
  const startChat = async (contact: SavedContact) => {
    if (!currentUser?.uid || isCreating) return;

    setIsCreating(true);
    try {
      // Check if chat already exists
      const existingChat = chats.find(
        (chat) =>
          chat.type === 'private' &&
          chat.participants.includes(currentUser.uid) &&
          chat.participants.includes(contact.userId)
      );

      if (existingChat) {
        setActiveChat(existingChat);
        onOpenChange(false);
        return;
      }

      // Create new chat
      const chatData = {
        type: 'private',
        participants: [currentUser.uid, contact.userId],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [contact.userId]: 0,
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
        participants: [currentUser.uid, contact.userId],
        createdAt: new Date(),
        lastMessageAt: new Date(),
        unreadCount: {
          [currentUser.uid]: 0,
          [contact.userId]: 0,
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

  const handleContactAdded = (user: User) => {
    // Refresh will happen automatically via onSnapshot
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              New Chat
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Add New Contact Button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={() => setShowAddContact(true)}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Add New Contact</p>
                <p className="text-xs text-muted-foreground">Save a phone number to start chatting</p>
              </div>
            </Button>

            {/* New Group Button */}
            {onNewGroup && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-14"
                onClick={() => {
                  onOpenChange(false);
                  onNewGroup();
                }}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">New Group</p>
                  <p className="text-xs text-muted-foreground">Create a group with your contacts</p>
                </div>
              </Button>
            )}

            {/* Contacts List */}
            <div className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredContacts.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    CONTACTS ON LETSCHAT
                  </p>
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.userId}
                      onClick={() => startChat(contact)}
                      disabled={isCreating}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.photoURL || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {contact.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-foreground">{contact.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {formatPhoneDisplay(contact.phone)}
                        </p>
                      </div>
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </button>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No contacts yet</p>
                  <p className="text-sm">Add a contact to start chatting</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No contacts found</p>
                  <p className="text-sm">Try a different search</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddContact}
        onOpenChange={setShowAddContact}
        onContactAdded={handleContactAdded}
      />
    </>
  );
};
