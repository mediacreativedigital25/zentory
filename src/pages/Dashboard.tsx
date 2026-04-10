import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  TrendingUp, 
  Users, 
  Package, 
  ShoppingCart, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Calendar,
  Wallet,
  Plus,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-3 rounded-xl", color)}>
        {icon}
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          trend.positive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        )}>
          {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend.value}
        </div>
      )}
    </div>
    <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
  </div>
);

export const Dashboard: React.FC = () => {
  const { profile, isStaff, currentTenant } = useAuth();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalBookings: 0,
    totalBalance: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isRetail = currentTenant?.businessType === 'Retail' || currentTenant?.businessType === 'Mixed';
  const isService = currentTenant?.businessType === 'Service' || currentTenant?.businessType === 'Mixed';

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentTenant?.id) return;
      try {
        const queries = [
          getDocs(query(collection(db, 'orders'), where('tenantId', '==', currentTenant.id))),
          getDocs(query(collection(db, 'products'), where('tenantId', '==', currentTenant.id))),
          getDocs(query(collection(db, 'bookings'), where('tenantId', '==', currentTenant.id))),
          getDocs(query(collection(db, 'transactions'), where('tenantId', '==', currentTenant.id))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'Customer'), where('tenantId', '==', currentTenant.id)))
        ];
        
        const [ordersSnap, productsSnap, bookingsSnap, transactionsSnap, customersSnap] = await Promise.all(queries);
        
        const orders = ordersSnap.docs.map(doc => doc.data());
        const totalSales = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);

        const transactions = transactionsSnap.docs.map(doc => doc.data());
        const income = transactions.filter(t => t.type === 'Income').reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const expense = transactions.filter(t => t.type === 'Expense').reduce((acc, curr) => acc + (curr.amount || 0), 0);
        
        setStats({
          totalSales,
          totalOrders: ordersSnap.size,
          totalProducts: productsSnap.size,
          totalCustomers: customersSnap.size,
          totalBookings: bookingsSnap.size,
          totalBalance: income - expense
        });

        const recentOrdersSnap = await getDocs(query(
          collection(db, 'orders'), 
          where('tenantId', '==', currentTenant.id),
          orderBy('createdAt', 'desc'), 
          limit(5)
        ));
        setRecentOrders(recentOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isStaff && currentTenant) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [isStaff, currentTenant]);

  if (!isStaff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-8 shadow-xl shadow-indigo-100/50">
          <ShoppingCart size={48} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Selamat Datang, {profile?.name}!</h1>
        <p className="text-gray-500 max-w-md text-lg">
          Jelajahi katalog {currentTenant?.name || 'toko'} kami dan temukan produk atau layanan terbaik untuk Anda.
        </p>
        <Link 
          to="/catalog"
          className="mt-10 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2"
        >
          Mulai Belanja
          <ArrowRight size={20} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 mt-1">Selamat datang kembali, {profile?.name}. Berikut ringkasan bisnis Anda.</p>
        </div>
        <div className="flex items-center gap-3">
          {isRetail && (
            <Link to="/sales-order" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm">
              <Plus size={18} />
              <span>POS Baru</span>
            </Link>
          )}
          {isService && (
            <Link to="/booking" className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition-all shadow-sm">
              <Calendar size={18} />
              <span>Booking Baru</span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Total Penjualan" 
          value={`Rp ${stats.totalSales.toLocaleString()}`} 
          icon={<TrendingUp size={24} />} 
          trend={{ value: '12%', positive: true }}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard 
          title="Saldo Kas" 
          value={`Rp ${stats.totalBalance.toLocaleString()}`} 
          icon={<Wallet size={24} />} 
          color="bg-emerald-50 text-emerald-600"
        />
        {isRetail && (
          <StatCard 
            title="Total Pesanan" 
            value={stats.totalOrders} 
            icon={<ShoppingCart size={24} />} 
            trend={{ value: '8%', positive: true }}
            color="bg-blue-50 text-blue-600"
          />
        )}
        {isService && (
          <StatCard 
            title="Total Booking" 
            value={stats.totalBookings} 
            icon={<Calendar size={24} />} 
            trend={{ value: '15%', positive: true }}
            color="bg-purple-50 text-purple-600"
          />
        )}
        <StatCard 
          title="Total Produk" 
          value={stats.totalProducts} 
          icon={<Package size={24} />} 
          color="bg-orange-50 text-orange-600"
        />
        <StatCard 
          title="Total Pelanggan" 
          value={stats.totalCustomers} 
          icon={<Users size={24} />} 
          trend={{ value: '5%', positive: true }}
          color="bg-sky-50 text-sky-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Pesanan Terbaru</h3>
            <Link to="/order-receiving" className="text-indigo-600 text-sm font-semibold hover:underline flex items-center gap-1">
              Lihat Semua
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">ID Pesanan</th>
                  <th className="px-6 py-4">Pelanggan</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber || `#${order.id.slice(0, 8)}`}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.customerName}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">Rp {order.total.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold",
                        order.status === 'Completed' ? "bg-green-50 text-green-600" :
                        order.status === 'Processing' ? "bg-blue-50 text-blue-600" :
                        order.status === 'Cancelled' ? "bg-red-50 text-red-600" :
                        "bg-amber-50 text-amber-600"
                      )}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '-'}
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                      Belum ada pesanan terbaru.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6">Aktivitas Terakhir</h3>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-900 font-medium leading-tight">Stok produk "Sepatu Nike" menipis</p>
                    <p className="text-xs text-gray-500 mt-1">2 jam yang lalu</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
            <h3 className="font-bold text-lg mb-2">Butuh Bantuan?</h3>
            <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
              Tim support kami siap membantu Anda mengelola bisnis dengan Zentory.
            </p>
            <button className="w-full bg-white text-indigo-600 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">
              Hubungi Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
