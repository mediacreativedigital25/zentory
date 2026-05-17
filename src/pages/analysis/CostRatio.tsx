import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Transaction } from '../../types';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, Legend } from 'recharts';
import { Activity, TrendingUp, Calendar, ArrowUpRight, Calculator, Wallet, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';

export default function CostRatio() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('6m');

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'transactions'),
      where('tenantId', '==', profile.tenantId),
      where('status', '==', 'completed'),
      orderBy('date', 'desc')
    );

    const unsubTx = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    });

    return () => unsubTx();
  }, [profile]);

  const getMonthKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getStats = (months: number) => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    
    const filteredTxs = transactions.filter(tx => {
      const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return date >= startDate;
    });

    const monthlyData: { [key: string]: { revenue: number, expense: number } } = {};
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = getMonthKey(d);
      monthlyData[mKey] = { revenue: 0, expense: 0 };
    }

    filteredTxs.forEach(tx => {
      const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      const mKey = getMonthKey(date);
      if (monthlyData.hasOwnProperty(mKey)) {
        if (tx.type === 'sale') {
          monthlyData[mKey].revenue += tx.amount;
        } else if (tx.type === 'expense') {
          monthlyData[mKey].expense += tx.amount;
        }
      }
    });

    const chartData = Object.keys(monthlyData).sort().map(key => {
      const { revenue, expense } = monthlyData[key];
      // Cost Ratio = (Expense / Revenue) * 100
      const ratio = revenue > 0 ? (expense / revenue) * 100 : 0;
      return {
        month: new Date(key + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        revenue,
        expense,
        ratio: parseFloat(ratio.toFixed(2))
      };
    });

    const totalRevenue = filteredTxs.filter(t => t.type === 'sale').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = filteredTxs.filter(t => t.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const averageRatio = totalRevenue > 0 ? (totalExpense / totalRevenue) * 100 : 0;

    return { totalRevenue, totalExpense, averageRatio, chartData };
  };

  const periodMonths = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
  const { totalRevenue, totalExpense, averageRatio, chartData } = getStats(periodMonths);

  const getRatioColor = (ratio: number) => {
    if (ratio === 0) return 'text-gray-400';
    if (ratio < 30) return 'text-green-500'; // Bagus
    if (ratio <= 60) return 'text-amber-500'; // Wajar/Warning
    return 'text-red-500'; // Bahaya
  };

  const getStatusBadge = (ratio: number) => {
    if (ratio === 0) return { label: 'No Data', class: 'bg-gray-50 text-gray-500 border-gray-100' };
    if (ratio < 30) return { label: 'Sangat Efisien', class: 'bg-green-50 text-green-700 border-green-100' };
    if (ratio <= 60) return { label: 'Wajar', class: 'bg-amber-50 text-amber-700 border-amber-100' };
    return { label: 'Bahaya (Boros)', class: 'bg-red-50 text-red-700 border-red-100' };
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Memuat Data Analisis...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center">
            <Calculator className="w-8 h-8 mr-3 text-indigo-600" />
            Cost to Revenue Ratio
          </h2>
          <p className="text-gray-500 font-medium">Persentase Biaya Operasional terhadap Pendapatan (Makin Kecil Makin Baik).</p>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-md">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h4 className="font-black text-gray-900 text-xs uppercase tracking-tight">Total Pendapatan</h4>
          </div>
          <p className="text-2xl font-black text-gray-900">Rp.{Math.round(totalRevenue).toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-widest">{periodMonths} Bulan Terakhir</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 text-red-600 rounded-md">
              <Wallet className="w-5 h-5" />
            </div>
            <h4 className="font-black text-gray-900 text-xs uppercase tracking-tight">Total Biaya Operasional</h4>
          </div>
          <p className="text-2xl font-black text-gray-900 text-red-600">Rp.{Math.round(totalExpense).toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-widest">{periodMonths} Bulan Terakhir</p>
        </div>

        <div className={`p-6 rounded-[2rem] shadow-xl text-white transition-all transform hover:scale-[1.02] ${
          averageRatio < 30 ? 'bg-gradient-to-br from-green-600 to-green-700 shadow-green-100' :
          averageRatio <= 60 ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-100' :
          'bg-gradient-to-br from-red-600 to-red-700 shadow-red-100'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 text-white rounded-md">
              <Activity className="w-5 h-5" />
            </div>
            <h4 className="font-black text-white/80 text-xs uppercase tracking-tight text-white">Rata-rata Cost Ratio</h4>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black">{averageRatio.toFixed(1)}%</p>
            <p className="text-[10px] font-bold uppercase tracking-widest">
              {averageRatio < 30 ? '(Sangat Bagus)' : averageRatio <= 60 ? '(Perlu Awasi)' : '(Bahaya)'}
            </p>
          </div>
          <p className="text-[10px] text-white/60 font-bold uppercase mt-1 tracking-widest">Efficiency Goal: {'<'} 30%</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-md border border-gray-100 shadow-sm h-[450px]">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-black text-gray-800 uppercase tracking-tight text-lg">Tren Cost Ratio (Efisiensi)</h3>
            <p className="text-xs text-gray-400 font-bold">Biaya Operasional : Pendapatan x 100%</p>
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
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#4f46e5' }}
              tickFormatter={(val) => `Rp.${(val / 1000000).toFixed(1)}M`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#ea580c' }}
              tickFormatter={(val) => `${val}%`}
              domain={[0, (dataMax: number) => Math.max(100, dataMax)]}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} 
              contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)', padding: '20px' }}
              formatter={(value: any, name: string) => [name === 'Cost Ratio (%)' ? `${Number(value)}%` : `Rp.${Math.round(Number(value)).toLocaleString('id-ID')}`, name]}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" fill="#4f46e5" radius={[8, 8, 0, 0]} name="Pendapatan" />
            <Bar yAxisId="left" dataKey="expense" fill="#f87171" radius={[8, 8, 0, 0]} name="Biaya Operasional" />
            <Line yAxisId="right" type="monotone" dataKey="ratio" stroke="#ea580c" strokeWidth={4} dot={{ stroke: '#ea580c', strokeWidth: 2, r: 4, fill: '#fff' }} name="Cost Ratio (%)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <h3 className="font-black text-gray-800 uppercase tracking-tight">Rincian Efisiensi Operasional</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
              <span className="text-[10px] font-bold text-gray-400">Efisiensi Tinggi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
              <span className="text-[10px] font-bold text-gray-400">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
              <span className="text-[10px] font-bold text-gray-400">Bahaya (Boros)</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-5">Bulan</th>
                <th className="px-8 py-5 text-right">Pendapatan</th>
                <th className="px-8 py-5 text-right">Biaya Ops</th>
                <th className="px-8 py-5 text-right">Ratio (Efisiensi)</th>
                <th className="px-8 py-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {chartData.slice().reverse().map((data, idx) => {
                const status = getStatusBadge(data.ratio);
                return (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6 font-bold text-gray-900">{data.month}</td>
                    <td className="px-8 py-6 text-right font-bold">Rp.{Math.round(data.revenue).toLocaleString('id-ID')}</td>
                    <td className="px-8 py-6 text-right font-bold text-red-500">Rp.{Math.round(data.expense).toLocaleString('id-ID')}</td>
                    <td className="px-8 py-6 text-right">
                      <span className={`text-lg font-black ${getRatioColor(data.ratio)}`}>
                        {data.ratio}%
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${status.class}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
