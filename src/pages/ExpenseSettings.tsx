import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, serverTimestamp, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { ExpenseRule } from '../types';
import { Plus, Trash2, Edit2, X, Settings, Tag, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

export default function ExpenseSettings() {
  const { profile } = useAuth();
  const [rules, setRules] = useState<ExpenseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ExpenseRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    category: '',
    defaultActivity: '',
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'expenseRules'),
      where('tenantId', '==', profile.tenantId)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRules(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseRule)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'expenseRules');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingRule) {
        await updateDoc(doc(db, 'expenseRules', editingRule.id), {
          category: formData.category,
          defaultActivity: formData.defaultActivity,
        });
      } else {
        await addDoc(collection(db, 'expenseRules'), {
          tenantId: profile.tenantId,
          category: formData.category,
          defaultActivity: formData.defaultActivity,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditingRule(null);
      setFormData({ category: '', defaultActivity: '' });
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan aturan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (rule: ExpenseRule) => {
    setEditingRule(rule);
    setFormData({
      category: rule.category,
      defaultActivity: rule.defaultActivity,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus aturan ini?')) return;
    try {
      await deleteDoc(doc(db, 'expenseRules', id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Setting Claim Expense</h2>
          <p className="text-gray-500 mt-1">Atur otomatisasi kategori dan aktivitas pengeluaran.</p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setFormData({ category: '', defaultActivity: '' });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-md flex items-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Aturan
        </button>
      </div>

      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                <th className="px-8 py-5">Kategori (Claim Expense)</th>
                <th className="px-8 py-5">Aktivitas Otomatis</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={3} className="px-8 py-12 text-center text-gray-400 font-bold">Memuat data...</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={3} className="px-8 py-12 text-center text-gray-400 font-bold">Belum ada aturan yang dibuat.</td></tr>
              ) : rules.map((rule) => (
                <tr key={rule.id} className="group hover:bg-indigo-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center">
                      <Tag className="w-4 h-4 mr-3 text-indigo-600" />
                      <p className="text-sm font-black text-gray-900">{rule.category}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center">
                      <Briefcase className="w-4 h-4 mr-3 text-gray-400" />
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-tight">
                        {rule.defaultActivity}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
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
              className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900">{editingRule ? 'Edit Aturan' : 'Tambah Aturan'}</h3>
                  <p className="text-xs text-gray-500 mt-1">Tentukan kategori dan aktivitas otomatis.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Kategori (Claim Expense)</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Internet dan Telephon"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Aktivitas Otomatis</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Operasional"
                      value={formData.defaultActivity}
                      onChange={(e) => setFormData({ ...formData, defaultActivity: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 border border-gray-100 rounded-md text-gray-500 font-medium hover:bg-white transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-md font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Aturan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
