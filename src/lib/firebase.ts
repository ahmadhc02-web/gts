import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

// Persistence can sometimes cause issues in sandboxed frames
/*
try {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence already enabled in another tab');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported by this browser');
    }
  });
} catch (e) {
  console.warn('Firestore persistence initialization failed', e);
}
*/

export const auth = getAuth(app);
