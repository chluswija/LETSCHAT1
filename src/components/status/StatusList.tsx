import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  Image,
  Type,
  Loader2,
  MoreVertical,
  Trash2,
  Play,
  Pause
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Status types
interface Status {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto: string | null;
  type: 'text' | 'image' | 'video';
  content?: string;
  backgroundColor?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  caption?: string;
  visibility: 'everyone' | 'contacts' | 'selected';
  visibleTo: string[];
  viewedBy: { viewerId: string; viewedAt: Date }[];
  timestamp: Date;
  expiresAt: Date;
}

interface StatusGroup {
  userId: string;
  userName: string;
  userPhoto: string | null;
  statuses: Status[];
  hasUnviewed: boolean;
}

// Background color options for text status
const STATUS_COLORS = [
  'bg-gradient-to-br from-green-500 to-emerald-600',
  'bg-gradient-to-br from-blue-500 to-indigo-600',
  'bg-gradient-to-br from-purple-500 to-pink-600',
  'bg-gradient-to-br from-orange-500 to-red-600',
  'bg-gradient-to-br from-cyan-500 to-blue-600',
  'bg-gradient-to-br from-pink-500 to-rose-600',
  'bg-gradient-to-br from-yellow-500 to-orange-600',
  'bg-gradient-to-br from-teal-500 to-green-600',
];

