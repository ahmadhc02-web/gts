import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Configure log level to "silent" to silence cosmetic warnings and benign infrastructure connection cancellations
setLogLevel('silent');

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
