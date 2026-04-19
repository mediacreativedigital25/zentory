import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, serverTimestamp, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Transaction, Tenant } from '../types';
import { Wallet, TrendingUp, TrendingDown, Plus, Search, Filter, ArrowUpRight, ArrowDownRight, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Finance() {
  const { profile, domainTenantId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: 0,
    type: 'expense' as 'sale' | 'expense',
    description: '',
    category: '',
  });

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (!profile) return;

    const targetTenantId = domainTenantId || profile.tenantId;

    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? query(collection(db, 'transactions'), orderBy('date', 'desc'))
      : query(
          collection(db, 'transactions'),
          where('tenantId', '==', targetTenantId),
          orderBy('date', 'desc')
        );

    if (profile.role === 'superadmin') {
      getDocs(collection(db, 'tenants')).then(snap => {
        setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      });
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, domainTenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!targetTenantId) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        tenantId: targetTenantId,
        type: formData.type,
        amount: formData.amount,
        description: formData.description,
        category: formData.category,
        date: serverTimestamp(),
        status: 'completed',
        userId: profile.uid,
      });
      setIsModalOpen(false);
      setFormData({ amount: 0, type: 'expense', description: '', category: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const totalSales = transactions.filter(t => t.type === 'sale' && t.status !== 'cancelled').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense' && t.status !== 'cancelled').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const balance = totalSales - totalExpenses;

  const filteredTransactions = transactions.filter(t => 
    t.description?.toLowerCase().includes(search.toLowerCase()) || 
    t.category?.toLowerCase().includes(search.toLowerCase()) ||
    t.id?.toLowerCase().includes(search.toLowerCase()) ||
    t.transactionNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Finance & Cash Flow</h2>
          <p className="text-gray-500">Track your revenue, expenses, and overall financial health.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Expense
        </button>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Balance</span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900">Rp.{(balance || 0).toLocaleString()}</p>
          <div className="mt-4 flex items-center text-sm text-green-600 font-medium">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            +12.5% from last month
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Income</span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900">Rp.{(totalSales || 0).toLocaleString()}</p>
          <div className="mt-4 flex items-center text-sm text-green-600 font-medium">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            +8.2% from last month
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Expenses</span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900">Rp.{(totalExpenses || 0).toLocaleString()}</p>
          <div className="mt-4 flex items-center text-sm text-red-600 font-medium">
            <ArrowDownRight className="w-4 h-4 mr-1" />
            -4.1% from last month
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
              <span>Show:</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="bg-transparent font-bold text-gray-900 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Calendar className="w-5 h-5 text-gray-500" />
            </button>
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Filter className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                {profile?.role === 'superadmin' && <th className="px-6 py-4 font-medium">Tenant</th>}
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  {profile?.role === 'superadmin' && (
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-900">
                        {tenants.find(ten => ten.id === t.tenantId)?.name || 'Unknown'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {t.date 
                      ? new Date(t.date?.seconds * 1000).toLocaleDateString() 
                      : 'Just now...'}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {t.type === 'sale' ? `Order #${(t.id || '').slice(-6).toUpperCase()}` : (t as any).description || 'Expense'}
                    </p>
                    <p className="text-xs text-gray-500">{(t as any).category || (t.type === 'sale' ? 'Sales' : 'Operational')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      t.type === 'sale' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-sm font-bold ${t.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'sale' ? '+' : '-'}Rp.{(t.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center text-xs font-bold uppercase ${
                      t.status === 'cancelled' ? 'text-red-500' : 
                      t.status === 'pending' ? 'text-yellow-500' : 
                      'text-green-500'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        t.status === 'cancelled' ? 'bg-red-500' : 
                        t.status === 'pending' ? 'bg-yellow-500' : 
                        'bg-green-500'
                      }`} />
                      {t.status || 'Completed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900">{Math.min(filteredTransactions.length, (currentPage - 1) * rowsPerPage + 1)}</span> to <span className="font-bold text-gray-900">{Math.min(filteredTransactions.length, currentPage * rowsPerPage)}</span> of <span className="font-bold text-gray-900">{filteredTransactions.length}</span> transactions
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                // Show only current, first, last, and pages around current
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === page 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                          : 'text-gray-500 hover:bg-white border border-transparent hover:border-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  (page === currentPage - 2 && page > 1) || 
                  (page === currentPage + 2 && page < totalPages)
                ) {
                  return <span key={page} className="text-gray-400">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Add New Expense</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <TrendingDown className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rp.)</label>
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Category</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                    placeholder="What was this expense for?"
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                  >
                    Save Expense
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
