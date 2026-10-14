import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import rawConfig from '../firebase-applet-config.json';

export interface AppletFirebaseConfig extends FirebaseOptions {
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
}

const firebaseConfig: AppletFirebaseConfig = {
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || rawConfig.appId,
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || rawConfig.apiKey,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain,
  firestoreDatabaseId: (import.meta as any).env?.VITE_FIREBASE_DATABASE_ID || rawConfig.firestoreDatabaseId,
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId,
};

// Initialize or reuse existing Firebase app instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Connect to specific Firestore database instance
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Test server connection as per skill instructions
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline.');
    }
    return false;
  }
}
