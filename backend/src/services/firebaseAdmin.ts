import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getStorage, type Storage } from 'firebase-admin/storage';

let firebaseApp: App | null = null;
let isInitialized = false;

export function initializeFirebaseAdmin(): App | null {
  if (isInitialized && firebaseApp) {
    return firebaseApp;
  }

  try {
    // 1. Try single JSON string env var
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const parsed = JSON.parse(serviceAccountJson);
      firebaseApp = initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id,
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${parsed.project_id}-default-rtdb.firebaseio.com`,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${parsed.project_id}.appspot.com`,
      });
      isInitialized = true;
      console.log(`[Firebase Admin] Initialized with Service Account JSON for project: ${parsed.project_id}`);
      return firebaseApp;
    }

    // 2. Try individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      });
      isInitialized = true;
      console.log(`[Firebase Admin] Initialized with explicit credentials for project: ${projectId}`);
      return firebaseApp;
    }

    // 3. Try Application Default Credentials (ADC) or emulator
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
      firebaseApp = initializeApp();
      isInitialized = true;
      console.log('[Firebase Admin] Initialized with Application Default Credentials');
      return firebaseApp;
    }

    // 4. Default / Project ID only fallback (Local / Development)
    if (projectId) {
      firebaseApp = initializeApp({
        projectId,
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      });
      isInitialized = true;
      console.log(`[Firebase Admin] Initialized in development mode for project: ${projectId}`);
      return firebaseApp;
    }

    console.warn('[Firebase Admin] No Firebase service account credentials found. Running in hybrid local mode.');
    return null;
  } catch (err: any) {
    console.error('[Firebase Admin] Failed to initialize:', err.message);
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return isInitialized && firebaseApp !== null;
}

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured() || !firebaseApp) return null;
  return getAuth(firebaseApp);
}

export function getFirestoreDb(): Firestore | null {
  if (!isFirebaseConfigured() || !firebaseApp) return null;
  return getFirestore(firebaseApp);
}

export function getRealtimeDb(): Database | null {
  if (!isFirebaseConfigured() || !firebaseApp) return null;
  return getDatabase(firebaseApp);
}

export function getFirebaseStorage(): Storage | null {
  if (!isFirebaseConfigured() || !firebaseApp) return null;
  return getStorage(firebaseApp);
}

/**
 * Verify Firebase ID Token from client
 */
export async function verifyFirebaseIdToken(token: string): Promise<DecodedIdToken | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    return await auth.verifyIdToken(token);
  } catch (err: any) {
    console.warn('[Firebase Auth] Invalid ID token:', err.message);
    return null;
  }
}

/**
 * Issue a Custom Auth Token for an authorized gateway
 */
export async function createGatewayCustomToken(
  gatewayId: string,
  workspaceId: string,
  role: 'gateway' | 'controller' = 'gateway'
): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    return await auth.createCustomToken(`gw-${gatewayId}`, {
      role,
      workspaceId,
      gatewayId,
    });
  } catch (err: any) {
    console.error('[Firebase Auth] Failed to generate custom token:', err.message);
    return null;
  }
}

/**
 * Write job command into gateway inbox in Firebase Realtime Database
 */
export async function dispatchJobToGatewayInbox(
  gatewayUid: string,
  jobId: string,
  jobData: any
): Promise<boolean> {
  const rtdb = getRealtimeDb();
  if (!rtdb) return false;
  try {
    const inboxRef = rtdb.ref(`gatewayInbox/${gatewayUid}/${jobId}`);
    await inboxRef.set({
      jobId,
      workspaceId: jobData.workspaceId,
      deviceId: jobData.deviceId,
      fileName: jobData.fileName,
      originalName: jobData.originalName,
      fileSize: jobData.fileSize,
      fileHash: jobData.fileHash,
      downloadUrl: jobData.downloadUrl || null,
      options: jobData.options,
      status: 'QUEUED',
      dispatchedAt: Date.now(),
    });
    console.log(`[Firebase RTDB] Dispatched job ${jobId} to gateway inbox: gatewayInbox/${gatewayUid}/${jobId}`);
    return true;
  } catch (err: any) {
    console.error('[Firebase RTDB] Failed to write to gateway inbox:', err.message);
    return false;
  }
}

/**
 * Update gateway presence state in RTDB
 */
export async function updateGatewayPresenceInRTDB(
  gatewayUid: string,
  isOnline: boolean,
  metadata?: any
): Promise<void> {
  const rtdb = getRealtimeDb();
  if (!rtdb) return;
  try {
    const presenceRef = rtdb.ref(`presence/${gatewayUid}`);
    await presenceRef.update({
      isOnline,
      lastSeenAt: Date.now(),
      ...metadata,
    });
  } catch (err: any) {
    console.error('[Firebase RTDB] Failed to update presence:', err.message);
  }
}
