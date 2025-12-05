import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  Phone, 
  Video, 
  Search, 
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Send,
  Image,
  Camera,
  FileText,
  MapPin,
  User as UserIcon,
  ArrowLeft,
  Loader2,
  MessageCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MessageBubble } from './MessageBubble';
import { Message, User } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';

interface ChatWindowProps {
  otherUser?: User;
  onBack?: () => void;
}

export const ChatWindow = ({ otherUser, onBack }: ChatWindowProps) => {
  const { activeChat, setActiveChat, messages, setMessages } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [chatPartner, setChatPartner] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch chat partner info
  useEffect(() => {
    if (!activeChat || !currentUser?.uid) {
      setChatPartner(null);
      return;
    }

    const otherUserId = activeChat.participants.find(p => p !== currentUser.uid);
    if (!otherUserId) return;

    const fetchPartner = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          if (userData.lastSeen) {
            userData.lastSeen = (userData.lastSeen as any).toDate?.() || userData.lastSeen;
          }
          if (userData.createdAt) {
            userData.createdAt = (userData.createdAt as any).toDate?.() || userData.createdAt;
          }
          setChatPartner(userData);
        }
      } catch (error) {
        console.error('Error fetching chat partner:', error);
      }
    };

    fetchPartner();
  }, [activeChat, currentUser?.uid]);

  // Fetch messages from Firebase in real-time
  useEffect(() => {
    if (!activeChat?.id) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData: Message[] = [];
      snapshot.forEach((docSnap) => {
        const msgData = { id: docSnap.id, ...docSnap.data() } as Message;
        // Convert Firestore timestamp to Date
        if (msgData.timestamp) {
          msgData.timestamp = (msgData.timestamp as any).toDate?.() || msgData.timestamp;
        }
        messagesData.push(msgData);
      });
      setMessages(messagesData);
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }, (error) => {
      console.error('Error fetching messages:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [activeChat?.id, setMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !activeChat?.id || !currentUser?.uid) return;

    setIsSending(true);
    const messageContent = message.trim();
    setMessage('');

    try {
      // Add message to Firestore
      const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
      await addDoc(messagesRef, {
        chatId: activeChat.id,
        senderId: currentUser.uid,
        content: messageContent,
        type: 'text',
        timestamp: serverTimestamp(),
        status: 'sent',
        forwarded: false,
        deletedForEveryone: false,
        deletedFor: [],
        reactions: {},
      });

      // Update chat's last message
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        lastMessage: {
          id: '',
          chatId: activeChat.id,
          senderId: currentUser.uid,
          content: messageContent,
          type: 'text',
          timestamp: new Date(),
          status: 'sent',
          forwarded: false,
          deletedForEveryone: false,
          deletedFor: [],
          reactions: {},
        },
        lastMessageAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setMessage(messageContent); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Use the chat partner or provided otherUser
  const displayUser = otherUser || chatPartner;

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-chat-wallpaper chat-wallpaper">
        <div className="text-center animate-fade-up">
          <div className="w-64 h-64 mx-auto mb-6 opacity-20">
            <svg viewBox="0 0 303 172" className="w-full h-full text-primary">
              <path
                fill="currentColor"
                d="M229.565 160.229c32.647-25.618 50.156-55.264 50.156-88.621C279.721 32.245 217.178 0 139.86 0 62.544 0 0 32.245 0 71.608c0 39.362 62.544 71.608 139.86 71.608 15.751 0 30.967-1.671 45.243-4.862l.001.001c27.862 21.792 57.296 24.627 73.735 23.752-5.903-1.812-18.533-8.922-29.274-29.878z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">LETSCHAT Web</h2>
          <p className="text-muted-foreground max-w-md">
            Send and receive messages without keeping your phone online.
            <br />
            Use LETSCHAT on up to 4 linked devices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-chat-wallpaper chat-wallpaper">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-2 -ml-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Avatar className="h-10 w-10 cursor-pointer">
          <AvatarImage src={displayUser?.photoURL || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {displayUser?.displayName?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 cursor-pointer">
          <h3 className="font-semibold text-foreground truncate">{displayUser?.displayName || 'Loading...'}</h3>
          <p className="text-xs text-muted-foreground">
            {displayUser?.online ? (
              <span className="text-online">online</span>
            ) : displayUser?.lastSeen ? (
              `last seen ${formatDistanceToNow(displayUser.lastSeen, { addSuffix: true })}`
            ) : (
              'offline'
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2.5 hover:bg-muted rounded-full transition-colors">
            <Video className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2.5 hover:bg-muted rounded-full transition-colors">
            <Phone className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2.5 hover:bg-muted rounded-full transition-colors">
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2.5 hover:bg-muted rounded-full transition-colors">
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Contact info</DropdownMenuItem>
              <DropdownMenuItem>Select messages</DropdownMenuItem>
              <DropdownMenuItem>Mute notifications</DropdownMenuItem>
              <DropdownMenuItem>Clear messages</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Block</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === currentUser?.uid}
              showAvatar={index === 0 || messages[index - 1].senderId !== msg.senderId}
              user={msg.senderId === currentUser?.uid ? undefined : displayUser || undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border p-3">
        <div className="flex items-end gap-2">
          <button 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 hover:bg-muted rounded-full transition-colors flex-shrink-0"
          >
            <Smile className="w-6 h-6 text-muted-foreground" />
          </button>

          <Popover open={showAttachMenu} onOpenChange={setShowAttachMenu}>
            <PopoverTrigger asChild>
              <button className="p-2.5 hover:bg-muted rounded-full transition-colors flex-shrink-0">
                <Paperclip className="w-6 h-6 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto p-2">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Image, label: 'Photos', color: 'bg-purple-500' },
                  { icon: Camera, label: 'Camera', color: 'bg-pink-500' },
                  { icon: FileText, label: 'Document', color: 'bg-blue-500' },
                  { icon: UserIcon, label: 'Contact', color: 'bg-cyan-500' },
                  { icon: MapPin, label: 'Location', color: 'bg-green-500' },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-muted rounded-xl transition-colors"
                    onClick={() => setShowAttachMenu(false)}
                  >
                    <div className={`w-10 h-10 ${item.color} rounded-full flex items-center justify-center`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex-1 relative">
            <Input
              placeholder="Type a message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending}
              className="h-11 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl pr-12"
            />
          </div>

          <button
            onClick={message.trim() && !isSending ? handleSendMessage : undefined}
            disabled={isSending}
            className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
              message.trim() && !isSending
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {isSending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : message.trim() ? (
              <Send className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
