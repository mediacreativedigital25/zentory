import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, limit, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuth } from '../hooks/useAuth';
import { Transaction, Product, Tenant } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Package, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight, Building2, CheckCircle2, CreditCard, Tag, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { profile, domainTenantId, tenant } = useAuth();
  const navigate = useNavigate();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const bookings = useMemo(() => allOrders.filter(o => o.type === 'booking'), [allOrders]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [productCount, setProductCount] = useState(0);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isBookingTenant = tenant?.catalogTheme === 'booking-v1';
  const nextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const prevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');

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

  useEffect(() => {
    if (allTransactions.length > 0 && profile) {
      allTransactions.forEach(async (t) => {
        if (Number(t.amount) === 151 || Number(t.amount) === 151.555 || Number(t.amount) < 200) {
           try {
             // Only auto-delete anomaly transactions if order list is empty or it has no associated valid order 
             if (t.type === 'sale' && allOrders.length === 0) {
                 const { deleteDoc, doc } = await import('firebase/firestore');
                 await deleteDoc(doc(db, 'transactions', t.id));
             }
           } catch(e) {}
        }
      });
    }
  }, [allTransactions, allOrders, profile]);

  const stats = useMemo(() => {
    const activeSales = allTransactions.filter(t => t.type === 'sale' && t.status !== 'cancelled' && t.status !== 'deleted');
    const activeExpenses = allTransactions.filter(t => t.type === 'expense' && t.status !== 'cancelled' && t.status !== 'deleted');
    
    const sales = activeSales.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expenses = activeExpenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    // Payment Insights
    const paymentMethods: any = {};
    const paymentStatus: any = { lunas: 0, tempo: 0 };
    const productSales: any = {};

    const validOrders = allOrders.filter(o => o.status !== 'cancelled' && o.status !== 'deleted');

    validOrders.forEach(order => {
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
      totalOrders: validOrders.length,
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

    allTransactions.filter(t => t.status !== 'cancelled' && t.status !== 'deleted').forEach(t => {
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
    <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col transition-all hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg flex items-center justify-center ${color.replace('bg-', 'bg-').replace('-500', '-50')}`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${trend > 0 ? 'text-[#28C76F] bg-[#28C76F]/10' : 'text-[#EA5455] bg-[#EA5455]/10'} px-2 py-1 rounded-md`}>
            {trend > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <h3 className="text-gray-500 text-[15px] font-medium tracking-tight mb-1">{title}</h3>
      <p className="text-[26px] font-bold text-gray-800 leading-tight">
        {typeof value === 'number' && title.includes('Total') && !title.includes('Orders') && !title.includes('Products')
          ? `Rp ${Math.round(value || 0).toLocaleString('id-ID')}`
          : Math.round(value || 0).toLocaleString('id-ID')}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center justify-between relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-[#7367f0] mb-2">Welcome back, {profile?.displayName || profile?.email?.split('@')[0]}! 🎉</h2>
          <p className="text-gray-500 text-[15px] max-w-md">Overview of your system metrics and analytics tracking. Check your ongoing projects and sales records.</p>
          {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
            <button 
              onClick={() => navigate('/sales/analysis/achievement')}
              className="mt-6 bg-[#7367f0] hover:bg-[#6357e0] text-white px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors shadow-md shadow-[#7367f0]/30"
            >
              View Analytics
            </button>
          )}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none hidden md:block" style={{ background: 'radial-gradient(circle at 100% 50%, #7367f0 0%, transparent 70%)' }}></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Sales" value={stats.totalSales} icon={ShoppingCart} trend={12} color="bg-indigo-500" />
        <StatCard title="Total Orders" value={stats.totalOrders} icon={TrendingUp} trend={8} color="bg-emerald-500" />
        <StatCard title="Total Products" value={stats.totalProducts} icon={Package} color="bg-sky-500" />
        <StatCard title="Total Expenses" value={stats.totalExpenses} icon={Wallet} trend={-5} color="bg-rose-500" />
      </div>

      {!isBookingTenant && (
        <>
          {/* Payment Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-emerald-50 text-emerald-500 rounded-xl group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Total Lunas</p>
              <p className="text-[26px] font-bold text-gray-800 leading-none">Rp {Math.round(stats.paymentStatus.lunas).toLocaleString('id-ID')}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md">PAID</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-rose-50 text-rose-500 rounded-xl group-hover:scale-110 transition-transform">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Total Tempo</p>
              <p className="text-[26px] font-bold text-gray-800 leading-none">Rp {Math.round(stats.paymentStatus.tempo).toLocaleString('id-ID')}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-md">CREDIT</span>
          </div>
        </div>
      </div>

      {/* Approval Shortcut */}
      {profile?.role === 'admin' && (
        <motion.div 
          whileHover={{ y: -2 }}
          onClick={() => navigate('/approvals')}
          className="bg-indigo-600 p-6 rounded-md shadow-lg shadow-indigo-100 flex items-center justify-between cursor-pointer group overflow-hidden relative"
        >
          <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <CheckCircle2 className="w-48 h-48 text-white" />
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-md flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Pusat Persetujuan</h3>
              <p className="text-indigo-100">Cek pengajuan Sales, Finance, dan Purchase yang butuh tindakan Anda.</p>
            </div>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-md text-white font-bold text-sm backdrop-blur-md group-hover:bg-white/30 transition-colors relative z-10">
            Buka Modul
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales vs Expenses */}
        <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Sales vs Expenses</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 13}} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 13}} />
                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                <Bar dataKey="sales" fill="#7367f0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="expenses" fill="#FF9F43" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Metode Pembayaran</h3>
          <div className="h-80 relative flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={stats.paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.paymentMethodData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#7367f0', '#00CFE8', '#FF9F43', '#EA5455'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-4">
              {stats.paymentMethodData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#7367f0', '#00CFE8', '#FF9F43', '#EA5455'][index % 4] }} />
                  <span className="text-[13px] font-medium text-gray-600">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Popular Products</h3>
            <button className="p-1.5 text-gray-400 hover:text-[#7367f0] hover:bg-[#7367f0]/10 rounded-lg transition-colors">
              <Tag className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            {stats.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-10 h-10 ${i === 0 ? 'bg-[#7367f0]/10 text-[#7367f0]' : i === 1 ? 'bg-[#00CFE8]/10 text-[#00CFE8]' : i === 2 ? 'bg-[#28C76F]/10 text-[#28C76F]' : 'bg-gray-100 text-gray-500'} rounded-lg flex items-center justify-center font-bold text-sm shadow-sm`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-[15px] text-gray-800 line-clamp-1">{p.name}</p>
                    <p className="text-[13px] text-gray-500">Item Name</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{p.qty}</p>
                  <p className="text-[12px] text-[#7367f0] font-medium">Sales</p>
                </div>
              </div>
            ))}
            {stats.topProducts.length === 0 && (
              <p className="text-center text-gray-500 py-8">Belum ada data penjualan.</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Recent Transactions</h3>
            <button className="p-1.5 text-gray-400 hover:text-[#7367f0] hover:bg-[#7367f0]/10 rounded-lg transition-colors">
              <TrendingUp className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-5">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-sm mr-4 ${t.type === 'sale' || t.type === 'transfer_in' || t.type === 'charity_reserve' ? 'bg-[#28C76F]/10 text-[#28C76F]' : 'bg-[#EA5455]/10 text-[#EA5455]'}`}>
                    {t.type === 'sale' || t.type === 'transfer_in' || t.type === 'charity_reserve' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-semibold text-gray-800 capitalize leading-tight">{t.type}</p>
                      {profile?.role === 'superadmin' && (
                        <span className="flex items-center text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                          <Building2 className="w-2 h-2 mr-1" />
                          {tenants.find(ten => ten.id === t.tenantId)?.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-gray-500 mt-0.5">
                      {t.date 
                        ? new Date(t.date?.seconds * 1000).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) 
                        : 'Just now...'}
                    </p>
                  </div>
                </div>
                <p className={`text-[15px] font-semibold ${t.type === 'sale' || t.type === 'transfer_in' || t.type === 'charity_reserve' ? 'text-[#28C76F]' : 'text-[#EA5455]'}`}>
                  {t.type === 'sale' || t.type === 'transfer_in' || t.type === 'charity_reserve' ? '+' : '-'}Rp {Math.round(t.amount || 0).toLocaleString('id-ID')}
                </p>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transactions yet.</p>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Booking Calendar & List */}
      {isBookingTenant && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className="xl:col-span-2 bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-gray-900">Jadwal Booking Terkonfirmasi</h3>
              </div>
              <div className="flex items-center gap-4 bg-gray-50 p-1.5 rounded-full border border-gray-100">
                <button onClick={prevMonth} className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                <span className="font-bold text-gray-900 min-w-[150px] text-center text-sm">{format(currentMonth, 'MMMM yyyy', { locale: idLocale })}</span>
                <button onClick={nextMonth} className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                <div key={day} className="bg-gray-50 p-2 sm:p-3 text-center text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white p-2 min-h-[80px] sm:min-h-[120px]" />
              ))}
              {monthDays.map(day => {
                const formattedDay = format(day, 'yyyy-MM-dd');
                const dayBookings = confirmedBookings.filter(b => b.bookingDate === formattedDay);
                const isToday = isSameDay(day, new Date());

                return (
                  <div key={day.toString()} className={`bg-white p-1.5 sm:p-2 min-h-[80px] sm:min-h-[120px] transition hover:bg-gray-50 ${isToday ? 'ring-2 ring-indigo-600 ring-inset relative z-10' : ''}`}>
                    <div className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full mb-1 sm:mb-2 ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1.5 max-h-[60px] sm:max-h-[80px] overflow-y-auto no-scrollbar">
                      {dayBookings.map((b, i) => {
                         const time = b.bookingTime || '';
                         const serviceName = b.serviceName || (b.items && b.items.length > 0 ? b.items[0].name : (b.notes || 'Booking'));
                         return (
                          <div key={`${b.id}-${i}`} className="text-[9px] sm:text-[10px] px-1.5 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 font-semibold truncate leading-tight" title={`${time} - ${serviceName}`}>
                            {time} <span className="opacity-75">{serviceName}</span>
                          </div>
                         );
                      })}
                    </div>
                  </div>
                );
              })}
              {Array.from({ length: (7 - ((startDay + monthDays.length) % 7)) % 7 }).map((_, i) => (
                <div key={`empty-end-${i}`} className="bg-white p-2 min-h-[80px] sm:min-h-[120px]" />
              ))}
            </div>
            
            {confirmedBookings.length === 0 && (
              <div className="text-center mt-8 mb-4">
                <CalendarIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">Belum ada jadwal booking yang dikonfirmasi bulan ini.</p>
              </div>
            )}
          </div>

          {/* List Jadwal */}
          <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 flex flex-col">
            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
              List Jadwal Mendatang
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[600px] no-scrollbar">
              {confirmedBookings
                .filter(b => {
                   if (!b.bookingDate) return false;
                   const bDate = new Date(`${b.bookingDate}T${b.bookingTime || '00:00'}`);
                   return bDate >= new Date(new Date().setHours(0,0,0,0));
                })
                .sort((a, b) => {
                   const dateA = new Date(`${a.bookingDate}T${a.bookingTime || '00:00'}`);
                   const dateB = new Date(`${b.bookingDate}T${b.bookingTime || '00:00'}`);
                   return dateA.getTime() - dateB.getTime();
                })
                .slice(0, 15)
                .map((b, i) => {
                  const dateDate = new Date(b.bookingDate);
                  const isToday = isSameDay(dateDate, new Date());
                  const isTmrw = isSameDay(dateDate, new Date(new Date().setDate(new Date().getDate() + 1)));

                  let dayLabel = format(dateDate, 'dd MMM yyyy', { locale: idLocale });
                  if (isToday) dayLabel = 'Hari Ini';
                  else if (isTmrw) dayLabel = 'Besok';

                  const serviceName = b.serviceName || (b.items && b.items.length > 0 ? b.items[0].name : (b.notes || 'Booking'));
                  const customerName = b.customerName || (b.customerInfo as any)?.name || 'Pelanggan';
                  const time = b.bookingTime || '';

                  return (
                    <div key={b.id || i} className="p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow bg-gray-50/50">
                      <div className="bg-white py-2 px-3 rounded-lg border border-gray-200 text-center min-w-[65px] flex-shrink-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{format(dateDate, 'MMM', { locale: idLocale })}</span>
                        <span className="block text-lg font-black text-indigo-600 leading-none my-0.5">{format(dateDate, 'dd')}</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-900 text-sm truncate pr-2">{serviceName}</h4>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded flex-shrink-0">{time}</span>
                        </div>
                        <p className="text-xs text-gray-600 truncate flex items-center gap-1.5 font-medium mt-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          {customerName}
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium mt-1">
                          {dayLabel}
                        </p>
                      </div>
                    </div>
                  );
              })}

              {confirmedBookings.filter(b => b.bookingDate && new Date(`${b.bookingDate}T${b.bookingTime || '00:00'}`) >= new Date(new Date().setHours(0,0,0,0))).length === 0 && (
                <div className="text-center py-10">
                  <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Tidak ada jadwal mendatang.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
