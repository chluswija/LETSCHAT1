import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallScreenProps {
  callType: 'voice' | 'video';
  callStatus: 'ringing' | 'connecting' | 'connected' | 'ending';
  isIncoming: boolean;
  contactName: string;
  contactPhoto?: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  duration: number;
  onAnswer?: () => void;
  onDecline: () => void;
  onEndCall: () => void;
  onToggleMic: (enabled: boolean) => void;
  onToggleVideo: (enabled: boolean) => void;
}

export const CallScreen = ({
  callType,
  callStatus,
  isIncoming,
  contactName,
  contactPhoto,
  localStream,
  remoteStream,
  duration,
  onAnswer,
  onDecline,
  onEndCall,
  onToggleMic,
  onToggleVideo,
}: CallScreenProps) => {
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMic = () => {
    const newState = !isMicEnabled;
    setIsMicEnabled(newState);
    onToggleMic(newState);
  };

  const handleToggleVideo = () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    onToggleVideo(newState);
  };

  const getStatusText = () => {
    if (isIncoming && callStatus === 'ringing') {
      return `Incoming ${callType} call...`;
    }
    switch (callStatus) {
      case 'ringing':
        return 'Calling...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatDuration(duration);
      case 'ending':
        return 'Call ended';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-primary/20 to-background flex flex-col">
      {/* Video Call Layout */}
      {callType === 'video' && (
        <div className="flex-1 relative">
          {/* Remote Video (Full Screen) */}
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <div className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4 ring-4 ring-primary/20">
                  <AvatarImage src={contactPhoto} />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                    {contactName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-semibold text-foreground">{contactName}</h2>
                <p className="text-muted-foreground mt-2">{getStatusText()}</p>
              </div>
            </div>
          )}

          {/* Local Video (Picture-in-Picture) */}
          {localStream && (
            <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Call Info Overlay */}
          <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
            <h3 className="text-white font-semibold">{contactName}</h3>
            <p className="text-white/80 text-sm">{getStatusText()}</p>
          </div>
        </div>
      )}

      {/* Voice Call Layout */}
      {callType === 'voice' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-up">
            <div className="relative inline-block mb-8">
              <Avatar className="h-40 w-40 ring-8 ring-primary/20">
                <AvatarImage src={contactPhoto} />
                <AvatarFallback className="bg-primary/10 text-primary text-6xl">
                  {contactName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {callStatus === 'ringing' && (
                <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping" />
              )}
            </div>
            <h2 className="text-3xl font-semibold text-foreground mb-2">{contactName}</h2>
            <p className="text-xl text-muted-foreground">{getStatusText()}</p>

            {/* Waveform animation for connected call */}
            {callStatus === 'connected' && (
              <div className="flex items-center justify-center gap-1 mt-6">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 30 + 20}px`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div className="p-6 bg-card/95 backdrop-blur-sm border-t border-border">
        {isIncoming && callStatus === 'ringing' ? (
          // Incoming call buttons
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant="destructive"
              className="rounded-full h-16 w-16 p-0"
              onClick={onDecline}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              size="lg"
              className="rounded-full h-16 w-16 p-0 bg-green-500 hover:bg-green-600"
              onClick={onAnswer}
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        ) : (
          // Active call controls
          <div className="flex justify-center items-center gap-4">
            {/* Microphone Toggle */}
            <Button
              size="lg"
              variant={isMicEnabled ? 'secondary' : 'destructive'}
              className="rounded-full h-14 w-14 p-0"
              onClick={handleToggleMic}
            >
              {isMicEnabled ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </Button>

            {/* Video Toggle (for video calls) */}
            {callType === 'video' && (
              <Button
                size="lg"
                variant={isVideoEnabled ? 'secondary' : 'destructive'}
                className="rounded-full h-14 w-14 p-0"
                onClick={handleToggleVideo}
              >
                {isVideoEnabled ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </Button>
            )}

            {/* Speaker Toggle (for voice calls) */}
            {callType === 'voice' && (
              <Button
                size="lg"
                variant={isSpeakerEnabled ? 'secondary' : 'destructive'}
                className="rounded-full h-14 w-14 p-0"
                onClick={() => setIsSpeakerEnabled(!isSpeakerEnabled)}
              >
                {isSpeakerEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </Button>
            )}

            {/* End Call Button */}
            <Button
              size="lg"
              variant="destructive"
              className="rounded-full h-16 w-16 p-0"
              onClick={onEndCall}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
