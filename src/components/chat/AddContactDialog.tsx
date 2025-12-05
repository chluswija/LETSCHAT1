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

        // Check if user is trying to search their own number
        const currentUserPhone = (currentUser?.phone || '').replace(/[\s\-()]/g, '');
        if (normalizedPhone === currentUserPhone) {
          setFoundUser(null);
          setSearchStatus('idle');
          setIsSearching(false);
          return;
        }

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
  }, [phoneNumber, currentUser?.uid, contactName]);

  // Save contact (even if user not found on platform yet)
  const saveContact = async () => {
    if (!currentUser?.uid || !contactName.trim() || !phoneNumber.trim()) {
      toast({ 
        title: 'Missing information', 
        description: 'Please enter both name and phone number',
        variant: 'destructive' 
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const contactsRef = collection(db, 'users', currentUser.uid, 'contacts');
      const normalizedPhone = phoneNumber.replace(/[\s\-()]/g, '');
      
      // Check if trying to save own number
      const currentUserPhone = (currentUser.phone || '').replace(/[\s\-()]/g, '');
      if (normalizedPhone === currentUserPhone || (foundUser && foundUser.uid === currentUser.uid)) {
        toast({ 
          title: 'Cannot add yourself', 
          description: 'You cannot add your own phone number as a contact',
          variant: 'destructive' 
        });
        setIsSaving(false);
        return;
      }
      
      console.log('Attempting to save contact:', {
        name: contactName.trim(),
        phone: normalizedPhone,
        userId: foundUser?.uid || `phone_${normalizedPhone}`
      });
      
      // Check if contact already exists (improved logic)
      const existingContacts = await getDocs(contactsRef);
      let alreadyExists = false;
      let existingContactName = '';
      
      existingContacts.forEach((docSnap) => {
        const data = docSnap.data();
        const existingPhone = (data.phone || '').replace(/[\s\-()]/g, '');
        
        // Check for exact userId match OR exact phone match
        if (foundUser && data.userId === foundUser.uid) {
          alreadyExists = true;
          existingContactName = data.name;
        } else if (!foundUser && existingPhone === normalizedPhone) {
          // For contacts not on platform, check phone number
          alreadyExists = true;
          existingContactName = data.name;
        }
      });

      if (alreadyExists) {
        toast({ 
          title: 'Contact already exists', 
          description: `Already saved as "${existingContactName}"`,
          variant: 'destructive' 
        });
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
      
      console.log('Saving contact data:', contactData);
      
      // Add document and wait for it to complete
      const docRef = await addDoc(contactsRef, contactData);
      console.log('Contact saved successfully with ID:', docRef.id);

      // If user is on platform, add to contacts array
      if (foundUser?.uid) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            contacts: arrayUnion(foundUser.uid),
          });

          // Update local user state
          setUser({
            ...currentUser,
            contacts: [...(currentUser.contacts || []), foundUser.uid],
          });
        } catch (err) {
          console.error('Error updating user contacts array:', err);
          // Continue anyway, subcollection save was successful
        }
      }

      // Show success message
      toast({ 
        title: '✓ Contact saved!', 
        description: foundUser 
          ? `${contactName} has been added to your contacts` 
          : `${contactName} saved. You can message them when they join LetsChat`,
        duration: 3000,
      });
      
      // Wait a bit for the user to see the success message
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (foundUser) {
        onContactAdded?.(foundUser);
      }
      
      // Close dialog and reset form
      resetForm();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Error saving contact:', error);
      toast({ 
        title: 'Failed to save contact', 
        description: error?.message || 'An error occurred. Please try again.',
        variant: 'destructive',
        duration: 5000,
      });
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
    <Dialog open={open} onOpenChange={(o) => { 
      if (!isSaving) {
        onOpenChange(o); 
        if (!o) resetForm();
      }
    }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => {
        if (isSaving) e.preventDefault();
      }} onInteractOutside={(e) => {
        if (isSaving) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            Add New Contact
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Enter a phone number to add to your contacts
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone Number *
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="+1 234 567 8900"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="pl-10 h-11"
                type="tel"
                autoFocus
                disabled={isSaving}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +1 for USA)
            </p>
          </div>

          {/* Search Result */}
          {searchStatus === 'found' && foundUser && (
            <div className="p-4 bg-green-500/5 rounded-lg border-2 border-green-500/20 animate-fade-up">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-14 w-14 ring-2 ring-green-500/20">
                  <AvatarImage src={foundUser.photoURL || undefined} />
                  <AvatarFallback className="bg-green-500/10 text-green-700 font-semibold">
                    {foundUser.displayName?.charAt(0) || foundUser.phone?.charAt(1) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {foundUser.displayName || 'LetsChat User'}
                    </p>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">{foundUser.phone}</p>
                  {foundUser.about && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{foundUser.about}"</p>
                  )}
                </div>
              </div>

              {/* Contact Name Input */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Save as * <span className="text-xs text-muted-foreground font-normal">(How they'll appear in your chats)</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., John, Mom, Office Manager"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-11"
                  disabled={isSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && contactName.trim()) {
                      saveContact();
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Not Found - But still allow saving */}
          {searchStatus === 'not-found' && (
            <div className="space-y-3 animate-fade-up">
              <div className="p-4 bg-blue-500/5 rounded-lg border-2 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Not on LetsChat</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This number isn't registered yet. You can still save it and message them when they join.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Name Input for non-registered users */}
              <div className="space-y-2">
                <Label htmlFor="name-notfound" className="text-sm font-medium">
                  Contact Name *
                </Label>
                <Input
                  id="name-notfound"
                  placeholder="e.g., John Doe, Work Client"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-11"
                  disabled={isSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && contactName.trim()) {
                      saveContact();
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={saveContact}
            disabled={!contactName.trim() || !phoneNumber.trim() || phoneNumber.length < 10 || isSaving}
            className="flex-1 bg-primary hover:bg-primary/90"
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
