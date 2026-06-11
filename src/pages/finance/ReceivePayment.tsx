import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, updateDoc, increment, limit, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { PaymentReceipt, Order, Customer, BankAccount, InvoiceCollection } from '../../types';
import { 
  Wallet, 
  Plus, 
  Search, 
  Eye, 
  X, 
  Trash2, 
  CheckCircle2, 
  ArrowRight,
  Clock,
  Banknote,
  Navigation,
  Layers,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ReceivePayment() {
  const { profile, domainTenantId } = useAuth();
  const targetTenantId = domainTenantId || profile?.tenantId;

  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<PaymentReceipt | null>(null);
  const [search, setSearch] = useState('');

  // Form State
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [unpaidCollections, setUnpaidCollections] = useState<InvoiceCollection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<{ 
    collectionId: string, 
    collectionNumber: string, 
    amountToPay: number, 
    remaining: number,
    orderIds: string[]
  }[]>([]);
  
  const [unpaidStandaloneOrders, setUnpaidStandaloneOrders] = useState<Order[]>([]);
  const [selectedStandaloneOrders, setSelectedStandaloneOrders] = useState<{
    orderId: string,
    orderNumber: string,
    amountToPay: number,
    remaining: number
  }[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'Bank Transfer'>('Tunai');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [useSavings, setUseSavings] = useState(false);
  const [useSavingsAmount, setUseSavingsAmount] = useState(0);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [requestKoreksiReceipt, setRequestKoreksiReceipt] = useState<PaymentReceipt | null>(null);
  const [koreksiReasonType, setKoreksiReasonType] = useState('Salah Input Nominal');
  const [koreksiReasonDetail, setKoreksiReasonDetail] = useState('');
  const [isRequestingKoreksi, setIsRequestingKoreksi] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState<any[]>([]);

  useEffect(() => {
    if (!targetTenantId) return;

    const unsubCorrections = onSnapshot(query(
      collection(db, 'approval_requests'),
      where('tenantId', '==', targetTenantId),
      where('type', '==', 'payment_correction'),
      where('status', '==', 'pending')
    ), (snap) => {
      setPendingCorrections(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => {
      console.error('Error fetching pending corrections:', error);
    });

    return () => unsubCorrections();
  }, [targetTenantId]);

  useEffect(() => {
    if (!targetTenantId) return;

    const q = query(
      collection(db, 'payment_receipts'),
      where('tenantId', '==', targetTenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentReceipt)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [targetTenantId]);

  useEffect(() => {
    if (!targetTenantId || !isAddModalOpen) return;

    // Fetch Customers
    const fetchCustomers = async () => {
      const q = query(collection(db, 'customers'), where('tenantId', '==', targetTenantId));
      const snap = await getDocs(q);
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    };

    // Fetch Bank Accounts
    const fetchBanks = async () => {
      const q = query(collection(db, 'bank_accounts'), where('tenantId', '==', targetTenantId), where('isActive', '==', true));
      const snap = await getDocs(q);
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
    };

    fetchCustomers();
    fetchBanks();
  }, [targetTenantId, isAddModalOpen]);

  useEffect(() => {
    if (!selectedCustomerId || !targetTenantId) return;

    const fetchUnpaidItems = async () => {
      try {
        const qCol = query(
          collection(db, 'invoice_collections'),
          where('tenantId', '==', targetTenantId),
          where('customerId', '==', selectedCustomerId),
          where('status', '==', 'open')
        );
        const snapCol = await getDocs(qCol);
        const collections = snapCol.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceCollection));
        
        for (const col of collections) {
          if (!col.totalAmount || isNaN(col.totalAmount)) {
             if (col.orderIds && col.orderIds.length > 0) {
               const chunks = [];
               for (let i = 0; i < col.orderIds.length; i += 10) {
                 chunks.push(col.orderIds.slice(i, i + 10));
               }
               let fixedTotal = 0;
               let fixedPaid = 0;
               for (const chunk of chunks) {
                 const ordersSnap = await getDocs(query(collection(db, 'orders'), where('__name__', 'in', chunk)));
                 ordersSnap.forEach(oDoc => {
                   const data = oDoc.data();
                   fixedTotal += (Number(data.totalAmount) || Number(data.total) || 0);
                   fixedPaid += (Number(data.paidAmount) || 0);
                 });
               }
               col.totalAmount = fixedTotal;
               col.totalPaid = fixedPaid;
               col.totalSisa = fixedTotal - fixedPaid;
               await updateDoc(doc(db, 'invoice_collections', col.id), {
                 totalAmount: fixedTotal,
                 totalPaid: fixedPaid,
                 totalSisa: fixedTotal - fixedPaid
               });
             }
          }
        }
        setUnpaidCollections(collections);

        // Fetch Standalone Orders
        const qOrd = query(
          collection(db, 'orders'),
          where('tenantId', '==', targetTenantId),
          where('customerId', '==', selectedCustomerId)
        );
        const snapOrd = await getDocs(qOrd);
        const orders = snapOrd.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        const standaloneUnpaid = orders.filter(o => 
          (o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial') && o.isInCollection !== true
        );
        setUnpaidStandaloneOrders(standaloneUnpaid);
        
      } catch (err) {
        console.error('Error fetching unpaid items:', err);
      }
    };

    fetchUnpaidItems();
  }, [selectedCustomerId, targetTenantId]);

  const toggleCollectionSelection = (col: InvoiceCollection) => {
    const isSelected = selectedCollections.find(i => i.collectionId === col.id);
    if (isSelected) {
      setSelectedCollections(prev => prev.filter(i => i.collectionId !== col.id));
    } else {
      const colTotalAmount = Number(col.totalAmount) || 0;
      const colTotalPaid = Number(col.totalPaid) || 0;
      const colSisa = Number(col.totalSisa) || (colTotalAmount - colTotalPaid);
      const sisa = Math.round(Math.max(0, colSisa));
      setSelectedCollections(prev => [...prev, { 
        collectionId: col.id, 
        collectionNumber: col.collectionNumber, 
        amountToPay: sisa,
        remaining: sisa,
        orderIds: col.orderIds
      }]);
    }
  };

  const handleAmountChange = (collectionId: string, amount: number) => {
    setSelectedCollections(prev => prev.map(i => 
      i.collectionId === collectionId ? { ...i, amountToPay: amount } : i
    ));
  };

  const toggleOrderSelection = (order: Order) => {
    const isSelected = selectedStandaloneOrders.find(i => i.orderId === order.id);
    if (isSelected) {
      setSelectedStandaloneOrders(prev => prev.filter(i => i.orderId !== order.id));
    } else {
      const colTotalAmount = Number(order.totalAmount) || 0;
      const colTotalPaid = Number(order.paidAmount) || 0;
      const colSisa = colTotalAmount - colTotalPaid;
      const sisa = Math.round(Math.max(0, colSisa));
      setSelectedStandaloneOrders(prev => [...prev, { 
        orderId: order.id, 
        orderNumber: order.orderNumber, 
        amountToPay: sisa,
        remaining: sisa
      }]);
    }
  };

  const handleOrderAmountChange = (orderId: string, amount: number) => {
    setSelectedStandaloneOrders(prev => prev.map(i => 
      i.orderId === orderId ? { ...i, amountToPay: amount } : i
    ));
  };

  const resetForm = () => {
    setStep(1);
    setSelectedCustomerId('');
    setUnpaidCollections([]);
    setSelectedCollections([]);
    setUnpaidStandaloneOrders([]);
    setSelectedStandaloneOrders([]);
    setPaymentMethod('Tunai');
    setSelectedBankAccountId('');
    setUseSavings(false);
    setUseSavingsAmount(0);
    setNote('');
    setIsSubmitting(false);
  };

  const handleSaveReceipt = async () => {
    if (!targetTenantId || (selectedCollections.length === 0 && selectedStandaloneOrders.length === 0)) return;
    setIsSubmitting(true);

    try {
      const now = new Date();
      const prefix = `RP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Get Sequence
      const lastQ = query(
        collection(db, 'payment_receipts'),
        where('tenantId', '==', targetTenantId),
        where('receiptNumber', '>=', prefix),
        where('receiptNumber', '<=', prefix + '\uf8ff'),
        orderBy('receiptNumber', 'desc'),
        limit(1)
      );
      const lastSnap = await getDocs(lastQ);
      let seq = 1;
      if (!lastSnap.empty) {
        const lastNum = lastSnap.docs[0].data().receiptNumber;
        seq = parseInt(lastNum.slice(-6)) + 1;
      }
      const receiptNumber = `${prefix}${String(seq).padStart(6, '0')}`;

      // 1. Calculate Allocations and Update Collections & Orders
      const orderAllocations: any[] = [];
      const collectionDataList: any[] = [];

      for (const item of selectedCollections) {
        const colDoc = unpaidCollections.find(o => o.id === item.collectionId);
        if (!colDoc) continue;

        collectionDataList.push({
          collectionId: item.collectionId,
          collectionNumber: item.collectionNumber,
          amountPaid: item.amountToPay
        });

        const colRef = doc(db, 'invoice_collections', item.collectionId);
        const currentPaid = Number(colDoc.totalPaid) || 0;
        const currentAmountToPay = Number(item.amountToPay) || 0;
        const newTotalPaid = currentPaid + currentAmountToPay;
        const colTotalAmount = Number(colDoc.totalAmount) || 0;
        const newSisa = Math.max(0, colTotalAmount - newTotalPaid);
        const colStatus = newSisa <= 0 ? 'completed' : 'open';

        await updateDoc(colRef, {
          totalPaid: newTotalPaid,
          totalSisa: newSisa,
          status: colStatus
        });

        // Distribution logic for underlying orders
        let remainingPayment = currentAmountToPay;
        for (const orderId of colDoc.orderIds) {
          const orderRef = doc(db, 'orders', orderId);
          // If collection is completed, free all its orders from "isInCollection" flag
          if (colStatus === 'completed') {
            await updateDoc(orderRef, { isInCollection: false });
          }

          if (remainingPayment <= 0) continue;
          
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            const orderTotal = Number(orderData.totalAmount) || Number(orderData.total) || 0;
            const orderPaid = Number(orderData.paidAmount) || 0;
            const orderSisa = Math.max(0, orderTotal - orderPaid);

            if (orderSisa > 0) {
              const payToThisOrder = Math.min(orderSisa, remainingPayment);
              const orderNewPaid = orderPaid + payToThisOrder;
              
              const isFullyPaid = orderNewPaid >= orderTotal;
              const updateData: any = {
                paidAmount: increment(payToThisOrder),
                paymentStatus: isFullyPaid ? 'paid' : 'partial'
              };
              
              if (isFullyPaid && orderData.status !== 'completed') {
                updateData.status = 'completed';
              }
              
              await updateDoc(orderRef, updateData);

              if (isFullyPaid) {
                 import('../../lib/savings').then(({ processCustomerSavings }) => {
                    processCustomerSavings({
                       orderId: orderId,
                       orderTotal: orderTotal,
                       customerId: orderData.customerId || selectedCustomerId,
                       tenantId: targetTenantId || ''
                    }).catch(err => console.error("Error processing savings", err));
                 });
              }

              orderAllocations.push({
                orderId: orderId,
                orderNumber: orderData.orderNumber,
                date: orderData.date,
                dueDate: orderData.dueDate,
                createdAt: orderData.createdAt,
                totalAmount: orderTotal,
                amountPaid: payToThisOrder
              });

              remainingPayment -= payToThisOrder;
            }
          }
        }
      }

      for (const item of selectedStandaloneOrders) {
        const orderDoc = unpaidStandaloneOrders.find(o => o.id === item.orderId);
        if (!orderDoc) continue;

        const orderRef = doc(db, 'orders', item.orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const orderTotal = Number(orderData.totalAmount) || Number(orderData.total) || 0;
          const orderPaid = Number(orderData.paidAmount) || 0;
          
          const payToThisOrder = item.amountToPay;
          const orderNewPaid = orderPaid + payToThisOrder;
          
          const isFullyPaid = orderNewPaid >= orderTotal;
          const updateData: any = {
            paidAmount: increment(payToThisOrder),
            paymentStatus: isFullyPaid ? 'paid' : 'partial'
          };
          
          if (isFullyPaid && orderData.status !== 'completed') {
            updateData.status = 'completed';
          }
          
          await updateDoc(orderRef, updateData);

          if (isFullyPaid) {
             import('../../lib/savings').then(({ processCustomerSavings }) => {
                processCustomerSavings({
                   orderId: item.orderId,
                   orderTotal: orderTotal,
                   customerId: orderData.customerId || selectedCustomerId,
                   tenantId: targetTenantId || ''
                }).catch(err => console.error("Error processing savings", err));
             });
          }

          orderAllocations.push({
            orderId: item.orderId,
            orderNumber: orderData.orderNumber,
            date: orderData.date,
            dueDate: orderData.dueDate,
            createdAt: orderData.createdAt,
            totalAmount: orderTotal,
            amountPaid: payToThisOrder
          });
        }
      }

      // 2. Create Receipt
      const totalPaid = selectedCollections.reduce((sum, i) => sum + i.amountToPay, 0) + selectedStandaloneOrders.reduce((sum, i) => sum + i.amountToPay, 0);
      const actualSavingsUsed = useSavings ? useSavingsAmount : 0;
      const cashAmount = Math.max(0, totalPaid - actualSavingsUsed);
      const customer = customers.find(c => c.id === selectedCustomerId);
      const bank = bankAccounts.find(b => b.id === selectedBankAccountId);

      const cleanObj = (obj: any) => {
        Object.keys(obj).forEach(key => {
          if (obj[key] === undefined) {
            delete obj[key];
          }
        });
        return obj;
      };

      const receiptData = cleanObj({
        tenantId: targetTenantId,
        receiptNumber,
        customerId: selectedCustomerId,
        customerName: customer?.name || 'Unknown',
        date: serverTimestamp(),
        paymentMethod,
        bankAccountId: paymentMethod === 'Bank Transfer' ? (selectedBankAccountId || null) : null,
        bankAccountName: paymentMethod === 'Bank Transfer' ? (bank?.name || null) : null,
        amount: cashAmount,
        savingsAmount: actualSavingsUsed,
        note: note || null,
        collections: collectionDataList.map(cleanObj),
        invoices: orderAllocations.map(cleanObj),
        createdBy: profile.uid,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'payment_receipts'), receiptData);

      if (actualSavingsUsed > 0 && customer) {
        await updateDoc(doc(db, 'customers', customer.id), {
          savingsBalance: increment(-actualSavingsUsed)
        });
      }

      // 3. Create Transaction Records (One per Order so it links properly on Sales Order view)
      if (orderAllocations.length > 0) {
        for (const alloc of orderAllocations) {
          await addDoc(collection(db, 'transactions'), cleanObj({
            tenantId: targetTenantId,
            type: 'sale',
            amount: alloc.amountPaid,
            date: serverTimestamp(),
            status: 'completed',
            userId: profile.uid,
            description: `Receive Payment dari ${customer?.name} - ${receiptNumber} (Order ${alloc.orderNumber || 'Unknown'})`,
            transactionNumber: `TRX-RP-${receiptNumber}-${alloc.orderNumber || new Date().getTime()}`,
            orderId: alloc.orderId || null,
            orderNumber: alloc.orderNumber || null,
            bankAccountId: paymentMethod === 'Bank Transfer' ? (selectedBankAccountId || null) : null,
            createdAt: serverTimestamp()
          }));
        }
      } else {
        // Fallback if no order allocations were mapped (should be rare)
        await addDoc(collection(db, 'transactions'), cleanObj({
          tenantId: targetTenantId,
          type: 'sale',
          amount: totalPaid,
          date: serverTimestamp(),
          status: 'completed',
          userId: profile.uid,
          description: `Receive Payment dari ${customer?.name} - ${receiptNumber}`,
          transactionNumber: `TRX-RP-${receiptNumber}`,
          bankAccountId: paymentMethod === 'Bank Transfer' ? (selectedBankAccountId || null) : null,
          createdAt: serverTimestamp()
        }));
      }

      alert(`Berhasil menyimpan pembayaran #${receiptNumber}`);
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving receipt:', err);
      alert('Gagal menyimpan pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestKoreksi = async () => {
    const finalReason = koreksiReasonType === 'Lainnya' ? koreksiReasonDetail : koreksiReasonType;
    if (!requestKoreksiReceipt || !finalReason.trim() || !targetTenantId) return;
    setIsRequestingKoreksi(true);

    try {
      await addDoc(collection(db, 'approval_requests'), {
        tenantId: targetTenantId,
        type: 'payment_correction',
        receiptId: requestKoreksiReceipt.id,
        orderNumber: requestKoreksiReceipt.receiptNumber, // Maps to reference
        customerId: requestKoreksiReceipt.customerId,
        customerName: requestKoreksiReceipt.customerName,
        amount: requestKoreksiReceipt.amount,
        reason: finalReason,
        status: 'pending',
        requestedBy: profile?.uid,
        requestedByName: profile?.name || profile?.email || 'Kasir',
        requestedAt: serverTimestamp(),
        // We save a snapshot of the allocated invoices and collections for easy rollback reference 
        invoices: requestKoreksiReceipt.invoices || [],
        collections: requestKoreksiReceipt.collections || []
      });

      alert('Berhasil mengajukan koreksi payment ke Super Admin.');
      setRequestKoreksiReceipt(null);
      setKoreksiReasonType('Salah Input Nominal');
      setKoreksiReasonDetail('');
    } catch (err) {
      console.error('Error requesting koreksi:', err);
      alert('Gagal mengajukan koreksi payment.');
    } finally {
      setIsRequestingKoreksi(false);
    }
  };

  const filteredReceipts = receipts.filter(r => 
    r.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
    r.customerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-indigo-600" />
            Receive Payment
          </h2>
          <p className="text-gray-500 font-medium tracking-tight">Catat penerimaan piutang dari pelanggan.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-md font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm uppercase tracking-widest active:scale-95"
        >
          <Plus className="w-5 h-5" />
          TERIMA BAYAR
        </button>
      </div>

      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Penerimaan Hari Ini</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-gray-900">
              Rp.{receipts
                .filter(r => r.date?.toDate().toLocaleDateString() === new Date().toLocaleDateString())
                .reduce((sum, r) => sum + r.amount, 0)
                .toLocaleString()}
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Tunai</p>
          <span className="text-2xl font-black text-emerald-600">
            Rp.{receipts.filter(r => r.paymentMethod === 'Tunai').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
          </span>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Bank Transfer</p>
          <span className="text-2xl font-black text-indigo-600">
            Rp.{receipts.filter(r => r.paymentMethod === 'Bank Transfer').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Pending Corrections Table */}
      {pendingCorrections.length > 0 && (
        <div className="bg-amber-50/50 rounded-md border border-amber-100 shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-amber-100/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-md">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-amber-900 leading-tight">Status Pengajuan Koreksi</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-amber-100/30">
                  <th className="px-6 py-4 text-[10px] font-black text-amber-700 uppercase tracking-widest">Waktu Pengajuan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-amber-700 uppercase tracking-widest">No. Bukti</th>
                  <th className="px-6 py-4 text-[10px] font-black text-amber-700 uppercase tracking-widest">Alasan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-amber-700 uppercase tracking-widest">Diajukan Oleh</th>
                  <th className="px-6 py-4 text-[10px] font-black text-amber-700 uppercase tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/30">
                {pendingCorrections.map(c => (
                  <tr key={c.id} className="hover:bg-amber-50/80 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-amber-800">
                      {c.requestedAt?.toDate().toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-amber-900">
                      {c.orderNumber}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-amber-800">
                      {c.reason}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-amber-800">
                      {c.requestedByName}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 font-bold text-[10px] uppercase tracking-wider rounded-full">
                        Menunggu Approval
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/30">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari No. Bukti atau Pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-100 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tgl Bayar</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">No. Bukti</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pelanggan</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Metode</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Nominal</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredReceipts.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-gray-500">
                      {r.date?.toDate().toLocaleDateString('id-ID')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase">
                      #{r.receiptNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-700">{r.customerName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      r.paymentMethod === 'Tunai' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {r.paymentMethod}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-gray-900">
                      Rp.{Math.round(r.amount + (r.savingsAmount || 0)).toLocaleString('id-ID')}
                    </span>
                    {(r.savingsAmount || 0) > 0 && (
                      <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                        (Termasuk Tabungan: Rp {Math.round(r.savingsAmount || 0).toLocaleString('id-ID')})
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center gap-2">
                       <button 
                         onClick={() => setViewReceipt(r)}
                         className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                         title="Lihat Detail"
                       >
                         <Eye className="w-5 h-5" />
                       </button>
                       <button 
                         onClick={() => { setRequestKoreksiReceipt(r); setKoreksiReasonType(''); setKoreksiReasonDetail(''); }}
                         className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-all"
                         title="Koreksi Payment"
                       >
                         <AlertCircle className="w-5 h-5" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReceipts.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Clock className="w-12 h-12 text-gray-200" />
                       <p className="text-gray-400 font-bold mb-0">Belum ada rincian pembayaran.</p>
                       <p className="text-[10px] text-gray-400 uppercase tracking-widest">Klik "TERIMA BAYAR" untuk memulai.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Kwitansi Penerimaan</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase tracking-widest">Step {step} of 2</span>
                    <span className="text-white/60 text-xs font-bold uppercase tracking-tighter">— {step === 1 ? 'Pilih Invoices' : 'Detail Pembayaran'}</span>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {step === 1 ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Pilih Pelanggan</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => { setSelectedCustomerId(e.target.value); setSelectedCollections([]); }}
                        className="w-full p-2 bg-white border border-gray-100 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">-- Pilih Nama Pelanggan --</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                      </select>
                    </div>

                    {selectedCustomerId && (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="block text-xs font-semibold text-gray-600">Pilih Tagihan (Kolektif / Standalone) Yang Akan Dibayar</label>
                          <div className="space-y-2">
                            {unpaidCollections.length === 0 && unpaidStandaloneOrders.length === 0 ? (
                              <p className="p-8 text-center text-gray-400 font-medium bg-white rounded-md border border-dashed border-gray-200">Tidak ada tagihan tertunggak untuk pelanggan ini.</p>
                            ) : (
                              <>
                                {/* Collections */}
                                {unpaidCollections.map(col => {
                                  const selected = selectedCollections.find(i => i.collectionId === col.id);
                                  const sisa = col.totalSisa || (col.totalAmount - col.totalPaid);
                                  return (
                                    <div 
                                      key={col.id} 
                                      className={`p-5 rounded-[1.5rem] border transition-all cursor-pointer flex items-center justify-between group ${
                                        selected ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' : 'bg-white border-gray-100 hover:border-indigo-100'
                                      }`}
                                      onClick={() => toggleCollectionSelection(col)}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
                                          selected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                          <Layers className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-gray-900 uppercase">#{col.collectionNumber}</p>
                                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">{col.date?.toDate().toLocaleDateString('id-ID')}</p>
                                          <p className="text-[8px] font-bold text-indigo-500 uppercase mt-1">Kolektif ({col.orderNumbers.length} Invoices)</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sisa Tagihan</p>
                                        <p className="text-sm font-black text-gray-900">Rp.{sisa.toLocaleString()}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                                
                                {/* Standalone Orders */}
                                {unpaidStandaloneOrders.map(order => {
                                  const selected = selectedStandaloneOrders.find(i => i.orderId === order.id);
                                  const total = Number(order.totalAmount) || 0;
                                  const paid = Number(order.paidAmount) || 0;
                                  const sisa = Math.max(0, total - paid);
                                  return (
                                    <div 
                                      key={order.id} 
                                      className={`p-5 rounded-[1.5rem] border transition-all cursor-pointer flex items-center justify-between group ${
                                        selected ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100' : 'bg-white border-gray-100 hover:border-amber-100'
                                      }`}
                                      onClick={() => toggleOrderSelection(order)}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
                                          selected ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                          <Banknote className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-gray-900 uppercase">#{order.orderNumber}</p>
                                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">{(order.date || order.createdAt)?.toDate().toLocaleDateString('id-ID') || '-'}</p>
                                          <p className="text-[8px] font-bold text-amber-600 uppercase mt-1">Invoice Langsung</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sisa Tagihan</p>
                                        <p className="text-sm font-black text-gray-900">Rp.{sisa.toLocaleString()}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Alokasi Pembayaran
                      </h4>
                      <div className="space-y-4">
                        {selectedCollections.map(item => (
                          <div key={item.collectionId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-md border border-indigo-50">
                            <div>
                              <p className="text-xs font-black text-gray-900 uppercase">#{item.collectionNumber}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Sisa: Rp.{item.remaining.toLocaleString()}</p>
                            </div>
                            <div className="relative w-full sm:w-48">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">Rp</span>
                              <input 
                                type="text"
                                value={item.amountToPay > 0 ? item.amountToPay.toLocaleString('id-ID') : ''}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\./g, '');
                                  val = val.replace(/\D/g, '');
                                  handleAmountChange(item.collectionId, Number(val));
                                }}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-indigo-600"
                              />
                            </div>
                          </div>
                        ))}

                        {selectedStandaloneOrders.map(item => (
                          <div key={item.orderId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-md border border-amber-50">
                            <div>
                              <p className="text-xs font-black text-gray-900 uppercase">#{item.orderNumber}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Sisa: Rp.{item.remaining.toLocaleString()}</p>
                            </div>
                            <div className="relative w-full sm:w-48">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">Rp</span>
                              <input 
                                type="text"
                                value={item.amountToPay > 0 ? item.amountToPay.toLocaleString('id-ID') : ''}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\./g, '');
                                  val = val.replace(/\D/g, '');
                                  handleOrderAmountChange(item.orderId, Number(val));
                                }}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500 transition-all text-amber-600"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const selCust = customers.find(c => c.id === selectedCustomerId);
                      const totalAllocated = selectedCollections.reduce((sum, item) => sum + item.amountToPay, 0) + selectedStandaloneOrders.reduce((sum, item) => sum + item.amountToPay, 0);
                      if (selCust && selCust.hasSavingsProgram && (selCust.savingsBalance || 0) > 0) {
                        return (
                          <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                Tabungan / Berkah (Tersedia: Rp {Math.round(selCust.savingsBalance || 0).toLocaleString('id-ID')})
                              </h4>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={useSavings}
                                  onChange={(e) => {
                                      setUseSavings(e.target.checked);
                                      if (e.target.checked) {
                                          const defaultSavingsUse = Math.min(totalAllocated, selCust.savingsBalance || 0);
                                          setUseSavingsAmount(defaultSavingsUse);
                                      } else {
                                          setUseSavingsAmount(0);
                                      }
                                  }}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                            
                            {useSavings && (
                              <div className="relative w-full">
                                <span className="absolute left-3 top-1/2 -translate-y-[60%] text-xs font-black text-gray-400">Rp</span>
                                <input 
                                  type="text"
                                  value={useSavingsAmount > 0 ? useSavingsAmount.toLocaleString('id-ID') : ''}
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/\./g, '');
                                    val = val.replace(/\D/g, '');
                                    const numVal = Number(val);
                                    if (numVal <= (selCust.savingsBalance || 0) && numVal <= totalAllocated) {
                                       setUseSavingsAmount(numVal);
                                    }
                                  }}
                                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-emerald-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-emerald-600"
                                  placeholder="0"
                                />
                                <p className="text-[10px] text-emerald-600 font-bold mt-2">
                                  Tagihan Sisa (Tunai/Bank): Rp {Math.max(0, totalAllocated - useSavingsAmount).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="block text-xs font-semibold text-gray-600">Metode Pembayaran</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setPaymentMethod('Tunai')}
                            className={`p-4 rounded-md border-2 flex flex-col items-center gap-2 transition-all ${
                              paymentMethod === 'Tunai' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <Banknote className="w-6 h-6" />
                            <span className="text-[10px] font-black tracking-widest uppercase">TUNAI</span>
                          </button>
                          <button
                            onClick={() => setPaymentMethod('Bank Transfer')}
                            className={`p-4 rounded-md border-2 flex flex-col items-center gap-2 transition-all ${
                              paymentMethod === 'Bank Transfer' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <Navigation className="w-6 h-6" />
                            <span className="text-[10px] font-black tracking-widest uppercase">BANK TRF</span>
                          </button>
                        </div>
                      </div>

                      {paymentMethod === 'Bank Transfer' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                          <label className="block text-xs font-semibold text-gray-600">Pilih Akun Bank</label>
                          <select
                            value={selectedBankAccountId}
                            onChange={(e) => setSelectedBankAccountId(e.target.value)}
                            className="w-full p-2 bg-white border border-gray-100 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          >
                            <option value="">-- Pilih Bank --</option>
                            {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name} - {b.accountNumber}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <label className="block text-xs font-semibold text-gray-600">Catatan Tambahan (Opsional)</label>
                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Contoh: Titipan pembayaran bulan Januari..."
                        className="w-full p-2 bg-white border border-gray-100 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-gray-100 bg-gray-50 flex gap-4">
                {step === 1 ? (
                  <button
                    disabled={!selectedCustomerId || (selectedCollections.length === 0 && selectedStandaloneOrders.length === 0)}
                    onClick={() => setStep(2)}
                    className="w-full px-8 py-4 bg-indigo-600 text-white rounded-md font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-95"
                  >
                    LANJUT KE PEMBAYARAN
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setStep(1)}
                      className="px-8 py-4 bg-white border border-gray-200 text-gray-600 rounded-md font-medium hover:bg-gray-100 transition-all text-sm uppercase tracking-widest"
                    >
                      KEMBALI
                    </button>
                    <button
                      disabled={isSubmitting || (paymentMethod === 'Bank Transfer' && !selectedBankAccountId && ((selectedCollections.reduce((s,i) => s + i.amountToPay, 0) + selectedStandaloneOrders.reduce((s,i) => s + i.amountToPay, 0)) - (useSavings ? useSavingsAmount : 0) > 0))}
                      onClick={handleSaveReceipt}
                      className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-md font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-95"
                    >
                      {isSubmitting ? 'MENYIMPAN...' : 'SIMPAN & SELESAI'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail View Modal */}
      <AnimatePresence>
        {viewReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full max-w-3xl overflow-hidden ring-1 ring-gray-100 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-8 border-b border-gray-100 flex justify-between items-start bg-gradient-to-r from-gray-50 to-white">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">E-Receipt Official</p>
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-3">
                    <span className="text-gray-300 font-light">#</span>
                    {viewReceipt.receiptNumber}
                  </h3>
                </div>
                <button 
                  onClick={() => setViewReceipt(null)} 
                  className="p-3 hover:bg-gray-100 rounded-md transition-all text-gray-400 hover:text-gray-900 hover:rotate-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Info Bar */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diterima Dari</p>
                    <p className="text-xl font-black text-gray-900 flex items-center gap-2">
                      {viewReceipt.customerName}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tanggal Penerimaan</p>
                    <p className="text-sm font-black text-gray-800">
                      {viewReceipt.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Amount Card */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                  <div className="relative p-8 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100/50 flex flex-col md:flex-row justify-between items-center shadow-sm gap-6">
                    <div className="flex gap-8">
                      <div>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">Nominal Cash/Bank</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-emerald-400">Rp</span>
                          <p className="text-4xl font-black text-emerald-600 tracking-tighter">
                            {Math.round(viewReceipt.amount).toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                      {(viewReceipt.savingsAmount || 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">Potong Tabungan</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-indigo-400">Rp</span>
                            <p className="text-4xl font-black text-indigo-600 tracking-tighter">
                              {Math.round(viewReceipt.savingsAmount || 0).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="bg-white/60 backdrop-blur-md p-2 rounded-md border border-emerald-100 inline-block">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Payment Method</p>
                        <p className="text-sm font-black text-emerald-700 uppercase">{viewReceipt.paymentMethod}</p>
                        {viewReceipt.bankAccountName && (
                          <p className="text-[10px] font-bold text-emerald-500/80 mt-0.5">{viewReceipt.bankAccountName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Allocation Table */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end px-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail Alokasi Pesanan</p>
                    <p className="text-[10px] font-bold text-gray-400 border-b border-gray-100 italic">Total {viewReceipt.invoices?.length || 0} Invoice</p>
                  </div>
                  
                  <div className="bg-gray-50/30 rounded-xl border border-gray-100 overflow-hidden shadow-inner">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-gray-100">
                          <th className="p-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Order ID</th>
                          <th className="p-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Date</th>
                          <th className="p-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Due</th>
                          <th className="p-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Nominal</th>
                          <th className="p-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Allocation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white/50">
                        {(viewReceipt.invoices || []).map((inv, idx) => (
                          <tr key={idx} className="group hover:bg-white transition-colors duration-200">
                            <td className="p-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-900 uppercase">#{inv.orderNumber}</span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase">UID: {inv.orderId.slice(0, 8)}...</span>
                              </div>
                            </td>
                            <td className="p-5 text-center">
                              <span className="text-xs font-bold text-gray-500 tabular-nums">
                                {(inv.date || inv.createdAt)?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/') || '-'}
                              </span>
                            </td>
                            <td className="p-5 text-center">
                              <span className="text-xs font-bold text-gray-400 tabular-nums">
                                {(inv.dueDate || inv.date || inv.createdAt)?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/') || '-'}
                              </span>
                            </td>
                            <td className="p-5 text-right">
                              <span className="text-xs font-bold text-gray-600 tabular-nums">
                                {inv.totalAmount?.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-5 text-right">
                              <div className="inline-block py-1 px-3 bg-emerald-50 rounded-md group-hover:bg-emerald-100/50 transition-colors">
                                <span className="text-xs font-black text-emerald-600 tabular-nums">
                                  {inv.amountPaid.toLocaleString()}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Table Footer / Summary */}
                    <div className="p-6 bg-white border-t border-gray-100 flex flex-col gap-3">
                      <div className="flex justify-between items-center max-w-[240px] ml-auto w-full">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pesanan</span>
                        <span className="text-sm font-black text-gray-900 tabular-nums">
                          Rp.{(viewReceipt.invoices || []).reduce((acc, inv) => acc + (inv.totalAmount || 0), 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center max-w-[240px] ml-auto w-full">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Terbayar</span>
                        <span className="text-sm font-black text-emerald-600 tabular-nums">
                          Rp.{(viewReceipt.invoices || []).reduce((acc, inv) => acc + inv.amountPaid, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center max-w-[240px] ml-auto w-full pt-2 border-t border-gray-50">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selisih (Difference)</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black tabular-nums ${( (viewReceipt.invoices || []).reduce((acc, inv) => acc + (inv.totalAmount || 0), 0) - (viewReceipt.invoices || []).reduce((acc, inv) => acc + inv.amountPaid, 0) ) === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {(() => {
                              const totalOrder = (viewReceipt.invoices || []).reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
                              const totalPaid = (viewReceipt.invoices || []).reduce((acc, inv) => acc + inv.amountPaid, 0);
                              const diff = totalOrder - totalPaid;
                              
                              if (diff > 0) return `< Rp.${diff.toLocaleString()}`; // Kurang bayar / Sisa
                              if (diff < 0) return `> Rp.${Math.abs(diff).toLocaleString()}`; // Lebih bayar
                              return `Rp.${diff.toLocaleString()}`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {viewReceipt.note && (
                  <div className="p-6 bg-amber-50/30 rounded-xl border border-amber-100/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Layers className="w-8 h-8 text-amber-900" />
                    </div>
                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      Narasi / Catatan
                    </div>
                    <p className="text-xs font-semibold text-amber-900/70 leading-relaxed italic pr-8">
                      "{viewReceipt.note}"
                    </p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-gray-50/80 backdrop-blur-sm border-t border-gray-100 flex justify-between items-center">
                <div className="text-[9px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tighter">
                  <ShieldCheck className="w-3 h-3" />
                  Sistem Validasi Otomatis v2.4
                </div>
                <button
                  onClick={() => setViewReceipt(null)}
                  className="px-8 py-3.5 bg-gray-900 text-white rounded-md text-xs font-black hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-95 uppercase tracking-[0.2em]"
                >
                  Selesai & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Koreksi Modal */}
      <AnimatePresence>
        {requestKoreksiReceipt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-amber-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-md">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-amber-900 leading-tight">Pengajuan Koreksi</h3>
                    <p className="text-xs font-medium text-amber-700/70 uppercase tracking-widest">{requestKoreksiReceipt.receiptNumber}</p>
                  </div>
                </div>
                <button onClick={() => setRequestKoreksiReceipt(null)} className="p-2 text-amber-900/50 hover:bg-amber-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4" flex-1 overflow-y-auto auto-rows-max>
                <p className="text-sm text-gray-600">
                  Anda akan mengajukan koreksi untuk pembayaran dari <strong className="text-gray-900">{requestKoreksiReceipt.customerName}</strong> senilai <strong className="text-gray-900">Rp.{requestKoreksiReceipt.amount.toLocaleString()}</strong>.
                </p>
                <p className="text-sm text-gray-600">
                  Koreksi memerlukan persetujuan dari Super Admin. Jika disetujui, pembayaran ini akan dibatalkan, dan status order serta piutang akan dikembalikan seperti semula.
                </p>
                
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest">Alasan Koreksi</label>
                    <select
                      value={koreksiReasonType}
                      onChange={(e) => setKoreksiReasonType(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500 transition-all appearance-none"
                    >
                      <option value="Salah Salesman">Salah Salesman</option>
                      <option value="Salah Input Nominal">Salah Input Nominal</option>
                      <option value="Salah Bank">Salah Bank</option>
                      <option value="Salah Tanggal">Salah Tanggal</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  {koreksiReasonType === 'Lainnya' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest">Detail Alasan Lainnya</label>
                      <textarea
                        rows={3}
                        value={koreksiReasonDetail}
                        onChange={(e) => setKoreksiReasonDetail(e.target.value)}
                        placeholder="Masukkan alasan yang lebih detail..."
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setRequestKoreksiReceipt(null)}
                  disabled={isRequestingKoreksi}
                  className="flex-1 py-3 text-gray-600 font-bold rounded-md hover:bg-gray-100 transition-colors text-sm uppercase tracking-widest"
                >
                  Batal
                </button>
                <button
                  onClick={handleRequestKoreksi}
                  disabled={(koreksiReasonType === 'Lainnya' && !koreksiReasonDetail.trim()) || isRequestingKoreksi}
                  className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-md shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all disabled:opacity-50 disabled:grayscale text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isRequestingKoreksi ? 'Memproses...' : 'Ajukan Koreksi'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
