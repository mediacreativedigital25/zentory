import { getDoc, doc, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import config from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const snap = await getDoc(doc(db, 'global_settings', 'fonnte'));
  console.log('FONNTE SETTINGS:', snap.exists() ? snap.data() : 'NOT FOUND');
}
run();