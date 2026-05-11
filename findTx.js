import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./src/firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, 'transactions'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    if (data.amount === 151 || data.amount === 151000 || data.amount < 200 && data.amount > 0) {
      console.log('Found:', doc.id, data);
    }
  });
}
run();
