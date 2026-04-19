import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { StockLog } from '../types';

export const logStockChange = async (
  tenantId: string,
  productId: string,
  productName: string,
  type: StockLog['type'],
  quantity: number,
  previousStock: number,
  currentStock: number,
  userId: string,
  userName: string,
  reference?: { id: string; number: string },
  note?: string
) => {
  try {
    const logData: any = {
      tenantId,
      productId,
      productName,
      type,
      quantity,
      previousStock,
      currentStock,
      userId,
      userName,
      createdAt: serverTimestamp(),
    };

    if (note) logData.note = note;
    if (reference?.id) logData.referenceId = reference.id;
    if (reference?.number) logData.referenceNumber = reference.number;

    await addDoc(collection(db, 'stock_logs'), logData);
  } catch (error) {
    console.error('Error logging stock change:', error);
  }
};
