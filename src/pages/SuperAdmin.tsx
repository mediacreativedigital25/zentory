import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, onSnapshot, serverTimestamp, where, deleteDoc, writeBatch, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, UserProfile, ApprovalRequest } from '../types';
import { Users, Building2, ShieldCheck, Activity, Search, CheckCircle2, XCircle, Clock, Trash2, AlertTriangle, RefreshCcw, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import ConfirmModal from '../components/ConfirmModal';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function SuperAdmin() {
  const { profile } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'approvals' | 'users' | 'reset'>('tenants');
  const [selectedResetTenant, setSelectedResetTenant] = useState<string>('');
  const [resetCollections, setResetCollections] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const collectionsToReset = [
    { id: 'orders', label: 'Orders (Pesanan)' },
    { id: 'transactions', label: 'Transactions (Keuangan)' },
    { id: 'products', label: 'Products (Produk)' },
    { id: 'customers', label: 'Customers (Pelanggan)' },
    { id: 'categories', label: 'Categories (Kategori)' },
    { id: 'warehouses', label: 'Warehouses (Gudang)' },
    { id: 'approval_requests', label: 'Approval Requests' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tenantSnap = await getDocs(query(collection(db, 'tenants'), orderBy('createdAt', 'desc')));
        setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));

        const userSnap = await getDocs(collection(db, 'users'));
        setUsers(userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'tenants_or_users', auth, profile);
      }
    };
    fetchData();

    const unsubApprovals = onSnapshot(query(collection(db, 'approval_requests'), orderBy('requestedAt', 'desc')), (snap) => {
      setApprovals(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'approval_requests', auth, profile);
      setLoading(false);
    });

    return () => unsubApprovals();
  }, []);

  const updateSubscription = async (tenantId: string, plan: string) => {
    await updateDoc(doc(db, 'tenants', tenantId), { subscription: plan });
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, subscription: plan as any } : t));
  };

  const handleApproval = async (request: ApprovalRequest, action: 'approve' | 'reject') => {
    try {
      const requestRef = doc(db, 'approval_requests', request.id);

      if (action === 'approve') {
        if (request.type === 'order_status' && request.orderId) {
          const orderRef = doc(db, 'orders', request.orderId);
          const orderSnap = await getDoc(orderRef);
          
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            const oldStatus = orderData.status;
            const newStatus = request.targetStatus;

            // 1. Update Order Status
            await updateDoc(orderRef, { status: newStatus });
            
            // 2. Update corresponding transaction
            const transQuery = profile?.role === 'superadmin'
              ? query(
                  collection(db, 'transactions'),
                  where('orderNumber', '==', request.orderNumber)
                )
              : query(
                  collection(db, 'transactions'),
                  where('tenantId', '==', request.tenantId),
                  where('orderNumber', '==', request.orderNumber)
                );
            try {
              const transSnap = await getDocs(transQuery);
              for (const tDoc of transSnap.docs) {
                // Map transaction status: processing -> pending, others stay same
                const transStatus = newStatus === 'processing' ? 'pending' : newStatus;
                await updateDoc(doc(db, 'transactions', tDoc.id), { status: transStatus });
              }
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, 'transactions', auth, profile);
            }

            // 3. Handle Stock Return/Deduction
            if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
              // Return stock
              for (const item of orderData.items || []) {
                const productRef = doc(db, 'products', item.productId);
                await runTransaction(db, async (transaction) => {
                  const pDoc = await transaction.get(productRef);
                  if (!pDoc.exists()) return;
                  const currentStock = pDoc.data().stock || 0;
                  transaction.update(productRef, { stock: currentStock + item.quantity });
                });
              }
            } else if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
              // Deduct stock again
              for (const item of orderData.items || []) {
                const productRef = doc(db, 'products', item.productId);
                await runTransaction(db, async (transaction) => {
                  const pDoc = await transaction.get(productRef);
                  if (!pDoc.exists()) return;
                  const currentStock = pDoc.data().stock || 0;
                  const newStock = Math.max(0, currentStock - item.quantity);
                  transaction.update(productRef, { stock: newStock });
                });
              }
            }
          }
        } else if (request.type === 'daily_settlement_open' && request.closingId) {
          // 1. Delete the daily closing record
          await deleteDoc(doc(db, 'dailyClosings', request.closingId));

          // 2. Delete associated charity records
          const charityQ = query(
            collection(db, 'charityRecords'),
            where('dailyClosingId', '==', request.closingId)
          );
          const charitySnap = await getDocs(charityQ);
          for (const cDoc of charitySnap.docs) {
            await deleteDoc(doc(db, 'charityRecords', cDoc.id));
          }

          // 3. Delete the auto-generated Amal expense if it exists
          if (request.closingDate) {
            const dateObj = new Date(request.closingDate.seconds * 1000);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            
            const amalQuery = query(
              collection(db, 'transactions'),
              where('tenantId', '==', request.tenantId),
              where('type', '==', 'expense'),
              where('category', '==', 'Amal'),
              where('isAutoGenerated', '==', true)
            );
            const amalSnap = await getDocs(amalQuery);
            for (const aDoc of amalSnap.docs) {
              const desc = aDoc.data().description || '';
              if (desc.includes(dateStr)) {
                await deleteDoc(doc(db, 'transactions', aDoc.id));
              }
            }
          }
        } else if (request.type === 'charity_revision' && request.charityId) {
          // 1. Update the charity record status back to draft or just delete it
          // For now, let's delete it so they can re-save it from the list
          await deleteDoc(doc(db, 'charityRecords', request.charityId));

          // 2. Delete the auto-generated Amal expense if it exists
          if (request.closingDate) {
            const dateObj = new Date(request.closingDate.seconds * 1000);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            
            const amalQuery = query(
              collection(db, 'transactions'),
              where('tenantId', '==', request.tenantId),
              where('type', '==', 'expense'),
              where('category', '==', 'Amal'),
              where('description', '>=', `Amal tgl ${dateStr}`), // Use >= to match with Ref
              where('isAutoGenerated', '==', true)
            );
            const amalSnap = await getDocs(amalQuery);
            for (const aDoc of amalSnap.docs) {
              if (aDoc.data().description.includes(dateStr)) {
                await deleteDoc(doc(db, 'transactions', aDoc.id));
              }
            }
          }
        }

        await updateDoc(requestRef, { 
          status: 'approved',
          resolvedBy: profile?.uid,
          resolvedAt: serverTimestamp()
        });
        setConfirmConfig({
          isOpen: true,
          title: 'Berhasil',
          message: 'Permintaan telah disetujui.',
          onConfirm: () => setConfirmConfig(null),
          showCancel: false
        });
      } else {
        await updateDoc(requestRef, { 
          status: 'rejected',
          resolvedBy: profile?.uid,
          resolvedAt: serverTimestamp()
        });
        setConfirmConfig({
          isOpen: true,
          title: 'Berhasil',
          message: 'Permintaan telah ditolak.',
          onConfirm: () => setConfirmConfig(null),
          showCancel: false
        });
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('{"error"')) {
          setConfirmConfig({
            isOpen: true,
            title: 'Error',
            message: 'Gagal memproses permintaan: Izin tidak cukup.',
            onConfirm: () => setConfirmConfig(null),
            showCancel: false
          });
      } else {
        handleFirestoreError(err, OperationType.UPDATE, `approval_requests/${request.id}`, auth, profile);
      }
    }
  };

  const handleReset = async () => {
    if (!selectedResetTenant) return;
    if (resetCollections.length === 0) return;

    const tenantName = tenants.find(t => t.id === selectedResetTenant)?.name;
    
    setConfirmConfig({
      isOpen: true,
      title: 'RESET DATA TENANT',
      message: `PERINGATAN KRITIS! Anda akan menghapus SEMUA data (${resetCollections.join(', ')}) untuk tenant "${tenantName}". Tindakan ini TIDAK DAPAT DIBATALKAN. Apakah Anda yakin?`,
      onConfirm: async () => {
        setConfirmConfig(null);
        setIsResetting(true);
        setResetSuccess(false);
        try {
          for (const collId of resetCollections) {
            const q = query(collection(db, collId), where('tenantId', '==', selectedResetTenant));
            const snap = await getDocs(q);
            
            let batch = writeBatch(db);
            let count = 0;
            
            for (const d of snap.docs) {
              batch.delete(d.ref);
              count++;
              if (count === 500) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
              }
            }
            if (count > 0) await batch.commit();
          }
          setResetSuccess(true);
          setResetCollections([]);
          setTimeout(() => setResetSuccess(false), 5000);
        } catch (err) {
          console.error(err);
          handleFirestoreError(err, OperationType.DELETE, 'multiple_collections', auth, profile);
        } finally {
          setIsResetting(false);
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Superadmin Dashboard</h2>
          <p className="text-gray-500">Global system management and monitoring.</p>
        </div>
        <div className="flex space-x-4">
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2" />
            System Status: Healthy
          </div>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Tenants</p>
            <p className="text-2xl font-bold">{tenants.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg mr-4">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Sessions</p>
            <p className="text-2xl font-bold">42</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tenants' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Tenants
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${activeTab === 'approvals' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Approvals
          {approvals.filter(a => a.status === 'pending').length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
              {approvals.filter(a => a.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('reset')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${activeTab === 'reset' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Reset Data
        </button>
      </div>

      {activeTab === 'tenants' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Tenant Management</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenants..."
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Business Name</th>
                  <th className="px-6 py-4 font-medium">Slug</th>
                  <th className="px-6 py-4 font-medium">Subscription</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{tenant.name}</td>
                    <td className="px-6 py-4 text-gray-500">{tenant.slug}</td>
                    <td className="px-6 py-4">
                      <select
                        value={tenant.subscription}
                        onChange={(e) => updateSubscription(tenant.id, e.target.value)}
                        className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 outline-none border-none"
                      >
                        <option value="free">FREE</option>
                        <option value="pro">PRO</option>
                        <option value="enterprise">ENTERPRISE</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tenant.createdAt ? new Date(tenant.createdAt?.seconds * 1000).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'approvals' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold">Approval Requests</h3>
            <p className="text-sm text-gray-500">Manage requests to revert cancelled transactions.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Tenant</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Requested At</th>
                  <th className="px-6 py-4 font-medium">Details</th>
                  <th className="px-6 py-4 font-medium">Reason</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvals.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">
                          {req.tenantName || tenants.find(t => t.id === req.tenantId)?.name || 'Unknown Tenant'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{req.tenantId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                        req.type === 'daily_settlement_open' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                        req.type === 'charity_revision' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {req.type?.replace('_', ' ') || 'ORDER STATUS'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {req.type === 'daily_settlement_open' || req.type === 'charity_revision' ? (
                        req.closingDate ? new Date(req.closingDate.seconds * 1000).toLocaleDateString() : 'Settlement'
                      ) : (
                        req.orderNumber
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {req.requestedAt ? new Date(req.requestedAt?.seconds * 1000).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {req.type === 'daily_settlement_open' ? (
                        <span className="text-xs font-bold text-amber-600">OPEN SETTLEMENT</span>
                      ) : req.type === 'charity_revision' ? (
                        <span className="text-xs font-bold text-pink-600">REVISI AMAL</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                          {req.targetStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {req.reason || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                        req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' :
                        req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                        'bg-yellow-50 text-yellow-700 border-yellow-100'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'pending' && (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleApproval(req, 'approve')}
                            className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApproval(req, 'reject')}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {req.status !== 'pending' && (
                        <span className="text-xs text-gray-400 italic">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
                {approvals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Clock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      No approval requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Global User Management</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Tenant</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">
                          {user.displayName?.charAt(0) || user.email?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{user.displayName || 'No Name'}</p>
                          <p className="text-[10px] text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                        user.role === 'superadmin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        user.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-900">
                          {tenants.find(t => t.id === user.tenantId)?.name || 'System'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{user.tenantId || 'global'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt?.seconds * 1000).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">Edit Profile</button>
                        {user.uid !== profile?.uid && (
                          <button
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: 'Konfirmasi Logout Paksa',
                                message: `Apakah Anda yakin ingin memaksa logout user ${user.displayName || user.email}?`,
                                onConfirm: async () => {
                                  try {
                                    await updateDoc(doc(db, 'users', user.uid), {
                                      forceLogoutAt: serverTimestamp()
                                    });
                                    setConfirmConfig(null);
                                  } catch (err) {
                                    console.error(err);
                                    setConfirmConfig({
                                      isOpen: true,
                                      title: 'Error',
                                      message: 'Gagal melakukan logout paksa.',
                                      onConfirm: () => setConfirmConfig(null)
                                    });
                                  }
                                }
                              });
                            }}
                            className="text-red-600 hover:text-red-900 text-sm font-medium flex items-center"
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            Logout
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center space-x-4 mb-8">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Reset Data Tenant</h3>
                <p className="text-sm text-gray-500">Hapus data transaksi dan master data untuk tenant tertentu.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Tenant</label>
                <select
                  value={selectedResetTenant}
                  onChange={(e) => setSelectedResetTenant(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all"
                >
                  <option value="">-- Pilih Tenant --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">Pilih Data yang Akan Dihapus</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {collectionsToReset.map(coll => (
                    <label key={coll.id} className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      resetCollections.includes(coll.id) 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={resetCollections.includes(coll.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setResetCollections([...resetCollections, coll.id]);
                          } else {
                            setResetCollections(resetCollections.filter(id => id !== coll.id));
                          }
                        }}
                      />
                      <div className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                        resetCollections.includes(coll.id) ? 'bg-red-500 border-red-500' : 'border-gray-300'
                      }`}>
                        {resetCollections.includes(coll.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm font-medium ${resetCollections.includes(coll.id) ? 'text-red-700' : 'text-gray-600'}`}>
                        {coll.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-700 leading-relaxed">
                  <p className="font-bold mb-1">PERHATIAN:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Semua data yang dipilih akan dihapus secara permanen dari database.</li>
                    <li>Tindakan ini tidak dapat dibatalkan (Undo).</li>
                    <li>Pastikan Anda telah memilih tenant yang benar sebelum menekan tombol reset.</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={handleReset}
                disabled={isResetting || !selectedResetTenant || resetCollections.length === 0}
                className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-red-100"
              >
                {isResetting ? (
                  <>
                    <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
                    Sedang Mereset Data...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Reset Data Sekarang
                  </>
                )}
              </button>

              {resetSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-50 border border-green-100 rounded-xl text-center text-sm font-bold text-green-700"
                >
                  Data tenant berhasil direset sepenuhnya.
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}

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
