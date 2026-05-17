import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Tenant, UserProfile } from '../../types';
import { Users, Building2, ShieldCheck, Globe, TrendingUp, CreditCard, Clock, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { auth } from '../../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    revenueThisMonth: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    planDistribution: [] as { name: string, value: number, color: string }[]
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantSnap, userSnap, invoiceSnap] = await Promise.all([
          getDocs(query(collection(db, 'tenants'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'finance_invoices'), orderBy('createdAt', 'desc'), limit(100)))
        ]);

        const tenantData = tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));
        const userData = userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        const invoiceData = invoiceSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        setTenants(tenantData);
        setUsers(userData);
        setInvoices(invoiceData);

        // Calculate Revenue
        const paidInvoices = invoiceData.filter(inv => inv.status === 'paid');
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const revenueThisMonth = paidInvoices
          .filter(inv => {
            const date = inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000) : new Date();
            return date >= startOfMonth;
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);

        // Pending Invoices
        const pendingInvoices = invoiceData.filter(inv => inv.status === 'pending');
        const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        // Subscriptions
        const active = tenantData.filter(t => {
          if (!t.subscriptionEndDate) return true;
          const end = new Date(t.subscriptionEndDate.seconds * 1000);
          return end > new Date();
        }).length;

        // Plan Distribution
        const plans: Record<string, number> = {};
        tenantData.forEach(t => {
          const plan = t.plan || t.subscription || 'free';
          plans[plan] = (plans[plan] || 0) + 1;
        });

        const COLORS = {
          free: '#94a3b8',
          starter: '#22c55e',
          lite: '#3b82f6',
          pro: '#8b5cf6',
          business: '#ec4899'
        };

        const planDist = Object.entries(plans).map(([name, value]) => ({
          name: name.toUpperCase(),
          value,
          color: COLORS[name as keyof typeof COLORS] || '#4f46e5'
        })).sort((a, b) => b.value - a.value);

        setStats({
          totalRevenue,
          revenueThisMonth,
          activeSubscriptions: active,
          expiredSubscriptions: tenantData.length - active,
          pendingInvoices: pendingInvoices.length,
          pendingAmount,
          planDistribution: planDist
        });

      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'dashboard_stats', auth, profile);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  if (loading) return (
    <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      <p className="text-gray-500 font-medium font-mono text-xs uppercase tracking-widest">Memuat Dashboard Utama...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Superadmin Dashboard</h2>
          <p className="text-gray-500 font-medium">Monitoring sistem & aliran pendapatan global.</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 p-2 rounded-md flex items-center border border-emerald-100 font-medium text-sm shadow-sm">
          <ShieldCheck className="w-4 h-4 mr-2" />
          Sistem Online & Optimal
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full uppercase">TOTAL REVENUE</span>
          </div>
          <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Total Pendapatan</p>
          <p className="text-2xl font-black text-gray-900">Rp{stats.totalRevenue.toLocaleString()}</p>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-xs">
            <span className="text-emerald-500 font-bold mr-2">+Rp{stats.revenueThisMonth.toLocaleString()}</span>
            <span className="text-gray-400 font-medium">bulan ini</span>
          </div>
        </div>

        {/* Total Tenants */}
        <div 
          className="bg-white p-6 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
          onClick={() => navigate('/superadmin/tenants')}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-md">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-full uppercase">USER B2B</span>
          </div>
          <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Total Tenant Aktif</p>
          <p className="text-2xl font-black text-gray-900">{stats.activeSubscriptions} <span className="text-sm font-bold text-gray-300">/ {tenants.length}</span></p>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold group-hover:text-indigo-600 transition-colors">Lihat Semua</span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
          </div>
        </div>

        {/* Total Users */}
        <div 
          className="bg-white p-6 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
          onClick={() => navigate('/superadmin/users')}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-md">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black bg-purple-50 text-purple-600 px-2 py-1 rounded-full uppercase">CUST BASE</span>
          </div>
          <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Total User</p>
          <p className="text-2xl font-black text-gray-900">{users.length.toLocaleString()}</p>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold group-hover:text-indigo-600 transition-colors">Lihat Semua</span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
          </div>
        </div>

        {/* Billing Status */}
        <div 
          className="bg-white p-6 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
          onClick={() => navigate('/superadmin/invoices')}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-md">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded-full uppercase">BILLING</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Invoice Pending</p>
              <p className="text-2xl font-black text-gray-900">{stats.pendingInvoices}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-amber-500 uppercase">Potensi Dana</p>
              <p className="text-sm font-black text-gray-900">+Rp{stats.pendingAmount.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold group-hover:text-amber-600 transition-colors">Kelola Tagihan</span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-600 transition-all group-hover:translate-x-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Plan Distribution Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-md border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Distribusi Paket</h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Per Tenant</span>
          </div>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.planDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  width={80}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-md shadow-xl border border-gray-100">
                          <p className="text-xs font-black text-gray-900 uppercase tracking-widest leading-none mb-1">{payload[0].payload.name}</p>
                          <p className="text-lg font-black text-indigo-600">{payload[0].value} <span className="text-[10px] text-gray-400 font-bold">Tenants</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                  {stats.planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-auto space-y-2">
            {stats.planDistribution.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{item.name}</span>
                </div>
                <span className="text-xs font-black text-gray-900">{item.value} Tenant</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Invoices List */}
        <div className="lg:col-span-2 bg-white rounded-md border border-gray-100 shadow-sm flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs flex items-center">
              <FileText className="w-4 h-4 mr-2 text-indigo-600" />
              Recent Payment Activity
            </h3>
            <button 
              onClick={() => navigate('/superadmin/invoices')}
              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 px-3 py-1 rounded-full transition-all"
            >
              See All Activity
            </button>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Paket</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium italic">
                      No recent invoice activity.
                    </td>
                  </tr>
                ) : (
                  invoices.slice(0, 6).map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-black text-gray-900 truncate max-w-[150px]">
                            {tenants.find(t => t.id === inv.tenantId)?.name || inv.tenantName || 'Unknown Corp'}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-tighter uppercase">{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{inv.planName || inv.planId}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                          inv.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.status === 'paid' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {inv.status === 'paid' ? 'Paid' : inv.status === 'cancelled' ? 'Batal' : 'Pending'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-black text-gray-900 whitespace-nowrap">
                          Rp{(inv.total || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[11px] font-bold text-gray-400">
                          {inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }) : '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
