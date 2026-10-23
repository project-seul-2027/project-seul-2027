import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured as configFilled } from './config';

// Solo per prove in locale con gli emulatori Firebase: VITE_USE_FIREBASE_EMULATORS=true
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const isFirebaseConfigured = configFilled || useEmulators;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(
    useEmulators
      ? { apiKey: 'demo-key', authDomain: 'demo-seul2027.firebaseapp.com', projectId: 'demo-seul2027', appId: 'demo' }
      : firebaseConfig
  );
  auth = getAuth(app);
  auth.languageCode = 'it';
  db = getFirestore(app);

  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export function firebase() {
  if (!auth || !db) throw new Error('Firebase non è configurato: compila src/firebase/config.ts');
  return { auth, db };
}
