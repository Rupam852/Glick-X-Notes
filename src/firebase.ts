import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// This file will be automatically updated by the set_up_firebase tool
// once you accept the terms in the UI.
import localConfig from '../firebase-applet-config.json';

// Use environment variables for production, fallback to local config for development
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || (localConfig as any).apiKey,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || (localConfig as any).authDomain,
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || (localConfig as any).projectId,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || (localConfig as any).storageBucket,
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || (localConfig as any).messagingSenderId,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || (localConfig as any).appId,
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || (localConfig as any).measurementId
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, silent = false) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  
  const message = JSON.stringify(errInfo);
  console.error('Firestore Error: ', message);
  
  if (!silent) {
    throw new Error(message);
  }
}
