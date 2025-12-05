import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export default app;
