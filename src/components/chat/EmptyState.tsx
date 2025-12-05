import { MessageCircle } from 'lucide-react';

export const EmptyState = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-chat-wallpaper chat-wallpaper p-8">
      <div className="text-center animate-fade-up max-w-md">
        <div className="w-72 h-72 mx-auto mb-8 relative">
          {/* Animated illustration */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-primary/5 animate-pulse-soft" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-primary/10 animate-pulse-soft" style={{ animationDelay: '0.5s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <MessageCircle className="w-16 h-16 text-primary" />
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          LETSCHAT Web
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Send and receive messages without keeping your phone online.
          <br />
          Use LETSCHAT on up to 4 linked devices and 1 phone at the same time.
        </p>
        
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse" />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
};
