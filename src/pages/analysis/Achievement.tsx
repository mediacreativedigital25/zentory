import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Transaction, SalesTarget } from '../../types';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line } from 'recharts';
import { Activity, TrendingUp, Calendar, ArrowUpRight, Target } from 'lucide-react';
import { motion } from 'motion/react';

export default function Achievement() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('1m');

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

    return () => {
      unsubTx();
      unsubTarget();
    };
  }, [profile]);

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

    const totalSales = filteredTxs.reduce((sum, tx) => sum + tx.amount, 0);
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
            monthlyData[mKey] += tx.amount;
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
    .reduce((sum, tx) => sum + tx.amount, 0);

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
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center">
            <Activity className="w-8 h-8 mr-3 text-indigo-600" />
            Pencapaian Penjualan
          </h2>
          <p className="text-gray-500 font-medium">Bandingkan realisasi transaksi terhadap target yang telah ditetapkan.</p>
        </div>
        <div className="flex bg-white p-1 rounded-lg shadow-sm border border-gray-100">
          {[
            { label: 'Bulanan', value: '1m' },
            { label: '3 Bulan', value: '3m' },
            { label: '6 Bulan', value: '6m' },
            { label: '12 Bulan', value: '12m' },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value as any)}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">Total Sales ({period === '1m' ? 'Bulan Ini' : `${periodMonths} Bln`})</h4>
                </div>
                <p className="text-3xl font-black text-gray-900">Rp.{totalSales.toLocaleString()}</p>
                <div className="flex items-center mt-3 text-green-600 gap-1">
                    <div className="bg-green-100 p-0.5 rounded text-[10px] font-black uppercase tracking-tighter shadow-sm flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        Live Update
                    </div>
                </div>
            </div>

            {achievement && (
                <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Progress Target {achievement.level + 1}</p>
                            <h3 className="text-2xl font-black mt-1">Level {achievement.level}</h3>
                        </div>
                        <Target className="w-8 h-8 text-indigo-400/50" />
                    </div>
                    
                    <div className="relative h-6 bg-white/10 rounded-full overflow-hidden mb-4 border border-white/5 p-1">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${achievement.progress}%` }}
                            className="absolute inset-y-1 left-1 bg-gradient-to-r from-indigo-400 to-amber-400 rounded-full"
                        />
                    </div>
                    
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Realisasi</span>
                            <span className="text-xl font-black">Rp.{currentMonthSales.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Goal</span>
                            <p className="text-xs font-bold">Rp.{achievement.nextTarget.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm h-[400px]">
                <div className="flex justify-between items-center mb-10">
                    <h3 className="font-black text-gray-800 uppercase tracking-tight text-lg">Visual Pencapaian</h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Actual Sales</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target 1</span>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
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
                            formatter={(value: any) => [`Rp.${Number(value).toLocaleString()}`, '']}
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

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-gray-800 uppercase tracking-tight">Rincian Performa Bulanan</h3>
                    <div className="p-2 bg-gray-50 rounded-xl px-4 py-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{periodMonths} Bulan Terakhir</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="px-8 py-5">Nama Bulan</th>
                                <th className="px-8 py-5 text-right">Omzet</th>
                                <th className="px-8 py-5 text-right">Target 1 & %</th>
                                <th className="px-8 py-5 text-right">Target 2 & %</th>
                                <th className="px-8 py-5 text-right">Target 3 & %</th>
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
                                        <td className="px-8 py-6 font-bold text-gray-900 border-r border-gray-50">{data.month}</td>
                                        <td className="px-8 py-6 text-right font-black text-indigo-600 text-lg border-r border-gray-50">
                                            Rp.{data.sales.toLocaleString()}
                                        </td>
                                        
                                        {/* Target 1 */}
                                        <td className="px-8 py-6 text-right border-r border-gray-50">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-400 mb-1">Rp.{data.target1.toLocaleString()}</span>
                                                <span className={`text-sm font-black ${pct1 >= 100 ? 'text-green-600' : 'text-amber-500'}`}>
                                                    {pct1.toFixed(1)}%
                                                </span>
                                                {pct1 < 100 && data.target1 > 0 && (
                                                    <span className="text-[9px] font-bold text-red-400 mt-1 uppercase tracking-tighter">
                                                        Kurang: Rp.{(data.target1 - data.sales).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Target 2 */}
                                        <td className="px-8 py-6 text-right border-r border-gray-50">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-400 mb-1">Rp.{data.target2.toLocaleString()}</span>
                                                <span className={`text-sm font-black ${pct2 >= 100 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                    {pct2.toFixed(1)}%
                                                </span>
                                                {pct2 < 100 && data.target2 > 0 && (
                                                    <span className="text-[9px] font-bold text-red-400 mt-1 uppercase tracking-tighter">
                                                        Kurang: Rp.{(data.target2 - data.sales).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Target 3 */}
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-400 mb-1">Rp.{data.target3.toLocaleString()}</span>
                                                <span className={`text-sm font-black ${pct3 >= 100 ? 'text-amber-600' : 'text-gray-300'}`}>
                                                    {pct3.toFixed(1)}%
                                                </span>
                                                {pct3 < 100 && data.target3 > 0 && (
                                                    <span className="text-[9px] font-bold text-red-400 mt-1 uppercase tracking-tighter">
                                                        Kurang: Rp.{(data.target3 - data.sales).toLocaleString()}
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
