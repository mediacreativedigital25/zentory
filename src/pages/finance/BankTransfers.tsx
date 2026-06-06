import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { BankTransfer, BankAccount } from '../../types';
import { ArrowLeftRight, Plus, X, Calculator, Search, Calendar, Edit2, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function BankTransfers() {
  const { profile } = useAuth();
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingTransfer, setEditingTransfer] = useState<BankTransfer | null>(null);
  const [viewingTransfer, setViewingTransfer] = useState<BankTransfer | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    referenceNumber: '',
    description: ''
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    const fetchAccounts = async () => {
      try {
        const q = query(
          collection(db, 'bank_accounts'),
          where('tenantId', '==', profile.tenantId),
          where('isActive', '==', true)
        );
        const snap = await getDocs(q);
        setBankAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
      } catch (error) {
        console.error("Firestore Error in bank_accounts fetch:", error);
      }
    };
    fetchAccounts();

    const qTransfers = query(
      collection(db, 'bank_transfers'),
      where('tenantId', '==', profile.tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(qTransfers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BankTransfer[];
      setTransfers(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error in bank_transfers:", error);
    });

    return () => unsubscribe();
  }, [profile?.tenantId]);

  const openAddModal = () => {
    setEditingTransfer(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      referenceNumber: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (t: BankTransfer) => {
    setEditingTransfer(t);
    setFormData({
      date: t.date?.seconds 
        ? format(new Date(t.date.seconds * 1000), 'yyyy-MM-dd') 
        : new Date().toISOString().split('T')[0],
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      amount: t.amount.toString(),
      referenceNumber: t.referenceNumber || '',
      description: t.description || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (t: BankTransfer) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus transfer ini?')) return;
    try {
      await deleteDoc(doc(db, 'bank_transfers', t.id));
      
      let qTx = query(
        collection(db, 'transactions'), 
        where('tenantId', '==', profile?.tenantId), 
        where('transactionNumber', '==', t.transferNumber)
      );
      let txDocs = await getDocs(qTx);

      // Fallback for older transactions that didn't record transactionNumber
      if (txDocs.empty) {
        const fallBackQ = query(
          collection(db, 'transactions'),
          where('tenantId', '==', profile?.tenantId),
          where('amount', '==', t.amount)
        );
        const fbDocs = await getDocs(fallBackQ);
        const relatedDocs = fbDocs.docs.filter(d => 
          (d.data().type === 'transfer_out' && d.data().bankAccountId === t.fromAccountId) ||
          (d.data().type === 'transfer_in' && d.data().bankAccountId === t.toAccountId)
        );
        // Ensure same day
        const matchedDocs = relatedDocs.filter(d => {
          const txDate = d.data().date?.seconds ? new Date(d.data().date.seconds * 1000) : new Date();
          const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
          return txDate.toDateString() === tDate.toDateString();
        });
        
        for (const tDoc of matchedDocs) {
          await deleteDoc(tDoc.ref);
        }
      } else {
        for (const tDoc of txDocs.docs) {
           await deleteDoc(tDoc.ref);
        }
      }
    } catch (error) {
      console.error('Error deleting transfer:', error);
      alert('Gagal menghapus data transfer.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId || !formData.fromAccountId || !formData.toAccountId || !formData.amount || !formData.date) return;

    if (formData.fromAccountId === formData.toAccountId) {
      alert('Akun asal dan tujuan tidak boleh sama.');
      return;
    }

    const amount = Number(formData.amount);
    if (amount <= 0) {
      alert('Jumlah transfer harus lebih dari 0.');
      return;
    }

    try {
      const fromAccount = bankAccounts.find(a => a.id === formData.fromAccountId);
      const toAccount = bankAccounts.find(a => a.id === formData.toAccountId);

      if (editingTransfer) {
        await updateDoc(doc(db, 'bank_transfers', editingTransfer.id), {
          date: new Date(formData.date),
          fromAccountId: formData.fromAccountId,
          fromAccountName: fromAccount?.name || 'Unknown',
          toAccountId: formData.toAccountId,
          toAccountName: toAccount?.name || 'Unknown',
          amount,
          referenceNumber: formData.referenceNumber,
          description: formData.description
        });

        const qTx = query(collection(db, 'transactions'), where('tenantId', '==', profile.tenantId), where('transactionNumber', '==', editingTransfer.transferNumber));
        const txDocs = await getDocs(qTx);
        
        let docsToUpdate = txDocs.docs;

        if (txDocs.empty) {
          const fallBackQ = query(
            collection(db, 'transactions'),
            where('tenantId', '==', profile.tenantId),
            where('amount', '==', editingTransfer.amount)
          );
          const fbDocs = await getDocs(fallBackQ);
          const relatedDocs = fbDocs.docs.filter(d => 
            (d.data().type === 'transfer_out' && d.data().bankAccountId === editingTransfer.fromAccountId) ||
            (d.data().type === 'transfer_in' && d.data().bankAccountId === editingTransfer.toAccountId)
          );
          docsToUpdate = relatedDocs.filter(d => {
            const txDate = d.data().date?.seconds ? new Date(d.data().date.seconds * 1000) : new Date();
            const tDate = editingTransfer.date?.seconds ? new Date(editingTransfer.date.seconds * 1000) : new Date();
            return txDate.toDateString() === tDate.toDateString();
          });
        }

        for (const tDoc of docsToUpdate) {
           const tData = tDoc.data();
           if (tData.type === 'transfer_out') {
             await updateDoc(tDoc.ref, {
               amount: amount,
               bankAccountId: formData.fromAccountId,
               date: new Date(formData.date),
               description: formData.description || `Transfer keluar ke ${toAccount?.name}`
             });
           } else if (tData.type === 'transfer_in') {
             await updateDoc(tDoc.ref, {
               amount: amount,
               bankAccountId: formData.toAccountId,
               date: new Date(formData.date),
               description: formData.description || `Transfer masuk dari ${fromAccount?.name}`
             });
           }
        }
      } else {
        const dateYm = formData.date.slice(0, 7).replace('-', '');
        const docCountSnap = await getDocs(query(
          collection(db, 'bank_transfers'),
          where('tenantId', '==', profile.tenantId)
        ));
        const refCount = (docCountSnap.size + 1).toString().padStart(6, '0');
        const transferNumber = `BTL${dateYm}${refCount}`;

        await addDoc(collection(db, 'bank_transfers'), {
          tenantId: profile.tenantId,
          transferNumber,
          date: new Date(formData.date),
          fromAccountId: formData.fromAccountId,
          fromAccountName: fromAccount?.name || 'Unknown',
          toAccountId: formData.toAccountId,
          toAccountName: toAccount?.name || 'Unknown',
          amount,
          referenceNumber: formData.referenceNumber,
          description: formData.description,
          createdBy: profile.uid,
          createdAt: serverTimestamp()
        });

        // OUT
        await addDoc(collection(db, 'transactions'), {
          tenantId: profile.tenantId,
          type: 'transfer_out',
          amount: amount,
          bankAccountId: formData.fromAccountId,
          date: new Date(formData.date),
          status: 'completed',
          userId: profile.uid,
          description: formData.description || `Transfer keluar ke ${toAccount?.name}`,
          category: 'Transfer',
          activity: 'Bank Transfer',
          transactionNumber: transferNumber,
          createdAt: serverTimestamp()
        });

        // IN
        await addDoc(collection(db, 'transactions'), {
          tenantId: profile.tenantId,
          type: 'transfer_in',
          amount: amount,
          bankAccountId: formData.toAccountId,
          date: new Date(formData.date),
          status: 'completed',
          userId: profile.uid,
          description: formData.description || `Transfer masuk dari ${fromAccount?.name}`,
          category: 'Transfer',
          activity: 'Bank Transfer',
          transactionNumber: transferNumber,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving transfer:', error);
      alert('Gagal menyimpan transfer cash/bank.');
    }
  };

  const filteredTransfers = transfers.filter(t => 
    t.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.fromAccountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.toAccountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-gray-500">Memuat data transfer...</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="w-8 h-8 text-indigo-600" />
            Transfer Kas/Bank
          </h1>
          <p className="text-gray-500 mt-1">Catat perpindahan dana antar rekening atau kas</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Transfer Baru
        </button>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari referensi, akun, atau deskripsi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
              <tr>
                <th className="px-6 py-4">Id Transaksi</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">No Ref</th>
                <th className="px-6 py-4">Dari Kas / Bank</th>
                <th className="px-6 py-4">Ke Kas/Bank</th>
                <th className="px-6 py-4">Remark</th>
                <th className="px-6 py-4 text-right">Jumlah</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransfers.length > 0 ? (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-700">
                      {t.transferNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {t.date?.seconds ? format(new Date(t.date.seconds * 1000), 'dd MMM yyyy', { locale: id }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {t.referenceNumber || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-red-50 text-red-700 rounded-md font-medium whitespace-nowrap text-xs">
                        {t.fromAccountName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-50 text-green-700 rounded-md font-medium whitespace-nowrap text-xs">
                        {t.toAccountName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                      {t.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 font-bold whitespace-nowrap">
                      Rp. {t.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setViewingTransfer(t)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada data transfer ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-10 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-md shadow-xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                  {editingTransfer ? 'Edit Transfer' : 'Tambah Transfer Baru'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto auto-rows-max">
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Dari Rekening/Kas</label>
                    <select
                      required
                      value={formData.fromAccountId}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromAccountId: e.target.value }))}
                      className="w-full p-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Pilih Asal...</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Ke Rekening/Kas</label>
                    <select
                      required
                      value={formData.toAccountId}
                      onChange={(e) => setFormData(prev => ({ ...prev, toAccountId: e.target.value }))}
                      className="w-full p-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Pilih Tujuan...</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Jumlah Transfer</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium tracking-widest text-xs uppercase">Rp</span>
                    <input
                      type="text"
                      required
                      value={Number(formData.amount) > 0 ? Number(formData.amount).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\./g, '');
                        val = val.replace(/\D/g, '');
                        setFormData(prev => ({ ...prev, amount: Number(val) || '' }));
                      }}
                      className="w-full pl-12 pr-4 py-3 rounded-md border-2 border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-medium font-mono tracking-wider text-right"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">No. Referensi <span className="font-normal text-gray-400">(Opsional)</span></label>
                    <input
                      type="text"
                      value={formData.referenceNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                      className="w-full p-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase font-mono"
                      placeholder="TRX-123"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                     <label className="block text-transparent mb-1 hidden sm:block text-xs font-semibold text-gray-600">Space</label>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Keterangan <span className="font-normal text-gray-400">(Opsional)</span></label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Contoh: Pindah dana operasional mingguan"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Simpan Transfer
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingTransfer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setViewingTransfer(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-md shadow-xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  Detail Transfer
                </h2>
                <button
                  onClick={() => setViewingTransfer(null)}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-4" flex-1 overflow-y-auto auto-rows-max>
                <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <label className="block tracking-wider mb-1 text-xs font-semibold text-gray-600">ID Transaksi</label>
                    <div className="font-mono text-gray-900">{viewingTransfer.transferNumber}</div>
                  </div>
                  <div>
                    <label className="block tracking-wider mb-1 text-xs font-semibold text-gray-600">Tanggal</label>
                    <div className="text-gray-900">
                      {viewingTransfer.date?.seconds ? format(new Date(viewingTransfer.date.seconds * 1000), 'dd MMM yyyy', { locale: id }) : '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <label className="block tracking-wider mb-1 text-xs font-semibold text-gray-600">Dari Kas / Bank</label>
                    <div className="text-gray-900 font-medium px-3 py-1 bg-red-50 text-red-700 rounded-md inline-block text-sm">
                      {viewingTransfer.fromAccountName}
                    </div>
                  </div>
                  <div>
                    <label className="block tracking-wider mb-1 text-xs font-semibold text-gray-600">Ke Kas / Bank</label>
                    <div className="text-gray-900 font-medium px-3 py-1 bg-green-50 text-green-700 rounded-md inline-block text-sm">
                      {viewingTransfer.toAccountName}
                    </div>
                  </div>
                </div>

                <div className="border-b border-gray-100 pb-4">
                  <label className="block tracking-wider mb-1 text-xs font-semibold text-gray-600">Jumlah</label>
                  <div className="text-2xl font-black text-gray-900">Rp. {viewingTransfer.amount.toLocaleString('id-ID')}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block tracking-wider mb-1 text-xs font-semibold text-gray-600">No REFERENSI</label>
                    <div className="text-gray-900">{viewingTransfer.referenceNumber || '-'}</div>
                  </div>
                  <div>
                    <label className="block tracking-wider mb-1 text-xs font-semibold text-gray-600">REMARK / KETERANGAN</label>
                    <div className="text-gray-900 max-h-24 overflow-y-auto whitespace-pre-wrap">{viewingTransfer.description || '-'}</div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setViewingTransfer(null)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-md hover:bg-gray-300 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
