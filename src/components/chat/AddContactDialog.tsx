import { useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { User } from '@/types/chat';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, User as UserIcon, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded?: (contact: User) => void;
}

export const AddContactDialog = ({ open, onOpenChange, onContactAdded }: AddContactDialogProps) => {
  const { user: currentUser, setUser } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not-found'>('idle');

  // Format phone number as user types
  const handlePhoneChange = (value: string) => {
    // Allow only digits, + and spaces
    const formatted = value.replace(/[^\d+\s]/g, '');
    setPhoneNumber(formatted);
    setSearchStatus('idle');
    setFoundUser(null);
  };

  // Search for user by phone number
  const searchUser = async () => {
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      toast({ title: 'Enter a valid phone number', variant: 'destructive' });
      return;
    }

    setIsSearching(true);
    setSearchStatus('idle');
    
    try {
      const usersRef = collection(db, 'users');
      // Normalize phone number for search
      const normalizedPhone = phoneNumber.replace(/[\s\-()]/g, '');
      
      // Search for exact match or partial match
      const allUsersSnapshot = await getDocs(usersRef);
      let found: User | null = null;
      
      allUsersSnapshot.forEach((docSnap) => {
        const userData = { ...docSnap.data(), uid: docSnap.id } as User;
        const userPhone = (userData.phone || '').replace(/[\s\-()]/g, '');
        
        // Check if phones match (with or without country code)
        if (
          userPhone === normalizedPhone ||
          userPhone.endsWith(normalizedPhone) ||
          normalizedPhone.endsWith(userPhone)
        ) {
          if (userData.uid !== currentUser?.uid) {
            found = userData;
          }
        }
      });

      if (found) {
        setFoundUser(found);
        setSearchStatus('found');
        // Pre-fill contact name if user has a display name
        if (!contactName && found.displayName) {
          setContactName(found.displayName);
        }
      } else {
        setFoundUser(null);
        setSearchStatus('not-found');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      toast({ title: 'Error searching', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  // Save contact
  const saveContact = async () => {
    if (!foundUser || !currentUser?.uid || !contactName.trim()) {
      toast({ title: 'Enter a name for this contact', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      // Add to user's contacts list
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        contacts: arrayUnion(foundUser.uid),
      });

      // Save contact with custom name in a subcollection
      const contactsRef = collection(db, 'users', currentUser.uid, 'contacts');
      const existingContact = await getDocs(
        query(contactsRef, where('userId', '==', foundUser.uid))
      );

      if (existingContact.empty) {
        const { addDoc } = await import('firebase/firestore');
        await addDoc(contactsRef, {
          oderId: foundUser.uid,
          userId: foundUser.uid,
          name: contactName.trim(),
          phone: foundUser.phone,
          photoURL: foundUser.photoURL,
          savedAt: new Date(),
        });
      }

      // Update local user state
      if (currentUser) {
        setUser({
          ...currentUser,
          contacts: [...(currentUser.contacts || []), foundUser.uid],
        });
      }

      toast({ title: 'Contact saved!', description: `${contactName} has been added to your contacts` });
      onContactAdded?.(foundUser);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast({ title: 'Failed to save contact', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setPhoneNumber('');
    setContactName('');
    setFoundUser(null);
    setSearchStatus('idle');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            Add New Contact
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  placeholder="+1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="pl-10"
                  type="tel"
                />
              </div>
              <Button 
                onClick={searchUser} 
                disabled={isSearching || phoneNumber.length < 10}
                variant="secondary"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Find'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the phone number with country code (e.g., +1 for US)
            </p>
          </div>

          {/* Search Result */}
          {searchStatus === 'found' && foundUser && (
            <div className="p-4 bg-muted/50 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={foundUser.photoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {foundUser.displayName?.charAt(0) || foundUser.phone?.charAt(1) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">
                    {foundUser.displayName || 'LETSCHAT User'}
                  </p>
                  <p className="text-sm text-muted-foreground">{foundUser.phone}</p>
                  <p className="text-xs text-muted-foreground">{foundUser.about}</p>
                </div>
                <Check className="w-5 h-5 text-green-500 ml-auto" />
              </div>

              {/* Contact Name Input */}
              <div className="space-y-2">
                <Label htmlFor="name">Save as</Label>
                <Input
                  id="name"
                  placeholder="Contact name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Not Found */}
          {searchStatus === 'not-found' && (
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 text-center">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-2" />
              <p className="font-medium text-destructive">User not found</p>
              <p className="text-sm text-muted-foreground mt-1">
                This phone number is not registered on LETSCHAT.
                <br />
                Invite them to join!
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={saveContact}
            disabled={!foundUser || !contactName.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Contact
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
