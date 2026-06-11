import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Transaction, SalesTarget, BusinessLine } from '../../types';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line } from 'recharts';
import { Activity, TrendingUp, Calendar, ArrowUpRight, Target, Briefcase } from 'lucide-react';
import { motion } from 'motion/react';

export default function Achievement() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);
  const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('1m');
  const [selectedBusinessLine, setSelectedBusinessLine] = useState<string>('all');

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'transactions'),
      where('tenantId', '==', profile.tenantId),
      where('type', '==', 'sale'),
      where('status', '==', 'completed'),
      orderBy('date', 'desc')
    );

    const unsubTx = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    });

    const targetQ = query(collection(db, 'sales_targets'), where('tenantId', '==', profile.tenantId));
    const unsubTarget = onSnapshot(targetQ, (snap) => {
      setSalesTargets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesTarget)));
    });

    const blQ = query(collection(db, 'business_lines'), where('tenantId', '==', profile.tenantId));
    const unsubBL = onSnapshot(blQ, (snap) => {
      setBusinessLines(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessLine)));
    });

    return () => {
      unsubTx();
      unsubTarget();
      unsubBL();
    };
  }, [profile]);

  const getTxAmount = (tx: Transaction) => {
    if (selectedBusinessLine === 'all') return tx.amount;
    
    if (tx.items && tx.items.length > 0) {
      const matchTotal = tx.items.reduce((sum, item) => {
        if (item.businessLineId === selectedBusinessLine) {
          return sum + (item.price * item.quantity);
        }
        return sum;
      }, 0);
      
      const itemTotal = tx.items.reduce((s, it) => s + (it.price * it.quantity), 0);
      return itemTotal > 0 ? (tx.amount * (matchTotal / itemTotal)) : 0;
    }
    
    return 0; // Or tx.amount if we can't figure it out? No, 0 is safer if filtering
  };

  const getMonthKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getSalesStats = (months: number) => {
    const now = new Date();
    // Start of the first month in the range
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    
    const filteredTxs = transactions.filter(tx => {
      const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return date >= startDate;
    });

    const totalSales = filteredTxs.reduce((sum, tx) => sum + getTxAmount(tx), 0);
    const monthlyData: { [key: string]: number } = {};
    for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = getMonthKey(d);
        monthlyData[mKey] = 0;
    }

    filteredTxs.forEach(tx => {
        const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        const mKey = getMonthKey(date);
        if (monthlyData.hasOwnProperty(mKey)) {
            monthlyData[mKey] += getTxAmount(tx);
        }
    });

    const chartData = Object.keys(monthlyData).sort().map(key => {
        const target = salesTargets.find(t => t.month === key);
        return {
            month: new Date(key + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
            sales: monthlyData[key],
            target1: target?.target1 || 0,
            target2: target?.target2 || 0,
            target3: target?.target3 || 0
        };
    });

    return { totalSales, chartData };
  };

  const periodMonths = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
  const { totalSales, chartData } = getSalesStats(periodMonths);

  const currentMonth = getMonthKey(new Date());
  const currentMonthSales = transactions
    .filter(tx => {
        const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        return date.toISOString().slice(0, 7) === currentMonth;
    })
    .reduce((sum, tx) => sum + getTxAmount(tx), 0);

  const currentMonthTarget = salesTargets.find(t => t.month === currentMonth);

  const getAchievementInfo = () => {
    if (!currentMonthTarget) return null;
    let level = 0;
    let nextTarget = currentMonthTarget.target1;
    let progress = 0;

    if (currentMonthSales >= currentMonthTarget.target3) {
      level = 3;
      nextTarget = currentMonthTarget.target3;
      progress = 100;
    } else if (currentMonthSales >= currentMonthTarget.target2) {
      level = 2;
      nextTarget = currentMonthTarget.target3;
      progress = (currentMonthSales / currentMonthTarget.target3) * 100;
    } else if (currentMonthSales >= currentMonthTarget.target1) {
      level = 1;
      nextTarget = currentMonthTarget.target2;
      progress = (currentMonthSales / currentMonthTarget.target2) * 100;
    } else {
      level = 0;
      nextTarget = currentMonthTarget.target1;
      progress = (currentMonthSales / currentMonthTarget.target1) * 100;
    }

    return { level, nextTarget, progress };
  };

  const achievement = getAchievementInfo();

  if (loading) return <div className="p-8 text-center text-gray-500">Memuat Pencapaian...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center">
            <Activity className="w-8 h-8 mr-3 text-indigo-600" />
            Pencapaian Penjualan
          </h2>
          <p className="text-gray-500 font-medium">Bandingkan realisasi transaksi terhadap target yang telah ditetapkan.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {businessLines.length > 0 && (
            <div className="flex items-center bg-white px-3 py-1 rounded-md shadow-sm border border-gray-100">
              <Briefcase className="w-4 h-4 text-gray-400 mr-2" />
              <select
                value={selectedBusinessLine}
                onChange={(e) => setSelectedBusinessLine(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
              >
                <option value="all">Semua Market Bisnis</option>
                {businessLines.map(bl => (
                  <option key={bl.id} value={bl.id}>{bl.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex bg-white p-1 rounded-md shadow-sm border border-gray-100">
            {[
              { label: 'Bulanan', value: '1m' },
              { label: '3 Bulan', value: '3m' },
              { label: '6 Bulan', value: '6m' },
              { label: '12 Bulan', value: '12m' },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value as any)}
                className={`px-4 py-2 text-xs font-black rounded-md transition-all ${
                  period === p.value 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-md">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-gray-900 text-xs uppercase tracking-tight">Total Sales</h4>
                </div>
                <p className="text-xl font-bold text-gray-900">Rp.{Math.round(totalSales).toLocaleString('id-ID')}</p>
                <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{period === '1m' ? 'Bulan Ini' : `${periodMonths} Bulan Terakhir`}</p>
                    <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        Live Update
                    </div>
                </div>
            </div>

            {achievement && (
                <div className="p-6 rounded-xl shadow-xl text-white transition-all transform hover:scale-[1.02] bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-indigo-200">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest border border-indigo-400/30 bg-indigo-800/30 px-2 py-0.5 rounded-full inline-block backdrop-blur-sm mb-2">
                                Progress Target {achievement.level + 1}
                            </p>
                            <h3 className="text-xl font-bold tracking-tight mt-1 text-white text-shadow">Level {achievement.level}</h3>
                        </div>
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10 shadow-inner">
                            <Target className="w-5 h-5 text-indigo-100" />
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-lg font-bold tabular-nums tracking-tight">Rp.{Math.round(currentMonthSales).toLocaleString('id-ID')}</span>
                            <span className="text-sm font-semibold text-indigo-200 tabular-nums">Rp.{Math.round(achievement.nextTarget).toLocaleString('id-ID')}</span>
                        </div>
                        
                        <div className="relative h-2 bg-indigo-900/50 rounded-full overflow-hidden shadow-inner">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.max(0, achievement.progress))}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="absolute inset-y-0 left-0 bg-white rounded-full"
                            />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] font-medium text-indigo-300">Realisasi</span>
                            <span className="text-[10px] font-medium text-indigo-300">Goal</span>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm h-[420px] transition-all hover:shadow-md">
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <h3 className="font-bold text-gray-800 uppercase tracking-tight text-base">
                        Visual Pencapaian
                    </h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actual</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target 1</span>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="80%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="month" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                            tickFormatter={(val) => `Rp.${(val / 1000000).toFixed(0)}M`}
                        />
                        <Tooltip 
                            cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} 
                            contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)', padding: '20px' }}
                            formatter={(value: any) => [`Rp.${Math.round(Number(value)).toLocaleString('id-ID')}`, '']}
                        />
                        <Area type="monotone" dataKey="sales" fill="url(#achieveColor)" stroke="none" />
                        <Bar dataKey="sales" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={40} />
                        <Line type="monotone" dataKey="target1" stroke="#f87171" strokeWidth={3} dot={false} strokeDasharray="12 6" />
                        <defs>
                            <linearGradient id="achieveColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 uppercase tracking-tight">Rincian Performa Bulanan</h3>
                    <div className="bg-gray-50 rounded-md px-3 py-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {periodMonths} Bulan Terakhir
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <th className="px-8 py-5 whitespace-nowrap">Bulan</th>
                                <th className="px-8 py-5 text-right whitespace-nowrap">Omzet Aktual</th>
                                <th className="px-8 py-5 text-right whitespace-nowrap">Target 1 & %</th>
                                <th className="px-8 py-5 text-right whitespace-nowrap">Target 2 & %</th>
                                <th className="px-8 py-5 text-right whitespace-nowrap">Target 3 & %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {chartData.slice().reverse().map((data, idx) => {
                                const calcPct = (target: number) => target > 0 ? (data.sales / target) * 100 : 0;
                                const pct1 = calcPct(data.target1);
                                const pct2 = calcPct(data.target2);
                                const pct3 = calcPct(data.target3);
                                
                                return (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-6 font-bold text-gray-900 border-r border-gray-50 whitespace-nowrap">
                                            {data.month}
                                        </td>
                                        <td className="px-8 py-6 text-right font-bold text-indigo-600 text-base border-r border-gray-50 whitespace-nowrap">
                                            Rp.{Math.round(data.sales).toLocaleString('id-ID')}
                                        </td>
                                        
                                        {/* Target 1 */}
                                        <td className="px-8 py-6 text-right border-r border-gray-50 align-top">
                                            <div className="flex flex-col justify-start h-full">
                                                <span className="text-xs font-bold text-gray-400 mb-1">Rp.{Math.round(data.target1).toLocaleString('id-ID')}</span>
                                                <span className={`text-sm font-black ${pct1 >= 100 ? 'text-green-600' : 'text-amber-500'}`}>
                                                    {pct1.toFixed(1)}%
                                                </span>
                                                {pct1 < 100 && data.target1 > 0 && (
                                                    <span className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-tight">
                                                        - Rp.{Math.round(data.target1 - data.sales).toLocaleString('id-ID')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Target 2 */}
                                        <td className="px-8 py-6 text-right border-r border-gray-50 align-top">
                                            <div className="flex flex-col justify-start h-full">
                                                <span className="text-xs font-bold text-gray-400 mb-1">Rp.{Math.round(data.target2).toLocaleString('id-ID')}</span>
                                                <span className={`text-sm font-black ${pct2 >= 100 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                    {pct2.toFixed(1)}%
                                                </span>
                                                {pct2 < 100 && data.target2 > 0 && (
                                                    <span className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-tight">
                                                        - Rp.{Math.round(data.target2 - data.sales).toLocaleString('id-ID')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Target 3 */}
                                        <td className="px-8 py-6 text-right align-top">
                                            <div className="flex flex-col justify-start h-full">
                                                <span className="text-xs font-bold text-gray-400 mb-1">Rp.{Math.round(data.target3).toLocaleString('id-ID')}</span>
                                                <span className={`text-sm font-black ${pct3 >= 100 ? 'text-amber-600' : 'text-gray-300'}`}>
                                                    {pct3.toFixed(1)}%
                                                </span>
                                                {pct3 < 100 && data.target3 > 0 && (
                                                    <span className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-tight">
                                                        - Rp.{Math.round(data.target3 - data.sales).toLocaleString('id-ID')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
