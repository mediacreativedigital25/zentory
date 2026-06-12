import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, orderBy, limit, serverTimestamp, where, Timestamp } from 'firebase/firestore';

export const autoGenerateReceiptForConfirm = async (orderOrBooking: any, profile: any) => {
  console.log("autoGenerateReceiptForConfirm invoked for doc:", orderOrBooking.id);
  
  let order = orderOrBooking;
  const isBookingDoc = orderOrBooking.docType === 'booking';
  let realOrderId = orderOrBooking.id; // Assume order id first
  
  if (isBookingDoc) {
     if (orderOrBooking.invoiceNumber) {
        const oQ = query(collection(db, 'orders'), where('tenantId', '==', profile?.tenantId || orderOrBooking.tenantId), where('orderNumber', '==', orderOrBooking.invoiceNumber), limit(1));
        const oSnap = await getDocs(oQ);
        if (!oSnap.empty) {
           order = { id: oSnap.docs[0].id, ...oSnap.docs[0].data(), status: orderOrBooking.status };
           realOrderId = order.id;
        } else {
           console.error("Order not found for invoiceNumber:", orderOrBooking.invoiceNumber);
           return;
        }
     } else {
        console.error("isBookingDoc but no invoiceNumber");
        return;
     }
  }

  if (order.status === 'cancelled' || order.status === 'deleted') return;
  if (order.paymentStatus === 'paid' || (order.paymentStatus === 'partial' && order.paymentType === 'dp')) return;
  
  // Only process if it's DP or full
  const paymentAmountToProcess = order.paymentType === 'dp' && order.downPaymentAmount ? order.downPaymentAmount : order.totalAmount;
  if (!paymentAmountToProcess) return;

  const targetTenantId = order.tenantId || profile?.tenantId;
  if (!targetTenantId) return;

  // Check if a receipt already exists for this order
  const existTrxQ = query(
    collection(db, 'transactions'),
    where('tenantId', '==', targetTenantId),
    where('orderId', '==', realOrderId)
  );
  
  const existTrxSnap = await getDocs(existTrxQ);
  const hasExistingReceipt = existTrxSnap.docs.some(doc => doc.data().source === 'auto_confirm_receipt' || doc.data().description?.includes('Receive Payment'));
  if (hasExistingReceipt) {
     return; // Already has a payment transaction
  }

  const now = new Date();
  const prefix = `RP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const lastQ = query(
    collection(db, 'payment_receipts'),
    where('tenantId', '==', targetTenantId),
    where('receiptNumber', '>=', prefix),
    where('receiptNumber', '<=', prefix + '\uf8ff'),
    orderBy('receiptNumber', 'desc'),
    limit(1)
  );

  let nextSeq = 1;
  const lastSnap = await getDocs(lastQ);
  if (!lastSnap.empty) {
     const lastData = lastSnap.docs[0].data();
     const lastSeq = parseInt(lastData.receiptNumber.slice(-6), 10);
     if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }
  
  const receiptNumber = `${prefix}${String(nextSeq).padStart(6, '0')}`;

  const receiptData = {
    tenantId: targetTenantId,
    receiptNumber,
    customerId: order.customerId || null,
    customerName: order.customerName || order.customer?.name || 'Customer',
    date: serverTimestamp(),
    paymentMethod: order.paymentMethod || 'manual',
    bankAccountId: null,
    bankAccountName: null,
    amount: paymentAmountToProcess,
    savingsAmount: 0,
    note: `Auto-generated from order confirmation (${order.paymentType === 'dp' ? 'DP' : 'Full'})`,
    collections: [],
    invoices: [{
      orderId: order.id,
      orderNumber: order.orderNumber,
      date: order.createdAt || order.date || null,
      totalAmount: order.totalAmount,
      amountDue: order.totalAmount,
      amountPaid: paymentAmountToProcess,
    }],
    createdBy: profile?.uid || 'auto',
    createdAt: serverTimestamp()
  };

  const receiptRef = await addDoc(collection(db, 'payment_receipts'), Object.fromEntries(Object.entries(receiptData).filter(([_, v]) => v !== undefined)));

  await addDoc(collection(db, 'transactions'), {
     tenantId: targetTenantId,
     type: 'sale',
     amount: paymentAmountToProcess,
     date: serverTimestamp(),
     status: 'completed',
     userId: profile?.uid || 'auto',
     description: `Receive Payment dari ${receiptData.customerName} - ${receiptNumber} (Order ${order.orderNumber || 'Unknown'})`,
     transactionNumber: `TRX-RP-${receiptNumber}-${order.orderNumber || new Date().getTime()}`,
     orderId: order.id,
     receiptNumber: receiptNumber,
     bankAccountId: null,
     bankAccountName: null,
     receiptId: receiptRef.id,
     source: 'auto_confirm_receipt',
     createdAt: serverTimestamp()
  });

  // Calculate new payment status for the order
  let newAmountPaid = (order.amountPaid || 0) + paymentAmountToProcess;
  let newPaymentStatus = order.paymentStatus || 'unpaid';
  
  if (newAmountPaid >= order.totalAmount) {
     newAmountPaid = order.totalAmount;
     newPaymentStatus = 'paid';
  } else if (newAmountPaid > 0) {
     newPaymentStatus = 'partial';
  }

  await updateDoc(doc(db, 'orders', order.id), {
     amountPaid: newAmountPaid,
     paymentStatus: newPaymentStatus
  });

  if (isBookingDoc) {
     await updateDoc(doc(db, 'payment_corrections', orderOrBooking.id), {
        amountPaid: newAmountPaid,
        paymentStatus: newPaymentStatus
     });
  }
};
