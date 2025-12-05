import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Loader2 } from 'lucide-react';
import { User } from '@/types/chat';

const Index = () => {
  const { user, isLoading, isAuthenticated, setUser, setLoading } = useAuthStore();
  const { activeChat, setActiveChat } = useChatStore();
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              photoURL: firebaseUser.photoURL,
              about: 'Hey there! I am using LETSCHAT',
              lastSeen: new Date(),
              online: true,
              blockedUsers: [],
              createdAt: new Date(),
            });
          }
        } catch (error) {
          console.error('Error fetching user:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-up">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading LETSCHAT...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile when chat is active */}
      <div
        className={`${
          isMobileView && activeChat ? 'hidden' : 'flex'
        } w-full md:w-[380px] lg:w-[420px] flex-shrink-0 relative`}
      >
        <ChatSidebar />
      </div>

      {/* Chat Window - full width on mobile */}
      <div
        className={`${
          isMobileView && !activeChat ? 'hidden' : 'flex'
        } flex-1 min-w-0`}
      >
        <ChatWindow
          onBack={isMobileView ? () => setActiveChat(null) : undefined}
        />
      </div>
    </div>
  );
};

export default Index;
