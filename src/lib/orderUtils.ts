import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Generates a custom order ID based on the source type.
 * Format: [Prefix][YYYYMM][6-digit sequence]
 * Example: IN202604000001 (Catalog), M202604000001 (Manual)
 */
export async function generateOrderId(prefix: 'IN' | 'M', tenantId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const baseId = `${prefix}${year}${month}`;
  
  // Query for orders with the same prefix and month for THIS tenant
  const q = query(
    collection(db, 'orders'),
    where('tenantId', '==', tenantId),
    where('orderNumber', '>=', baseId),
    where('orderNumber', '<=', baseId + '\uf8ff'),
    orderBy('orderNumber', 'desc'),
    limit(1)
  );

  const snap = await getDocs(q);
  let sequence = 1;
  
  if (!snap.empty) {
    const lastId = snap.docs[0].data().orderNumber;
    // Extract sequence from the end (last 6 digits)
    const lastSequenceStr = lastId.slice(baseId.length);
    const lastSequence = parseInt(lastSequenceStr);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }
  
  return `${baseId}${sequence.toString().padStart(6, '0')}`;
}
