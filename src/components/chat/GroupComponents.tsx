import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import {
  Users,
  Camera,
  X,
  ChevronRight,
  UserPlus,
  LogOut,
  Trash2,
  Shield,
  Bell,
  BellOff,
  Link,
  Crown,
  Loader2,
  Search,
  Check,
  MessageSquare,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Types
interface GroupMember {
  userId: string;
  displayName: string;
  photoURL: string | null;
  role: 'admin' | 'member';
  joinedAt: Date;
}

interface GroupChat {
  id: string;
  name: string;
  description: string;
  photoURL: string | null;
  createdBy: string;
  createdAt: Date;
  members: string[];
  admins: string[];
  settings: {
    onlyAdminsCanMessage: boolean;
    onlyAdminsCanEditInfo: boolean;
    onlyAdminsCanAddMembers: boolean;
  };
}

interface UserSearchResult {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  phoneNumber: string | null;
}

// ==================== CREATE GROUP DIALOG ====================
interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated?: (groupId: string) => void;
}

export const CreateGroupDialog = ({ open, onOpenChange, onGroupCreated }: CreateGroupDialogProps) => {
  const { user } = useAuthStore();
  const [step, setStep] = useState<'members' | 'details'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff')
        );
        
        const snapshot = await getDocs(q);
        const results: UserSearchResult[] = [];
        
        snapshot.forEach((doc) => {
          if (doc.id !== user?.uid) {
            results.push({
              id: doc.id,
              displayName: doc.data().displayName,
              email: doc.data().email,
              photoURL: doc.data().photoURL,
              phoneNumber: doc.data().phoneNumber,
            });
          }
        });
        
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user?.uid]);

  const toggleMember = (member: UserSearchResult) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === member.id);
      if (exists) {
        return prev.filter(m => m.id !== member.id);
      }
      return [...prev, member];
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Image too large (max 5MB)', variant: 'destructive' });
        return;
      }
      setGroupPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleCreate = async () => {
    if (!user?.uid || !groupName.trim()) return;
    
    setIsCreating(true);
    try {
      let photoURL: string | null = null;
      
      if (groupPhoto) {
        const result = await uploadToCloudinary(groupPhoto, { folder: 'groups' });
        photoURL = result.url;
      }

      const memberIds = [user.uid, ...selectedMembers.map(m => m.id)];
      
      const groupRef = await addDoc(collection(db, 'conversations'), {
        type: 'group',
        name: groupName.trim(),
        description: groupDescription.trim(),
        photoURL,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        members: memberIds,
        admins: [user.uid],
        settings: {
          onlyAdminsCanMessage: false,
          onlyAdminsCanEditInfo: true,
          onlyAdminsCanAddMembers: false,
        },
        lastMessage: null,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add system message
      await addDoc(collection(db, 'conversations', groupRef.id, 'messages'), {
        type: 'system',
        content: `${user.displayName} created group "${groupName.trim()}"`,
        timestamp: serverTimestamp(),
      });

      toast({ title: 'Group created!' });
      onGroupCreated?.(groupRef.id);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast({ title: 'Failed to create group', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setStep('members');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedMembers([]);
    setGroupName('');
    setGroupDescription('');
    setGroupPhoto(null);
    setPhotoPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'members' ? 'Add Participants' : 'New Group'}
          </DialogTitle>
        </DialogHeader>

        {step === 'members' && (
          <>
            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
                {selectedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full"
                  >
                    <span className="text-sm">{member.displayName}</span>
                    <button onClick={() => toggleMember(member)}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search results */}
            <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
              {isSearching && (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              
              {searchResults.map((result) => {
                const isSelected = selectedMembers.some(m => m.id === result.id);
                return (
                  <div
                    key={result.id}
                    onClick={() => toggleMember(result)}
                    className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer rounded-lg"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={result.photoURL || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {result.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{result.displayName}</p>
                      <p className="text-sm text-muted-foreground">{result.phoneNumber || result.email}</p>
                    </div>
                    <Checkbox checked={isSelected} />
                  </div>
                );
              })}

              {searchQuery && !isSearching && searchResults.length === 0 && (
                <p className="text-center text-muted-foreground p-4">No users found</p>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button
                onClick={() => setStep('details')}
                disabled={selectedMembers.length === 0}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'details' && (
          <>
            {/* Group photo */}
            <div className="flex justify-center">
              <div 
                className="relative cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar className="h-24 w-24">
                  <AvatarImage src={photoPreview || undefined} />
                  <AvatarFallback className="bg-primary/10">
                    <Users className="w-10 h-10 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full">
                  <Camera className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Group name */}
            <Input
              placeholder="Group name (required)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />

            {/* Description */}
            <Textarea
              placeholder="Group description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              maxLength={200}
              rows={3}
            />

            {/* Members preview */}
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">Participants: {selectedMembers.length + 1}</p>
              <div className="flex -space-x-2">
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarImage src={user?.photoURL || undefined} />
                  <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                {selectedMembers.slice(0, 5).map((member) => (
                  <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={member.photoURL || undefined} />
                    <AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
                {selectedMembers.length > 5 && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                    +{selectedMembers.length - 5}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('members')}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!groupName.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Create Group
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ==================== GROUP INFO SHEET ====================
interface GroupInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
}

export const GroupInfoSheet = ({ open, onOpenChange, groupId }: GroupInfoSheetProps) => {
  const { user } = useAuthStore();
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const isAdmin = group?.admins.includes(user?.uid || '');

  // Fetch group data
  useEffect(() => {
    if (!groupId || !open) return;

    const unsubscribe = onSnapshot(doc(db, 'conversations', groupId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroup({
          id: docSnap.id,
          name: data.name,
          description: data.description,
          photoURL: data.photoURL,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate(),
          members: data.members,
          admins: data.admins,
          settings: data.settings,
        });

        // Fetch member details
        const memberDetails: GroupMember[] = [];
        for (const memberId of data.members) {
          const userDoc = await getDoc(doc(db, 'users', memberId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            memberDetails.push({
              userId: memberId,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
              role: data.admins.includes(memberId) ? 'admin' : 'member',
              joinedAt: new Date(),
            });
          }
        }
        setMembers(memberDetails);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, open]);

  const makeAdmin = async (memberId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'conversations', groupId), {
        admins: arrayUnion(memberId),
      });
      toast({ title: 'Member is now an admin' });
    } catch (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const removeAdmin = async (memberId: string) => {
    if (!isAdmin || memberId === group?.createdBy) return;
    try {
      await updateDoc(doc(db, 'conversations', groupId), {
        admins: arrayRemove(memberId),
      });
      toast({ title: 'Admin removed' });
    } catch (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const removeMember = async (memberId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'conversations', groupId), {
        members: arrayRemove(memberId),
        admins: arrayRemove(memberId),
      });
      // Add system message
      const member = members.find(m => m.userId === memberId);
      await addDoc(collection(db, 'conversations', groupId, 'messages'), {
        type: 'system',
        content: `${member?.displayName} was removed from the group`,
        timestamp: serverTimestamp(),
      });
      toast({ title: 'Member removed' });
    } catch (error) {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    }
  };

  const exitGroup = async () => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'conversations', groupId), {
        members: arrayRemove(user.uid),
        admins: arrayRemove(user.uid),
      });
      await addDoc(collection(db, 'conversations', groupId, 'messages'), {
        type: 'system',
        content: `${user.displayName} left the group`,
        timestamp: serverTimestamp(),
      });
      toast({ title: 'You left the group' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to exit', variant: 'destructive' });
    }
  };

  const deleteGroup = async () => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'conversations', groupId));
      toast({ title: 'Group deleted' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  if (!group || isLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Group Info</SheetTitle>
          </SheetHeader>

          {/* Header */}
          <div className="bg-primary/5 p-6 text-center">
            <Avatar className="h-24 w-24 mx-auto mb-4">
              <AvatarImage src={group.photoURL || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                <Users className="w-10 h-10" />
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-semibold">{group.name}</h2>
            <p className="text-muted-foreground text-sm">
              Group · {members.length} participant{members.length !== 1 ? 's' : ''}
            </p>
          </div>

          <ScrollArea className="flex-1">
            {/* Description */}
            {group.description && (
              <div className="p-4 border-b">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p>{group.description}</p>
              </div>
            )}

            {/* Actions */}
            <div className="p-4 space-y-2 border-b">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg"
              >
                {isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                <span>{isMuted ? 'Unmute notifications' : 'Mute notifications'}</span>
              </button>
              
              {isAdmin && (
                <button
                  onClick={() => setShowAddMembers(true)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg text-primary"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Add participants</span>
                </button>
              )}
            </div>

            {/* Members */}
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-3">
                {members.length} participant{members.length !== 1 ? 's' : ''}
              </p>
              
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg group"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.photoURL || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {member.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {member.userId === user?.uid ? 'You' : member.displayName}
                      </span>
                      {member.role === 'admin' && (
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                          Admin
                        </span>
                      )}
                      {member.userId === group.createdBy && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                  
                  {isAdmin && member.userId !== user?.uid && (
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                      {member.role !== 'admin' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => makeAdmin(member.userId)}
                          title="Make admin"
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                      ) : member.userId !== group.createdBy && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAdmin(member.userId)}
                          title="Remove admin"
                        >
                          <Shield className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(member.userId)}
                        title="Remove member"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Exit / Delete */}
            <div className="p-4 border-t">
              <button
                onClick={() => setShowExitConfirm(true)}
                className="w-full flex items-center gap-3 p-3 hover:bg-destructive/10 rounded-lg text-destructive"
              >
                <LogOut className="w-5 h-5" />
                <span>Exit group</span>
              </button>
              
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-destructive/10 rounded-lg text-destructive"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete group</span>
                </button>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Members Dialog */}
      <AddMembersDialog
        open={showAddMembers}
        onOpenChange={setShowAddMembers}
        groupId={groupId}
        existingMembers={members.map(m => m.userId)}
      />

      {/* Exit Confirmation */}
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit "{group.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer receive messages from this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={exitGroup} className="bg-destructive text-destructive-foreground">
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All messages and media will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteGroup} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ==================== ADD MEMBERS DIALOG ====================
interface AddMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  existingMembers: string[];
}

const AddMembersDialog = ({ open, onOpenChange, groupId, existingMembers }: AddMembersDialogProps) => {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff')
        );
        
        const snapshot = await getDocs(q);
        const results: UserSearchResult[] = [];
        
        snapshot.forEach((doc) => {
          // Exclude self and existing members
          if (doc.id !== user?.uid && !existingMembers.includes(doc.id)) {
            results.push({
              id: doc.id,
              displayName: doc.data().displayName,
              email: doc.data().email,
              photoURL: doc.data().photoURL,
              phoneNumber: doc.data().phoneNumber,
            });
          }
        });
        
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user?.uid, existingMembers]);

  const toggleMember = (member: UserSearchResult) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === member.id);
      if (exists) {
        return prev.filter(m => m.id !== member.id);
      }
      return [...prev, member];
    });
  };

  const handleAdd = async () => {
    if (selectedMembers.length === 0) return;
    
    setIsAdding(true);
    try {
      const newMemberIds = selectedMembers.map(m => m.id);
      
      await updateDoc(doc(db, 'conversations', groupId), {
        members: arrayUnion(...newMemberIds),
      });

      // Add system message
      const names = selectedMembers.map(m => m.displayName).join(', ');
      await addDoc(collection(db, 'conversations', groupId, 'messages'), {
        type: 'system',
        content: `${user?.displayName} added ${names}`,
        timestamp: serverTimestamp(),
      });

      toast({ title: `Added ${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''}` });
      onOpenChange(false);
      setSearchQuery('');
      setSelectedMembers([]);
    } catch (error) {
      toast({ title: 'Failed to add members', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSearchQuery(''); setSelectedMembers([]); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Participants</DialogTitle>
        </DialogHeader>

        {/* Selected */}
        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
            {selectedMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full"
              >
                <span className="text-sm">{member.displayName}</span>
                <button onClick={() => toggleMember(member)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[300px]">
          {isSearching && (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          
          {searchResults.map((result) => {
            const isSelected = selectedMembers.some(m => m.id === result.id);
            return (
              <div
                key={result.id}
                onClick={() => toggleMember(result)}
                className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer rounded-lg"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={result.photoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {result.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{result.displayName}</p>
                </div>
                <Checkbox checked={isSelected} />
              </div>
            );
          })}
        </ScrollArea>

        <DialogFooter>
          <Button
            onClick={handleAdd}
            disabled={selectedMembers.length === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Add {selectedMembers.length > 0 ? `(${selectedMembers.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
