import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, deleteDoc, getDocs, getDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ShoppingCart, 
  Wallet, 
  Truck, 
  AlertCircle,
  FileText,
  User,
  Calendar,
  Eye,
  Info,
  Package,
  ArrowRight,
  Trash2,
  RefreshCcw // adding this for Koreksi
} from 'lucide-react';

type ApprovalType = 'Sales' | 'Finance' | 'Purchase' | 'Deletion' | 'Correction';

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  subtitle: string;
  amount?: number;
  status: string;
  date: any;
  rawData: any;
}

export default function Approvals() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ApprovalType>('Sales');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  useEffect(() => {
    if (!profile?.tenantId) return;

    setLoading(true);
    const unsubscribes: (() => void)[] = [];

    // 1. Sales Approvals (Orders with status 'pending')
    const salesQuery = query(
      collection(db, 'orders'),
      where('tenantId', '==', profile.tenantId),
      where('status', '==', 'pending')
    );
    const unsubSales = onSnapshot(salesQuery, (snap) => {
      const salesItems: ApprovalItem[] = snap.docs.map(d => ({
        id: d.id,
        type: 'Sales',
        title: `Order ${d.data().orderNumber}`,
        subtitle: `Customer: ${d.data().customerName || 'Unknown'}`,
        amount: d.data().totalAmount,
        status: d.data().status,
        date: d.data().date,
        rawData: { ...d.data(), collection: 'orders' }
      }));
      updateItems('Sales', salesItems);
    });
    unsubscribes.push(unsubSales);

    // 2. Finance Approvals (Transactions with status 'pending')
    const financeQuery = query(
      collection(db, 'transactions'),
      where('tenantId', '==', profile.tenantId),
      where('status', '==', 'pending')
    );
    const unsubFinance = onSnapshot(financeQuery, (snap) => {
      const financeItems: ApprovalItem[] = snap.docs.map(d => ({
        id: d.id,
        type: 'Finance',
        title: d.data().description || 'Transaction',
        subtitle: `Type: ${d.data().type} - Category: ${d.data().category}`,
        amount: d.data().amount,
        status: d.data().status,
        date: d.data().date,
        rawData: { ...d.data(), collection: 'transactions' }
      }));
      updateItems('Finance', financeItems);
    });
    unsubscribes.push(unsubFinance);

    // 3. Purchase Approvals (Purchase Requests with status 'pending')
    const purchaseQuery = query(
      collection(db, 'purchase_requests'),
      where('tenantId', '==', profile.tenantId),
      where('status', '==', 'pending')
    );
    const unsubPurchase = onSnapshot(purchaseQuery, (snap) => {
      const purchaseItems: ApprovalItem[] = snap.docs.map(d => ({
        id: d.id,
        type: 'Purchase',
        title: `PR ${d.data().prNumber}`,
        subtitle: `Requested by: ${d.data().requestedByName || 'Staff'}`,
        status: d.data().status,
        date: d.data().date,
        rawData: { ...d.data(), collection: 'purchase_requests' }
      }));
      updateItems('Purchase', purchaseItems);
    });
    unsubscribes.push(unsubPurchase);

    // 4. Delete Requests (status 'pending')
    const deleteQuery = query(
      collection(db, 'delete_requests'),
      where('tenantId', '==', profile.tenantId),
      where('status', '==', 'pending')
    );
    const unsubDelete = onSnapshot(deleteQuery, (snap) => {
      const deleteItems: ApprovalItem[] = snap.docs.map(d => ({
        id: d.id,
        type: 'Deletion' as ApprovalType,
        title: `Hapus: ${d.data().sourceNumber}`,
        subtitle: `Alasan: ${d.data().reason} - Oleh: ${d.data().requestedByName}`,
        status: d.data().status,
        date: d.data().createdAt,
        rawData: { ...d.data(), collection: 'delete_requests' }
      }));
      updateItems('Deletion', deleteItems);
    });
    unsubscribes.push(unsubDelete);

    // 5. Correction Requests (status 'pending')
    const correctionQuery = query(
      collection(db, 'approval_requests'),
      where('tenantId', '==', profile.tenantId),
      where('type', '==', 'payment_correction'),
      where('status', '==', 'pending')
    );
    const unsubCorrection = onSnapshot(correctionQuery, (snap) => {
      const correctionItems: ApprovalItem[] = snap.docs.map(d => ({
        id: d.id,
        type: 'Correction' as ApprovalType,
        title: `Koreksi: ${d.data().orderNumber}`,
        subtitle: `Pelanggan: ${d.data().customerName} - Oleh: ${d.data().requestedByName}`,
        amount: d.data().amount,
        status: d.data().status,
        date: d.data().createdAt || d.data().requestedAt,
        rawData: { ...d.data(), collection: 'approval_requests' }
      }));
      updateItems('Correction', correctionItems);
    });
    unsubscribes.push(unsubCorrection);

    return () => unsubscribes.forEach(unsub => unsub());
  }, [profile]);

  const [allData, setAllData] = useState<Record<ApprovalType, ApprovalItem[]>>({
    Sales: [],
    Finance: [],
    Purchase: [],
    Deletion: [],
    Correction: []
  });

  const updateItems = (type: ApprovalType, newItems: ApprovalItem[]) => {
    setAllData(prev => {
      const updated = { ...prev, [type]: newItems };
      setLoading(false);
      return updated;
    });
  };

  const filteredItems = allData[activeTab] || [];

  const handleAction = async (item: ApprovalItem, action: 'approve' | 'reject') => {
    setIsProcessing(item.id);
    try {
      const docRef = doc(db, item.rawData.collection, item.id);
      let status = '';
      
      if (item.type === 'Sales') {
        status = action === 'approve' ? 'processing' : 'cancelled';
      } else if (item.type === 'Finance') {
        status = action === 'approve' ? 'completed' : 'cancelled';
      } else if (item.type === 'Purchase') {
        status = action === 'approve' ? 'approved' : 'rejected';
      } else if (item.type === 'Deletion') {
        if (action === 'approve') {
          // If we are deleting an order, revert its generated customer tabungan before deletion
          if (item.rawData.sourceCollection === 'orders') {
            const orderRef = doc(db, 'orders', item.rawData.sourceId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
               const orderData = orderSnap.data();
               if (orderData.savingsAdded && orderData.savingsAmount > 0 && orderData.customerId) {
                   const { revertCustomerSavings } = await import('../lib/savings');
                   await revertCustomerSavings({ orderId: item.rawData.sourceId, customerId: orderData.customerId });
               }
            }
          }
          // Actual deletion of the source document
          await deleteDoc(doc(db, item.rawData.sourceCollection, item.rawData.sourceId));
          status = 'approved';
        } else {
          status = 'rejected';
        }
      } else if (item.type === 'Correction') {
        if (action === 'approve') {
          // Rollback the receipt
          const batch = writeBatch(db);
          
          // 1. Revert Invoices (orders collection)
          if (Array.isArray(item.rawData.invoices)) {
            for (const inv of item.rawData.invoices) {
              const orderRef = doc(db, 'orders', inv.orderId);
              const orderSnap = await getDoc(orderRef);
              if (orderSnap.exists()) {
                 const currentData = orderSnap.data();
                 const currentPaid = Number(currentData.paidAmount) || 0;
                 const allocatedAmount = Number(inv.amountPaid) || 0;
                 const newPaid = Math.max(0, currentPaid - allocatedAmount);
                 const orderTotal = Number(currentData.totalAmount) || Number(currentData.total) || 0;
                 
                 // If it was corrected, the payment is undone.
                 let paymentStatus = newPaid <= 0 ? 'unpaid' : (newPaid < orderTotal ? 'partial' : 'paid');
                 
                 let statusToSet = currentData.status;
                 // If the order was fully completed by this payment, maybe revert to processing or pending
                 if (currentData.status === 'completed' && paymentStatus !== 'paid') {
                    statusToSet = 'pending'; // revert to pending to be collected again
                 }
                 
                 batch.update(orderRef, {
                   paidAmount: newPaid,
                   paymentStatus: paymentStatus,
                   status: statusToSet
                 });

                 if (paymentStatus !== 'paid' && item.rawData.customerId) {
                   import('../lib/savings').then(({ revertCustomerSavings }) => {
                     revertCustomerSavings({ orderId: inv.orderId, customerId: item.rawData.customerId })
                       .catch(console.error);
                   });
                 }
              }
            }
          }

          // 2. Revert Collections (invoice_collections)
          if (Array.isArray(item.rawData.collections)) {
            for (const col of item.rawData.collections) {
              const colRef = doc(db, 'invoice_collections', col.collectionId);
              const colSnap = await getDoc(colRef);
              if (colSnap.exists()) {
                const currentData = colSnap.data();
                const totalPaid = Number(currentData.totalPaid) || 0;
                const allocatedAmount = Number(col.amountPaid) || 0;
                
                const newTotalPaid = Math.max(0, totalPaid - allocatedAmount);
                const colTotalAmount = Number(currentData.totalAmount) || 0;
                const newSisa = Math.max(0, colTotalAmount - newTotalPaid);
                
                batch.update(colRef, {
                  totalPaid: newTotalPaid,
                  totalSisa: newSisa,
                  status: 'open' // since we just removed payment, it should be open
                });
              }
            }
          }

          // 3. Delete related transactions
          const receiptNumberToMatch = item.rawData.orderNumber || item.rawData.receiptNumber || '';
          if (receiptNumberToMatch) {
            const trxQuery = query(
              collection(db, 'transactions'),
              where('tenantId', '==', profile?.tenantId),
              where('transactionNumber', '>=', `TRX-RP-${receiptNumberToMatch}`),
              where('transactionNumber', '<=', `TRX-RP-${receiptNumberToMatch}\uf8ff`)
            );
            const trxSnap = await getDocs(trxQuery);
            trxSnap.forEach(tDoc => {
               batch.delete(tDoc.ref);
            });
          }
          
          // 4. Revert used tabungan (savingsAmount)
          if (item.rawData.receiptId) {
             const receiptRef = doc(db, 'payment_receipts', item.rawData.receiptId);
             const receiptSnap = await getDoc(receiptRef);
             if (receiptSnap.exists()) {
                const rData = receiptSnap.data();
                if (rData.savingsAmount && rData.savingsAmount > 0 && rData.customerId) {
                   batch.update(doc(db, 'customers', rData.customerId), {
                      savingsBalance: increment(rData.savingsAmount)
                   });
                }
             }
             // 5. Delete the actual receipt
             batch.delete(receiptRef);
          }

          await batch.commit();
          status = 'approved';
        } else {
          status = 'rejected';
        }
      }

      await updateDoc(docRef, {
        status,
        resolvedBy: profile?.uid,
        resolvedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error processing approval:', err);
      alert('Failed to process approval');
    } finally {
      setIsProcessing(null);
    }
  };

  const tabs: { type: ApprovalType; icon: any; label: string }[] = [
    { type: 'Sales', icon: ShoppingCart, label: 'Sales' },
    { type: 'Finance', icon: Wallet, label: 'Finance' },
    { type: 'Purchase', icon: Truck, label: 'Purchase' },
    { type: 'Correction', icon: RefreshCcw, label: 'Koreksi Payment' },
    { type: 'Deletion', icon: Trash2, label: 'Penghapusan' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pusat Persetujuan (Approvals)</h2>
          <p className="text-gray-500 text-sm">Kelola semua pengajuan yang membutuhkan tindakan Anda di satu tempat.</p>
        </div>
        
        <div className="relative inline-block text-left">
          <div className="flex bg-white p-1 rounded-md border border-gray-200 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  activeTab === tab.type
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <tab.icon className={`w-4 h-4 mr-2 ${activeTab === tab.type ? 'text-white' : 'text-gray-400'}`} />
                {tab.label}
                {allData[tab.type].length > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.type ? 'bg-white text-indigo-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {allData[tab.type].length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className={`p-6 text-white flex justify-between items-center ${
                selectedItem.type === 'Sales' ? 'bg-indigo-600' :
                selectedItem.type === 'Finance' ? 'bg-green-600' :
                selectedItem.type === 'Deletion' ? 'bg-red-600' :
                'bg-orange-600'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-md">
                    {selectedItem.type === 'Sales' ? <ShoppingCart className="w-5 h-5" /> :
                     selectedItem.type === 'Finance' ? <Wallet className="w-5 h-5" /> :
                     selectedItem.type === 'Deletion' ? <Trash2 className="w-5 h-5" /> :
                     <Truck className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedItem.title}</h3>
                    <p className="text-xs opacity-80 uppercase tracking-widest font-bold">{selectedItem.type} Approval</p>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                {/* Common Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <span className="px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 text-[10px] font-bold uppercase">
                      {selectedItem.status}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tanggal</p>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedItem.date?.seconds ? new Date(selectedItem.date.seconds * 1000).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>

                {/* Specific Details */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-3 h-3" /> Detail Pengajuan
                  </h4>
                  
                  {selectedItem.type === 'Sales' && (
                    <div className="space-y-3">
                      <div className="border border-gray-100 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>
                              <th className="px-4 py-2 text-left font-bold">Item</th>
                              <th className="px-4 py-2 text-center font-bold">Qty</th>
                              <th className="px-4 py-2 text-right font-bold">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {selectedItem.rawData.items?.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                <td className="px-4 py-3 text-center text-gray-500">{item.quantity}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">Rp.{(item.price * item.quantity).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-md">
                        <span className="font-bold text-indigo-900">Total Pesanan</span>
                        <span className="text-xl font-black text-indigo-600">Rp.{selectedItem.amount?.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {selectedItem.type === 'Finance' && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-md space-y-3">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deskripsi</p>
                          <p className="text-sm text-gray-900 font-medium">{selectedItem.rawData.description || '-'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/50">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kategori</p>
                            <p className="text-sm text-gray-900 font-bold">{selectedItem.rawData.category}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aktivitas</p>
                            <p className="text-sm text-gray-900 font-bold">{selectedItem.rawData.activity}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-green-50 rounded-md">
                        <span className="font-bold text-green-900">Jumlah Transaksi</span>
                        <span className="text-xl font-black text-green-600">Rp.{selectedItem.amount?.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {selectedItem.type === 'Purchase' && (
                    <div className="space-y-3">
                      <div className="border border-gray-100 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>
                              <th className="px-4 py-2 text-left font-bold">Item</th>
                              <th className="px-4 py-2 text-center font-bold">Jumlah</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {selectedItem.rawData.items?.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                                  <Package className="w-4 h-4 text-gray-400" />
                                  {item.name}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-900">{item.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-md">
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Alasan Pengajuan</p>
                        <p className="text-sm text-orange-900 font-medium">{selectedItem.rawData.reason || 'Tidak ada alasan spesifik.'}</p>
                      </div>
                    </div>
                  )}

                  {selectedItem.type === 'Correction' && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 p-4 rounded-md border border-amber-100">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Target Koreksi Pembayaran</p>
                        <p className="font-bold text-amber-900">{selectedItem.rawData.orderNumber || selectedItem.rawData.receiptNumber}</p>
                        <p className="text-xs text-amber-700 mt-1 opacity-70">Refund / Undo nominal: Rp.{selectedItem.amount?.toLocaleString()}</p>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-md space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alasan Koreksi</p>
                          <p className="text-sm text-gray-900 font-bold">{selectedItem.rawData.reason}</p>
                        </div>
                        <div className="pt-2 border-t border-gray-200/50 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diajukan Oleh</p>
                            <p className="text-sm text-gray-900 font-bold">{selectedItem.rawData.requestedByName}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedItem.type === 'Deletion' && (
                    <div className="space-y-4">
                      <div className="bg-red-50 p-4 rounded-md border border-red-100">
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Target Penghapusan</p>
                        <p className="font-bold text-red-900">{selectedItem.rawData.sourceNumber}</p>
                        <p className="text-xs text-red-600 mt-1 opacity-70">ID: {selectedItem.rawData.sourceId}</p>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-md space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alasan</p>
                          <p className="text-sm text-gray-900 font-bold">{selectedItem.rawData.reason}</p>
                        </div>
                        {selectedItem.rawData.notes && (
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Catatan</p>
                            <p className="text-sm text-gray-900 font-medium">{selectedItem.rawData.notes}</p>
                          </div>
                        )}
                        <div className="pt-2 border-t border-gray-200/50 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diajukan Oleh</p>
                            <p className="text-sm text-gray-900 font-bold">{selectedItem.rawData.requestedByName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deadline</p>
                            <p className="text-xs font-bold text-red-600">{new Date(selectedItem.rawData.deadline).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => { handleAction(selectedItem, 'reject'); setSelectedItem(null); }}
                  disabled={isProcessing === selectedItem.id}
                  className="flex-1 py-3 border border-red-100 text-red-600 font-medium rounded-md hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" /> Tolak
                </button>
                <button
                  onClick={() => { handleAction(selectedItem, 'approve'); setSelectedItem(null); }}
                  disabled={isProcessing === selectedItem.id}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> Setujui
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-20 text-center"
            >
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Memuat data pengajuan...</p>
            </motion.div>
          ) : filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-20 bg-white rounded-md border border-dashed border-gray-200 text-center"
            >
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Semua Beres!</h3>
              <p className="text-gray-500">Tidak ada pengajuan {activeTab} yang menunggu persetujuan.</p>
            </motion.div>
          ) : (
            filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white p-6 rounded-md border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-md ${
                    item.type === 'Sales' ? 'bg-indigo-50 text-indigo-600' :
                    item.type === 'Finance' ? 'bg-green-50 text-green-600' :
                    item.type === 'Deletion' ? 'bg-red-50 text-red-600' :
                    item.type === 'Correction' ? 'bg-amber-50 text-amber-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {item.type === 'Sales' ? <ShoppingCart className="w-6 h-6" /> :
                     item.type === 'Finance' ? <Wallet className="w-6 h-6" /> :
                     item.type === 'Deletion' ? <Trash2 className="w-6 h-6" /> :
                     item.type === 'Correction' ? <RefreshCcw className="w-6 h-6" /> :
                     <Truck className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase border border-yellow-100 flex items-center">
                        <Clock className="w-3 h-3 mr-1" /> Pending
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{item.subtitle}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <button 
                        onClick={() => setSelectedItem(item)}
                        className="flex items-center text-indigo-600 font-bold hover:underline"
                      >
                        <Eye className="w-3 h-3 mr-1" /> Lihat Detail
                      </button>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {item.date?.seconds ? new Date(item.date.seconds * 1000).toLocaleString() : 'Baru saja'}
                      </span>
                      {item.amount !== undefined && (
                        <span className="font-bold text-gray-900">
                          Rp.{item.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleAction(item, 'reject')}
                    disabled={isProcessing === item.id}
                    className="flex-1 md:flex-none px-6 py-2.5 border border-red-100 text-red-600 font-medium rounded-md hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Tolak
                  </button>
                  <button
                    onClick={() => handleAction(item, 'approve')}
                    disabled={isProcessing === item.id}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing === item.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Setujui
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
