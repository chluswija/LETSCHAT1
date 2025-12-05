import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, setupRecaptcha, sendOTP, verifyOTP } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageCircle, 
  Phone, 
  ArrowRight, 
  Loader2, 
  ArrowLeft,
  Shield,
  CheckCircle2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { User, UserSettings } from '@/types/chat';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type AuthStep = 'phone' | 'otp' | 'profile';

const defaultSettings: UserSettings = {
  notifications: {
    messages: true,
    groups: true,
    calls: true,
    statusUpdates: true,
    sound: true,
    vibrate: true,
    showPreview: true,
  },
  privacy: {
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    about: 'everyone',
    status: 'contacts',
    readReceipts: true,
  },
  chat: {
    enterSendsMessage: true,
    mediaAutoDownload: 'wifi',
    fontSize: 'medium',
  },
  theme: 'system',
  language: 'en',
};

export const PhoneAuthForm = () => {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const { setUser } = useAuthStore();

  // Setup reCAPTCHA on mount
  useEffect(() => {
    if (recaptchaContainerRef.current) {
      setupRecaptcha('recaptcha-container');
    }
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const formatPhoneNumber = (phone: string) => {
    // Remove non-digits
    return phone.replace(/\D/g, '');
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (formattedPhone.length < 10) {
      toast({ 
        title: 'Invalid Phone Number', 
        description: 'Please enter a valid phone number',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const fullPhoneNumber = `${countryCode}${formattedPhone}`;
      await sendOTP(fullPhoneNumber);
      setStep('otp');
      setResendTimer(60);
      toast({ 
        title: 'OTP Sent!', 
        description: `Verification code sent to ${fullPhoneNumber}` 
      });
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      let message = 'Failed to send verification code';
      if (error.code === 'auth/invalid-phone-number') {
        message = 'Invalid phone number format';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later';
      }
      toast({ 
        title: 'Error', 
        description: message,
        variant: 'destructive'
      });
      // Re-setup recaptcha after error
      if (recaptchaContainerRef.current) {
        setupRecaptcha('recaptcha-container');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({ 
        title: 'Invalid OTP', 
        description: 'Please enter the 6-digit code',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOTP(otp);
      const user = result.user;
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        // Existing user - sign in
        const userData = userDoc.data() as User;
        setUser(userData);
        toast({ title: 'Welcome back!', description: 'Successfully logged in.' });
      } else {
        // New user - go to profile setup
        setIsNewUser(true);
        setStep('profile');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      let message = 'Invalid verification code';
      if (error.code === 'auth/code-expired') {
        message = 'Verification code expired. Please request a new one';
      }
      toast({ 
        title: 'Verification Failed', 
        description: message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast({ 
        title: 'Name Required', 
        description: 'Please enter your display name',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No authenticated user');

      const fullPhoneNumber = `${countryCode}${formatPhoneNumber(phoneNumber)}`;
      
      const userData: User = {
        uid: user.uid,
        phone: fullPhoneNumber,
        displayName: displayName.trim(),
        photoURL: null,
        about: 'Hey there! I am using LETSCHAT',
        lastSeen: new Date(),
        online: true,
        blockedUsers: [],
        contacts: [],
        createdAt: new Date(),
        settings: defaultSettings,
      };

      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setUser(userData);
      toast({ title: 'Welcome to LETSCHAT!', description: 'Your account has been created.' });
    } catch (error: any) {
      console.error('Error creating profile:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to create profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    // Re-setup recaptcha
    if (recaptchaContainerRef.current) {
      setupRecaptcha('recaptcha-container');
    }
    
    setLoading(true);
    try {
      const fullPhoneNumber = `${countryCode}${formatPhoneNumber(phoneNumber)}`;
      await sendOTP(fullPhoneNumber);
      setResendTimer(60);
      toast({ title: 'OTP Resent!', description: 'New verification code sent' });
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to resend code. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <MessageCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">LETSCHAT</h1>
          <p className="text-muted-foreground mt-2">Connect with friends instantly</p>
        </div>

        {/* Form Card */}
        <div className="bg-card rounded-2xl shadow-xl border border-border/50 p-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          
          {/* Step: Phone Number */}
          {step === 'phone' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Enter your phone</h2>
                  <p className="text-sm text-muted-foreground">We'll send you a verification code</p>
                </div>
              </div>

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="h-12 px-3 bg-muted/50 border-0 rounded-xl text-sm focus:ring-primary w-24"
                  >
                    <option value="+91">+91 🇮🇳</option>
                    <option value="+1">+1 🇺🇸</option>
                    <option value="+44">+44 🇬🇧</option>
                    <option value="+61">+61 🇦🇺</option>
                    <option value="+971">+971 🇦🇪</option>
                    <option value="+65">+65 🇸🇬</option>
                    <option value="+81">+81 🇯🇵</option>
                    <option value="+86">+86 🇨🇳</option>
                    <option value="+49">+49 🇩🇪</option>
                    <option value="+33">+33 🇫🇷</option>
                  </select>
                  <Input
                    type="tel"
                    placeholder="Phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 h-12 bg-muted/50 border-0 focus-visible:ring-primary rounded-xl"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !phoneNumber}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-primary/25"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Step: OTP Verification */}
          {step === 'otp' && (
            <>
              <button 
                onClick={() => setStep('phone')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Change number
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Verify your phone</h2>
                  <p className="text-sm text-muted-foreground">
                    Code sent to {countryCode} {phoneNumber}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    onClick={handleResendOTP}
                    disabled={resendTimer > 0 || loading}
                    className="text-sm text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
                  >
                    {resendTimer > 0 
                      ? `Resend code in ${resendTimer}s` 
                      : "Didn't receive code? Resend"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step: Profile Setup */}
          {step === 'profile' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Create your profile</h2>
                  <p className="text-sm text-muted-foreground">Add your name to get started</p>
                </div>
              </div>

              <form onSubmit={handleCreateProfile} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 bg-muted/50 border-0 focus-visible:ring-primary rounded-xl"
                  maxLength={25}
                  required
                  autoFocus
                />

                <Button
                  type="submit"
                  disabled={loading || !displayName.trim()}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* reCAPTCHA container */}
        <div id="recaptcha-container" ref={recaptchaContainerRef}></div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default PhoneAuthForm;
