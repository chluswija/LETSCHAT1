import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { Status, User } from '@/types/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, X, Eye, ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface StatusViewerProps {
  statuses: Status[];
  user: User;
  onClose: () => void;
  onReply?: (statusId: string, message: string) => void;
}

// Status Viewer Component (full-screen story viewer)
export const StatusViewer = ({ statuses, user, onClose, onReply }: StatusViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const { user: currentUser } = useAuthStore();

  const currentStatus = statuses[currentIndex];
  const isOwnStatus = currentStatus?.ownerId === currentUser?.uid;

  useEffect(() => {
    if (isPaused) return;

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < statuses.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + 2; // 5 seconds per status (100/2 = 50 intervals * 100ms = 5s)
      });
    }, 100);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, isPaused, statuses.length, onClose]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleReply = () => {
    if (replyText.trim() && onReply) {
      onReply(currentStatus.id, replyText);
      setReplyText('');
    }
  };

  if (!currentStatus) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
        {statuses.map((_, index) => (
          <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{
                width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-white/20">
            <AvatarImage src={user.photoURL || undefined} />
            <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-medium">{user.displayName}</p>
            <p className="text-white/60 text-xs">
              {formatDistanceToNow(currentStatus.timestamp, { addSuffix: true })}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-white/80 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation areas */}
      <div className="absolute inset-0 flex">
        <button 
          className="w-1/3 h-full" 
          onClick={handlePrevious}
        />
        <div className="w-1/3 h-full" />
        <button 
          className="w-1/3 h-full" 
          onClick={handleNext}
        />
      </div>

      {/* Status content */}
      <div className="flex-1 flex items-center justify-center">
        {currentStatus.type === 'text' ? (
          <div 
            className="w-full h-full flex items-center justify-center p-8"
            style={{ backgroundColor: currentStatus.backgroundColor || '#075E54' }}
          >
            <p className="text-white text-2xl md:text-4xl font-medium text-center">
              {currentStatus.content}
            </p>
          </div>
        ) : currentStatus.type === 'image' ? (
          <img
            src={currentStatus.mediaUrl}
            alt="Status"
            className="max-w-full max-h-full object-contain"
          />
        ) : currentStatus.type === 'video' ? (
          <video
            src={currentStatus.mediaUrl}
            className="max-w-full max-h-full"
            autoPlay
            playsInline
            muted={false}
          />
        ) : null}
        
        {currentStatus.caption && (
          <div className="absolute bottom-24 left-0 right-0 px-4">
            <p className="text-white text-center bg-black/50 rounded-lg px-4 py-2">
              {currentStatus.caption}
            </p>
          </div>
        )}
      </div>

      {/* View count (for own status) */}
      {isOwnStatus && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center">
          <button className="flex items-center gap-2 text-white/80 bg-black/30 px-4 py-2 rounded-full">
            <Eye className="w-4 h-4" />
            <span>{Object.keys(currentStatus.viewedBy).length} views</span>
          </button>
        </div>
      )}

      {/* Reply input (for others' status) */}
      {!isOwnStatus && (
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Reply to status..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              onKeyPress={(e) => e.key === 'Enter' && handleReply()}
            />
            <Button
              size="icon"
              onClick={handleReply}
              disabled={!replyText.trim()}
              className="bg-primary"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white bg-black/20 rounded-full"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {currentIndex < statuses.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white bg-black/20 rounded-full"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

// Status Creation Component
interface StatusCreatorProps {
  onClose: () => void;
}

export const StatusCreator = ({ onClose }: StatusCreatorProps) => {
  const { user } = useAuthStore();
  const [type, setType] = useState<'text' | 'media'>('text');
  const [textContent, setTextContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#075E54');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backgroundColors = [
    '#075E54', '#128C7E', '#25D366', '#DCF8C6',
    '#34B7F1', '#00A884', '#667781', '#1F2C34',
    '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setType('media');
    }
  };

  const handlePost = async () => {
    if (!user) return;

    setIsUploading(true);
    try {
      let mediaUrl = '';
      let statusType: Status['type'] = 'text';

      if (mediaFile) {
        const result = await uploadToCloudinary(mediaFile, { folder: 'status' });
        mediaUrl = result.url;
        statusType = mediaFile.type.startsWith('video') ? 'video' : 'image';
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      await addDoc(collection(db, 'statuses'), {
        ownerId: user.uid,
        type: statusType,
        content: type === 'text' ? textContent : undefined,
        mediaUrl: mediaUrl || undefined,
        backgroundColor: type === 'text' ? backgroundColor : undefined,
        caption: caption || undefined,
        timestamp: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        viewedBy: {},
        privacy: 'contacts',
        muted: [],
      });

      onClose();
    } catch (error) {
      console.error('Error posting status:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
          <X className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <Button
            variant={type === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setType('text')}
          >
            Text
          </Button>
          <Button
            variant={type === 'media' ? 'default' : 'outline'}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Media
          </Button>
        </div>
        <Button 
          onClick={handlePost} 
          disabled={isUploading || (type === 'text' && !textContent)}
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {type === 'text' ? (
          <div 
            className="flex-1 flex items-center justify-center p-8"
            style={{ backgroundColor }}
          >
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Type a status..."
              className="w-full h-full bg-transparent text-white text-2xl md:text-4xl font-medium text-center resize-none focus:outline-none placeholder:text-white/50"
              maxLength={700}
            />
          </div>
        ) : mediaPreview ? (
          <div className="flex-1 flex items-center justify-center bg-black">
            {mediaFile?.type.startsWith('video') ? (
              <video src={mediaPreview} className="max-w-full max-h-full" controls />
            ) : (
              <img src={mediaPreview} alt="Preview" className="max-w-full max-h-full object-contain" />
            )}
          </div>
        ) : (
          <div 
            className="flex-1 flex items-center justify-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center text-muted-foreground">
              <Plus className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Click to add photo or video</p>
            </div>
          </div>
        )}

        {/* Color picker for text status */}
        {type === 'text' && (
          <div className="p-4 flex gap-2 justify-center overflow-x-auto">
            {backgroundColors.map((color) => (
              <button
                key={color}
                onClick={() => setBackgroundColor(color)}
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex-shrink-0',
                  backgroundColor === color ? 'border-white ring-2 ring-primary' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}

        {/* Caption for media */}
        {type === 'media' && mediaPreview && (
          <div className="p-4 border-t">
            <Input
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Status List Item
interface StatusListItemProps {
  user: User;
  statuses: Status[];
  onClick: () => void;
  isOwn?: boolean;
}

export const StatusListItem = ({ user, statuses, onClick, isOwn }: StatusListItemProps) => {
  const latestStatus = statuses[statuses.length - 1];
  const hasUnviewed = !isOwn && statuses.some(s => !s.viewedBy[user.uid]);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
    >
      <div className={cn(
        'relative p-0.5 rounded-full',
        hasUnviewed ? 'bg-gradient-to-r from-primary to-green-500' : 'bg-muted'
      )}>
        <Avatar className="h-12 w-12 border-2 border-background">
          <AvatarImage src={user.photoURL || undefined} />
          <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        {isOwn && (
          <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full border-2 border-background flex items-center justify-center">
            <Plus className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{isOwn ? 'My Status' : user.displayName}</p>
        <p className="text-sm text-muted-foreground">
          {isOwn 
            ? `${statuses.length} update${statuses.length > 1 ? 's' : ''}` 
            : formatDistanceToNow(latestStatus.timestamp, { addSuffix: true })}
        </p>
      </div>
    </button>
  );
};

export default StatusViewer;
