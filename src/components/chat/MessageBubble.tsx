import { useState, useRef } from 'react';
import { Message, User } from '@/types/chat';
import { 
  Check, 
  CheckCheck, 
  Clock, 
  Trash2, 
  Copy, 
  MoreVertical,
  Download,
  Play,
  Pause,
  FileText,
  MapPin,
  Forward,
  Star,
  Reply,
  Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
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
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const handleDownload = () => {
    if (message.mediaUrl) {
      const link = document.createElement('a');
      link.href = message.mediaUrl;
      link.download = message.fileName || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Downloaded', description: 'Media saved to your device' });
    }
  };

  const handleForward = () => {
    setShowForwardDialog(true);
    toast({ title: 'Forward', description: 'Select a chat to forward this message' });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        const shareData: any = { title: 'LetsChat Message' };
        
        if (message.content) {
          shareData.text = message.content;
        }
        
        if (message.mediaUrl) {
          shareData.url = message.mediaUrl;
        }
        
        await navigator.share(shareData);
        toast({ title: 'Shared', description: 'Message shared successfully' });
      } else {
        // Fallback: Copy to clipboard
        const textToCopy = message.content || message.mediaUrl || '';
        await navigator.clipboard.writeText(textToCopy);
        toast({ title: 'Copied', description: 'Message copied to clipboard for sharing' });
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast({ title: 'Error', description: 'Could not share message', variant: 'destructive' });
      }
    }
  };

  const toggleAudioPlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasReactions = Object.keys(message.reactions || {}).length > 0;

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
              <DropdownMenuItem className="gap-2">
                <Reply className="w-4 h-4" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleForward} className="gap-2">
                <Forward className="w-4 h-4" />
                Forward
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare} className="gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Star className="w-4 h-4" />
                Star
              </DropdownMenuItem>
              {message.mediaUrl && (
                <DropdownMenuItem onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download
                </DropdownMenuItem>
              )}
              {isOwn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDeleteMessage} className="gap-2 text-destructive">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          className={cn(
            'shadow-sm overflow-hidden',
            message.type === 'image' || message.type === 'video' ? 'rounded-xl' : 'px-3 py-2',
            isOwn
              ? 'message-bubble-sent bg-chat-bubble-sent'
              : 'message-bubble-received bg-chat-bubble-received'
          )}
        >
          {/* System message */}
          {message.type === 'system' && (
            <div className="text-center px-4 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              {message.content}
            </div>
          )}

          {/* Text message */}
          {message.type === 'text' && (
            <p className="text-foreground text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {/* Image message */}
          {message.type === 'image' && message.mediaUrl && (
            <div className="relative group/image">
              <div 
                className="cursor-pointer"
                onClick={() => setShowMediaPreview(true)}
              >
                <img 
                  src={message.mediaUrl} 
                  alt="Image"
                  className="max-w-full rounded-xl max-h-80 object-cover"
                  loading="lazy"
                />
                {message.caption && (
                  <p className="text-foreground text-sm p-2">{message.caption}</p>
                )}
              </div>
              {/* Quick Actions for Images */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur-sm"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleForward(); }}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur-sm"
                  title="Forward"
                >
                  <Forward className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleShare(); }}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur-sm"
                  title="Share"
                >
                  <Share2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Video message */}
          {message.type === 'video' && message.mediaUrl && (
            <div className="relative group/video">
              <div 
                className="cursor-pointer relative"
                onClick={() => setShowMediaPreview(true)}
              >
                <video 
                  ref={videoRef}
                  src={message.mediaUrl}
                  poster={message.thumbnail}
                  className="max-w-full rounded-xl max-h-80 object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-white" />
                  </div>
                </div>
                {message.caption && (
                  <p className="text-foreground text-sm p-2">{message.caption}</p>
                )}
              </div>
              {/* Quick Actions for Videos */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/video:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur-sm"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleForward(); }}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur-sm"
                  title="Forward"
                >
                  <Forward className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleShare(); }}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur-sm"
                  title="Share"
                >
                  <Share2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Voice message */}
          {message.type === 'voice' && message.mediaUrl && (
            <div className="flex items-center gap-3 min-w-[200px] px-3 py-2">
              <button 
                onClick={toggleAudioPlay}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
              <div className="flex-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/50 w-0" />
                </div>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {message.duration ? formatDuration(message.duration) : '0:00'}
                </span>
              </div>
              <audio 
                ref={audioRef}
                src={message.mediaUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>
          )}

          {/* Document message */}
          {message.type === 'document' && message.mediaUrl && (
            <div 
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/10"
              onClick={handleDownload}
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.fileName || 'Document'}</p>
                <p className="text-xs text-muted-foreground">
                  {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : 'Tap to download'}
                </p>
              </div>
              <Download className="w-5 h-5 text-muted-foreground" />
            </div>
          )}

          {/* Location message */}
          {message.type === 'location' && message.location && (
            <a 
              href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="w-60 h-32 bg-muted rounded-xl flex items-center justify-center">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm p-2 text-primary">Open in Maps</p>
            </a>
          )}

          {/* Timestamp and status */}
          {message.type !== 'system' && (
            <div className={cn(
              'flex items-center gap-1 mt-1',
              message.type === 'image' || message.type === 'video' ? 'absolute bottom-2 right-2 bg-black/50 px-1.5 py-0.5 rounded' : '',
              isOwn ? 'justify-end' : 'justify-start'
            )}>
              <span className={cn(
                "text-[10px]",
                message.type === 'image' || message.type === 'video' ? 'text-white' : 'text-muted-foreground'
              )}>
                {format(message.timestamp, 'HH:mm')}
              </span>
              {isOwn && getStatusIcon()}
            </div>
          )}
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className={cn(
            'absolute -bottom-3 px-1.5 py-0.5 bg-card rounded-full shadow-sm border border-border flex items-center gap-0.5',
            isOwn ? 'right-2' : 'left-2'
          )}>
            {Object.values(message.reactions || {}).map((emoji, i) => (
              <span key={i} className="text-xs">{String(emoji)}</span>
            ))}
          </div>
        )}

        {/* Message tail */}
        {message.type !== 'system' && message.type !== 'image' && message.type !== 'video' && (
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
        )}
      </div>

      {/* Media Preview Dialog */}
      <Dialog open={showMediaPreview} onOpenChange={setShowMediaPreview}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          {message.type === 'image' && message.mediaUrl && (
            <img 
              src={message.mediaUrl} 
              alt="Preview"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
          {message.type === 'video' && message.mediaUrl && (
            <video 
              src={message.mediaUrl}
              controls
              autoPlay
              className="w-full h-auto max-h-[90vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