// ==================== STATUS LIST ====================
export const StatusList = () => {
  const { user } = useAuthStore();
  const [statuses, setStatuses] = useState<StatusGroup[]>([]);
  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StatusGroup | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch statuses
  useEffect(() => {
    if (!user?.uid) return;

    const now = new Date();
    const statusesRef = collection(db, 'statuses');
    
    // Query for non-expired statuses
    const q = query(
      statusesRef,
      where('expiresAt', '>', Timestamp.fromDate(now)),
      orderBy('expiresAt', 'desc'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allStatuses: Status[] = [];
      const myStatusList: Status[] = [];
      const groupMap = new Map<string, StatusGroup>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const status: Status = {
          id: docSnap.id,
          ownerId: data.ownerId,
          ownerName: data.ownerName,
          ownerPhoto: data.ownerPhoto,
          type: data.type,
          content: data.content,
          backgroundColor: data.backgroundColor,
          mediaUrl: data.mediaUrl,
          mediaThumbnail: data.mediaThumbnail,
          caption: data.caption,
          visibility: data.visibility,
          visibleTo: data.visibleTo || [],
          viewedBy: data.viewedBy || [],
          timestamp: data.timestamp?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
        };

        // Check visibility
        const canView = 
          status.ownerId === user.uid ||
          status.visibility === 'everyone' ||
          (status.visibility === 'contacts' && user.contacts?.includes(status.ownerId)) ||
          (status.visibility === 'selected' && status.visibleTo.includes(user.uid));

        if (!canView) return;

        if (status.ownerId === user.uid) {
          myStatusList.push(status);
        } else {
          allStatuses.push(status);
          
          // Group by user
          if (!groupMap.has(status.ownerId)) {
            groupMap.set(status.ownerId, {
              userId: status.ownerId,
              userName: status.ownerName,
              userPhoto: status.ownerPhoto,
              statuses: [],
              hasUnviewed: false,
            });
          }
          
          const group = groupMap.get(status.ownerId)!;
          group.statuses.push(status);
          
          // Check if user has viewed this status
          if (!status.viewedBy.some(v => v.viewerId === user.uid)) {
            group.hasUnviewed = true;
          }
        }
      });

      setMyStatuses(myStatusList);
      setStatuses(Array.from(groupMap.values()));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.contacts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* My Status */}
      <div className="p-4 border-b border-border">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
          onClick={() => myStatuses.length > 0 
            ? setSelectedGroup({
                userId: user!.uid,
                userName: 'My Status',
                userPhoto: user!.photoURL,
                statuses: myStatuses,
                hasUnviewed: false,
              })
            : setShowCreateDialog(true)
          }
        >
          <div className="relative">
            <Avatar className={cn(
              "h-14 w-14 ring-2",
              myStatuses.length > 0 ? "ring-primary" : "ring-muted"
            )}>
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {user?.displayName?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreateDialog(true); }}
              className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-card"
            >
              <Plus className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">My Status</p>
            <p className="text-sm text-muted-foreground">
              {myStatuses.length > 0 
                ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
                : 'Tap to add status update'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Recent Updates */}
      <div className="flex-1 overflow-y-auto">
        {statuses.length > 0 && (
          <>
            <p className="px-4 py-2 text-sm font-medium text-muted-foreground">
              Recent updates
            </p>
            {statuses.map((group) => (
              <div
                key={group.userId}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedGroup(group)}
              >
                <Avatar className={cn(
                  "h-12 w-12 ring-2",
                  group.hasUnviewed ? "ring-primary" : "ring-muted"
                )}>
                  <AvatarImage src={group.userPhoto || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {group.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{group.userName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(group.statuses[0].timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}

        {statuses.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Eye className="w-12 h-12 mb-3 opacity-30" />
            <p>No status updates</p>
            <p className="text-sm">Status updates from contacts will appear here</p>
          </div>
        )}
      </div>

      {/* Create Status Dialog */}
      <CreateStatusDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />

      {/* Status Viewer */}
      {selectedGroup && (
        <StatusViewer
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
};

// ==================== CREATE STATUS DIALOG ====================
interface CreateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateStatusDialog = ({ open, onOpenChange }: CreateStatusDialogProps) => {
  const { user } = useAuthStore();
  const [type, setType] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(STATUS_COLORS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type and size
      const isImage = selectedFile.type.startsWith('image/');
      const isVideo = selectedFile.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        toast({ title: 'Invalid file type', variant: 'destructive' });
        return;
      }
      
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
        toast({ title: 'File too large (max 50MB)', variant: 'destructive' });
        return;
      }

      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setType('media');
    }
  };

  const handlePost = async () => {
    if (!user?.uid) return;
    
    if (type === 'text' && !text.trim()) {
      toast({ title: 'Enter some text', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      let mediaUrl: string | undefined;
      let mediaThumbnail: string | undefined;
      let mediaType: 'text' | 'image' | 'video' = 'text';

      if (file) {
        const result = await uploadToCloudinary(file, {
          folder: 'status',
          onProgress: (p) => console.log('Upload:', p.percent + '%'),
        });
        mediaUrl = result.url;
        mediaThumbnail = result.thumbnail;
        mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await addDoc(collection(db, 'statuses'), {
        ownerId: user.uid,
        ownerName: user.displayName,
        ownerPhoto: user.photoURL,
        type: file ? mediaType : 'text',
        content: type === 'text' ? text : undefined,
        backgroundColor: type === 'text' ? bgColor : undefined,
        mediaUrl,
        mediaThumbnail,
        caption: caption || undefined,
        visibility: 'contacts',
        visibleTo: [],
        viewedBy: [],
        timestamp: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      });

      toast({ title: 'Status posted!' });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error posting status:', error);
      toast({ title: 'Failed to post status', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setText('');
    setFile(null);
    setPreview(null);
    setCaption('');
    setType('text');
    setBgColor(STATUS_COLORS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Status</DialogTitle>
        </DialogHeader>

        {/* Type selector */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={type === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setType('text'); setFile(null); setPreview(null); }}
            className="flex-1"
          >
            <Type className="w-4 h-4 mr-2" />
            Text
          </Button>
          <Button
            variant={type === 'media' ? 'default' : 'outline'}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <Image className="w-4 h-4 mr-2" />
            Photo/Video
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text status */}
        {type === 'text' && (
          <div className="space-y-4">
            <div 
              className={cn(
                "w-full aspect-square rounded-xl flex items-center justify-center p-6",
                bgColor
              )}
            >
              <Textarea
                placeholder="Type a status..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="bg-transparent border-0 text-white text-xl text-center resize-none focus-visible:ring-0 placeholder:text-white/50"
                maxLength={500}
              />
            </div>
            
            {/* Color picker */}
            <div className="flex gap-2 justify-center">
              {STATUS_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setBgColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full",
                    color,
                    bgColor === color && "ring-2 ring-offset-2 ring-primary"
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* Media preview */}
        {preview && (
          <div className="space-y-4">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-black">
              {file?.type.startsWith('video/') ? (
                <video src={preview} className="w-full h-full object-contain" controls />
              ) : (
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              )}
              <button
                onClick={() => { setFile(null); setPreview(null); setType('text'); }}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <Input
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
            />
          </div>
        )}

        {/* Post button */}
        <Button
          onClick={handlePost}
          disabled={isUploading || (type === 'text' && !text.trim()) || (type === 'media' && !file)}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Post Status
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

// ==================== STATUS VIEWER ====================
interface StatusViewerProps {
  group: StatusGroup;
  onClose: () => void;
}

const StatusViewer = ({ group, onClose }: StatusViewerProps) => {
  const { user } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const currentStatus = group.statuses[currentIndex];
  const isOwner = currentStatus?.ownerId === user?.uid;

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || !currentStatus) return;

    const duration = currentStatus.type === 'video' ? 30000 : 5000; // 30s for video, 5s for others
    const interval = 50;
    let elapsed = 0;

    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / duration) * 100);

      if (elapsed >= duration) {
        if (currentIndex < group.statuses.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setProgress(0);
        } else {
          onClose();
        }
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, currentStatus, group.statuses.length, onClose]);

  // Mark as viewed
  useEffect(() => {
    if (!currentStatus || !user?.uid || isOwner) return;
    
    const hasViewed = currentStatus.viewedBy.some(v => v.viewerId === user.uid);
    if (!hasViewed) {
      updateDoc(doc(db, 'statuses', currentStatus.id), {
        viewedBy: arrayUnion({
          viewerId: user.uid,
          viewedAt: new Date(),
        }),
      }).catch(console.error);
    }
  }, [currentStatus, user?.uid, isOwner]);

  const goNext = () => {
    if (currentIndex < group.statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!currentStatus || !isOwner) return;
    try {
      await deleteDoc(doc(db, 'statuses', currentStatus.id));
      toast({ title: 'Status deleted' });
      if (group.statuses.length === 1) {
        onClose();
      } else {
        goNext();
      }
    } catch (error) {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  if (!currentStatus) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
        {group.statuses.map((_, index) => (
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
      <div className="absolute top-4 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6 text-white" />
          </button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={group.userPhoto || undefined} />
            <AvatarFallback>{group.userName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-medium">{group.userName}</p>
            <p className="text-white/70 text-sm">
              {formatDistanceToNow(currentStatus.timestamp, { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            {isPaused ? (
              <Play className="w-5 h-5 text-white" />
            ) : (
              <Pause className="w-5 h-5 text-white" />
            )}
          </button>
          {isOwner && (
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-white/10 rounded-full"
            >
              <Trash2 className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div 
        className="flex-1 flex items-center justify-center"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width / 3) goPrev();
          else if (x > (rect.width * 2) / 3) goNext();
        }}
      >
        {currentStatus.type === 'text' ? (
          <div 
            className={cn(
              "w-full h-full flex items-center justify-center p-8",
              currentStatus.backgroundColor
            )}
          >
            <p className="text-white text-2xl text-center font-medium">
              {currentStatus.content}
            </p>
          </div>
        ) : currentStatus.type === 'video' ? (
          <video
            src={currentStatus.mediaUrl}
            className="max-w-full max-h-full object-contain"
            autoPlay
            playsInline
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
          />
        ) : (
          <img
            src={currentStatus.mediaUrl}
            alt="Status"
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Caption */}
      {currentStatus.caption && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-center">{currentStatus.caption}</p>
        </div>
      )}

      {/* Views count (for owner) */}
      {isOwner && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white/70">
          <Eye className="w-5 h-5" />
          <span>{currentStatus.viewedBy.length} views</span>
        </div>
      )}

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
      )}
      {currentIndex < group.statuses.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      )}
    </div>
  );
};
