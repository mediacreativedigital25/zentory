import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, Timestamp, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Transaction, DailyClosing as DailyClosingType, ApprovalRequest, Tenant } from '../types';
import { Calculator, Calendar, TrendingUp, Heart, Wallet, CheckCircle2, History, AlertCircle, ArrowRight, TrendingDown, Lock, Send, X } from 'lucide-react';
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

export default function DailySettlement() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closings, setClosings] = useState<DailyClosingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [closingSuccess, setClosingSuccess] = useState(false);
  const [isAlreadySettled, setIsAlreadySettled] = useState(false);
  const [currentClosing, setCurrentClosing] = useState<DailyClosingType | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [pendingRequest, setPendingRequest] = useState<ApprovalRequest | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const [isCharityConfirmOpen, setIsCharityConfirmOpen] = useState(false);

  const fetchTodayData = async () => {
    if (!profile?.tenantId) return;

    try {
      // Get start and end of today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startTimestamp = Timestamp.fromDate(startOfDay);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const endTimestamp = Timestamp.fromDate(endOfDay);

      // Check if already settled for today
      const settledQ = query(
        collection(db, 'dailyClosings'),
        where('tenantId', '==', profile.tenantId),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp),
        limit(1)
      );
      const settledSnap = await getDocs(settledQ);
      setIsAlreadySettled(!settledSnap.empty);
      if (!settledSnap.empty) {
        setCurrentClosing({ id: settledSnap.docs[0].id, ...settledSnap.docs[0].data() } as DailyClosingType);
      } else {
        setCurrentClosing(null);
      }

      // Check for pending open requests
      const requestQ = query(
        collection(db, 'approval_requests'),
        where('tenantId', '==', profile.tenantId),
        where('type', '==', 'daily_settlement_open'),
        where('status', '==', 'pending'),
        where('closingDate', '>=', startTimestamp),
        where('closingDate', '<=', endTimestamp),
        limit(1)
      );
      const requestSnap = await getDocs(requestQ);
      setPendingRequest(!requestSnap.empty ? { id: requestSnap.docs[0].id, ...requestSnap.docs[0].data() } as ApprovalRequest : null);

      // Fetch tenant info
      const tSnap = await getDoc(doc(db, 'tenants', profile.tenantId));
      if (tSnap.exists()) {
        setTenantInfo({ id: tSnap.id, ...tSnap.data() } as Tenant);
      }

      // Fetch today's transactions
      const q = query(
        collection(db, 'transactions'),
        where('tenantId', '==', profile.tenantId),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp),
        where('status', '==', 'completed')
      );

      const snap = await getDocs(q);
      const transData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(transData);

      // Fetch recent closings
      const closingQ = query(
        collection(db, 'dailyClosings'),
        where('tenantId', '==', profile.tenantId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const closingSnap = await getDocs(closingQ);
      setClosings(closingSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyClosingType)));

    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'dailyClosings/transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
  }, [profile]);

  // Calculations
  const salesTransactions = transactions.filter(t => t.type === 'sale');
  const expenseTransactions = transactions.filter(t => t.type === 'expense');

  const totalSales = salesTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalExpenses = expenseTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  
  const totalCost = salesTransactions.reduce((acc, t) => {
    const itemsCost = t.items?.reduce((itemAcc, item) => itemAcc + (item.hpp * item.quantity), 0) || 0;
    return acc + itemsCost;
  }, 0);

  const grossProfit = totalSales - totalCost;
  const netProfit = grossProfit - totalExpenses;
  const charityAmount = netProfit > 0 ? netProfit * 0.025 : 0;
  const transactionCount = salesTransactions.length;

  const status = netProfit > 0 ? 'UNTUNG' : netProfit < 0 ? 'RUGI' : 'IMPAS';

  const handleDoClosing = async (isCharityEnabled: boolean = false) => {
    if (!profile?.tenantId || (transactionCount === 0 && totalExpenses === 0)) {
      alert('Tidak ada aktivitas keuangan untuk ditutup hari ini.');
      return;
    }

    if (isAlreadySettled) {
      alert('Hari ini sudah dilakukan settlement.');
      return;
    }

    setIsClosing(true);
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      // 1. Save Daily Closing Record
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      
      // Generate DS number (Simplified for now, ideally needs a counter)
      const dsNumber = `DS${year}${month}${String(closings.length + 1).padStart(6, '0')}`;

      await addDoc(collection(db, 'dailyClosings'), {
        tenantId: profile.tenantId,
        dailyNumber: dsNumber,
        date: serverTimestamp(),
        totalSales,
        totalCost,
        totalExpenses,
        grossProfit,
        netProfit,
        transactionCount,
        charityAmount: 0, 
        isCharityEnabled,
        status,
        closedBy: profile.displayName || profile.email,
        createdAt: serverTimestamp()
      });

      setClosingSuccess(true);
      fetchTodayData();
      setTimeout(() => setClosingSuccess(false), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'dailyClosings');
    } finally {
      setIsClosing(false);
      setIsCharityConfirmOpen(false);
    }
  };

  const handleRequestOpen = async () => {
    if (!profile?.tenantId || !currentClosing) return;

    setIsClosing(true);
    try {
      await addDoc(collection(db, 'approval_requests'), {
        tenantId: profile.tenantId,
        tenantName: tenantInfo?.name || 'Unknown Tenant',
        type: 'daily_settlement_open',
        closingId: currentClosing.id,
        closingDate: currentClosing.date,
        requestedBy: profile.uid,
        requestedAt: serverTimestamp(),
        reason: requestReason,
        status: 'pending'
      });
      alert('Permintaan pembukaan kembali settlement telah dikirim ke Super Admin.');
      setIsRequestModalOpen(false);
      setRequestReason('');
      fetchTodayData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'approval_requests');
    } finally {
      setIsClosing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Daily Settlement</h2>
          <p className="text-gray-500 mt-1">Proses tutup buku harian untuk merangkum aktivitas keuangan.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <span className="font-bold text-gray-700">
            {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </header>

      {isAlreadySettled && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-amber-900">Buku Sudah Ditutup</h4>
              <p className="text-amber-700 text-sm">Settlement untuk hari ini telah dilakukan. Data transaksi hari ini telah dikunci.</p>
            </div>
          </div>
          
          {pendingRequest ? (
            <div className="px-6 py-3 bg-white border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-600 font-bold text-sm">
              <Send className="w-4 h-4" />
              Request Open Pending...
            </div>
          ) : (
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-bold text-sm hover:bg-amber-700 transition-all flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Request Open Settlement
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group"
            >
              <div className="relative z-10">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Omzet (Penjualan)</p>
                <h3 className="text-3xl font-black text-gray-900">Rp.{totalSales.toLocaleString()}</h3>
                <div className="mt-4 flex items-center text-green-600 text-xs font-bold">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {transactionCount} Transaksi Berhasil
                </div>
              </div>
              <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-50 group-hover:text-indigo-50 transition-colors" />
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group"
            >
              <div className="relative z-10">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Pengeluaran</p>
                <h3 className="text-3xl font-black text-red-600">Rp.{totalExpenses.toLocaleString()}</h3>
                <p className="mt-4 text-gray-400 text-xs font-bold">Termasuk biaya operasional</p>
              </div>
              <TrendingDown className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-50 group-hover:text-red-50 transition-colors" />
            </motion.div>
          </div>

          {/* Profit Breakdown */}
          <div className={`rounded-[3rem] p-10 text-white relative overflow-hidden shadow-xl ${status === 'UNTUNG' ? 'bg-indigo-600 shadow-indigo-100' : status === 'RUGI' ? 'bg-red-600 shadow-red-100' : 'bg-gray-600 shadow-gray-100'}`}>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <p className="text-white/70 text-xs font-black uppercase tracking-widest">Laba Bersih</p>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${status === 'UNTUNG' ? 'bg-green-400 text-green-900' : status === 'RUGI' ? 'bg-yellow-400 text-yellow-900' : 'bg-white text-gray-900'}`}>
                    {status}
                  </span>
                </div>
                <h4 className="text-5xl font-black mb-6">Rp.{netProfit.toLocaleString()}</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center">
                      <Calculator className="w-5 h-5 mr-3 text-indigo-200" />
                      <span className="text-sm font-bold">Laba Kotor (Omzet - Modal)</span>
                    </div>
                    <span className="font-black">Rp.{grossProfit.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center items-center text-center space-y-6">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                  {status === 'UNTUNG' ? <TrendingUp className="w-12 h-12" /> : <TrendingDown className="w-12 h-12" />}
                </div>
                <div>
                  <h5 className="text-xl font-black">Finalisasi Settlement</h5>
                  <p className="text-white/80 text-sm mt-2">Data yang sudah disettle akan dikunci dan tidak dapat diubah.</p>
                </div>
                <button
                  onClick={() => setIsCharityConfirmOpen(true)}
                  disabled={isClosing || (transactionCount === 0 && totalExpenses === 0) || isAlreadySettled}
                  className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black shadow-lg hover:bg-indigo-50 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClosing ? 'Memproses...' : isAlreadySettled ? 'Sudah Settlement' : 'Tutup Buku Sekarang'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          </div>

          <AnimatePresence>
            {isCharityConfirmOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
                >
                  <div className="p-8 border-b border-gray-100">
                    <h3 className="text-xl font-black text-gray-900">Konfirmasi Amal</h3>
                    <p className="text-sm text-gray-500 mt-2">Apakah akan aktifkan fitur amal pada hari ini?</p>
                  </div>
                  <div className="p-8 flex gap-3">
                    <button
                      onClick={() => handleDoClosing(false)}
                      disabled={isClosing}
                      className="flex-1 px-6 py-4 border border-gray-200 rounded-2xl text-gray-600 font-black hover:bg-gray-50 transition-all"
                    >
                      Tidak
                    </button>
                    <button
                      onClick={() => handleDoClosing(true)}
                      disabled={isClosing}
                      className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all"
                    >
                      Ya, Aktifkan
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {closingSuccess && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 border border-green-100 p-6 rounded-3xl flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-green-900">Settlement Berhasil!</h4>
                <p className="text-green-700 text-sm">Data rekapitulasi harian telah disimpan dan dikunci.</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* History Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-gray-900 flex items-center">
                <History className="w-5 h-5 mr-2 text-indigo-600" />
                Riwayat Settlement
              </h3>
            </div>

            <div className="space-y-6">
              {closings.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm font-bold">Belum ada riwayat settlement.</p>
                </div>
              ) : (
                closings.map((closing) => (
                  <div key={closing.id} className="group relative pl-6 border-l-2 border-gray-100 hover:border-indigo-600 transition-colors">
                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-100 group-hover:border-indigo-600 transition-colors" />
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">
                      {closing.date ? new Date(closing.date.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Baru saja'}
                    </p>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`text-sm font-black ${closing.status === 'UNTUNG' ? 'text-green-600' : closing.status === 'RUGI' ? 'text-red-600' : 'text-gray-900'}`}>
                          Rp.{closing.netProfit.toLocaleString()}
                        </h4>
                        <p className="text-[10px] text-gray-500">{closing.dailyNumber || 'DS-...'}</p>
                        <p className="text-[10px] text-gray-500">{closing.status} • {closing.transactionCount} Trx</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-5 h-5 text-indigo-600" />
              <h4 className="font-black text-indigo-900 text-sm">Keamanan Data</h4>
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Setelah settlement dilakukan, semua transaksi pada tanggal tersebut akan dikunci secara otomatis untuk menjaga integritas laporan keuangan Anda.
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isRequestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Request Open Settlement</h3>
                  <p className="text-sm text-gray-500">Kirim permintaan ke Super Admin untuk membuka kembali settlement hari ini.</p>
                </div>
                <button onClick={() => setIsRequestModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700 leading-relaxed">
                  Membuka kembali settlement akan memungkinkan Anda untuk mengubah data transaksi hari ini. Pastikan Anda memiliki alasan yang valid.
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">Alasan Pembukaan Kembali</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="Contoh: Ada transaksi yang terlewat, salah input nominal..."
                    className="w-full px-5 py-4 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsRequestModalOpen(false)}
                    className="flex-1 px-6 py-4 border border-gray-200 rounded-2xl text-gray-600 font-black hover:bg-gray-50 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRequestOpen}
                    disabled={isClosing || !requestReason.trim()}
                    className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center"
                  >
                    {isClosing ? 'Mengirim...' : 'Kirim Request'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
  )
}
