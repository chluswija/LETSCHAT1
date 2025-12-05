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
  ArrowLeft
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

// Demo messages
const demoMessages: Message[] = [
  {
    id: '1',
    chatId: '1',
    senderId: '2',
    content: 'Hey! How are you doing today? 😊',
    type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    status: 'seen',
    forwarded: false,
    deletedForEveryone: false,
    deletedFor: [],
    reactions: {},
  },
  {
    id: '2',
    chatId: '1',
    senderId: '1',
    content: "I'm doing great, thanks for asking! Just finished a big project at work.",
    type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 55),
    status: 'seen',
    forwarded: false,
    deletedForEveryone: false,
    deletedFor: [],
    reactions: {},
  },
  {
    id: '3',
    chatId: '1',
    senderId: '2',
    content: "That's awesome! 🎉 We should celebrate this weekend!",
    type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 50),
    status: 'seen',
    forwarded: false,
    deletedForEveryone: false,
    deletedFor: [],
    reactions: { '1': '❤️' },
  },
  {
    id: '4',
    chatId: '1',
    senderId: '1',
    content: 'Sounds like a plan! What do you have in mind?',
    type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    status: 'seen',
    forwarded: false,
    deletedForEveryone: false,
    deletedFor: [],
    reactions: {},
  },
  {
    id: '5',
    chatId: '1',
    senderId: '2',
    content: 'Maybe we could try that new restaurant downtown? I heard their food is amazing!',
    type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
    status: 'seen',
    forwarded: false,
    deletedForEveryone: false,
    deletedFor: [],
    reactions: {},
  },
  {
    id: '6',
    chatId: '1',
    senderId: '1',
    content: "Perfect! Let's do Saturday evening then 🍽️",
    type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    status: 'delivered',
    forwarded: false,
    deletedForEveryone: false,
    deletedFor: [],
    reactions: {},
  },
];

interface ChatWindowProps {
  otherUser?: User;
  onBack?: () => void;
}

export const ChatWindow = ({ otherUser, onBack }: ChatWindowProps) => {
  const { activeChat, setActiveChat } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, []);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    // Here you would add Firebase message sending logic
    console.log('Sending message:', message);
    setMessage('');
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

  // Demo user for showcase
  const displayUser = otherUser || {
    uid: '2',
    email: 'sarah@example.com',
    displayName: 'Sarah Wilson',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    about: 'Living my best life ✨',
    lastSeen: new Date(Date.now() - 1000 * 60 * 2),
    online: true,
    blockedUsers: [],
    createdAt: new Date(),
  };

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
          <AvatarImage src={displayUser.photoURL || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {displayUser.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 cursor-pointer">
          <h3 className="font-semibold text-foreground truncate">{displayUser.displayName}</h3>
          <p className="text-xs text-muted-foreground">
            {displayUser.online ? (
              <span className="text-online">online</span>
            ) : (
              `last seen ${formatDistanceToNow(displayUser.lastSeen, { addSuffix: true })}`
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
        {demoMessages.map((msg, index) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === '1'}
            showAvatar={index === 0 || demoMessages[index - 1].senderId !== msg.senderId}
            user={msg.senderId === '1' ? undefined : displayUser}
          />
        ))}
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
              className="h-11 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl pr-12"
            />
          </div>

          <button
            onClick={message.trim() ? handleSendMessage : undefined}
            className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
              message.trim()
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {message.trim() ? (
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
