import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, limit, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuth } from '../hooks/useAuth';
import { Transaction, Product, Tenant } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Package, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight, Building2, CheckCircle2, CreditCard, Tag, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { profile, domainTenantId } = useAuth();
  const navigate = useNavigate();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    if (!profile) return;

    let transQuery;
    let allTransQuery;
    let prodQuery;
    let ordersQuery;

    let unsubTenants: (() => void) | null = null;

    const targetTenantId = domainTenantId || profile.tenantId;

    if (targetTenantId) {
      transQuery = query(
        collection(db, 'transactions'),
        where('tenantId', '==', targetTenantId),
        orderBy('date', 'desc'),
        limit(10)
      );
      allTransQuery = query(
        collection(db, 'transactions'),
        where('tenantId', '==', targetTenantId)
      );
      prodQuery = query(
        collection(db, 'products'),
        where('tenantId', '==', targetTenantId)
      );
      ordersQuery = query(
        collection(db, 'orders'),
        where('tenantId', '==', targetTenantId)
      );
    } else if (profile.role === 'superadmin' && !domainTenantId) {
      transQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(10));
      allTransQuery = query(collection(db, 'transactions'));
      prodQuery = query(collection(db, 'products'));
      ordersQuery = query(collection(db, 'orders'));

      unsubTenants = onSnapshot(collection(db, 'tenants'), (snap) => {
        setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      }, (err) => handleFirestoreError(err, OperationType.GET, 'tenants', auth, profile));
    } else {
      return;
    }

    const unsubTrans = onSnapshot(transQuery, (snap) => {
      setRecentTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'recent_transactions', auth, profile));

    const unsubAllTrans = onSnapshot(allTransQuery, (snap) => {
      setAllTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'all_transactions', auth, profile));

    const unsubProd = onSnapshot(prodQuery, (snap) => {
      setProductCount(snap.size);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'products_count', auth, profile));

    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'orders_count', auth, profile));

    const unsubBanks = onSnapshot(
      targetTenantId 
        ? query(collection(db, 'bank_accounts'), where('tenantId', '==', targetTenantId))
        : collection(db, 'bank_accounts'), 
      (snap) => {
        setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'bank_accounts', auth, profile)
    );

    return () => {
      unsubTrans();
      unsubAllTrans();
      unsubProd();
      unsubOrders();
      unsubBanks();
      if (unsubTenants) unsubTenants();
    };
  }, [profile, domainTenantId]);

  const stats = useMemo(() => {
    const activeSales = allTransactions.filter(t => t.type === 'sale' && t.status !== 'cancelled');
    const activeExpenses = allTransactions.filter(t => t.type === 'expense' && t.status !== 'cancelled');
    
    const sales = activeSales.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expenses = activeExpenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    // Payment Insights
    const paymentMethods: any = {};
    const paymentStatus: any = { lunas: 0, tempo: 0 };
    const productSales: any = {};

    allOrders.forEach(order => {
      // Payment Method
      const bank = bankAccounts.find(b => b.id === order.paymentMethod);
      const methodName = bank ? bank.name : 'Unknown';
      paymentMethods[methodName] = (paymentMethods[methodName] || 0) + order.totalAmount;

      // Payment Status
      let paid = order.paidAmount > 0 ? order.paidAmount : (order.paymentStatus === 'paid' ? order.totalAmount : 0);
      
      // Fix for legacy V1 bug where cash orders were saved with 0 paidAmount and unpaid status
      if (order.paymentType === 'cash' && paid === 0) {
         paid = order.totalAmount;
      }
      
      const remainingTempo = order.totalAmount - paid;
      
      paymentStatus.lunas += paid;
      if (remainingTempo > 0) {
        paymentStatus.tempo += remainingTempo;
      }

      // Products
      order.items?.forEach((item: any) => {
        productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([name, qty]: any) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const paymentMethodData = Object.entries(paymentMethods).map(([name, value]) => ({ name, value }));
    
    return {
      totalSales: sales,
      totalOrders: allOrders.length,
      totalProducts: productCount,
      totalExpenses: expenses,
      paymentMethodData,
      paymentStatus,
      topProducts
    };
  }, [allTransactions, productCount, allOrders, bankAccounts]);

  const chartData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }).reverse();

    const dataMap = last7Days.reduce((acc, day) => ({ ...acc, [day]: { sales: 0, expenses: 0 } }), {} as any);

    allTransactions.filter(t => t.status !== 'cancelled').forEach(t => {
      const date = t.date instanceof Timestamp 
        ? t.date.toDate() 
        : (t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date());
      const day = date.toLocaleDateString('en-US', { weekday: 'short' });
      if (dataMap[day]) {
        if (t.type === 'sale') dataMap[day].sales += t.amount || 0;
        if (t.type === 'expense') dataMap[day].expenses += t.amount || 0;
      }
    });

    return last7Days.map(day => ({
      name: day,
      sales: dataMap[day].sales,
      expenses: dataMap[day].expenses,
    }));
  }, [allTransactions]);

  const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {typeof value === 'number' && title.includes('Total') && !title.includes('Orders') && !title.includes('Products')
          ? `Rp.${(value || 0).toLocaleString()}`
          : (value || 0).toLocaleString()}
      </p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500">Welcome back, {profile?.displayName || profile?.email}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Sales" value={stats.totalSales} icon={ShoppingCart} trend={12} color="bg-indigo-500" />
        <StatCard title="Total Orders" value={stats.totalOrders} icon={TrendingUp} trend={8} color="bg-green-500" />
        <StatCard title="Total Products" value={stats.totalProducts} icon={Package} color="bg-orange-500" />
        <StatCard title="Total Expenses" value={stats.totalExpenses} icon={Wallet} trend={-5} color="bg-red-500" />
      </div>

      {/* Payment Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Lunas</p>
              <p className="text-2xl font-black text-gray-900">Rp.{stats.paymentStatus.lunas.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">PAID</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Tempo</p>
              <p className="text-2xl font-black text-gray-900">Rp.{stats.paymentStatus.tempo.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">CREDIT</span>
          </div>
        </div>
      </div>

      {/* Approval Shortcut */}
      {profile?.role === 'admin' && (
        <motion.div 
          whileHover={{ y: -2 }}
          onClick={() => navigate('/approvals')}
          className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-between cursor-pointer group overflow-hidden relative"
        >
          <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <CheckCircle2 className="w-48 h-48 text-white" />
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Pusat Persetujuan</h3>
              <p className="text-indigo-100">Cek pengajuan Sales, Finance, dan Purchase yang butuh tindakan Anda.</p>
            </div>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-xl text-white font-bold text-sm backdrop-blur-md group-hover:bg-white/30 transition-colors relative z-10">
            Buka Modul
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales vs Expenses */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Sales vs Expenses</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Metode Pembayaran</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.paymentMethodData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `Rp.${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              {stats.paymentMethodData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444'][index % 4] }} />
                  <span className="text-xs text-gray-500">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Produk Terlaris</h3>
            <Tag className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {stats.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-600">{p.qty} unit</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Terjual</p>
                </div>
              </div>
            ))}
            {stats.topProducts.length === 0 && (
              <p className="text-center text-gray-500 py-8">Belum ada data penjualan.</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Transaksi Terakhir</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`p-2 rounded-full mr-4 ${t.type === 'sale' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {t.type === 'sale' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 capitalize">{t.type}</p>
                      {profile?.role === 'superadmin' && (
                        <span className="flex items-center text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                          <Building2 className="w-2 h-2 mr-1" />
                          {tenants.find(ten => ten.id === t.tenantId)?.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {t.date 
                        ? new Date(t.date?.seconds * 1000).toLocaleDateString() 
                        : 'Just now...'}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-bold ${t.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'sale' ? '+' : '-'}Rp.{(t.amount || 0).toLocaleString()}
                </p>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transactions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
