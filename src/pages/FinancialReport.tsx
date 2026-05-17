import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Transaction, BankAccount } from '../types';
import { Wallet, TrendingUp, TrendingDown, Calendar, Filter, Download, FileText, PieChart, BarChart3, Landmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

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

type FilterType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function FinancialReport() {
  const { profile, domainTenantId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTimeTransactions, setAllTimeTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('monthly');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (!profile) return;
    const targetTenantId = domainTenantId || profile.tenantId;
    if (!targetTenantId && profile.role !== 'superadmin') return;

    // Fetch Bank Accounts for mapping
    const bQuery = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'bank_accounts')
      : query(collection(db, 'bank_accounts'), where('tenantId', '==', targetTenantId));
    
    const unsubBanks = onSnapshot(bQuery, (snap) => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
    });

    const now = new Date();
    let startDate = new Date();

    if (filter === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
    }

    const startTimestamp = Timestamp.fromDate(startDate);

    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? query(
          collection(db, 'transactions'),
          where('date', '>=', startTimestamp),
          orderBy('date', 'desc')
        )
      : query(
          collection(db, 'transactions'),
          where('tenantId', '==', targetTenantId),
          where('date', '>=', startTimestamp),
          orderBy('date', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    const qAllTime = (profile.role === 'superadmin' && !domainTenantId)
      ? query(collection(db, 'transactions'))
      : query(collection(db, 'transactions'), where('tenantId', '==', targetTenantId));
      
    const unsubAllTime = onSnapshot(qAllTime, (snap) => {
      setAllTimeTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    return () => {
      unsubscribe();
      unsubAllTime();
      unsubBanks();
    };
  }, [profile, domainTenantId, filter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, rowsPerPage]);

  const totalSales = transactions
    .filter(t => t.type === 'sale' && t.status !== 'cancelled' && t.status !== 'deleted')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    
  const totalExpenses = transactions
    .filter(t => t.type === 'expense' && t.status !== 'cancelled' && t.status !== 'deleted')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    
  const balance = totalSales - totalExpenses;

  const totalPages = Math.ceil(transactions.length / rowsPerPage);
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const bankAccountBalances = bankAccounts.map(bank => {
    const bankTransactions = allTimeTransactions.filter(t => t.bankAccountId === bank.id && t.status !== 'cancelled' && t.status !== 'deleted');
    const income = bankTransactions.filter(t => t.type === 'sale' || t.type === 'charity_reserve' || t.type === 'transfer_in').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expense = bankTransactions.filter(t => t.type === 'expense' || t.type === 'transfer_out').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return {
      ...bank,
      balance: income - expense
    };
  });

  const handleExport = () => {
    alert('Fitur ekspor laporan sedang dalam pengembangan.');
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Laporan Keuangan</h2>
          <p className="text-gray-500 mt-1">Analisis performa finansial bisnis Anda secara mendalam.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-md border border-gray-100 shadow-sm flex">
            {(['daily', 'weekly', 'monthly', 'yearly'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {f === 'daily' ? 'Harian' : f === 'weekly' ? 'Mingguan' : f === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="p-3 bg-white border border-gray-100 rounded-md text-gray-600 hover:bg-white transition-all shadow-sm"
            title="Export Report"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-md border border-gray-100 shadow-sm relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-md flex items-center justify-center mb-6">
              <Wallet className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Saldo</p>
            <h3 className="text-3xl font-black text-gray-900">Rp.{Math.round(balance).toLocaleString('id-ID')}</h3>
          </div>
          <PieChart className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-50 group-hover:text-indigo-50 transition-colors" />
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-md border border-gray-100 shadow-sm relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-md flex items-center justify-center mb-6">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Pendapatan</p>
            <h3 className="text-3xl font-black text-gray-900">Rp.{Math.round(totalSales).toLocaleString('id-ID')}</h3>
          </div>
          <BarChart3 className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-50 group-hover:text-green-50 transition-colors" />
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-md border border-gray-100 shadow-sm relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-md flex items-center justify-center mb-6">
              <TrendingDown className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Pengeluaran</p>
            <h3 className="text-3xl font-black text-gray-900">Rp.{Math.round(totalExpenses).toLocaleString('id-ID')}</h3>
          </div>
          <TrendingDown className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-50 group-hover:text-red-50 transition-colors" />
        </motion.div>
      </div>

      {/* Bank Account Balances */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-gray-900 flex items-center px-2">
          <Landmark className="w-5 h-5 mr-2 text-indigo-600" />
          Saldo per Akun Bank
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bankAccountBalances.map((bank) => (
            <motion.div
              key={bank.id}
              whileHover={{ y: -3 }}
              className="bg-white p-6 rounded-md border border-gray-100 shadow-sm flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-md ${
                    bank.type === 'CASH' ? 'bg-orange-100 text-orange-600' :
                    bank.type === 'QRIS' ? 'bg-purple-100 text-purple-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Landmark className="w-4 h-4" />
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                    bank.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {bank.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{bank.name}</p>
                <p className="text-xs text-gray-500 font-medium truncate mb-2">{bank.accountNumber || 'Cash Account'}</p>
              </div>
              <h4 className={`text-lg font-black ${bank.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                Rp.{Math.round(bank.balance).toLocaleString('id-ID')}
              </h4>
            </motion.div>
          ))}
          {bankAccountBalances.length === 0 && (
            <div className="col-span-full py-10 text-center bg-gray-50 rounded-md border border-dashed border-gray-200">
              <p className="text-gray-400 font-bold">Belum ada akun bank yang terdaftar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Report Table */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-black text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600" />
              Rincian Transaksi ({filter === 'daily' ? 'Hari Ini' : filter === 'weekly' ? 'Minggu Ini' : filter === 'monthly' ? 'Bulan Ini' : 'Tahun Ini'})
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-white px-3 py-1.5 rounded-md border border-gray-100 shadow-sm">
              <span className="font-black uppercase tracking-widest">Tampilkan:</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="bg-transparent font-black text-indigo-600 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <span className="px-4 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
            {transactions.length} Transaksi
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                <th className="px-8 py-5">Tanggal</th>
                <th className="px-8 py-5">Kategori / Deskripsi</th>
                <th className="px-8 py-5">Tipe</th>
                <th className="px-8 py-5">Nominal</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold">Memuat data...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold">Tidak ada transaksi ditemukan untuk periode ini.</td></tr>
              ) : paginatedTransactions.map((t) => (
                <tr key={t.id} className="group hover:bg-indigo-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                      <p className="text-sm font-bold text-gray-600">
                        {t.date ? new Date(t.date.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja'}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <p className="text-sm font-black text-gray-900">
                        {t.category || (t.type === 'sale' ? 'Penjualan' : 'Umum')}
                      </p>
                      <div className="flex items-center mt-1">
                        <p className="text-[10px] text-gray-400 truncate max-w-[150px]">
                          {t.description || (t.type === 'sale' ? `Order #${t.id.slice(-6).toUpperCase()}` : '-')}
                        </p>
                        {t.bankAccountId && (
                          <span className="ml-2 flex items-center text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                            <Landmark className="w-2 h-2 mr-1" />
                            {bankAccounts.find(b => b.id === t.bankAccountId)?.name || 'Unknown'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${
                      t.type === 'sale' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {t.type === 'sale' ? 'Pendapatan' : 'Pengeluaran'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <p className={`text-sm font-black ${t.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'sale' ? '+' : '-'} Rp.{Math.round(t.amount).toLocaleString('id-ID')}
                    </p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        t.status === 'completed' ? 'bg-green-500' : t.status === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-[10px] font-black uppercase text-gray-500">{t.status || 'Selesai'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50/30 gap-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Menampilkan <span className="text-indigo-600">{Math.min(transactions.length, (currentPage - 1) * rowsPerPage + 1)}</span> - <span className="text-indigo-600">{Math.min(transactions.length, currentPage * rowsPerPage)}</span> dari <span className="text-indigo-600">{transactions.length}</span> Transaksi
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-3 bg-white border border-gray-100 rounded-md text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-md text-[10px] font-black transition-all ${
                        currentPage === page 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                          : 'bg-white text-gray-400 hover:text-gray-600 border border-gray-100 shadow-sm'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  (page === currentPage - 2 && page > 1) || 
                  (page === currentPage + 2 && page < totalPages)
                ) {
                  return <span key={page} className="text-gray-400 font-black">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-3 bg-white border border-gray-100 rounded-md text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
