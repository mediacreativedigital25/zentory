import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Product, Order } from '../../types';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Package, 
  Search, 
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface ProductMovement extends Product {
  totalSold: number;
  lastSoldDate: Date | null;
  movementStatus: 'fast' | 'slow' | 'dead';
}

export default function InventoryReport() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'fast' | 'slow' | 'dead'>('all');
  const [daysFilter, setDaysFilter] = useState(30);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const productsQuery = query(
      collection(db, 'products'),
      where('tenantId', '==', profile.tenantId)
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    // Fetch orders for movement analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - daysFilter);
    
    const ordersQuery = query(
      collection(db, 'orders'),
      where('tenantId', '==', profile.tenantId),
      where('date', '>=', Timestamp.fromDate(thirtyDaysAgo))
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
    };
  }, [profile, daysFilter]);

  const movementData = useMemo(() => {
    const productSales: Record<string, { total: number; lastDate: Date | null }> = {};

    orders.forEach(order => {
      const orderDate = order.date?.toDate() || new Date();
      order.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { total: 0, lastDate: null };
        }
        productSales[item.productId].total += item.quantity;
        if (!productSales[item.productId].lastDate || orderDate > productSales[item.productId].lastDate!) {
          productSales[item.productId].lastDate = orderDate;
        }
      });
    });

    return products.map(product => {
      const sales = productSales[product.id] || { total: 0, lastDate: null };
      let status: 'fast' | 'slow' | 'dead' = 'dead';
      
      if (sales.total > 10) status = 'fast';
      else if (sales.total > 0) status = 'slow';
      else status = 'dead';

      return {
        ...product,
        totalSold: sales.total,
        lastSoldDate: sales.lastDate,
        movementStatus: status
      } as ProductMovement;
    });
  }, [products, orders]);

  const filteredData = useMemo(() => {
    return movementData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                           item.sku.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.movementStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [movementData, search, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, rowsPerPage]);

  const stats = useMemo(() => {
    const fast = movementData.filter(i => i.movementStatus === 'fast').length;
    const slow = movementData.filter(i => i.movementStatus === 'slow').length;
    const dead = movementData.filter(i => i.movementStatus === 'dead').length;
    const totalStockValue = products.reduce((acc, p) => acc + (p.stock * p.hpp), 0);
    
    return { fast, slow, dead, totalStockValue };
  }, [movementData, products]);

  const chartData = [
    { name: 'Fast Moving', value: stats.fast, color: '#10B981' },
    { name: 'Slow Moving', value: stats.slow, color: '#F59E0B' },
    { name: 'Dead Stock', value: stats.dead, color: '#EF4444' },
  ];

  const topSoldData = [...movementData]
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 5)
    .map(p => ({ name: p.name, sales: p.totalSold }));

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Menganalisis pergerakan stok...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Inventory Report</h2>
          <p className="text-gray-500 font-medium">Analisis pergerakan produk dan efisiensi stok.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-lg border border-gray-100 shadow-sm">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest ml-3">Periode:</span>
          {[7, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setDaysFilter(d)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                daysFilter === d 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {d} HARI
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase">Fast Moving</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{stats.fast}</p>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Produk Laris</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase">Slow Moving</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{stats.slow}</p>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Pergerakan Lambat</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-2xl text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase">Dead Stock</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{stats.dead}</p>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Stok Mengendap</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100">
          <div className="flex items-center justify-between mb-4 text-white/80">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Total Value</span>
          </div>
          <p className="text-2xl font-black text-white">Rp {stats.totalStockValue.toLocaleString()}</p>
          <p className="text-xs font-bold text-white/60 mt-1 uppercase tracking-wider">Nilai Aset Stok</p>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-gray-900 uppercase tracking-wider">Komposisi Pergerakan Stok</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-gray-900 uppercase tracking-wider">Top 5 Produk Terlaris</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSoldData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }} />
                <Tooltip 
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="sales" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-gray-900 uppercase tracking-wider">Detail Pergerakan Produk</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari SKU atau Nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="p-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Status</option>
              <option value="fast">Fast Moving</option>
              <option value="slow">Slow Moving</option>
              <option value="dead">Dead Stock</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stok Saat Ini</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Terjual</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Penjualan Terakhir</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group items-center">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{item.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{item.sku}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className={`text-sm font-black ${item.stock <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.stock}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-indigo-600">{item.totalSold}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-gray-500">
                      {item.lastSoldDate ? item.lastSoldDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        item.movementStatus === 'fast' ? 'bg-emerald-100 text-emerald-700' :
                        item.movementStatus === 'slow' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.movementStatus === 'fast' ? 'Fast' : item.movementStatus === 'slow' ? 'Slow' : 'Dead'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link 
                      to={`/inventory/products?tab=history&search=${item.sku || item.name}`}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                    >
                      <History className="w-4 h-4" />
                      Riwayat
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredData.length > 0 && (
          <div className="p-6 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <p className="text-xs text-gray-500 font-bold">
                Menampilkan <span className="text-gray-900">{Math.min(filteredData.length, (currentPage - 1) * rowsPerPage + 1)}</span> - <span className="text-gray-900">{Math.min(filteredData.length, currentPage * rowsPerPage)}</span> dari <span className="text-gray-900">{filteredData.length}</span> produk
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-100">
                <span className="font-black uppercase tracking-widest">Baris:</span>
                <select 
                  value={rowsPerPage} 
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="bg-transparent font-black text-indigo-600 outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-white disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                          currentPage === page 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                            : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if ((page === currentPage - 2 && page > 1) || (page === currentPage + 2 && page < totalPages)) {
                    return <span key={page} className="text-gray-400">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-white disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {filteredData.length === 0 && (
          <div className="p-20 text-center">
            <Package className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Tidak ada data produk yang ditemukan.</p>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-600 rounded-xl text-white">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-black text-indigo-900 tracking-tight">Rekomendasi Strategi</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm font-black text-emerald-700 uppercase tracking-wider">Fast Moving</p>
            <p className="text-sm text-indigo-800/80 leading-relaxed">
              Pastikan stok selalu tersedia. Pertimbangkan untuk membeli dalam jumlah besar untuk mendapatkan diskon supplier.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-black text-amber-700 uppercase tracking-wider">Slow Moving</p>
            <p className="text-sm text-indigo-800/80 leading-relaxed">
              Lakukan promosi atau bundling dengan produk fast moving untuk mempercepat perputaran stok.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-black text-red-700 uppercase tracking-wider">Dead Stock</p>
            <p className="text-sm text-indigo-800/80 leading-relaxed">
              Pertimbangkan untuk melakukan cuci gudang atau diskon besar untuk membebaskan modal yang tertahan di stok ini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
