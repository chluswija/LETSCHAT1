import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
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

  // Auto-search for user by phone number
  useEffect(() => {
    const searchUser = async () => {
      if (!phoneNumber.trim() || phoneNumber.length < 10) {
        setFoundUser(null);
        setSearchStatus('idle');
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
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUser, 500);
    return () => clearTimeout(debounceTimer);
  }, [phoneNumber, currentUser?.uid]);

  // Save contact (even if user not found on platform yet)
  const saveContact = async () => {
    if (!currentUser?.uid || !contactName.trim() || !phoneNumber.trim()) {
      toast({ title: 'Enter both name and phone number', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const contactsRef = collection(db, 'users', currentUser.uid, 'contacts');
      const normalizedPhone = phoneNumber.replace(/[\s\-()]/g, '');
      
      // Check if contact already exists
      const existingContacts = await getDocs(contactsRef);
      let alreadyExists = false;
      
      existingContacts.forEach((docSnap) => {
        const data = docSnap.data();
        const existingPhone = (data.phone || '').replace(/[\s\-()]/g, '');
        if (existingPhone === normalizedPhone || (foundUser && data.userId === foundUser.uid)) {
          alreadyExists = true;
        }
      });

      if (alreadyExists) {
        toast({ title: 'Contact already exists', variant: 'destructive' });
        setIsSaving(false);
        return;
      }

      // Save contact to subcollection with the individual's name
      const contactData = {
        userId: foundUser?.uid || `phone_${normalizedPhone}`,
        name: contactName.trim(), // This is the custom name the user enters
        phone: normalizedPhone,
        photoURL: foundUser?.photoURL || null,
        savedAt: serverTimestamp(),
        onPlatform: !!foundUser,
      };
      
      console.log('Saving contact with name:', contactName.trim());
      await addDoc(contactsRef, contactData);

      // If user is on platform, add to contacts array
      if (foundUser?.uid) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          contacts: arrayUnion(foundUser.uid),
        });

        // Update local user state
        setUser({
          ...currentUser,
          contacts: [...(currentUser.contacts || []), foundUser.uid],
        });
      }

      toast({ 
        title: 'Contact saved!', 
        description: foundUser 
          ? `${contactName} has been added to your contacts` 
          : `${contactName} saved. You can chat when they join LetsChat.`
      });
      
      if (foundUser) {
        onContactAdded?.(foundUser);
      }
      
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
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="+1 234 567 8900"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="pl-10"
                type="tel"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Enter with country code (e.g., +1 234 567 8900)
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
                <Label htmlFor="name">Save as (e.g., John Doe, Mom, Office)</Label>
                <Input
                  id="name"
                  placeholder="Enter name for this contact"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This is how the contact will appear in your chat list
                </p>
              </div>
            </div>
          )}

          {/* Not Found - But still allow saving */}
          {searchStatus === 'not-found' && (
            <div className="space-y-3">
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Not on LetsChat yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You can still save this contact. They'll appear when they join.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Name Input for non-registered users */}
              <div className="space-y-2">
                <Label htmlFor="name-notfound">Contact name</Label>
                <Input
                  id="name-notfound"
                  placeholder="e.g., John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={saveContact}
            disabled={!contactName.trim() || !phoneNumber.trim() || phoneNumber.length < 10 || isSaving}
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
