import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, serverTimestamp, orderBy, onSnapshot, deleteDoc, doc, getDocs, updateDoc, limit, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Transaction, ExpenseRule, BankAccount } from '../types';
import { Plus, Search, Filter, FileText, DollarSign, Tag, Briefcase, Upload, Trash2, CheckCircle2, AlertCircle, X, Image as ImageIcon, Calculator, Edit2, Landmark, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ImageUpload from '../components/ImageUpload';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function ClaimExpense() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<ExpenseRule[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Transaction | null>(null);
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [isSettledToday, setIsSettledToday] = useState(false);

  const [formData, setFormData] = useState({
    bankAccountId: '',
    items: [{ 
      category: '', 
      activity: '', 
      amount: 0, 
      description: '', 
      receiptUrl: '' 
    }],
  });

  const generateTransactionId = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `CE${year}${month}`;
    
    // Query to find the latest transaction number for this month
    const q = query(
      collection(db, 'transactions'),
      where('tenantId', '==', profile?.tenantId),
      where('transactionNumber', '>=', prefix),
      where('transactionNumber', '<=', prefix + '\uf8ff'),
      orderBy('transactionNumber', 'desc'),
      limit(1)
    );
    
    const snap = await getDocs(q);
    let nextNumber = 1;
    
    if (!snap.empty) {
      const lastId = snap.docs[0].data().transactionNumber;
      const lastNumber = parseInt(lastId.slice(-5));
      nextNumber = lastNumber + 1;
    }
    
    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { 
        category: '', 
        activity: '', 
        amount: 0, 
        description: '', 
        receiptUrl: '' 
      }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill activity if category matches a rule
    if (field === 'category') {
      const matchedRule = rules.find(r => r.category.toLowerCase() === String(value).toLowerCase());
      if (matchedRule) {
        newItems[index].activity = matchedRule.defaultActivity;
      }
    }

    setFormData({ ...formData, items: newItems });
  };

  const totalAmount = formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  useEffect(() => {
    if (!profile?.tenantId) return;

    // Fetch transactions
    const q = query(
      collection(db, 'transactions'),
      where('tenantId', '==', profile.tenantId),
      where('type', '==', 'expense'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    // Fetch rules
    const rulesQ = query(
      collection(db, 'expenseRules'),
      where('tenantId', '==', profile.tenantId)
    );

    const unsubscribeRules = onSnapshot(rulesQ, (snap) => {
      setRules(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseRule)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'expenseRules');
    });

    // Fetch bank accounts
    const bQuery = query(collection(db, 'bank_accounts'), where('tenantId', '==', profile.tenantId), where('isActive', '==', true));
    const unsubBanks = onSnapshot(bQuery, (snap) => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bank_accounts');
    });

    // Check if today is settled
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const settledQ = query(
      collection(db, 'dailyClosings'),
      where('tenantId', '==', profile.tenantId),
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay)),
      limit(1)
    );

    const unsubscribeSettled = onSnapshot(settledQ, (snap) => {
      setIsSettledToday(!snap.empty);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'dailyClosings');
    });

    return () => {
      unsubscribe();
      unsubscribeRules();
      unsubBanks();
      unsubscribeSettled();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId || isSubmitting) return;

    // Check if today is settled for new entries
    if (!editingExpense && isSettledToday) {
      alert('Buku hari ini sudah ditutup (Settled). Tidak dapat menambah transaksi baru.');
      return;
    }

    // Check if the transaction date is settled for edits
    if (editingExpense && editingExpense.date) {
      const transDate = new Date(editingExpense.date.seconds * 1000);
      const start = new Date(transDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(transDate);
      end.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'dailyClosings'),
        where('tenantId', '==', profile.tenantId),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert('Transaksi ini berada pada hari yang sudah ditutup (Settled). Tidak dapat diubah.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const firstItem = formData.items[0];
      
      if (editingExpense) {
        // Update existing
        await updateDoc(doc(db, 'transactions', editingExpense.id), {
          amount: totalAmount,
          category: firstItem.category,
          activity: firstItem.activity,
          description: firstItem.description,
          totalTransactions: formData.items.length,
          expenseItems: formData.items,
          receiptUrl: firstItem.receiptUrl,
          bankAccountId: formData.bankAccountId || null,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new
        const transactionNumber = await generateTransactionId();
        
        await addDoc(collection(db, 'transactions'), {
          tenantId: profile.tenantId,
          type: 'expense',
          transactionNumber,
          amount: totalAmount,
          category: firstItem.category,
          activity: firstItem.activity,
          description: firstItem.description,
          totalTransactions: formData.items.length,
          expenseItems: formData.items,
          receiptUrl: firstItem.receiptUrl,
          bankAccountId: formData.bankAccountId || null,
          date: serverTimestamp(),
          status: 'completed',
          userId: profile.uid,
        });
      }
      
      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({ 
        bankAccountId: '',
        items: [{ 
          category: '', 
          activity: '', 
          amount: 0, 
          description: '', 
          receiptUrl: '' 
        }] 
      });
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan pengeluaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (expense: Transaction) => {
    setEditingExpense(expense);
    setFormData({
      bankAccountId: expense.bankAccountId || '',
      items: expense.expenseItems || [{
        category: expense.category || '',
        activity: expense.activity || '',
        amount: expense.amount || 0,
        description: expense.description || '',
        receiptUrl: expense.receiptUrl || ''
      }]
    });
    setIsModalOpen(true);
  };

  const handleDetail = (expense: Transaction) => {
    setSelectedExpense(expense);
    setIsDetailModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (expense && expense.date) {
      const transDate = new Date(expense.date.seconds * 1000);
      const start = new Date(transDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(transDate);
      end.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'dailyClosings'),
        where('tenantId', '==', profile.tenantId),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert('Transaksi ini berada pada hari yang sudah ditutup (Settled). Tidak dapat dihapus.');
        return;
      }
    }

    if (!confirm('Hapus pengeluaran ini?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredExpenses = expenses.filter(e => 
    e.category?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.activity?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Claim Expense</h2>
          <p className="text-gray-500 mt-1">Kelola dan catat pengeluaran operasional bisnis Anda.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-md flex items-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Pengeluaran
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari pengeluaran, aktivitas, atau deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button className="p-2 border border-gray-100 rounded-md hover:bg-white flex items-center text-gray-600 font-medium text-sm">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </button>
      </div>

      {/* Expense Table */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                <th className="px-8 py-5">ID Transaksi</th>
                <th className="px-8 py-5">Tanggal</th>
                <th className="px-8 py-5">Nominal</th>
                <th className="px-8 py-5">Trx</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold">Memuat data...</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr><td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold">Belum ada data pengeluaran.</td></tr>
              ) : filteredExpenses.map((expense) => (
                <tr key={expense.id} className="group hover:bg-indigo-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <p className="text-xs font-black text-indigo-600">{expense.transactionNumber || '-'}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold text-gray-900">
                      {expense.date ? new Date(expense.date.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja'}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {expense.date ? new Date(expense.date.seconds * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-red-600">Rp.{(expense.amount || 0).toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold text-gray-500">{expense.totalTransactions || 1}</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleDetail(expense)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                        title="Detail"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleEdit(expense)}
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                        title="Hapus"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900">{editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {editingExpense ? `Mengedit transaksi ${editingExpense.transactionNumber}` : 'Lengkapi detail pengeluaran di bawah ini.'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingExpense(null);
                  }} 
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Bank Account Selection */}
                <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-md">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600">Sumber Dana / Bank</label>
                      <p className="text-[10px] text-gray-400 mt-1">Pilih akun bank yang digunakan untuk pengeluaran ini.</p>
                    </div>
                  </div>
                  <select
                    required
                    value={formData.bankAccountId}
                    onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full p-2 bg-white border border-indigo-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium appearance-none"
                  >
                    <option value="">Pilih Akun Bank</option>
                    {bankAccounts.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name} {bank.accountNumber ? `(${bank.accountNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Repeater Section */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600">Daftar Pengeluaran</label>
                      <p className="text-[10px] text-gray-400 mt-1">Tambahkan satu atau lebih rincian pengeluaran.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Tambah Baris
                    </button>
                  </div>
                  
                  {formData.items.map((item, index) => (
                    <div key={index} className="relative bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center text-[10px] font-black text-indigo-600 shadow-sm">
                          {index + 1}
                        </span>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block mb-1 ml-1 text-xs font-semibold text-gray-600">Claim Expense</label>
                          <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <select
                              required
                              value={item.category}
                              onChange={(e) => updateItem(index, 'category', e.target.value)}
                              className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium appearance-none"
                            >
                              <option value="">Pilih Kategori</option>
                              {rules.map((rule) => (
                                <option key={rule.id} value={rule.category}>
                                  {rule.category}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block mb-1 ml-1 text-xs font-semibold text-gray-600">Activity</label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              required
                              placeholder="Operasional, dll"
                              value={item.activity}
                              onChange={(e) => updateItem(index, 'activity', e.target.value)}
                              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block mb-1 ml-1 text-xs font-semibold text-gray-600">Nominal (Rp.)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              required
                              value={item.amount > 0 ? item.amount.toLocaleString('id-ID') : ''}
                              onChange={(e) => {
                                 let val = e.target.value.replace(/\./g, '');
                                 val = val.replace(/\D/g, '');
                                 updateItem(index, 'amount', Number(val));
                              }}
                              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                            />
                          </div>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block mb-1 ml-1 text-xs font-semibold text-gray-600">Deskripsi</label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              required
                              placeholder="Keterangan singkat"
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <ImageUpload
                          value={item.receiptUrl}
                          onChange={(url) => updateItem(index, 'receiptUrl', url)}
                          label="Upload Nota"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-indigo-600 rounded-[2rem] flex justify-between items-center shadow-xl shadow-indigo-100">
                  <div className="flex items-center">
                    <div className="p-2 bg-white/20 rounded-md mr-3">
                      <Calculator className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-widest">Total Keseluruhan</span>
                  </div>
                  <span className="text-2xl font-black text-white">Rp.{totalAmount.toLocaleString()}</span>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingExpense(null);
                    }}
                    className="flex-1 py-4 border border-gray-100 rounded-md text-gray-500 font-medium hover:bg-white transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-md font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Menyimpan...' : (editingExpense ? 'Update Pengeluaran' : 'Simpan Semua')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-gray-900">Detail Pengeluaran</h3>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {selectedExpense.transactionNumber}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Dicatat pada {selectedExpense.date ? new Date(selectedExpense.date.seconds * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                  </p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-6 rounded-md border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Nominal</p>
                    <h4 className="text-xl font-black text-red-600">Rp.{selectedExpense.amount.toLocaleString()}</h4>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-md border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Item</p>
                    <h4 className="text-xl font-black text-gray-900">{selectedExpense.totalTransactions || 1} Item</h4>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-md border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Status</p>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                      <h4 className="text-sm font-black text-gray-900 uppercase">{selectedExpense.status}</h4>
                    </div>
                  </div>
                  {selectedExpense.bankAccountId && (
                    <div className="bg-indigo-50 p-6 rounded-md border border-indigo-100 md:col-span-3">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Sumber Dana / Bank</p>
                      <div className="flex items-center text-indigo-700">
                        <Landmark className="w-5 h-5 mr-2" />
                        <h4 className="text-sm font-black">
                          {bankAccounts.find(b => b.id === selectedExpense.bankAccountId)?.name || 'Unknown Account'}
                        </h4>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Rincian Item</h4>
                  <div className="space-y-3">
                    {(selectedExpense.expenseItems || []).map((item, idx) => (
                      <div key={idx} className="p-6 bg-white border border-gray-100 rounded-md shadow-sm flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex gap-4">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center shrink-0">
                            <Tag className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-sm font-black text-gray-900">{item.category}</h5>
                            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[8px] font-black uppercase">
                                {item.activity}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-between items-end">
                          <p className="text-sm font-black text-red-600">Rp.{item.amount.toLocaleString()}</p>
                          {item.receiptUrl && (
                            <a 
                              href={item.receiptUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="mt-2 flex items-center text-[10px] font-black text-indigo-600 hover:underline"
                            >
                              <ImageIcon className="w-3 h-3 mr-1" />
                              LIHAT NOTA
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-8 py-3 bg-white border border-gray-200 rounded-md text-gray-600 font-medium hover:bg-gray-100 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
