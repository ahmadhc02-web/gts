import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let cachedDb: any = null;

export function getDb() {
  if (!cachedDb) {
    cachedDb = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, (firebaseConfig as any).firestoreDatabaseId);
  }
  return cachedDb;
}

export const auth = getAuth(app);
