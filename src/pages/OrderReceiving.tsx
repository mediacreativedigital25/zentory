import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface Order {
  id: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  items: any[];
  total: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled';
  type: 'Manual' | 'Catalog';
  createdAt: string;
}

export const OrderReceiving: React.FC = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    if (!profile?.tenantId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'orders'), 
        where('tenantId', '==', profile.tenantId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.orderId || o.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Order Receiving</h1>
        <p className="text-gray-500 text-sm">Kumpulan data pesanan dari katalog dan input manual.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Cari ID Pesanan / Pelanggan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all">
              <Filter size={18} />
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">ID Pesanan</th>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Tipe</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin inline-block text-indigo-600" size={32} />
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderId || `#${order.id.slice(0, 8)}`}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.customerName}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      order.type === 'Manual' ? "bg-purple-50 text-purple-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                      {order.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">Rp {order.total.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit",
                      order.status === 'Completed' ? "bg-green-50 text-green-600" :
                      order.status === 'Processing' ? "bg-blue-50 text-blue-600" :
                      order.status === 'Cancelled' ? "bg-red-50 text-red-600" :
                      "bg-yellow-50 text-yellow-600"
                    )}>
                      {order.status === 'Completed' && <CheckCircle2 size={14} />}
                      {order.status === 'Processing' && <Clock size={14} />}
                      {order.status === 'Cancelled' && <XCircle size={14} />}
                      {order.status === 'Pending' && <Clock size={14} />}
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {format(new Date(order.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Detail Pesanan {selectedOrder.orderId || `#${selectedOrder.id.slice(0, 8)}`}</h3>
                <p className="text-sm text-gray-500">Dibuat pada {format(new Date(selectedOrder.createdAt), 'dd MMM yyyy HH:mm')}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Informasi Pelanggan</h4>
                  <p className="text-sm font-bold text-gray-900">{selectedOrder.customerName}</p>
                  <p className="text-sm text-gray-500">ID: {selectedOrder.customerId}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Metode Pemesanan</h4>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">{selectedOrder.type}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Item Pesanan</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.quantity} x Rp {item.price.toLocaleString()}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">Rp {(item.quantity * item.price).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-gray-500 font-bold">Total Pembayaran</span>
                  <span className="text-xl font-bold text-indigo-600">Rp {selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {['Pending', 'Processing', 'Completed', 'Cancelled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedOrder.id, status)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                        selectedOrder.status === status 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
