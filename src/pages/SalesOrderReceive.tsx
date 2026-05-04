import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, getDoc, Timestamp, limit, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Order, ApprovalRequest, Tenant, BankAccount } from '../types';
import { Search, Filter, Calendar, ShoppingBag, Tag, Briefcase, Globe, Eye, X, CheckCircle, Clock, Package, MoreVertical, Send, AlertCircle, Printer, FileText, Landmark, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../lib/firebase';
import ConfirmModal from '../components/ConfirmModal';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, profile?: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: profile?.tenantId || (auth.currentUser as any)?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function SalesOrderReceive() {
  const { profile, domainTenantId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'manual' | 'catalog' | 'service' | 'pos'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestTargetStatus, setRequestTargetStatus] = useState<'pending' | 'processing' | 'completed'>('pending');
  const [requestReason, setRequestReason] = useState('');
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [printType, setPrintType] = useState<'invoice' | 'receipt' | null>(null);
  const [isSettledToday, setIsSettledToday] = useState(false);
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintType(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (targetTenantId) {
      getDoc(doc(db, 'tenants', targetTenantId)).then(snap => {
        if (snap.exists()) {
          setTenantInfo({ id: snap.id, ...snap.data() } as Tenant);
        }
      });
    }
    if (profile?.role === 'superadmin') {
      getDocs(collection(db, 'tenants')).then(snap => {
        setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      });
    }
  }, [profile, domainTenantId]);

  useEffect(() => {
    if (!profile) return;
    const targetTenantId = domainTenantId || profile.tenantId;

    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? query(collection(db, 'orders'))
      : query(
          collection(db, 'orders'),
          where('tenantId', '==', targetTenantId)
        );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      data.sort((a, b) => {
        const dateA = a.date?.seconds || (a as any).createdAt?.seconds || 0;
        const dateB = b.date?.seconds || (b as any).createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setOrders(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    if (targetTenantId) {
      // Check if today is settled
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const settledQ = query(
        collection(db, 'dailyClosings'),
        where('tenantId', '==', targetTenantId),
        where('date', '>=', Timestamp.fromDate(startOfDay)),
        where('date', '<=', Timestamp.fromDate(endOfDay)),
        limit(1)
      );

      const unsubscribeSettled = onSnapshot(settledQ, (snap) => {
        setIsSettledToday(!snap.empty);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'dailyClosings', profile);
      });

      // Fetch bank accounts for mapping
      const bQuery = query(collection(db, 'bank_accounts'), where('tenantId', '==', targetTenantId));
      const unsubBanks = onSnapshot(bQuery, (snap) => {
        setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
      }, (error) => {
        console.error('Error fetching bank accounts:', error);
      });

      return () => {
        unsubscribe();
        unsubscribeSettled();
        unsubBanks();
      };
    }

    return () => {
      unsubscribe();
    };
  }, [profile, domainTenantId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, rowsPerPage]);

  const filteredOrders = orders.filter(o => {
    let matchesFilter = false;
    if (filter === 'all') matchesFilter = true;
    else if (filter === 'pending') {
      const oDate = o.date?.seconds || (o as any).createdAt?.seconds || 0;
      const tDate = new Date(oDate * 1000);
      const isToday = tDate.toDateString() === new Date().toDateString();
      matchesFilter = o.status === 'pending' && isToday;
    }
    else matchesFilter = o.type === filter;

    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (o.customerCode && o.customerCode.toLowerCase().includes(search.toLowerCase())) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'manual': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'pos': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'catalog': return 'bg-green-50 text-green-700 border-green-100';
      case 'service': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'manual': return <Tag className="w-3 h-3 mr-1" />;
      case 'pos': return <ShoppingBag className="w-3 h-3 mr-1" />;
      case 'catalog': return <Globe className="w-3 h-3 mr-1" />;
      case 'service': return <Briefcase className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    // Check if the order date is settled
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (order && (order.date || (order as any).createdAt)) {
      const orderDate = new Date(((order.date?.seconds || (order as any).createdAt?.seconds || 0)) * 1000);
      const start = new Date(orderDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(orderDate);
      end.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'dailyClosings'),
        where('tenantId', '==', profile?.tenantId),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setConfirmConfig({
          isOpen: true,
          title: 'Settlement Terdeteksi',
          message: 'Pesanan ini berada pada hari yang sudah ditutup (Settled). Status tidak dapat diubah secara langsung. Silakan hubungi Super Admin jika diperlukan.',
          onConfirm: () => setConfirmConfig(null),
          showCancel: false
        });
        return;
      }
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Konfirmasi Status',
      message: `Apakah Anda yakin ingin mengubah status pesanan menjadi ${(newStatus || '').toUpperCase()}?`,
      onConfirm: async () => {
        setConfirmConfig(null);
        setIsUpdating(true);
        try {
          const oldStatus = order.status;
          
          // 1. Update Order Status
          await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
          
          // 2. Update corresponding transaction if it exists
          if (order.orderNumber) {
            const transQuery = profile?.role === 'superadmin'
              ? query(
                  collection(db, 'transactions'),
                  where('orderNumber', '==', order.orderNumber)
                )
              : query(
                  collection(db, 'transactions'),
                  where('tenantId', '==', profile?.tenantId),
                  where('orderNumber', '==', order.orderNumber)
                );
            try {
              const transSnap = await getDocs(transQuery);
              for (const tDoc of transSnap.docs) {
                // Map transaction status: processing -> pending, others stay same
                const transStatus = newStatus === 'processing' ? 'pending' : newStatus;
                await updateDoc(doc(db, 'transactions', tDoc.id), { status: transStatus });
              }
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, 'transactions', profile);
            }
          }

          // 3. Handle Stock Return/Deduction if status changes to/from cancelled
          if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
            // Return stock
            for (const item of order.items) {
              const productRef = doc(db, 'products', item.productId);
              await runTransaction(db, async (transaction) => {
                const pDoc = await transaction.get(productRef);
                if (!pDoc.exists()) return;
                const productData = pDoc.data();
                if (productData.type === 'service') return;
                
                const currentStock = productData.stock || 0;
                transaction.update(productRef, { stock: currentStock + item.quantity });
              });
            }
          } else if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
            // Deduct stock again
            for (const item of order.items) {
              const productRef = doc(db, 'products', item.productId);
              await runTransaction(db, async (transaction) => {
                const pDoc = await transaction.get(productRef);
                if (!pDoc.exists()) return;
                const productData = pDoc.data();
                if (productData.type === 'service') return;
                
                const currentStock = productData.stock || 0;
                const newStock = Math.max(0, currentStock - item.quantity);
                transaction.update(productRef, { stock: newStock });
              });
            }
          }

          if (selectedOrder?.id === orderId) {
            setSelectedOrder({ ...selectedOrder, status: newStatus as any });
          }
        } catch (err) {
          console.error(err);
          setConfirmConfig({
            isOpen: true,
            title: 'Error',
            message: 'Gagal memperbarui status pesanan. Silakan coba lagi.',
            onConfirm: () => setConfirmConfig(null),
            showCancel: false
          });
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  const handleRecordPayment = async () => {
    if (!selectedOrder || !profile || paymentAmount <= 0) return;
    
    if (!selectedBankAccountId) {
      setConfirmConfig({
        isOpen: true,
        title: 'Akun Belum Dipilih',
        message: 'Silakan pilih metode pembayaran / bank terlebih dahulu.',
        onConfirm: () => setConfirmConfig(null),
        showCancel: false
      });
      return;
    }

    setIsUpdating(true);
    try {
      const currentPaid = (selectedOrder as any).paidAmount || 0;
      const totalAmount = selectedOrder.totalAmount || (selectedOrder as any).total || 0;
      const newPaid = currentPaid + paymentAmount;
      const newPaymentStatus = newPaid >= totalAmount ? 'paid' : 'partial';
      const newStatus = newPaid >= totalAmount ? 'completed' : selectedOrder.status;

      await runTransaction(db, async (transaction) => {
        // 1. Update Order
        const orderRef = doc(db, 'orders', selectedOrder.id);
        transaction.update(orderRef, {
          paidAmount: newPaid,
          paymentStatus: newPaymentStatus,
          status: newStatus,
          updatedAt: serverTimestamp()
        });

        // 2. Create Transaction
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          tenantId: profile.tenantId,
          type: 'sale',
          category: 'Sales Payment',
          amount: paymentAmount,
          totalOrderAmount: totalAmount,
          date: serverTimestamp(),
          status: 'completed',
          userId: profile.uid,
          orderNumber: selectedOrder.orderNumber,
          bankAccountId: selectedBankAccountId || null,
          createdAt: serverTimestamp()
        });
      });

      setSelectedOrder({
        ...selectedOrder,
        paidAmount: newPaid,
        paymentStatus: newPaymentStatus,
        status: newStatus
      } as any);
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      
      setConfirmConfig({
        isOpen: true,
        title: 'Pembayaran Berhasil',
        message: `Pembayaran sebesar Rp.${paymentAmount.toLocaleString()} telah dicatat.`,
        onConfirm: () => setConfirmConfig(null),
        showCancel: false
      });
    } catch (err) {
      console.error(err);
      alert('Gagal mencatat pembayaran.');
    } finally {
      setIsUpdating(false);
    }
  };
  const handleRequestChange = async () => {
    if (!selectedOrder || !profile) return;

    setIsUpdating(true);
    try {
      await addDoc(collection(db, 'approval_requests'), {
        type: 'order_status',
        tenantId: profile.tenantId,
        tenantName: tenantInfo?.name || 'Unknown Tenant',
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        requestedBy: profile.uid,
        requestedAt: serverTimestamp(),
        targetStatus: requestTargetStatus,
        reason: requestReason,
        status: 'pending'
      });
      setConfirmConfig({
        isOpen: true,
        title: 'Permintaan Terkirim',
        message: 'Permintaan perubahan status telah dikirim ke Super Admin untuk ditinjau.',
        onConfirm: () => setConfirmConfig(null),
        showCancel: false
      });
      setIsRequestModalOpen(false);
      setRequestReason('');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'approval_requests', profile);
    } finally {
      setIsUpdating(false);
    }
  };
  const handlePrint = (type: 'invoice' | 'receipt', order?: Order) => {
    const targetOrder = order || selectedOrder;
    if (!targetOrder) return;

    setSelectedOrder(targetOrder);
    setPrintType(type);
    setIsPrintDropdownOpen(false);
    
    // Give time for the print section to render before printing
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Print failed:', err);
        setConfirmConfig({
          isOpen: true,
          title: 'Print Error',
          message: 'Gagal membuka jendela cetak. Pastikan browser Anda mengizinkan popup.',
          onConfirm: () => setConfirmConfig(null),
          showCancel: false
        });
        setPrintType(null);
      }
    }, 500);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sales Order Receive</h2>
        <p className="text-gray-500">View and manage all incoming orders from various channels.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 flex items-center gap-4 overflow-x-auto pb-2 sm:pb-0">
          <div className="flex gap-2">
            {(['all', 'pending', 'manual', 'pos', 'catalog', 'service'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${filter === t ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                {t === 'pending' ? 'PENDING HARI INI' : t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="h-8 w-px bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            <span className="font-bold uppercase tracking-widest">Show:</span>
            <select 
              value={rowsPerPage} 
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-transparent font-bold text-indigo-600 outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                {profile?.role === 'superadmin' && <th className="px-6 py-4 font-medium">Tenant</th>}
                <th className="px-6 py-4 font-medium">Order ID</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Payment</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  {profile?.role === 'superadmin' && (
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-900">
                        {tenants.find(t => t.id === order.tenantId)?.name || 'Unknown'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono font-bold text-indigo-600">{order.orderNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {order.date || order.createdAt ? new Date((order.date?.seconds || order.createdAt?.seconds || 0) * 1000).toLocaleDateString() : 'Just now...'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       {order.customerCode && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase border border-indigo-100">
                          {order.customerCode}
                        </span>
                      )}
                      <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                    </div>
                    <p className="text-xs text-gray-500">{order.items.length} items</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeColor(order.type)}`}>
                      {getTypeIcon(order.type)}
                      {order.type?.toUpperCase() || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">Rp.{(order.totalAmount || (order as any).total || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      (order as any).paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-100' :
                      (order as any).paymentStatus === 'partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                      'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {(order as any).paymentStatus || 'UNPAID'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => handlePrint('invoice', order)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center group relative"
                        title="Cetak Faktur (A4)"
                      >
                        <Printer className="w-4 h-4" />
                        <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          Cetak Faktur (A4)
                        </span>
                      </button>
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        <span className="text-xs font-bold">Detail</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50/50 gap-4">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900">{Math.min(filteredOrders.length, (currentPage - 1) * rowsPerPage + 1)}</span> to <span className="font-bold text-gray-900">{Math.min(filteredOrders.length, currentPage * rowsPerPage)}</span> of <span className="font-bold text-gray-900">{filteredOrders.length}</span> orders
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === page 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                          : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  (page === currentPage - 2 && page > 1) || 
                  (page === currentPage + 2 && page < totalPages)
                ) {
                  return <span key={page} className="text-gray-400">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
                      {selectedOrder.date || (selectedOrder as any).createdAt ? new Date((selectedOrder.date?.seconds || (selectedOrder as any).createdAt?.seconds || 0) * 1000).toLocaleString() : 'Just now...'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Order Type</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeColor(selectedOrder.type)}`}>
                      {getTypeIcon(selectedOrder.type)}
                      {selectedOrder.type?.toUpperCase() || 'N/A'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Current Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusLabel(selectedOrder.status)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Payment Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      (selectedOrder as any).paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-100' :
                      (selectedOrder as any).paymentStatus === 'partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                      'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {((selectedOrder as any).paymentStatus || 'UNPAID').toUpperCase()}
                    </span>
                    {(selectedOrder as any).paymentStatus === 'partial' && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Paid: Rp.{((selectedOrder as any).paidAmount || 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {selectedOrder.paymentMethod && (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-400 uppercase">Payment Method</p>
                      <div className="flex items-center text-indigo-600">
                        <Landmark className="w-3 h-3 mr-1" />
                        <span className="text-sm font-bold">
                          {bankAccounts.find(b => b.id === selectedOrder.paymentMethod)?.name || 'Unknown Account'}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedOrder.remark && (
                    <div className="col-span-2 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase">Remark</p>
                      <p className="text-sm font-medium text-gray-700">{selectedOrder.remark}</p>
                    </div>
                  )}
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
                          <td colSpan={3} className="px-4 py-2 text-right font-bold text-gray-500">Subtotal :</td>
                          <td className="px-4 py-2 text-right font-bold text-gray-900">
                            Rp.{( (selectedOrder as any).subtotal || (selectedOrder.totalAmount || (selectedOrder as any).total || 0) + ((selectedOrder as any).discount || 0) ).toLocaleString()}
                          </td>
                        </tr>
                        {(selectedOrder as any).discount > 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-right font-bold text-green-600">
                              Anda Hemat :
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-green-600">
                              - Rp.{((selectedOrder as any).discount || 0).toLocaleString()}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-right font-bold text-gray-500 uppercase tracking-wider">Total Amount:</td>
                          <td className="px-4 py-4 text-right font-extrabold text-indigo-600 text-lg">
                            Rp.{(selectedOrder.totalAmount || (selectedOrder as any).total || 0).toLocaleString()}
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
                  
                  {selectedOrder.status !== 'cancelled' && (selectedOrder as any).paymentStatus !== 'paid' && (
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="text-sm font-bold text-indigo-900">Sisa Tagihan</h5>
                        <p className="text-lg font-black text-indigo-600">
                          Rp.{( (selectedOrder.totalAmount || (selectedOrder as any).total || 0) - ((selectedOrder as any).paidAmount || 0) ).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPaymentAmount((selectedOrder.totalAmount || (selectedOrder as any).total || 0) - ((selectedOrder as any).paidAmount || 0));
                          setIsPaymentModalOpen(true);
                        }}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center shadow-lg shadow-indigo-100"
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Catat Pembayaran Baru
                      </button>
                    </div>
                  )}

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
                        <span className="text-[10px] font-bold">RECEIVED</span>
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

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 no-print">
                <div className="relative">
                  <button 
                    onClick={() => setIsPrintDropdownOpen(!isPrintDropdownOpen)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center shadow-lg shadow-indigo-100"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </button>
                  
                  <AnimatePresence>
                    {isPrintDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-[55]" 
                          onClick={() => setIsPrintDropdownOpen(false)} 
                        />
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[60]"
                        >
                          <div className="p-2 bg-gray-50 border-b border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase px-3 py-1">Opsi Cetak</p>
                          </div>
                          <button 
                            onClick={() => handlePrint('invoice')}
                            className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center transition-colors"
                          >
                            <FileText className="w-4 h-4 mr-3 text-indigo-500" />
                            Cetak Faktur (A4)
                          </button>
                          <button 
                            onClick={() => handlePrint('receipt')}
                            className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center transition-colors"
                          >
                            <Printer className="w-4 h-4 mr-3 text-indigo-500" />
                            Cetak Struk (Thermal)
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setIsPrintDropdownOpen(false);
                  }}
                  className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  Close Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Templates */}
      <div className={`${printType ? 'block' : 'hidden'} print:block print-section fixed inset-0 bg-white z-[9999] overflow-auto`}>
        {selectedOrder && (
          <>
            {printType === 'invoice' && (
              <div className="p-10 text-black font-sans bg-white min-h-screen">
                <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      {tenantInfo?.settings?.logoUrl ? (
                        <img src={tenantInfo.settings.logoUrl} alt="Logo Business" className="h-16 mb-2 object-contain" />
                      ) : (
                        <h1 className="text-4xl font-black text-indigo-600 mb-1">{tenantInfo?.name || 'ZENTORY'}</h1>
                      )}
                      <p className="text-sm text-gray-500 max-w-xs">{tenantInfo?.settings?.description || 'Business Inventory & Sales Solutions'}</p>
                      <p className="text-sm text-gray-500 mt-1">{tenantInfo?.settings?.address || ''}</p>
                      <p className="text-sm text-gray-500">{tenantInfo?.settings?.phone || ''}</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-tighter">INVOICE</h2>
                      <p className="text-sm font-mono text-gray-500">#{selectedOrder.orderNumber}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedOrder.date || (selectedOrder as any).createdAt ? new Date((selectedOrder.date?.seconds || (selectedOrder as any).createdAt?.seconds || 0) * 1000).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10 mb-10 border-y border-gray-100 py-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Billed To</p>
                      <p className="text-lg font-bold text-gray-900">{selectedOrder.customerName}</p>
                      <p className="text-sm text-gray-500 uppercase">{selectedOrder.type} Order</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Order Status</p>
                      <p className="text-lg font-bold text-indigo-600 uppercase">{getStatusLabel(selectedOrder.status)}</p>
                    </div>
                  </div>

                  <table className="w-full mb-10">
                    <thead>
                      <tr className="border-b-2 border-gray-900 text-left text-xs font-bold uppercase tracking-wider">
                        <th className="py-3">Description</th>
                        <th className="py-3 text-center">Quantity</th>
                        <th className="py-3 text-right">Unit Price</th>
                        <th className="py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedOrder.items.map((item, i) => (
                        <tr key={i} className="text-sm">
                          <td className="py-4 font-medium">{item.name}</td>
                          <td className="py-4 text-center">{item.quantity}</td>
                          <td className="py-4 text-right">Rp.{item.price.toLocaleString()}</td>
                          <td className="py-4 text-right font-bold">Rp.{(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-100">
                        <td colSpan={3} className="py-2 text-right font-bold text-gray-500 uppercase tracking-widest text-[10px]">Subtotal :</td>
                        <td className="py-2 text-right font-bold text-gray-900 text-sm">
                          Rp.{( (selectedOrder as any).subtotal || (selectedOrder.totalAmount || (selectedOrder as any).total || 0) + ((selectedOrder as any).discount || 0) ).toLocaleString()}
                        </td>
                      </tr>
                      {(selectedOrder as any).discount > 0 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-right font-bold text-green-600 uppercase tracking-widest text-[10px]">
                            Anda Hemat :
                          </td>
                          <td className="py-2 text-right font-bold text-green-600 text-sm">
                            - Rp.{((selectedOrder as any).discount || 0).toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-gray-900">
                        <td colSpan={3} className="py-6 text-right font-bold text-gray-500 uppercase tracking-widest">Total Amount:</td>
                        <td className="py-6 text-right text-2xl font-black text-indigo-600">
                          Rp.{(selectedOrder.totalAmount || (selectedOrder as any).total || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="mt-20 pt-10 border-t border-gray-100 text-center">
                    <p className="text-sm font-bold text-gray-900">Thank you for your business!</p>
                    <p className="text-xs text-gray-400 mt-1">Generated by Zentory POS System</p>
                  </div>
                </div>
              </div>
            )}

            {printType === 'receipt' && (
              <div className="p-4 text-black font-mono text-[10px] w-[80mm] mx-auto bg-white min-h-screen">
                <div className="text-center mb-4 flex flex-col items-center">
                  {tenantInfo?.settings?.logoUrl && (
                    <img src={tenantInfo.settings.logoUrl} alt="Logo" className="max-w-[40mm] h-10 mb-2 object-contain grayscale" />
                  )}
                  <h1 className="text-base font-bold uppercase">{tenantInfo?.name || 'ZENTORY'}</h1>
                  <p className="text-[8px]">{tenantInfo?.settings?.description || 'Sales Receipt'}</p>
                  {tenantInfo?.settings?.address && <p className="text-[8px] mt-1">{tenantInfo?.settings?.address}</p>}
                  {tenantInfo?.settings?.phone && <p className="text-[8px]">{tenantInfo?.settings?.phone}</p>}
                </div>
                
                <div className="border-t border-dashed border-gray-300 py-2 mb-2">
                  <div className="flex justify-between">
                    <span>Order:</span>
                    <span>#{selectedOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{selectedOrder.date || (selectedOrder as any).createdAt ? new Date((selectedOrder.date?.seconds || (selectedOrder as any).createdAt?.seconds || 0) * 1000).toLocaleString() : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cust:</span>
                    <span>{selectedOrder.customerName}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 py-2 mb-2">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="mb-1">
                      <div className="flex justify-between">
                        <span>{item.name}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>{item.quantity} x {item.price.toLocaleString()}</span>
                        <span>{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 py-2 font-bold text-xs">
                  <div className="flex justify-between text-[8px] font-normal">
                    <span>Subtotal :</span>
                    <span>Rp.{( (selectedOrder as any).subtotal || (selectedOrder.totalAmount || (selectedOrder as any).total || 0) + ((selectedOrder as any).discount || 0) ).toLocaleString()}</span>
                  </div>
                  {(selectedOrder as any).discount > 0 && (
                    <div className="flex justify-between text-[8px] font-normal text-gray-600">
                      <span>Anda Hemat :</span>
                      <span>- Rp.{((selectedOrder as any).discount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-gray-200">
                    <span>Total Amount:</span>
                    <span>Rp.{(selectedOrder.totalAmount || (selectedOrder as any).total || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-center mt-6">
                  <p>TERIMA KASIH</p>
                  <p className="text-[8px] mt-1">Zentory POS System</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Alasan Perubahan</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="Contoh: Salah input status, pelanggan ingin lanjut..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                  />
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

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">Catat Pembayaran</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Jumlah Pembayaran</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Metode Pembayaran / Bank</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Pilih Bank / Kas</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.name} {b.accountNumber ? `(${b.accountNumber})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={isUpdating || paymentAmount <= 0 || !selectedBankAccountId}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isUpdating ? 'Memproses...' : 'Simpan Pembayaran'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
