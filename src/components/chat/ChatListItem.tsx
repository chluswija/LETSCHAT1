import { Chat, User, Message } from '@/types/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck, Pin, Image, Mic, Video, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

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

interface ChatListItemProps {
  chat: Chat;
  user: User;
  isActive: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
}

export const ChatListItem = ({ chat, user, isActive, onClick, style }: ChatListItemProps) => {
  const { user: currentUser } = useAuthStore();
  const lastMessage = chat.lastMessage;
  const isTyping = chat.typing[user.uid];
  const isPinned = chat.pinnedBy.includes(currentUser?.uid || '');
  const unreadCount = chat.unreadCount[currentUser?.uid || ''] || 0;

  const getMessagePreview = () => {
    if (!lastMessage) return 'No messages yet';
    
    const isFromMe = lastMessage.senderId === currentUser?.uid;
    const prefix = isFromMe ? 'You: ' : '';

    switch (lastMessage.type) {
      case 'image':
        return (
          <span className="flex items-center gap-1">
            {prefix}<Image className="w-4 h-4" /> Photo
          </span>
        );
      case 'audio':
        return (
          <span className="flex items-center gap-1">
            {prefix}<Mic className="w-4 h-4" /> Voice message
          </span>
        );
      case 'video':
        return (
          <span className="flex items-center gap-1">
            {prefix}<Video className="w-4 h-4" /> Video
          </span>
        );
      case 'document':
        return (
          <span className="flex items-center gap-1">
            {prefix}<FileText className="w-4 h-4" /> Document
          </span>
        );
      default:
        return `${prefix}${lastMessage.content}`;
    }
  };

  const getStatusIcon = () => {
    if (!lastMessage || lastMessage.senderId !== currentUser?.uid) return null;

    switch (lastMessage.status) {
      case 'sending':
        return <div className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin" />;
      case 'sent':
        return <Check className="w-4 h-4 text-tick-sent" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-tick-delivered" />;
      case 'seen':
        return <CheckCheck className="w-4 h-4 text-tick-read" />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 cursor-pointer transition-all hover:bg-muted/50 animate-fade-up',
        isActive && 'bg-muted'
      )}
      style={style}
    >
      {/* Avatar */}
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.photoURL || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {user.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {user.online && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-online rounded-full border-2 border-card" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="font-medium text-foreground truncate">
            {user.displayName || formatPhoneDisplay(user.phone || '')}
          </h3>
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {lastMessage && formatDistanceToNow(lastMessage.timestamp, { addSuffix: false })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
            {getStatusIcon()}
            {isTyping ? (
              <span className="text-typing italic flex items-center gap-1">
                typing
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-typing rounded-full animate-typing" style={{ animationDelay: '0s' }} />
                  <span className="w-1 h-1 bg-typing rounded-full animate-typing" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1 h-1 bg-typing rounded-full animate-typing" style={{ animationDelay: '0.4s' }} />
                </span>
              </span>
            ) : (
              <span className="truncate">{getMessagePreview()}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {isPinned && <Pin className="w-3 h-3 text-muted-foreground" />}
            {unreadCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
