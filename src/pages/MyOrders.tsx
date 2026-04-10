import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface Order {
  id: string;
  orderId?: string;
  items: any[];
  total: number;
  status: string;
  createdAt: string;
}

export const MyOrders: React.FC = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!profile) return;
      try {
        const q = query(
          collection(db, 'orders'), 
          where('customerId', '==', profile.uid),
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
    fetchOrders();
  }, [profile]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pesanan Saya</h1>
        <p className="text-gray-500 text-sm">Pantau status pesanan yang telah Anda buat.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{order.orderId || `Order #${order.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-gray-500">{format(new Date(order.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500 font-medium">Total</p>
                    <p className="text-lg font-bold text-gray-900">Rp {order.total.toLocaleString()}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5",
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
                </div>
              </div>

              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-2 border-t border-gray-50 first:border-0">
                    <span className="text-gray-600">{item.productName} <span className="text-gray-400 ml-1">x{item.quantity}</span></span>
                    <span className="font-semibold text-gray-900">Rp {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 flex sm:hidden justify-between items-center">
                <span className="text-gray-500 text-sm font-medium">Total</span>
                <span className="text-lg font-bold text-gray-900">Rp {order.total.toLocaleString()}</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Anda belum memiliki pesanan.</p>
              <button className="mt-4 text-indigo-600 font-bold hover:underline">Mulai Belanja</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
