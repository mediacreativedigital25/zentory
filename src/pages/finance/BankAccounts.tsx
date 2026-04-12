import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { BankAccount } from '../../types';
import { Landmark, Plus, X, Edit2, Trash2, Check, CreditCard, Wallet, Banknote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

const ACCOUNT_TYPES = [
  { id: 'BANK', label: 'Bank Transfer', icon: Landmark },
  { id: 'QRIS', label: 'QRIS', icon: CreditCard },
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'E-WALLET', label: 'E-Wallet', icon: Wallet },
];

export default function BankAccounts() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    accountNumber: '',
    accountHolder: '',
    type: 'BANK' as BankAccount['type'],
    isActive: true
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'bank_accounts'),
      where('tenantId', '==', profile.tenantId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BankAccount[];
      
      // Check for TUNAI account
      const tunaiAccount = data.find(a => a.name.toUpperCase() === 'TUNAI');
      if (!tunaiAccount && profile?.tenantId) {
        try {
          await addDoc(collection(db, 'bank_accounts'), {
            tenantId: profile.tenantId,
            name: 'TUNAI',
            accountNumber: 'CASH',
            accountHolder: 'Sistem',
            type: 'CASH',
            isActive: true,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          console.error('Error creating TUNAI account:', err);
        }
      }

      setAccounts(data.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    try {
      if (editingAccount) {
        await updateDoc(doc(db, 'bank_accounts', editingAccount.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'bank_accounts'), {
          ...formData,
          tenantId: profile.tenantId,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan akun bank.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      accountNumber: '',
      accountHolder: '',
      type: 'BANK',
      isActive: true
    });
    setEditingAccount(null);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      accountNumber: account.accountNumber || '',
      accountHolder: account.accountHolder || '',
      type: account.type,
      isActive: account.isActive
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Akun Bank',
      message: 'Apakah Anda yakin ingin menghapus akun bank ini?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'bank_accounts', id));
          setConfirmConfig(null);
        } catch (err) {
          console.error(err);
          alert('Gagal menghapus akun bank.');
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Akun Bank & Pembayaran</h1>
          <p className="text-gray-500">Kelola rekening bank dan metode pembayaran Anda</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Akun
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => {
          const typeInfo = ACCOUNT_TYPES.find(t => t.id === account.type);
          const Icon = typeInfo?.icon || Landmark;

          return (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {account.name.toUpperCase() !== 'TUNAI' && (
                  <>
                    <button
                      onClick={() => handleEdit(account)}
                      className="p-2 bg-white shadow-sm border border-gray-100 rounded-lg text-gray-600 hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="p-2 bg-white shadow-sm border border-gray-100 rounded-lg text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-xl ${account.isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-gray-900 truncate">{account.name}</h3>
                    {account.name.toUpperCase() === 'TUNAI' && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black uppercase rounded-full">
                        Sistem
                      </span>
                    )}
                    {!account.isActive && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-mono mt-1">
                    {account.accountNumber || 'Tanpa Nomor'}
                  </p>
                  {account.accountHolder && (
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                      {account.accountHolder}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {typeInfo?.label}
                </span>
                {account.isActive && (
                  <div className="flex items-center text-green-600 text-[10px] font-bold uppercase tracking-widest">
                    <Check className="w-3 h-3 mr-1" />
                    Aktif
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {accounts.length === 0 && (
          <div className="col-span-full bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <Landmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">Belum ada akun bank</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-2">
              Tambahkan akun bank atau metode pembayaran untuk mulai mengatur keuangan Anda.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">
                  {editingAccount ? 'Edit Akun Bank' : 'Tambah Akun Bank'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nama Bank / Metode</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: BCA, Mandiri, QRIS Toko"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Tipe</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as BankAccount['type'] })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {ACCOUNT_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center space-x-2 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-bold text-gray-700">Aktif</span>
                    </label>
                  </div>
                </div>

                {formData.type !== 'CASH' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Nomor Rekening / ID</label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        placeholder="Masukkan nomor rekening"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Nama Pemilik</label>
                      <input
                        type="text"
                        value={formData.accountHolder}
                        onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                        placeholder="Nama sesuai rekening"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                  >
                    Simpan
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
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
