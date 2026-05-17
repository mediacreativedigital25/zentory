import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot, doc, updateDoc, Timestamp, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { DailyClosing, CharityRecord, Transaction, ApprovalRequest, BankAccount } from '../types';
import { Heart, Calendar, Calculator, History, AlertCircle, Eye, Edit, Trash2, CheckCircle2, X, Send, Lock, TrendingUp, TrendingDown, Package, Wallet } from 'lucide-react';
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
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Charity() {
  const { profile } = useAuth();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [charityRecords, setCharityRecords] = useState<CharityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClosing, setSelectedClosing] = useState<DailyClosing | null>(null);
  const [closingTransactions, setClosingTransactions] = useState<Transaction[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [selectedCharityForRequest, setSelectedCharityForRequest] = useState<CharityRecord | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedCharityBankId, setSelectedCharityBankId] = useState('');

  useEffect(() => {
    if (!profile?.tenantId) return;

    // Fetch Bank Accounts
    const bankQ = query(collection(db, 'bank_accounts'), where('tenantId', '==', profile.tenantId));
    getDocs(bankQ).then(snap => {
        const banksData = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
        setBankAccounts(banksData.filter(b => b.isActive));
    }).catch(console.error);

    // Fetch Daily Closings that don't have charity records yet (or all for history)
    const closingQ = query(
      collection(db, 'dailyClosings'),
      where('tenantId', '==', profile.tenantId),
      where('isCharityEnabled', '==', true),
      orderBy('date', 'desc'),
      limit(20)
    );

    const unsubClosings = onSnapshot(closingQ, (snap) => {
      setClosings(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyClosing)));
      setLoading(false);
    });

    // Fetch Charity Records
    const charityQ = query(
      collection(db, 'charityRecords'),
      where('tenantId', '==', profile.tenantId),
      orderBy('date', 'desc')
    );

    const unsubCharity = onSnapshot(charityQ, (snap) => {
      setCharityRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as CharityRecord)));
    });

    return () => {
      unsubClosings();
      unsubCharity();
    };
  }, [profile]);

  const fetchClosingTransactions = async (closing: DailyClosing) => {
    if (!profile?.tenantId) return;
    
    // Calculate date range for that closing
    const date = new Date(closing.date.seconds * 1000);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'transactions'),
      where('tenantId', '==', profile.tenantId),
      where('date', '>=', Timestamp.fromDate(start)),
      where('date', '<=', Timestamp.fromDate(end)),
      where('type', '==', 'sale'),
      where('status', '==', 'completed')
    );

    const snap = await getDocs(q);
    setClosingTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    setSelectedClosing(closing);
    setIsDetailModalOpen(true);
  };

  const handleSaveCharity = async () => {
    if (!profile?.tenantId || !selectedClosing) return;

    // Check if already exists
    const existing = charityRecords.find(r => r.dailyClosingId === selectedClosing.id);
    if (existing) {
      alert('Data amal untuk settlement ini sudah disimpan.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `CE${year}${month}`;
      
      // Generate sequential CE number
      const qNum = query(
        collection(db, 'charityRecords'),
        where('tenantId', '==', profile?.tenantId),
        where('charityNumber', '>=', prefix),
        where('charityNumber', '<=', prefix + '\uf8ff'),
        orderBy('charityNumber', 'desc'),
        limit(1)
      );
      const snapNum = await getDocs(qNum);
      let nextIndex = 1;
      if (!snapNum.empty) {
        const lastNum = snapNum.docs[0].data().charityNumber;
        const lastIndex = parseInt(lastNum.replace(prefix, ''), 10);
        if (!isNaN(lastIndex)) nextIndex = lastIndex + 1;
      }
      const charityNumber = `${prefix}${String(nextIndex).padStart(6, '0')}`;

      const totalProfit = selectedClosing.netProfit || selectedClosing.grossProfit;
      const charityAmount = totalProfit * 0.025;
      const netProfitAfterCharity = totalProfit - charityAmount;

      await addDoc(collection(db, 'charityRecords'), {
        tenantId: profile.tenantId,
        charityNumber,
        dailyClosingId: selectedClosing.id,
        dailyNumber: selectedClosing.dailyNumber || 'DS-UNKNOWN',
        date: selectedClosing.date,
        totalProfit,
        charityAmount,
        netProfitAfterCharity,
        transactionCount: selectedClosing.transactionCount,
        status: 'locked', // Locked immediately as per request
        createdAt: serverTimestamp()
      });

      // Also create a charity reserve transaction for the charity
      const dateObj = new Date(selectedClosing.date.seconds * 1000);
      const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      
      await addDoc(collection(db, 'transactions'), {
        tenantId: profile.tenantId,
        type: 'charity_reserve',
        amount: charityAmount,
        category: 'Amal',
        activity: 'Operasional',
        description: `Reservasi Dana Amal tgl ${dateStr} (Ref: ${charityNumber})`,
        bankAccountId: selectedCharityBankId || null,
        date: serverTimestamp(),
        status: 'completed',
        userId: profile.uid,
        isAutoGenerated: true,
        createdAt: serverTimestamp()
      });

      alert('Data cadangan dana amal berhasil disimpan dan dikunci.');
      setIsDetailModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'charityRecords');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!profile?.tenantId || !selectedCharityForRequest) return;

    setIsSaving(true);
    try {
      const requestData: any = {
        tenantId: profile.tenantId,
        tenantName: profile.displayName || 'Unknown Tenant',
        type: 'charity_revision',
        charityId: selectedCharityForRequest.id,
        requestedBy: profile.uid,
        requestedAt: serverTimestamp(),
        reason: requestReason,
        status: 'pending'
      };

      if (selectedCharityForRequest.dailyClosingId) {
        requestData.closingId = selectedCharityForRequest.dailyClosingId;
      }

      await addDoc(collection(db, 'approval_requests'), requestData);
      alert('Permintaan revisi amal telah dikirim ke Super Admin.');
      setIsRequestModalOpen(false);
      setRequestReason('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'approval_requests');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Modul Amal</h2>
        <p className="text-gray-500 mt-1">Kelola kontribusi amal berdasarkan profit harian.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List of Daily Settlements for Charity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 flex items-center">
                <History className="w-5 h-5 mr-2 text-indigo-600" />
                Daftar Settlement Harian
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-widest font-black">
                  <tr>
                    <th className="px-8 py-4">ID Daily</th>
                    <th className="px-8 py-4">Tanggal</th>
                    <th className="px-8 py-4">TRX</th>
                    <th className="px-8 py-4">Profit</th>
                    <th className="px-8 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {closings.map((closing) => {
                    const hasCharity = charityRecords.some(r => r.dailyClosingId === closing.id);
                    return (
                      <tr key={closing.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-6 font-mono font-bold text-indigo-600">{closing.dailyNumber || 'DS-...'}</td>
                        <td className="px-8 py-6 text-sm text-gray-600 font-bold">
                          {new Date(closing.date.seconds * 1000).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-gray-900">{closing.transactionCount}</td>
                        <td className="px-8 py-6 text-sm font-black text-green-600">Rp.{closing.grossProfit.toLocaleString()}</td>
                        <td className="px-8 py-6 text-right">
                          {hasCharity ? (
                            <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full border border-green-100">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              SAVED
                            </span>
                          ) : (
                            <button
                              onClick={() => fetchClosingTransactions(closing)}
                              className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-md hover:bg-indigo-700 transition-all flex items-center ml-auto"
                            >
                              <Calculator className="w-3 h-3 mr-2" />
                              Hitung Amal
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {closings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-gray-400">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        Belum ada data settlement harian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Charity Records History */}
        <div className="space-y-6">
          <div className="bg-white rounded-md p-8 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 flex items-center mb-8">
              <Heart className="w-5 h-5 mr-2 text-pink-500" />
              Riwayat Amal
            </h3>
            <div className="space-y-6">
              {charityRecords.map((record) => (
                <div key={record.id} className="p-6 rounded-md bg-gray-50 border border-gray-100 relative group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">{record.charityNumber || 'CE-...'}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase">{record.dailyNumber || 'BELUM SETTLEMENT'}</p>
                      <p className="text-xs font-bold text-gray-600">
                        {record.date ? new Date(record.date.seconds * 1000).toLocaleDateString('id-ID') : 'Hari Ini'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedCharityForRequest(record);
                          setIsRequestModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                        title="Request Revisi"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 font-bold">Amal (2.5%):</span>
                      <span className="text-pink-600 font-black">Rp.{record.charityAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 font-bold">Profit Bersih:</span>
                      <span className="text-indigo-600 font-black">Rp.{record.netProfitAfterCharity.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase flex items-center">
                      <Lock className="w-3 h-3 mr-1" />
                      LOCKED
                    </span>
                    <span className="text-[10px] font-black text-gray-400 uppercase">
                      {record.transactionCount} Trx
                    </span>
                  </div>
                </div>
              ))}
              {charityRecords.length === 0 && (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                  <p className="text-gray-400 text-xs font-bold">Belum ada catatan amal.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedClosing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Detail Profit Harian</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-indigo-100 text-sm font-mono">{selectedClosing.dailyNumber}</p>
                    <span className="text-indigo-300">|</span>
                    <p className="text-pink-300 text-xs font-black uppercase tracking-widest">Penghitungan Amal</p>
                  </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="p-6 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Omzet</p>
                    <p className="text-xl font-black text-gray-900">Rp.{selectedClosing.totalSales.toLocaleString()}</p>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Modal (HPP)</p>
                    <p className="text-xl font-black text-red-600">Rp.{selectedClosing.totalCost.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-black text-gray-900 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-indigo-600" />
                    Rincian Transaksi
                  </h4>
                  <div className="bg-gray-50 rounded-md overflow-hidden border border-gray-100">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-gray-500 uppercase text-[10px] tracking-widest font-black">
                        <tr>
                          <th className="px-6 py-4">Item</th>
                          <th className="px-6 py-4 text-right">Jual - Beli</th>
                          <th className="px-6 py-4 text-right">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {closingTransactions.map((t) => (
                          t.items?.map((item, idx) => {
                            const profit = (item.price - item.hpp) * item.quantity;
                            return (
                              <tr key={`${t.id}-${idx}`}>
                                <td className="px-6 py-4">
                                  <p className="font-bold text-gray-900">{item.name}</p>
                                  <p className="text-[10px] text-gray-500">{item.quantity} pcs</p>
                                </td>
                                <td className="px-6 py-4 text-right text-xs text-gray-500">
                                  Rp.{item.price.toLocaleString()} - Rp.{item.hpp.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right font-black text-green-600">
                                  Rp.{profit.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-8 bg-indigo-50 rounded-md border border-indigo-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-indigo-900">Laba Bersih (Net):</span>
                    <span className="text-xl font-black text-indigo-600">Rp.{(selectedClosing.netProfit || selectedClosing.grossProfit).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-pink-700">Amal (2.5%):</span>
                    <span className="text-xl font-black text-pink-600">- Rp.{((selectedClosing.netProfit || selectedClosing.grossProfit) * 0.025).toLocaleString()}</span>
                  </div>
                  <div className="pt-4 border-t border-indigo-200 flex justify-between items-center">
                    <span className="text-lg font-black text-indigo-900">Profit Bersih Setelah Amal:</span>
                    <span className="text-2xl font-black text-indigo-600">
                      Rp.{((selectedClosing.netProfit || selectedClosing.grossProfit) - ((selectedClosing.netProfit || selectedClosing.grossProfit) * 0.025)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-10 border-t border-gray-100 bg-gray-50 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Pilih Akun Kas/Bank untuk Amal</label>
                  <select
                      value={selectedCharityBankId}
                      onChange={(e) => setSelectedCharityBankId(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-md focus:border-indigo-500 focus:ring-0 outline-none"
                  >
                      <option value="">-- Pilih Akun (Opsional) --</option>
                      {bankAccounts.map(b => (
                          <option key={b.id} value={b.id}>{b.name} {b.accountNumber ? `(${b.accountNumber})` : ''}</option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="flex-1 px-8 py-4 border border-gray-200 rounded-md font-medium text-gray-600 hover:bg-gray-100 transition-all"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={handleSaveCharity}
                    disabled={isSaving}
                    className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-md font-black hover:bg-indigo-700 transition-all flex items-center justify-center shadow-xl shadow-indigo-100"
                  >
                    {isSaving ? 'Menyimpan...' : 'Save & Lock'}
                    <Lock className="ml-2 w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Revision Modal */}
      <AnimatePresence>
        {isRequestModalOpen && selectedCharityForRequest && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100">
                <h3 className="text-xl font-black text-gray-900">Request Revisi Amal</h3>
                <p className="text-sm text-gray-500">Kirim permintaan ke Super Admin untuk mengubah data amal yang sudah dikunci.</p>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Alasan Revisi</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="Contoh: Ada kesalahan perhitungan profit, koreksi data transaksi..."
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsRequestModalOpen(false)}
                    className="flex-1 px-6 py-4 border border-gray-200 rounded-md text-gray-600 font-medium hover:bg-white transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRequestRevision}
                    disabled={isSaving || !requestReason.trim()}
                    className="flex-1 px-6 py-4 bg-red-600 text-white rounded-md font-black hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center"
                  >
                    {isSaving ? 'Mengirim...' : 'Kirim Request'}
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
