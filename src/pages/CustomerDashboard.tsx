import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Package, 
  CheckCircle, 
  XCircle, 
  Search,
  ArrowLeft,
  User,
  Save,
  LogOut
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Order } from '../types';

type Tab = 'history' | 'address' | 'status';

export default function CustomerDashboard() {
  const { tenantSlug } = useParams();
  const { user, profile, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [orders, setOrders] = useState<Order[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState(profile?.address || '');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (profile?.address) {
      setAddress(profile.address);
    }
  }, [profile]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user || !tenantSlug) return;

      try {
        // Find tenant first to get ID
        const tenantQuery = query(collection(db, 'tenants'), where('slug', '==', tenantSlug));
        const tenantSnap = await getDocs(tenantQuery);
        
        if (tenantSnap.empty) {
          setLoading(false);
          return;
        }

        const tenantData = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() };
        setTenant(tenantData);
        const tenantId = tenantData.id;

        // Fetch orders for this tenant and user
        const q = query(
          collection(db, 'orders'),
          where('tenantId', '==', tenantId),
          where('userId', '==', user.uid)
        );
        
        const snap = await getDocs(q);
        const ordersData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        
        // Sort in memory because composite index might not exist yet
        ordersData.sort((a, b) => {
          const dateA = a.date?.seconds || 0;
          const dateB = b.date?.seconds || 0;
          return dateB - dateA;
        });

        setOrders(ordersData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchOrders();
    }
  }, [user, authLoading, tenantSlug]);

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSavingAddress(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        address: address
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating address:', error);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-100';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'RECEIVED';
      case 'processing': return 'Processing';
      case 'pending': return 'PENDING';
      case 'cancelled': return 'CANCELLED';
      default: return status.toUpperCase();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => navigate(`/catalog/${tenantSlug}`)}
              className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors flex items-center text-gray-600 mr-2"
              title="Kembali ke Katalog"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {tenant && (
              <div className="flex items-center">
                {tenant.settings?.logoUrl ? (
                  <img src={tenant.settings.logoUrl} alt={tenant.name} className="h-8 w-auto mr-2" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm mr-2">
                    {tenant.name.charAt(0)}
                  </div>
                )}
                <span className="font-black text-gray-900 hidden sm:block">{tenant.name}</span>
              </div>
            )}
          </div>
          
          <h1 className="text-lg font-black text-gray-900 absolute left-1/2 -translate-x-1/2 hidden md:block">Dashboard Saya</h1>
          
          <button 
            onClick={() => logout()}
            className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold text-sm transition-all"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Info (Inline) */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-900">Halo, {profile?.displayName || 'Pelanggan'}!</h2>
          <p className="text-gray-500">Kelola pesanan dan alamat pengiriman Anda di sini.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'history' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Riwayat Pembelian
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'status' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            <Clock className="w-4 h-4 mr-2" />
            Status Orderan
          </button>
          <button
            onClick={() => setActiveTab('address')}
            className={`flex items-center px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'address' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Alamat
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {orders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
                  <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Belum ada riwayat pembelian.</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:border-indigo-100 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-bold text-indigo-600 mb-1">{order.orderNumber}</p>
                        <p className="text-sm text-gray-500">
                          {order.date || (order as any).createdAt ? new Date((order.date?.seconds || (order as any).createdAt?.seconds || 0) * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Baru saja'}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                          <span className="font-bold text-gray-900">Rp.{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total Pembayaran</span>
                      <span className="text-lg font-black text-indigo-600">Rp.{(order.totalAmount || (order as any).total || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'status' && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
                  <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Tidak ada pesanan aktif saat ini.</p>
                </div>
              ) : (
                orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').map((order) => (
                  <div key={order.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        order.status === 'processing' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {order.status === 'processing' ? <Package className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900">Pesanan Sedang {order.status === 'processing' ? 'Diproses' : 'Menunggu'}</h3>
                        <p className="text-xs text-gray-500">ID: {order.orderNumber}</p>
                      </div>
                    </div>

                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-8">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: order.status === 'processing' ? '66%' : '33%' }}
                        className="absolute top-0 left-0 h-full bg-indigo-600"
                      />
                    </div>

                    <div className="grid grid-cols-3 text-center text-[10px] font-bold uppercase tracking-wider">
                      <div className={order.status === 'pending' || order.status === 'processing' ? 'text-indigo-600' : 'text-gray-400'}>Diterima</div>
                      <div className={order.status === 'processing' ? 'text-indigo-600' : 'text-gray-400'}>Diproses</div>
                      <div className="text-gray-400">Selesai</div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'address' && (
            <motion.div
              key="address"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900">Alamat Pengiriman</h3>
                </div>

                <form onSubmit={handleUpdateAddress} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Alamat Lengkap</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Masukkan alamat lengkap Anda..."
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900 font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    {isSavingAddress ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        Simpan Alamat
                      </>
                    )}
                  </button>

                  {saveSuccess && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-sm font-bold text-green-600"
                    >
                      Alamat berhasil diperbarui!
                    </motion.p>
                  )}
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
