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
  ShieldCheck
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
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'Bank Transfer'>('Tunai');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const fetchCollections = async () => {
      try {
        const q = query(
          collection(db, 'invoice_collections'),
          where('tenantId', '==', targetTenantId),
          where('customerId', '==', selectedCustomerId),
          where('status', '==', 'open')
        );
        const snap = await getDocs(q);
        setUnpaidCollections(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceCollection)));
      } catch (err) {
        console.error('Error fetching collections:', err);
      }
    };

    fetchCollections();
  }, [selectedCustomerId, targetTenantId]);

  const toggleCollectionSelection = (col: InvoiceCollection) => {
    const isSelected = selectedCollections.find(i => i.collectionId === col.id);
    if (isSelected) {
      setSelectedCollections(prev => prev.filter(i => i.collectionId !== col.id));
    } else {
      const sisa = col.totalSisa || (col.totalAmount - col.totalPaid);
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

  const resetForm = () => {
    setStep(1);
    setSelectedCustomerId('');
    setUnpaidCollections([]);
    setSelectedCollections([]);
    setPaymentMethod('Tunai');
    setSelectedBankAccountId('');
    setNote('');
    setIsSubmitting(false);
  };

  const handleSaveReceipt = async () => {
    if (!targetTenantId || selectedCollections.length === 0) return;
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
        const currentPaid = colDoc.totalPaid || 0;
        const newTotalPaid = currentPaid + item.amountToPay;
        const newSisa = colDoc.totalAmount - newTotalPaid;
        const colStatus = newSisa <= 0 ? 'completed' : 'open';

        await updateDoc(colRef, {
          totalPaid: newTotalPaid,
          totalSisa: newSisa,
          status: colStatus
        });

        // Distribution logic for underlying orders
        let remainingPayment = item.amountToPay;
        for (const orderId of colDoc.orderIds) {
          if (remainingPayment <= 0) break;
          
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            const orderTotal = orderData.totalAmount;
            const orderPaid = orderData.paidAmount || 0;
            const orderSisa = orderTotal - orderPaid;

            if (orderSisa > 0) {
              const payToThisOrder = Math.min(orderSisa, remainingPayment);
              const orderNewPaid = orderPaid + payToThisOrder;
              
              await updateDoc(orderRef, {
                paidAmount: increment(payToThisOrder),
                paymentStatus: orderNewPaid >= orderTotal ? 'paid' : 'partial'
              });

              orderAllocations.push({
                orderId: orderId,
                orderNumber: orderData.orderNumber,
                date: orderData.date,
                dueDate: orderData.dueDate,
                totalAmount: orderTotal,
                amountPaid: payToThisOrder
              });

              remainingPayment -= payToThisOrder;
            }
          }
        }
      }

      // 2. Create Receipt
      const totalPaid = selectedCollections.reduce((sum, i) => sum + i.amountToPay, 0);
      const customer = customers.find(c => c.id === selectedCustomerId);
      const bank = bankAccounts.find(b => b.id === selectedBankAccountId);

      const receiptData = {
        tenantId: targetTenantId,
        receiptNumber,
        customerId: selectedCustomerId,
        customerName: customer?.name || 'Unknown',
        date: serverTimestamp(),
        paymentMethod,
        bankAccountId: paymentMethod === 'Bank Transfer' ? selectedBankAccountId : null,
        bankAccountName: paymentMethod === 'Bank Transfer' ? bank?.name : null,
        amount: totalPaid,
        note,
        collections: collectionDataList,
        invoices: orderAllocations,
        createdBy: profile.uid,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'payment_receipts'), receiptData);

      // 3. Create Transaction
      await addDoc(collection(db, 'transactions'), {
        tenantId: targetTenantId,
        type: 'sale',
        amount: totalPaid,
        date: serverTimestamp(),
        status: 'completed',
        userId: profile.uid,
        description: `Receive Payment dari ${customer?.name} - ${receiptNumber}`,
        transactionNumber: `TRX-RP-${receiptNumber}`,
        bankAccountId: paymentMethod === 'Bank Transfer' ? selectedBankAccountId : null,
        createdAt: serverTimestamp()
      });

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
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm uppercase tracking-widest active:scale-95"
        >
          <Plus className="w-5 h-5" />
          TERIMA BAYAR
        </button>
      </div>

      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
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
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Tunai</p>
          <span className="text-2xl font-black text-emerald-600">
            Rp.{receipts.filter(r => r.paymentMethod === 'Tunai').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
          </span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Bank Transfer</p>
          <span className="text-2xl font-black text-indigo-600">
            Rp.{receipts.filter(r => r.paymentMethod === 'Bank Transfer').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/30">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari No. Bukti atau Pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
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
                      Rp.{r.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setViewReceipt(r)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
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
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
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
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Pilih Pelanggan</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => { setSelectedCustomerId(e.target.value); setSelectedCollections([]); }}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">-- Pilih Nama Pelanggan --</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                      </select>
                    </div>

                    {selectedCustomerId && (
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Pilih Koleksi Tagihan Yang Akan Dibayar</label>
                        <div className="space-y-2">
                          {unpaidCollections.length === 0 ? (
                            <p className="p-8 text-center text-gray-400 font-bold bg-gray-50 rounded-2xl border border-dashed border-gray-200">Tidak ada koleksi tagihan untuk pelanggan ini.</p>
                          ) : unpaidCollections.map(col => {
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
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                    selected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                                  }`}>
                                    <Layers className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-gray-900 uppercase">#{col.collectionNumber}</p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">{col.date?.toDate().toLocaleDateString('id-ID')}</p>
                                    <p className="text-[8px] font-bold text-indigo-500 uppercase mt-1">{col.orderNumbers.length} Invoices</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sisa Tagihan</p>
                                  <p className="text-sm font-black text-gray-900">Rp.{sisa.toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Alokasi Pembayaran
                      </h4>
                      <div className="space-y-4">
                        {selectedCollections.map(item => (
                          <div key={item.collectionId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-indigo-50">
                            <div>
                              <p className="text-xs font-black text-gray-900 uppercase">#{item.collectionNumber}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Sisa: Rp.{item.remaining.toLocaleString()}</p>
                            </div>
                            <div className="relative w-full sm:w-48">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">Rp</span>
                              <input 
                                type="number"
                                value={item.amountToPay}
                                onChange={(e) => handleAmountChange(item.collectionId, Number(e.target.value))}
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-indigo-600"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Metode Pembayaran</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setPaymentMethod('Tunai')}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                              paymentMethod === 'Tunai' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <Banknote className="w-6 h-6" />
                            <span className="text-[10px] font-black tracking-widest uppercase">TUNAI</span>
                          </button>
                          <button
                            onClick={() => setPaymentMethod('Bank Transfer')}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
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
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Pilih Akun Bank</label>
                          <select
                            value={selectedBankAccountId}
                            onChange={(e) => setSelectedBankAccountId(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          >
                            <option value="">-- Pilih Bank --</option>
                            {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name} - {b.accountNumber}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Catatan Tambahan (Opsional)</label>
                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Contoh: Titipan pembayaran bulan Januari..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-gray-100 bg-gray-50 flex gap-4">
                {step === 1 ? (
                  <button
                    disabled={!selectedCustomerId || selectedCollections.length === 0}
                    onClick={() => setStep(2)}
                    className="w-full px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-95"
                  >
                    LANJUT KE PEMBAYARAN
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setStep(1)}
                      className="px-8 py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl font-black hover:bg-gray-100 transition-all text-sm uppercase tracking-widest"
                    >
                      KEMBALI
                    </button>
                    <button
                      disabled={isSubmitting || (paymentMethod === 'Bank Transfer' && !selectedBankAccountId)}
                      onClick={handleSaveReceipt}
                      className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-95"
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
              className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full max-w-3xl overflow-hidden ring-1 ring-gray-100"
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
                  className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-400 hover:text-gray-900 hover:rotate-90"
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
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                  <div className="relative p-8 bg-gradient-to-br from-emerald-50 to-white rounded-[2rem] border border-emerald-100/50 flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">Nominal Diterima</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-emerald-400">Rp</span>
                        <p className="text-4xl font-black text-emerald-600 tracking-tighter">
                          {viewReceipt.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-white/60 backdrop-blur-md px-4 py-2 rounded-xl border border-emerald-100 inline-block">
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
                  
                  <div className="bg-gray-50/30 rounded-[2rem] border border-gray-100 overflow-hidden shadow-inner">
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
                                {inv.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/')}
                              </span>
                            </td>
                            <td className="p-5 text-center">
                              <span className="text-xs font-bold text-gray-400 tabular-nums">
                                {inv.dueDate?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/')}
                              </span>
                            </td>
                            <td className="p-5 text-right">
                              <span className="text-xs font-bold text-gray-600 tabular-nums">
                                {inv.totalAmount?.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-5 text-right">
                              <div className="inline-block py-1 px-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100/50 transition-colors">
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
                  <div className="p-6 bg-amber-50/30 rounded-[2rem] border border-amber-100/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Layers className="w-8 h-8 text-amber-900" />
                    </div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      Narasi / Catatan
                    </p>
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
                  className="px-8 py-3.5 bg-gray-900 text-white rounded-2xl text-xs font-black hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-95 uppercase tracking-[0.2em]"
                >
                  Selesai & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
