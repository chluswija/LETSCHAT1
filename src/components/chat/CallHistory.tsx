import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Call {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  callerPhoto?: string;
  receiverName?: string;
  receiverPhoto?: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
}

export const CallHistory = () => {
  const { user: currentUser } = useAuthStore();
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const callsRef = collection(db, 'calls');
    
    // Query for calls where user is either caller or receiver
    const q = query(
      callsRef,
      or(
        where('callerId', '==', currentUser.uid),
        where('receiverId', '==', currentUser.uid)
      ),
      orderBy('startedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const callsList: Call[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        callsList.push({
          id: doc.id,
          callerId: data.callerId,
          receiverId: data.receiverId,
          callerName: data.callerName,
          callerPhoto: data.callerPhoto,
          receiverName: data.receiverName,
          receiverPhoto: data.receiverPhoto,
          type: data.type,
          status: data.status,
          startedAt: data.startedAt?.toDate() || new Date(),
          endedAt: data.endedAt?.toDate(),
          duration: data.duration,
        });
      });

      setCalls(callsList);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const getCallIcon = (call: Call) => {
    const isIncoming = call.receiverId === currentUser?.uid;
    const isMissed = call.status === 'missed' || call.status === 'rejected';
    
    if (call.type === 'video') {
      return <Video className={cn('w-4 h-4', isMissed ? 'text-destructive' : 'text-green-500')} />;
    }
    
    if (isMissed) {
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
    
    return isIncoming ? (
      <PhoneIncoming className="w-4 h-4 text-green-500" />
    ) : (
      <PhoneOutgoing className="w-4 h-4 text-primary" />
    );
  };

  const getCallStatusText = (call: Call) => {
    const isIncoming = call.receiverId === currentUser?.uid;
    
    if (call.status === 'missed') {
      return isIncoming ? 'Missed call' : 'Cancelled';
    }
    if (call.status === 'rejected') {
      return isIncoming ? 'Declined' : 'Call declined';
    }
    if (call.status === 'ended' && call.duration) {
      const mins = Math.floor(call.duration / 60);
      const secs = call.duration % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return isIncoming ? 'Incoming' : 'Outgoing';
  };

  const getContactInfo = (call: Call) => {
    const isIncoming = call.receiverId === currentUser?.uid;
    return {
      name: isIncoming ? call.callerName : (call.receiverName || 'Unknown'),
      photo: isIncoming ? call.callerPhoto : call.receiverPhoto,
    };
  };

  const formatCallTime = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 48) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else if (diffInHours < 168) { // Less than a week
      return format(date, 'EEEE HH:mm');
    } else {
      return format(date, 'MMM dd, HH:mm');
    }
  };

  const groupCallsByDate = (calls: Call[]) => {
    const groups: { [key: string]: Call[] } = {};
    
    calls.forEach((call) => {
      const date = call.startedAt;
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      let groupKey: string;
      if (diffInHours < 24) {
        groupKey = 'Today';
      } else if (diffInHours < 48) {
        groupKey = 'Yesterday';
      } else if (diffInHours < 168) {
        groupKey = format(date, 'EEEE');
      } else {
        groupKey = format(date, 'MMMM dd, yyyy');
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(call);
    });
    
    return groups;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-32 h-32 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Phone className="w-16 h-16 text-muted-foreground/30" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No calls yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your call history will appear here. Start a voice or video call with your contacts.
        </p>
      </div>
    );
  }

  const groupedCalls = groupCallsByDate(calls);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-semibold text-foreground mb-4">Calls</h2>
        
        {Object.entries(groupedCalls).map(([dateGroup, groupCalls]) => (
          <div key={dateGroup} className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">
              {dateGroup}
            </h3>
            <div className="space-y-1">
              {groupCalls.map((call) => {
                const contact = getContactInfo(call);
                const isMissed = call.status === 'missed' || call.status === 'rejected';
                
                return (
                  <div
                    key={call.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={contact.photo} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {contact.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'font-medium truncate',
                          isMissed ? 'text-destructive' : 'text-foreground'
                        )}>
                          {contact.name}
                        </p>
                        {getCallIcon(call)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getCallStatusText(call)}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatCallTime(call.startedAt)}
                      </p>
                      <button
                        className="mt-1 p-1.5 rounded-full hover:bg-muted transition-colors"
                        title={`${call.type === 'video' ? 'Video' : 'Voice'} call`}
                      >
                        {call.type === 'video' ? (
                          <Video className="w-4 h-4 text-primary" />
                        ) : (
                          <Phone className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
