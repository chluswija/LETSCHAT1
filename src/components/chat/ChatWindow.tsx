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
  MessageCircle,
  X,
  StopCircle
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
import { uploadToCloudinary } from '@/lib/cloudinary';
import { toast } from '@/hooks/use-toast';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
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
  const [savedContactName, setSavedContactName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch chat partner info
  useEffect(() => {
    if (!activeChat || !currentUser?.uid) {
      setChatPartner(null);
      setSavedContactName(null);
      return;
    }

    const otherUserId = activeChat.participants.find(p => p !== currentUser.uid);
    if (!otherUserId) return;

    const fetchPartner = async () => {
      try {
        // Fetch user data
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

        // Fetch saved contact name
        const contactsRef = collection(db, 'users', currentUser.uid, 'contacts');
        const contactQuery = query(contactsRef);
        const contactsSnap = await getDocs(contactQuery);
        let foundContactName: string | null = null;
        contactsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.userId === otherUserId) {
            foundContactName = data.name;
          }
        });
        setSavedContactName(foundContactName);
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

      // Mark messages as seen
      if (currentUser?.uid && messagesData.length > 0) {
        const unseenMessages = messagesData.filter(
          (msg) => msg.senderId !== currentUser.uid && msg.status !== 'seen'
        );
        unseenMessages.forEach(async (msg) => {
          try {
            const msgRef = doc(db, 'chats', activeChat.id, 'messages', msg.id);
            await updateDoc(msgRef, { status: 'seen' });
          } catch (error) {
            console.error('Error marking message as seen:', error);
          }
        });
      }
    }, (error) => {
      console.error('Error fetching messages:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [activeChat?.id, setMessages, currentUser?.uid]);

  // Listen for typing status from other user
  useEffect(() => {
    if (!activeChat?.id) return;

    const chatRef = doc(db, 'chats', activeChat.id);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const otherUserId = activeChat.participants.find(p => p !== currentUser?.uid);
        if (otherUserId && data.typing?.[otherUserId]) {
          setIsTyping(true);
        } else {
          setIsTyping(false);
        }
      }
    });

    return () => unsubscribe();
  }, [activeChat?.id, activeChat?.participants, currentUser?.uid]);

  // Update typing status when user types
  const updateTypingStatus = async (typing: boolean) => {
    if (!activeChat?.id || !currentUser?.uid) return;
    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        [`typing.${currentUser.uid}`]: typing,
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  // Debounced typing indicator
  useEffect(() => {
    if (message.trim()) {
      updateTypingStatus(true);
      const timeout = setTimeout(() => {
        updateTypingStatus(false);
      }, 2000);
      return () => clearTimeout(timeout);
    } else {
      updateTypingStatus(false);
    }
  }, [message, activeChat?.id, currentUser?.uid]);

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

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 50MB', variant: 'destructive' });
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(file));
    }
    setShowAttachMenu(false);
  };

  // Cancel file selection
  const cancelFileSelection = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send media message
  const handleSendMedia = async () => {
    if (!selectedFile || !activeChat?.id || !currentUser?.uid) return;

    setIsSending(true);
    setUploadProgress(0);

    try {
      const result = await uploadToCloudinary(selectedFile, {
        folder: 'messages',
        onProgress: (p) => setUploadProgress(p.percent),
      });

      const isImage = selectedFile.type.startsWith('image/');
      const isVideo = selectedFile.type.startsWith('video/');
      const messageType = isImage ? 'image' : isVideo ? 'video' : 'document';

      const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
      await addDoc(messagesRef, {
        chatId: activeChat.id,
        senderId: currentUser.uid,
        content: '',
        type: messageType,
        mediaUrl: result.url,
        thumbnail: result.thumbnail,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        caption: message.trim() || undefined,
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
          type: messageType,
          content: messageType === 'image' ? '📷 Photo' : messageType === 'video' ? '🎥 Video' : '📄 Document',
          timestamp: new Date(),
        },
        lastMessageAt: serverTimestamp(),
      });

      cancelFileSelection();
      setMessage('');
    } catch (error) {
      console.error('Error sending media:', error);
      toast({ title: 'Failed to send', variant: 'destructive' });
    } finally {
      setIsSending(false);
      setUploadProgress(0);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({ title: 'Cannot access microphone', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    if (!activeChat?.id || !currentUser?.uid || audioChunksRef.current.length === 0) return;

    setIsSending(true);
    try {
      const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
      const result = await uploadToCloudinary(audioFile, { folder: 'voice' });

      const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
      await addDoc(messagesRef, {
        chatId: activeChat.id,
        senderId: currentUser.uid,
        content: '',
        type: 'voice',
        mediaUrl: result.url,
        duration: recordingTime,
        timestamp: serverTimestamp(),
        status: 'sent',
        forwarded: false,
        deletedForEveryone: false,
        deletedFor: [],
        reactions: {},
      });

      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        lastMessage: { type: 'voice', content: '🎤 Voice message', timestamp: new Date() },
        lastMessageAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast({ title: 'Failed to send voice message', variant: 'destructive' });
    } finally {
      setIsSending(false);
      setRecordingTime(0);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  // Use the chat partner or provided otherUser
  const displayUser = otherUser || chatPartner;
  // Prefer saved contact name, then user's display name, then phone
  const displayName = savedContactName || displayUser?.displayName || formatPhoneDisplay(displayUser?.phone || '') || 'Loading...';

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
            {displayName?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 cursor-pointer">
          <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
          <p className="text-xs text-muted-foreground">
            {isTyping ? (
              <span className="text-primary flex items-center gap-1">
                typing
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </span>
              </span>
            ) : displayUser?.online ? (
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
              chatId={activeChat?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border p-3">
        {/* File Preview */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              {filePreview && selectedFile.type.startsWith('image/') && (
                <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
              )}
              {filePreview && selectedFile.type.startsWith('video/') && (
                <video src={filePreview} className="w-16 h-16 object-cover rounded" />
              )}
              {!filePreview && (
                <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {uploadProgress > 0 && (
                  <div className="mt-1 h-1 bg-muted-foreground/20 rounded overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${uploadProgress}%` }} 
                    />
                  </div>
                )}
              </div>
              <button onClick={cancelFileSelection} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Recording UI */}
        {isRecording ? (
          <div className="flex items-center gap-3 p-2 bg-destructive/10 rounded-xl">
            <button 
              onClick={cancelRecording}
              className="p-2 hover:bg-destructive/20 rounded-full"
            >
              <X className="w-5 h-5 text-destructive" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-destructive font-medium">{formatRecordingTime(recordingTime)}</span>
            </div>
            <button 
              onClick={stopRecording}
              className="p-2 bg-primary hover:bg-primary/90 rounded-full"
            >
              <Send className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        ) : (
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
                    { icon: Image, label: 'Photos', color: 'bg-purple-500', accept: 'image/*' },
                    { icon: Camera, label: 'Camera', color: 'bg-pink-500', accept: 'image/*;capture=camera' },
                    { icon: FileText, label: 'Document', color: 'bg-blue-500', accept: '*/*' },
                    { icon: UserIcon, label: 'Contact', color: 'bg-cyan-500', accept: '' },
                    { icon: MapPin, label: 'Location', color: 'bg-green-500', accept: '' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      className="flex flex-col items-center gap-1 p-3 hover:bg-muted rounded-xl transition-colors"
                      onClick={() => {
                        if (item.accept) {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = item.accept;
                          input.onchange = (e) => handleFileSelect(e as any);
                          input.click();
                        }
                        setShowAttachMenu(false);
                      }}
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
                placeholder={selectedFile ? "Add a caption..." : "Type a message"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className="h-11 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl pr-12"
              />
            </div>

            <button
              onClick={() => {
                if (selectedFile) {
                  handleSendMedia();
                } else if (message.trim() && !isSending) {
                  handleSendMessage();
                } else if (!message.trim() && !isSending) {
                  startRecording();
                }
              }}
              disabled={isSending}
              className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
                (message.trim() || selectedFile) && !isSending
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {isSending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : message.trim() || selectedFile ? (
                <Send className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
