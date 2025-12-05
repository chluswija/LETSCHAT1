import { useState } from 'react';
import { Message, User } from '@/types/chat';
import { Check, CheckCheck, Clock, Trash2, Copy, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  user?: User;
  chatId?: string;
}

export const MessageBubble = ({ message, isOwn, showAvatar, user, chatId }: MessageBubbleProps) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-tick-sent" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-tick-delivered" />;
      case 'seen':
        return <CheckCheck className="w-3.5 h-3.5 text-tick-read" />;
      default:
        return null;
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    toast({ title: 'Copied', description: 'Message copied to clipboard' });
  };

  const handleDeleteMessage = async () => {
    if (!chatId) return;
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', message.id));
      toast({ title: 'Deleted', description: 'Message deleted' });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  };

  const hasReactions = Object.keys(message.reactions).length > 0;

  return (
    <div
      className={cn(
        'flex animate-fade-up',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] relative group',
          isOwn ? 'animate-slide-in-right' : 'animate-slide-in-left'
        )}
      >
        {/* Message Options Menu */}
        <div className={cn(
          'absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10',
          isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full bg-card/80 hover:bg-card shadow-sm">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
              <DropdownMenuItem onClick={handleCopyMessage} className="gap-2">
                <Copy className="w-4 h-4" />
                Copy
              </DropdownMenuItem>
              {isOwn && (
                <DropdownMenuItem onClick={handleDeleteMessage} className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          className={cn(
            'px-3 py-2 shadow-sm',
            isOwn
              ? 'message-bubble-sent bg-chat-bubble-sent'
              : 'message-bubble-received bg-chat-bubble-received'
          )}
        >
          {/* Message content */}
          {message.type === 'text' && (
            <p className="text-foreground text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {/* Timestamp and status */}
          <div className={cn(
            'flex items-center gap-1 mt-1',
            isOwn ? 'justify-end' : 'justify-start'
          )}>
            <span className="text-[10px] text-muted-foreground">
              {format(message.timestamp, 'HH:mm')}
            </span>
            {isOwn && getStatusIcon()}
          </div>
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className={cn(
            'absolute -bottom-3 px-1.5 py-0.5 bg-card rounded-full shadow-sm border border-border flex items-center gap-0.5',
            isOwn ? 'right-2' : 'left-2'
          )}>
            {Object.values(message.reactions).map((emoji, i) => (
              <span key={i} className="text-xs">{emoji}</span>
            ))}
          </div>
        )}

        {/* Message tail */}
        <div
          className={cn(
            'absolute top-0 w-3 h-3',
            isOwn
              ? '-right-1.5 bg-chat-bubble-sent'
              : '-left-1.5 bg-chat-bubble-received'
          )}
          style={{
            clipPath: isOwn
              ? 'polygon(0 0, 100% 0, 0 100%)'
              : 'polygon(100% 0, 0 0, 100% 100%)',
          }}
        />
      </div>
    </div>
  );
};
