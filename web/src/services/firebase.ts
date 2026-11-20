import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously as fbSignInAnonymously,
  signInWithEmailAndPassword as fbSignInWithEmail,
  createUserWithEmailAndPassword as fbCreateUserWithEmail,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  linkWithCredential as fbLinkWithCredential,
  EmailAuthProvider,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  getDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  type Database,
} from 'firebase/database';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  type FirebaseStorage,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemo-PocketPrint-Bridge-Key2026',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pocketprint-bridge.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pocketprint-bridge',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pocketprint-bridge.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://pocketprint-bridge-default-rtdb.firebaseio.com',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);
export const storage: FirebaseStorage = getStorage(app);

export {
  fbSignInAnonymously as signInAnonymously,
  fbSignInWithEmail as signInWithEmailAndPassword,
  fbCreateUserWithEmail as createUserWithEmailAndPassword,
  fbSignOut as signOut,
  fbOnAuthStateChanged as onAuthStateChanged,
  fbLinkWithCredential as linkWithCredential,
  EmailAuthProvider,
  type User,
};

/**
 * Link an existing Anonymous Guest user to an Email/Password account
 * Preserves the existing workspace and paired devices.
 */
export async function linkGuestToAccount(email: string, pass: string): Promise<User | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  const credential = EmailAuthProvider.credential(email, pass);
  const result = await fbLinkWithCredential(currentUser, credential);
  return result.user;
}

/**
 * Upload PDF to Firebase Storage (if enabled)
 */
export async function uploadPdfToStorage(
  workspaceId: string,
  jobId: string,
  file: File
): Promise<string | null> {
  try {
    const fileRef = storageRef(storage, `workspaces/${workspaceId}/jobs/${jobId}/source.pdf`);
    const snapshot = await uploadBytes(fileRef, file, {
      contentType: 'application/pdf',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
    return await getDownloadURL(snapshot.ref);
  } catch (err: any) {
    console.warn('[Firebase Storage] Direct upload failed, falling back to Relay endpoint:', err.message);
    return null;
  }
}
