import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

export async function generateSequentialNumber(tenantId: string, prefix: string = 'INV'): Promise<string> {
  if (!tenantId) {
    throw new Error('Tenant ID is required for generating sequential number');
  }

  const now = new Date();
  const yearMonth = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0');
  const counterId = `${tenantId}_invoice_${yearMonth}`;
  const counterRef = doc(db, 'counters', counterId);

  try {
    const seq = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let newSequence = 1;

      if (!counterDoc.exists()) {
        transaction.set(counterRef, {
          tenantId,
          prefix,
          sequence: 1,
          yearMonth: yearMonth // You can add extra fields, but `tenantId`, `prefix`, `sequence` are required.
        });
      } else {
        newSequence = counterDoc.data().sequence + 1;
        transaction.update(counterRef, { sequence: newSequence });
      }

      return newSequence;
    });

    const sequenceStr = seq.toString().padStart(6, '0');
    return `${prefix}${yearMonth}${sequenceStr}`;
  } catch (err) {
    console.error('Sequence generation failed, falling back to timestamp:', err);
    // Fallback in case of transaction failure (offline or permission issue)
    return `${prefix}${yearMonth}${Math.floor(Date.now() / 1000 % 1000000).toString().padStart(6, '0')}`;
  }
}
