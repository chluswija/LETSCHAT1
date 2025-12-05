import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential, linkWithCredential, ConfirmationResult } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyDkxou78tR1vt-fwDCRj4pg_ya_jf9Fejs",
  authDomain: "letschat-ea6c1.firebaseapp.com",
  projectId: "letschat-ea6c1",
  storageBucket: "letschat-ea6c1.firebasestorage.app",
  messagingSenderId: "108590195004",
  appId: "1:108590195004:web:316d0abaaf31a023173e39",
  measurementId: "G-1DLYCR9THX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence not available in this browser');
  }
});

// Firebase Cloud Messaging setup
let messaging: ReturnType<typeof getMessaging> | null = null;

export const initializeMessaging = async () => {
  const supported = await isSupported();
  if (supported) {
    messaging = getMessaging(app);
    return messaging;
  }
  return null;
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted' && messaging) {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY' // Replace with actual VAPID key from Firebase Console
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

export const onMessageListener = () => {
  return new Promise((resolve) => {
    if (messaging) {
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    }
  });
};

// Phone Authentication helpers
let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

export const setupRecaptcha = (containerId: string) => {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
  }
  
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      console.log('reCAPTCHA verified');
    },
    'expired-callback': () => {
      console.log('reCAPTCHA expired');
    }
  });
  
  return recaptchaVerifier;
};

export const sendOTP = async (phoneNumber: string): Promise<ConfirmationResult> => {
  if (!recaptchaVerifier) {
    throw new Error('reCAPTCHA not initialized');
  }
  
  try {
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return confirmationResult;
  } catch (error: any) {
    // Reset recaptcha on error
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    throw error;
  }
};

export const verifyOTP = async (otp: string) => {
  if (!confirmationResult) {
    throw new Error('No confirmation result available');
  }
  
  const result = await confirmationResult.confirm(otp);
  confirmationResult = null;
  return result;
};

export const linkPhoneNumber = async (phoneNumber: string, otp: string) => {
  const credential = PhoneAuthProvider.credential(
    confirmationResult?.verificationId || '',
    otp
  );
  
  if (auth.currentUser) {
    return await linkWithCredential(auth.currentUser, credential);
  }
  
  return await signInWithCredential(auth, credential);
};

export { RecaptchaVerifier, PhoneAuthProvider };
export default app;
