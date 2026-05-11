import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, 'transactions'));
  const snap = await getDocs(q);
  for (const t of snap.docs) {
    const data = t.data();
    if (data.amount === 151 || data.amount === 151000 || (data.amount > 0 && data.amount < 200)) {
      console.log('Found:', t.id, data);
      await deleteDoc(doc(db, 'transactions', t.id));
      console.log('Deleted:', t.id);
    }
  }
}
run();
