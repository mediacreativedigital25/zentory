import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, limit, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
// ... (rest of imports)

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
  // We don't throw here to avoid crashing the whole dashboard, but we log it
}
import { useAuth } from '../hooks/useAuth';
import { Transaction, Product, Tenant } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Package, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight, Building2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    if (!profile) return;

    let transQuery;
    let allTransQuery;
    let prodQuery;
    let ordersQuery;

    let unsubTenants: (() => void) | null = null;

    if (profile.tenantId) {
      transQuery = query(
        collection(db, 'transactions'),
        where('tenantId', '==', profile.tenantId),
        orderBy('date', 'desc'),
        limit(10)
      );
      allTransQuery = query(
        collection(db, 'transactions'),
        where('tenantId', '==', profile.tenantId)
      );
      prodQuery = query(
        collection(db, 'products'),
        where('tenantId', '==', profile.tenantId)
      );
      ordersQuery = query(
        collection(db, 'orders'),
        where('tenantId', '==', profile.tenantId)
      );
    } else if (profile.role === 'superadmin') {
      transQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(10));
      allTransQuery = query(collection(db, 'transactions'));
      prodQuery = query(collection(db, 'products'));
      ordersQuery = query(collection(db, 'orders'));

      // Fetch tenants for name resolution
      unsubTenants = onSnapshot(collection(db, 'tenants'), (snap) => {
        setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      }, (err) => handleFirestoreError(err, OperationType.GET, 'tenants'));
    } else {
      return;
    }

    const unsubTrans = onSnapshot(transQuery, (snap) => {
      setRecentTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'recent_transactions'));

    const unsubAllTrans = onSnapshot(allTransQuery, (snap) => {
      setAllTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'all_transactions'));

    const unsubProd = onSnapshot(prodQuery, (snap) => {
      setProductCount(snap.size);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'products_count'));

    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      setOrderCount(snap.size);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'orders_count'));

    return () => {
      unsubTrans();
      unsubAllTrans();
      unsubProd();
      unsubOrders();
      if (unsubTenants) unsubTenants();
    };
  }, [profile]);

  const stats = useMemo(() => {
    const activeSales = allTransactions.filter(t => t.type === 'sale' && t.status !== 'cancelled');
    const activeExpenses = allTransactions.filter(t => t.type === 'expense' && t.status !== 'cancelled');
    
    const sales = activeSales.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expenses = activeExpenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    
    return {
      totalSales: sales,
      totalOrders: orderCount + activeSales.filter(t => !t.orderNumber).length,
      totalProducts: productCount,
      totalExpenses: expenses,
    };
  }, [allTransactions, productCount, orderCount]);

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
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Recent Transactions</h3>
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
