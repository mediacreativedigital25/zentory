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
    const logData: Omit<StockLog, 'id'> = {
      tenantId,
      productId,
      productName,
      type,
      quantity,
      previousStock,
      currentStock,
      referenceId: reference?.id,
      referenceNumber: reference?.number,
      note,
      userId,
      userName,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'stock_logs'), logData);
  } catch (error) {
    console.error('Error logging stock change:', error);
  }
};
