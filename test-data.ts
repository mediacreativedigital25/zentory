import { getDocs, query, collection, where, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import config from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const orders = await getDocs(query(collection(db, 'orders'), where('orderNumber', '==', 'IN202605000007')));
  orders.forEach(doc => console.log('ORDER:', doc.id, doc.data()));

  const receipts = await getDocs(query(collection(db, 'payment_receipts'), where('receiptNumber', '==', 'RP202605000007')));
  receipts.forEach(doc => console.log('RECEIPT:', doc.id, doc.data()));

  const collections = await getDocs(query(collection(db, 'invoice_collections')));
  collections.forEach(doc => {
    if (doc.data().orderNumbers?.includes('IN202605000007')) {
      console.log('COLLECTION:', doc.id, doc.data());
    }
  });
}
run();
