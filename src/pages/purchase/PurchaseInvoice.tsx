import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, orderBy, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { PurchaseInvoice, PurchaseOrder, Supplier, BankAccount } from '../../types';
import { Plus, Search, Edit2, Trash2, FileText, X, Printer, DollarSign, Calendar, Clock, Landmark, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

export default function PurchaseInvoices() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [formData, setFormData] = useState({
    poId: '',
    amount: 0,
    dueDate: '',
    status: 'unpaid' as const,
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteFormData, setDeleteFormData] = useState({
    reason: '',
    notes: '',
    deadline: '',
    invoiceId: '',
    piNumber: '',
  });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'purchase_invoices'), 
      where('tenantId', '==', profile.tenantId),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseInvoice)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching purchase invoices:', error);
      setLoading(false);
    });

    const poQ = query(collection(db, 'purchase_orders'), where('tenantId', '==', profile.tenantId));
    const unsubPos = onSnapshot(poQ, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    }, (error) => {
      console.error('Error fetching purchase orders:', error);
    });

    const supQ = query(collection(db, 'suppliers'), where('tenantId', '==', profile.tenantId));
    const unsubSups = onSnapshot(supQ, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    }, (error) => {
      console.error('Error fetching suppliers:', error);
    });
    
    const bankQ = query(collection(db, 'bank_accounts'), where('tenantId', '==', profile.tenantId), where('isActive', '==', true));
    const unsubBanks = onSnapshot(bankQ, (snap) => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
    }, (error) => {
      console.error('Error fetching bank accounts:', error);
    });

    return () => {
      unsubscribe();
      unsubPos();
      unsubSups();
      unsubBanks();
    };
  }, [profile]);

  const generatePINumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `PI${year}${month}`;
    
    // Find the highest sequence for the current month
    const sameMonthInvoices = invoices.filter(i => i.piNumber?.startsWith(prefix));
    let nextSeq = 1;
    if (sameMonthInvoices.length > 0) {
      const sequences = sameMonthInvoices.map(i => {
        const seqStr = i.piNumber.replace(prefix, '');
        return parseInt(seqStr, 10) || 0;
      });
      nextSeq = Math.max(...sequences) + 1;
    }
    
    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  };

  const handlePOSelection = (poId: string) => {
    const po = orders.find(o => o.id === poId);
    if (!po) return;
    setFormData({ ...formData, poId, amount: po.totalAmount });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    const po = orders.find(o => o.id === formData.poId);

    try {
      if (editingInvoice) {
        await updateDoc(doc(db, 'purchase_invoices', editingInvoice.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'purchase_invoices'), {
          ...formData,
          piNumber: generatePINumber(),
          tenantId: profile.tenantId,
          poNumber: po?.poNumber,
          supplierId: po?.supplierId,
          date: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditingInvoice(null);
      setFormData({ poId: '', amount: 0, dueDate: '', status: 'unpaid' });
    } catch (err) {
      console.error(err);
      alert('Failed to save purchase invoice.');
    }
  };

  const handleDeleteRequest = (pi: PurchaseInvoice) => {
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 1);
    
    setDeleteFormData({
      reason: '',
      notes: '',
      deadline: deadlineDate.toISOString().split('T')[0],
      invoiceId: pi.id,
      piNumber: pi.piNumber,
    });
    setIsDeleteModalOpen(true);
  };

  const submitDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId || !deleteFormData.reason) return;

    setIsSubmittingDelete(true);
    try {
      await addDoc(collection(db, 'delete_requests'), {
        tenantId: profile.tenantId,
        sourceCollection: 'purchase_invoices',
        sourceId: deleteFormData.invoiceId,
        sourceNumber: deleteFormData.piNumber,
        reason: deleteFormData.reason,
        notes: deleteFormData.notes,
        deadline: deleteFormData.deadline,
        requestedBy: profile.uid,
        requestedByName: profile.name || profile.email,
        status: 'pending',
        createdAt: serverTimestamp(),
        type: 'Purchase Invoice Delete'
      });
      
      setIsDeleteModalOpen(false);
      setConfirmConfig({
        isOpen: true,
        title: 'Pengajuan Terkirim',
        message: 'Pengajuan penghapusan invoice telah dikirim ke Super Admin untuk disetujui.',
        type: 'info',
        onConfirm: () => setConfirmConfig(null)
      });
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim pengajuan penghapusan.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handlePrint = async (pi: PurchaseInvoice) => {
    const supplier = suppliers.find(s => s.id === pi.supplierId);
    
    let tenantName = 'Our Company';
    let logoUrl = '';
    let address = '';
    let phone = '';
    
    if (profile?.tenantId) {
      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
        if (tenantDoc.exists()) {
          const tData = tenantDoc.data();
          tenantName = tData.name || tenantName;
          logoUrl = tData.settings?.logoUrl || '';
          address = tData.settings?.address || '';
          phone = tData.settings?.phone || '';
        }
      } catch (e) {
        console.error('Failed to load tenant info for printing', e);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups for printing");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Invoice - ${pi.piNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .title { font-size: 28px; font-weight: bold; color: #dc2626; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .total-box { background: #f8f9fa; padding: 20px; border-radius: 12px; margin-top: 40px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">SUPPLIER INVOICE</div>
              <div style="margin-top: 8px;">No: <strong>${pi.piNumber}</strong></div>
              <div>Date: ${new Date(pi.date?.seconds * 1000).toLocaleDateString()}</div>
            </div>
            <div style="text-align: right;">
               ${logoUrl ? `<img src="${logoUrl}" style="max-height: 60px; object-fit: contain; margin-bottom: 8px;" />` : ''}
            </div>
          </div>
          
          <div class="info-grid">
            <div>
              <div style="color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">From Supplier:</div>
              <div style="font-weight: bold; font-size: 16px;">${supplier?.name || '-'}</div>
              <div style="font-size: 14px; margin-top: 4px;">${supplier?.address || ''}</div>
            </div>
            <div style="text-align: right;">
              <div style="color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">Bill To:</div>
              <div style="font-weight: bold; font-size: 16px;">${tenantName}</div>
              ${address ? `<div style="font-size: 12px; color: #444; margin-top: 4px;">${address}</div>` : ''}
              ${phone ? `<div style="font-size: 12px; color: #444; margin-top: 2px;">${phone}</div>` : ''}
              <div style="margin-top: 8px;">PO Ref: ${pi.poNumber || '-'}</div>
              <div style="color: #dc2626; font-weight: bold;">Due Date: ${new Date(pi.dueDate).toLocaleDateString()}</div>
            </div>
          </div>

          <div style="border-top: 2px solid #eee; padding-top: 20px;">
            <div style="display: flex; justify-content: space-between; font-size: 18px;">
              <span>Purchase Order Amount</span>
              <span>Rp.${pi.amount.toLocaleString()}</span>
            </div>
          </div>

          <div class="total-box">
            <div style="font-size: 14px; color: #666; margin-bottom: 4px;">TOTAL DUE</div>
            <div style="font-size: 24px; font-weight: bold;">Rp.${pi.amount.toLocaleString()}</div>
          </div>

          <div style="margin-top: 80px; text-align: center; color: #999; font-size: 12px;">
            This is a computer generated document. No signature is required.
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePayment = async () => {
    if (!selectedInvoice || !selectedBankAccountId || !profile?.tenantId) return;

    setIsPaying(true);
    try {
      const transactionNumber = `EXP-${Date.now()}`;
      
      await runTransaction(db, async (transaction) => {
        // 1. Create expense transaction
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          tenantId: profile.tenantId,
          type: 'expense',
          category: 'Purchase Payment',
          activity: `Payment for Invoice ${selectedInvoice.piNumber}`,
          amount: selectedInvoice.amount,
          description: `Payment to supplier for PO ${selectedInvoice.poNumber}`,
          transactionNumber,
          status: 'completed',
          date: serverTimestamp(),
          userId: profile.uid,
          bankAccountId: selectedBankAccountId,
          orderNumber: selectedInvoice.poNumber
        });

        // 2. Update invoice status
        const invoiceRef = doc(db, 'purchase_invoices', selectedInvoice.id);
        transaction.update(invoiceRef, {
          status: 'paid',
          updatedAt: serverTimestamp()
        });
      });

      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
      setSelectedBankAccountId('');
    } catch (err) {
      console.error(err);
      alert('Gagal memproses pembayaran.');
    } finally {
      setIsPaying(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Purchase Invoices...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Invoice (Tagihan Supplier)</h2>
          <p className="text-gray-500">Kelola tagihan masuk dari supplier Anda.</p>
        </div>
        <button
          onClick={() => { setEditingInvoice(null); setFormData({ poId: '', amount: 0, dueDate: '', status: 'unpaid' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Input Invoice
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Invoice</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supplier</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nominal</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((pi) => {
                const supplier = suppliers.find(s => s.id === pi.supplierId);
                return (
                  <tr key={pi.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center mr-3">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{pi.piNumber}</p>
                          <p className="text-[10px] text-gray-400">PO: {pi.poNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-600">
                        <p className="font-medium">{new Date(pi.date?.seconds * 1000).toLocaleDateString()}</p>
                        <p className="text-[10px] text-gray-400">Due: {new Date(pi.dueDate).toLocaleDateString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-900">{supplier?.name || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-red-600">Rp.{pi.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                        pi.status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' :
                        pi.status === 'partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                        'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        {pi.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end space-x-2">
                        {pi.status !== 'paid' && (
                          <button
                            onClick={() => { setSelectedInvoice(pi); setIsPaymentModalOpen(true); }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Bayar"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handlePrint(pi)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Cetak">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditingInvoice(pi); setFormData({ poId: pi.poId, amount: pi.amount, dueDate: pi.dueDate, status: pi.status }); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteRequest(pi)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invoices.length === 0 && (
          <div className="text-center py-20">
            <DollarSign className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada tagihan supplier.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-600 text-white">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <h3 className="text-xl font-bold">Pengajuan Hapus Invoice</h3>
                </div>
                <button onClick={() => setIsDeleteModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={submitDeleteRequest} className="p-6 space-y-4">
                <div className="bg-red-50 p-4 rounded-lg mb-4 border border-red-100">
                  <p className="text-xs text-red-600 font-bold mb-1 uppercase">MENGHAPUS INVOICE:</p>
                  <p className="text-sm font-black text-red-700">{deleteFormData.piNumber}</p>
                </div>

                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Alasan Pengajuan</label>
                  <select
                    required
                    value={deleteFormData.reason}
                    onChange={(e) => setDeleteFormData({ ...deleteFormData, reason: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Pilih Alasan</option>
                    <option value="Salah Metode Pembayaran">Salah Metode Pembayaran</option>
                    <option value="Salah Nominal">Salah Nominal</option>
                    <option value="Salah Supplier">Salah Supplier</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {deleteFormData.reason === 'Lainnya' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block mb-2 text-xs font-semibold text-gray-600">Catatan Tambahan</label>
                    <textarea
                      required
                      value={deleteFormData.notes}
                      onChange={(e) => setDeleteFormData({ ...deleteFormData, notes: e.target.value })}
                      placeholder="Jelaskan alasan lainnya..."
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 h-24"
                    />
                  </motion.div>
                )}

                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Deadline Approval</label>
                  <input
                    type="date"
                    readOnly
                    value={deleteFormData.deadline}
                    className="w-full bg-white text-gray-500 cursor-not-allowed outline-none p-2 border border-gray-200 rounded-lg text-sm font-medium"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">*Deadline diatur otomatis H+1</p>
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDelete || !deleteFormData.reason}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {isSubmittingDelete ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Kirim Pengajuan'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">Pembayaran Supplier</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs text-gray-500 font-bold uppercase tracking-widest">
                    <span>Invoice No</span>
                    <span>Total Tagihan</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-gray-900">{selectedInvoice?.piNumber}</span>
                    <span className="text-xl font-black text-red-600">Rp.{selectedInvoice?.amount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-600">Pilih Sumber Dana</label>
                  <div className="grid grid-cols-1 gap-2">
                    {bankAccounts.map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => setSelectedBankAccountId(bank.id)}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          selectedBankAccountId === bank.id 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-gray-100 bg-white hover:border-gray-200 text-gray-600'
                        }`}
                      >
                        <div className="flex items-center">
                          <Landmark className={`w-5 h-5 mr-3 ${selectedBankAccountId === bank.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                          <div className="text-left">
                            <p className="text-sm font-bold">{bank.name}</p>
                            <p className="text-[10px] opacity-50">{bank.accountNumber || 'Cash'}</p>
                          </div>
                        </div>
                        {selectedBankAccountId === bank.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-white"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={!selectedBankAccountId || isPaying}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-2"
                  >
                    {isPaying ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Konfirmasi Bayar
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">{editingInvoice ? 'Edit Invoice' : 'Input Invoice Supplier'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Reference PO</label>
                  <select
                    required
                    value={formData.poId}
                    onChange={(e) => handlePOSelection(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Pilih Purchase Order</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.poNumber} - {o.supplierName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Jumlah Tagihan</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full pl-12 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Tanggal Jatuh Tempo</label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Status Pembayaran</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="unpaid">Belum Dibayar</option>
                    <option value="partial">Dibayar Sebagian</option>
                    <option value="paid">Lunas</option>
                  </select>
                </div>
                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                  >
                    Simpan Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          type={confirmConfig.type}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
