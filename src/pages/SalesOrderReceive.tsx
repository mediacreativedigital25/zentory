import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Order, ApprovalRequest } from '../types';
import { Search, Filter, Calendar, ShoppingBag, Tag, Briefcase, Globe, Eye, X, CheckCircle, Clock, Package, MoreVertical, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';

export default function SalesOrderReceive() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'manual' | 'catalog' | 'service'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestTargetStatus, setRequestTargetStatus] = useState<'pending' | 'processing' | 'completed'>('pending');
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!profile) return;

    const q = profile.role === 'superadmin'
      ? query(collection(db, 'orders'), orderBy('date', 'desc'))
      : query(
          collection(db, 'orders'),
          where('tenantId', '==', profile.tenantId),
          orderBy('date', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredOrders = orders.filter(o => filter === 'all' || o.type === filter);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'manual': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'catalog': return 'bg-green-50 text-green-700 border-green-100';
      case 'service': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'manual': return <Tag className="w-3 h-3 mr-1" />;
      case 'catalog': return <Globe className="w-3 h-3 mr-1" />;
      case 'service': return <Briefcase className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Konfirmasi Status',
      message: `Apakah Anda yakin ingin mengubah status pesanan menjadi ${newStatus.toUpperCase()}?`,
      onConfirm: async () => {
        setConfirmConfig(null);
        setIsUpdating(true);
        try {
          await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
          if (selectedOrder?.id === orderId) {
            setSelectedOrder({ ...selectedOrder, status: newStatus as any });
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  const handleRequestChange = async () => {
    if (!selectedOrder || !profile) return;

    setIsUpdating(true);
    try {
      await addDoc(collection(db, 'approval_requests'), {
        tenantId: profile.tenantId,
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        requestedBy: profile.uid,
        requestedAt: serverTimestamp(),
        targetStatus: requestTargetStatus,
        status: 'pending'
      });
      alert('Permintaan perubahan status telah dikirim ke Super Admin.');
      setIsRequestModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim permintaan.');
    } finally {
      setIsUpdating(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sales Order Receive</h2>
        <p className="text-gray-500">View and manage all incoming orders from various channels.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {(['all', 'manual', 'catalog', 'service'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${filter === t ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Order ID..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Order ID</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-indigo-600">{order.orderNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {order.date ? new Date(order.date?.seconds * 1000).toLocaleDateString() : 'Just now...'}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                    <p className="text-xs text-gray-500">{order.items.length} items</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeColor(order.type)}`}>
                      {getTypeIcon(order.type)}
                      {order.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">Rp.{(order.totalAmount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center ml-auto"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      <span className="text-xs font-bold">Detail</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredOrders.length === 0 && !loading && (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">No orders found.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Order Detail</h3>
                  <p className="text-indigo-100 text-sm font-mono">{selectedOrder.orderNumber}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Status & Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Customer</p>
                    <p className="text-lg font-bold text-gray-900">{selectedOrder.customerName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Order Date</p>
                    <p className="text-gray-900">
                      {selectedOrder.date ? new Date(selectedOrder.date.seconds * 1000).toLocaleString() : 'Just now...'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Order Type</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeColor(selectedOrder.type)}`}>
                      {getTypeIcon(selectedOrder.type)}
                      {selectedOrder.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Current Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-indigo-600" />
                    Order Items
                  </h4>
                  <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-gray-500 uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-bold">Item Name</th>
                          <th className="px-4 py-3 font-bold text-center">Qty</th>
                          <th className="px-4 py-3 font-bold text-right">Price</th>
                          <th className="px-4 py-3 font-bold text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">Rp.{item.price.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-bold">Rp.{(item.price * item.quantity).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-white border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-right font-bold text-gray-500">Total Amount</td>
                          <td className="px-4 py-4 text-right font-extrabold text-indigo-600 text-lg">
                            Rp.{selectedOrder.totalAmount.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-indigo-600" />
                    Update Status
                  </h4>
                  
                  {selectedOrder.status === 'cancelled' ? (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-3">
                      <p className="text-xs text-red-700 font-medium">
                        Pesanan ini telah dibatalkan dan tidak dapat diubah secara langsung. 
                        Silakan hubungi Super Admin atau kirim permintaan aktivasi kembali.
                      </p>
                      <button
                        onClick={() => setIsRequestModalOpen(true)}
                        className="w-full py-3 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-all flex items-center justify-center shadow-lg shadow-red-100"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Request Perubahan Status
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <button
                        disabled={isUpdating || selectedOrder.status === 'pending'}
                        onClick={() => updateStatus(selectedOrder.id, 'pending')}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border border-yellow-100 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-all disabled:opacity-50"
                      >
                        <Clock className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">PENDING</span>
                      </button>
                      <button
                        disabled={isUpdating || selectedOrder.status === 'processing'}
                        onClick={() => updateStatus(selectedOrder.id, 'processing')}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50"
                      >
                        <Package className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">PROCESS</span>
                      </button>
                      <button
                        disabled={isUpdating || selectedOrder.status === 'completed'}
                        onClick={() => updateStatus(selectedOrder.id, 'completed')}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border border-green-100 bg-green-50 text-green-700 hover:bg-green-100 transition-all disabled:opacity-50"
                      >
                        <CheckCircle className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">COMPLETE</span>
                      </button>
                      <button
                        disabled={isUpdating || selectedOrder.status === 'cancelled'}
                        onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border border-red-100 bg-red-50 text-red-700 hover:bg-red-100 transition-all disabled:opacity-50"
                      >
                        <X className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">CANCEL</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  Close Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRequestModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold">Request Ubah Transaksi</h3>
                <p className="text-sm text-gray-500">Kirim permintaan ke Super Admin untuk mengubah transaksi yang dibatalkan.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-700">
                  Apakah anda yakin untuk mengubah transaksi cancel ini?
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Mau di ubah menjadi apa transaksi ini?</label>
                  <select
                    value={requestTargetStatus}
                    onChange={(e) => setRequestTargetStatus(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pending">PENDING</option>
                    <option value="processing">PROCESS</option>
                    <option value="completed">COMPLETE</option>
                  </select>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setIsRequestModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 font-bold hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRequestChange}
                    disabled={isUpdating}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isUpdating ? 'Mengirim...' : 'Kirim Request'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
