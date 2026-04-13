import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, onSnapshot, serverTimestamp, where, deleteDoc, writeBatch, getDoc, runTransaction, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, UserProfile, ApprovalRequest } from '../types';
import { Users, Building2, ShieldCheck, Activity, Search, CheckCircle2, XCircle, Clock, Trash2, AlertTriangle, RefreshCcw, LogOut, Globe, Eye, Edit3, X, Save, Phone, Mail, MapPin, Briefcase, FileText, Calendar, ListChecks, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import ConfirmModal from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function SuperAdmin() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'approvals' | 'users' | 'reset' | 'roadmap'>('tenants');
  const [selectedResetTenant, setSelectedResetTenant] = useState<string>('');
  const [selectedTenantForDetail, setSelectedTenantForDetail] = useState<Tenant | null>(null);
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [tenantFormData, setTenantFormData] = useState<Partial<Tenant>>({});
  const [resetCollections, setResetCollections] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'online'>('all');
  const [roadmapItems, setRoadmapItems] = useState<any[]>([]);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);

  useEffect(() => {
    const unsubRoadmap = onSnapshot(query(collection(db, 'system_roadmap'), orderBy('order', 'asc')), (snap) => {
      if (snap.empty) {
        const defaults = [
          { order: 1, title: 'Riwayat Stok (Stock Ledger)', description: 'Pencatatan mutasi stok masuk/keluar secara detail.', status: 'completed', category: 'Inventory' },
          { order: 2, title: 'Notifikasi Stok Rendah', description: 'Peringatan otomatis saat stok mencapai batas minimum.', status: 'pending', category: 'Inventory' },
          { order: 3, title: 'Laporan & Analitik Visual', description: 'Grafik tren penjualan dan performa produk.', status: 'pending', category: 'Reporting' },
          { order: 4, title: 'Manajemen Pemasok', description: 'Database supplier dan histori pembelian.', status: 'pending', category: 'Purchase' },
          { order: 5, title: 'Validasi Keamanan Firestore', description: 'Audit dan penguatan security rules.', status: 'completed', category: 'Security' },
          { order: 6, title: 'Ekspor/Impor Data', description: 'Fitur download data ke format Excel/CSV.', status: 'pending', category: 'System' },
          { order: 7, title: 'Optimasi Mobile (PWA)', description: 'Aplikasi dapat diinstal di HP untuk operasional gudang.', status: 'pending', category: 'System' },
        ];
        Promise.all(defaults.map(item => addDoc(collection(db, 'system_roadmap'), item)))
          .catch(err => console.error('Error initializing roadmap:', err));
      } else {
        setRoadmapItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_roadmap', auth, profile);
    });

    return () => unsubRoadmap();
  }, []);

  const toggleRoadmapStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateDoc(doc(db, 'system_roadmap', id), { status: newStatus });
  };

  const collectionsToReset = [
    // Sales & Finance
    { id: 'orders', label: 'Orders (Pesanan)' },
    { id: 'transactions', label: 'Transactions (Keuangan)' },
    { id: 'bank_accounts', label: 'Bank Accounts (Rekening)' },
    { id: 'dailyClosings', label: 'Daily Closings (Tutup Buku)' },
    { id: 'charityRecords', label: 'Charity Records (Zakat/Infaq)' },
    
    // Inventory
    { id: 'products', label: 'Products (Produk)' },
    { id: 'categories', label: 'Categories (Kategori)' },
    { id: 'warehouses', label: 'Warehouses (Gudang)' },
    
    // Purchase
    { id: 'suppliers', label: 'Suppliers (Pemasok)' },
    { id: 'purchase_requests', label: 'Purchase Requests (PR)' },
    { id: 'purchase_orders', label: 'Purchase Orders (PO)' },
    { id: 'goods_receipts', label: 'Goods Receipts (GR)' },
    { id: 'purchase_invoices', label: 'Purchase Invoices (PI)' },
    
    // System
    { id: 'customers', label: 'Customers (Pelanggan)' },
    { id: 'approval_requests', label: 'Approval Requests' },
    { id: 'expenseRules', label: 'Expense Rules (Aturan Biaya)' },
    { id: 'roles', label: 'Custom Roles (Jabatan)' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tenantSnap = await getDocs(query(collection(db, 'tenants'), orderBy('createdAt', 'desc')));
        setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
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

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users', auth, profile);
    });

    return () => {
      unsubApprovals();
      unsubUsers();
    };
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesFilter = userFilter === 'all' || user.isOnline;
    return matchesSearch && matchesFilter;
  });

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

        await deleteDoc(requestRef);
        setConfirmConfig({
          isOpen: true,
          title: 'Berhasil',
          message: 'Permintaan telah disetujui dan dihapus.',
          onConfirm: () => setConfirmConfig(null),
          showCancel: false
        });
      } else {
        await deleteDoc(requestRef);
        setConfirmConfig({
          isOpen: true,
          title: 'Berhasil',
          message: 'Permintaan telah ditolak dan dihapus.',
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

  const handleDeleteAllApprovals = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'HAPUS SEMUA APPROVAL',
      message: 'Apakah Anda yakin ingin menghapus SEMUA daftar permintaan persetujuan? Tindakan ini tidak dapat dibatalkan.',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          const batch = writeBatch(db);
          approvals.forEach(req => {
            batch.delete(doc(db, 'approval_requests', req.id));
          });
          await batch.commit();
          setConfirmConfig({
            isOpen: true,
            title: 'Berhasil',
            message: 'Semua daftar persetujuan telah dihapus.',
            onConfirm: () => setConfirmConfig(null),
            showCancel: false
          });
        } catch (err) {
          console.error(err);
          handleFirestoreError(err, OperationType.DELETE, 'approval_requests_batch', auth, profile);
        }
      }
    });
  };

  const handleSaveTenantDetails = async () => {
    if (!selectedTenantForDetail) return;
    try {
      const tenantRef = doc(db, 'tenants', selectedTenantForDetail.id);
      await updateDoc(tenantRef, {
        ...tenantFormData,
        updatedAt: serverTimestamp()
      });
      
      setTenants(tenants.map(t => t.id === selectedTenantForDetail.id ? { ...t, ...tenantFormData } : t));
      setSelectedTenantForDetail({ ...selectedTenantForDetail, ...tenantFormData } as Tenant);
      setIsEditingTenant(false);
      
      setConfirmConfig({
        isOpen: true,
        title: 'Berhasil',
        message: 'Data tenant berhasil diperbarui.',
        onConfirm: () => setConfirmConfig(null),
        showCancel: false
      });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${selectedTenantForDetail.id}`, auth, profile);
    }
  };

  const generateMissingCodes = async () => {
    setIsGeneratingCodes(true);
    try {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const batch = writeBatch(db);
      let count = 0;

      for (const tenant of tenants) {
        if (!tenant.code) {
          let newCode = '';
          for (let i = 0; i < 3; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          batch.update(doc(db, 'tenants', tenant.id), { code: newCode });
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        // Refresh tenants
        const tenantSnap = await getDocs(query(collection(db, 'tenants'), orderBy('createdAt', 'desc')));
        setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
        
        setConfirmConfig({
          isOpen: true,
          title: 'Berhasil',
          message: `${count} kode tenant berhasil digenerate.`,
          onConfirm: () => setConfirmConfig(null),
          showCancel: false
        });
      } else {
        setConfirmConfig({
          isOpen: true,
          title: 'Info',
          message: 'Semua tenant sudah memiliki kode.',
          onConfirm: () => setConfirmConfig(null),
          showCancel: false
        });
      }
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, 'tenants_batch_update', auth, profile);
    } finally {
      setIsGeneratingCodes(false);
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate('/superadmin/domains')}>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg mr-4">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Custom Domains</p>
            <p className="text-2xl font-bold">Manage</p>
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
        <button
          onClick={() => setActiveTab('roadmap')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${activeTab === 'roadmap' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ListChecks className="w-4 h-4 mr-2" />
          Roadmap & Planning
        </button>
      </div>

      {activeTab === 'tenants' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold">Tenant Management</h3>
              <button
                onClick={generateMissingCodes}
                disabled={isGeneratingCodes}
                className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <RefreshCcw className={`w-3 h-3 mr-2 ${isGeneratingCodes ? 'animate-spin' : ''}`} />
                Generate Missing Codes
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenants..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Business Name</th>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Slug</th>
                  <th className="px-6 py-4 font-medium">Subscription</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants
                  .filter(t => t.name.toLowerCase().includes(tenantSearch.toLowerCase()) || t.code?.toLowerCase().includes(tenantSearch.toLowerCase()))
                  .map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{tenant.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded font-mono text-xs font-bold">
                        {tenant.code || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{tenant.slug}</td>
                    <td className="px-6 py-4">
                      <select
                        value={tenant.subscription || 'free'}
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
                      <button 
                        onClick={() => {
                          setSelectedTenantForDetail(tenant);
                          setTenantFormData(tenant);
                          setIsEditingTenant(false);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'approvals' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Approval Requests</h3>
              <p className="text-sm text-gray-500">Manage requests to revert cancelled transactions.</p>
            </div>
            {approvals.length > 0 && (
              <button
                onClick={handleDeleteAllApprovals}
                className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Hapus Semua List
              </button>
            )}
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
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Global User Management</h3>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setUserFilter('all')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all ${userFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setUserFilter('online')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all flex items-center ${userFilter === 'online' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${userFilter === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  Online
                </button>
              </div>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Tenant</th>
                  <th className="px-6 py-4 font-medium">Activity</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">
                            {user.displayName?.charAt(0) || user.email?.charAt(0)}
                          </div>
                          {user.isOnline && (
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm" title="Online"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{user.displayName || 'No Name'}</p>
                          <p className="text-[10px] text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isOnline ? (
                        <span className="flex items-center text-[10px] font-bold text-green-600 uppercase">
                          <Activity className="w-3 h-3 mr-1" />
                          Online
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Offline</span>
                      )}
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
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center text-[10px] text-gray-500">
                          <Clock className="w-3 h-3 mr-1 text-green-500" />
                          <span className="font-medium">In:</span>
                          <span className="ml-1">{user.lastLoginAt ? new Date(user.lastLoginAt?.seconds * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        </div>
                        <div className="flex items-center text-[10px] text-gray-500">
                          <LogOut className="w-3 h-3 mr-1 text-red-400" />
                          <span className="font-medium">Out:</span>
                          <span className="ml-1">{user.lastLogoutAt ? new Date(user.lastLogoutAt?.seconds * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        </div>
                      </div>
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
      ) : activeTab === 'roadmap' ? (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <ListChecks className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">System Roadmap & Planning</h3>
                  <p className="text-sm text-gray-500">Daftar pengembangan fitur Zentory di masa mendatang.</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-indigo-600">
                  {Math.round((roadmapItems.filter(i => i.status === 'completed').length / roadmapItems.length) * 100) || 0}%
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progress Selesai</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {roadmapItems.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => toggleRoadmapStatus(item.id, item.status)}
                  className={`group p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    item.status === 'completed' 
                      ? 'border-green-100 bg-green-50/30' 
                      : 'border-gray-50 bg-white hover:border-indigo-100 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      item.status === 'completed' 
                        ? 'bg-green-500 border-green-500' 
                        : 'border-gray-200 group-hover:border-indigo-500'
                    }`}>
                      {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                          item.category === 'Inventory' ? 'bg-blue-100 text-blue-700' :
                          item.category === 'Security' ? 'bg-purple-100 text-purple-700' :
                          item.category === 'Reporting' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.category}
                        </span>
                        <h4 className={`font-bold text-sm ${item.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {item.title}
                        </h4>
                      </div>
                      <p className={`text-xs ${item.status === 'completed' ? 'text-gray-300' : 'text-gray-500'}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 transition-all ${item.status === 'completed' ? 'text-green-300' : 'text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1'}`} />
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
              <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Catatan Pengembang
              </h4>
              <p className="text-xs text-indigo-700 leading-relaxed">
                Roadmap ini adalah panduan pengembangan sistem Zentory. Item yang ditandai sebagai selesai telah diimplementasikan dalam kode inti. Anda dapat memantau progress pengembangan secara real-time melalui halaman ini.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'reset' ? (
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
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-bold text-gray-700">Pilih Data yang Akan Dihapus</label>
                  <button
                    onClick={() => {
                      if (resetCollections.length === collectionsToReset.length) {
                        setResetCollections([]);
                      } else {
                        setResetCollections(collectionsToReset.map(c => c.id));
                      }
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    {resetCollections.length === collectionsToReset.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                  </button>
                </div>
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
      ) : null}

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}

      {/* Tenant Detail Modal */}
      <AnimatePresence>
        {selectedTenantForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center space-x-3">
                  <Building2 className="w-6 h-6" />
                  <div>
                    <h3 className="text-xl font-bold">{selectedTenantForDetail.name}</h3>
                    <p className="text-xs text-indigo-100">ID: {selectedTenantForDetail.id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!isEditingTenant ? (
                    <button
                      onClick={() => setIsEditingTenant(true)}
                      className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm font-bold"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Data
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveTenantDetails}
                      className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 rounded-xl transition-colors text-sm font-bold"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Simpan Perubahan
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedTenantForDetail(null)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
                      Informasi Dasar & Kontak
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Bisnis</label>
                          <div className="flex items-center text-gray-900 font-medium px-4 py-2 bg-gray-50 rounded-xl">
                            {selectedTenantForDetail.name}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kode Tenant</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              maxLength={3}
                              value={tenantFormData.code || ''}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, code: e.target.value.toUpperCase() })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono uppercase"
                              placeholder="KODE"
                            />
                          ) : (
                            <div className="flex items-center text-indigo-600 font-black font-mono px-4 py-2 bg-indigo-50 rounded-xl">
                              {selectedTenantForDetail.code || '---'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Owner / Penanggung Jawab</label>
                        {isEditingTenant ? (
                          <input
                            type="text"
                            value={tenantFormData.ownerName || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, ownerName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Nama Lengkap Owner"
                          />
                        ) : (
                          <div className="flex items-center text-gray-900 font-medium">
                            <Users className="w-4 h-4 mr-2 text-gray-400" />
                            {selectedTenantForDetail.ownerName || '-'}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Bisnis</label>
                          {isEditingTenant ? (
                            <input
                              type="email"
                              value={tenantFormData.email || ''}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, email: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="email@bisnis.com"
                            />
                          ) : (
                            <div className="flex items-center text-gray-900 font-medium">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {selectedTenantForDetail.email || '-'}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nomor Telepon/WA</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              value={tenantFormData.phone || ''}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, phone: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="0812..."
                            />
                          ) : (
                            <div className="flex items-center text-gray-900 font-medium">
                              <Phone className="w-4 h-4 mr-2 text-gray-400" />
                              {selectedTenantForDetail.phone || '-'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap</label>
                        {isEditingTenant ? (
                          <textarea
                            value={tenantFormData.address || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                            placeholder="Alamat Kantor / Toko"
                          />
                        ) : (
                          <div className="flex items-start text-gray-900 font-medium">
                            <MapPin className="w-4 h-4 mr-2 text-gray-400 mt-1" />
                            <span className="flex-1">{selectedTenantForDetail.address || '-'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Business & Cooperation */}
                  <div className="space-y-6">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
                      Detail Bisnis & Kerja Sama
                    </h4>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jenis Usaha</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              value={tenantFormData.businessType || ''}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, businessType: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="Retail, Jasa, Kuliner, dll"
                            />
                          ) : (
                            <div className="flex items-center text-gray-900 font-medium">
                              <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                              {selectedTenantForDetail.businessType || '-'}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">NPWP / Tax ID</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              value={tenantFormData.taxId || ''}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, taxId: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="Nomor NPWP"
                            />
                          ) : (
                            <div className="flex items-center text-gray-900 font-medium">
                              <FileText className="w-4 h-4 mr-2 text-gray-400" />
                              {selectedTenantForDetail.taxId || '-'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status Kerja Sama</label>
                          {isEditingTenant ? (
                            <select
                              value={tenantFormData.cooperationStatus || 'pending'}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, cooperationStatus: e.target.value as any })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                              <option value="trial">Masa Percobaan (Trial)</option>
                              <option value="pending">Menunggu (Pending)</option>
                              <option value="active">Aktif (Active)</option>
                              <option value="ended">Berakhir (Ended)</option>
                            </select>
                          ) : (
                            <div className="flex items-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                selectedTenantForDetail.cooperationStatus === 'active' ? 'bg-green-100 text-green-700' :
                                selectedTenantForDetail.cooperationStatus === 'trial' ? 'bg-blue-100 text-blue-700' :
                                selectedTenantForDetail.cooperationStatus === 'ended' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {selectedTenantForDetail.cooperationStatus || 'PENDING'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tanggal Mulai</label>
                          {isEditingTenant ? (
                            <input
                              type="date"
                              value={tenantFormData.cooperationStartDate ? new Date(tenantFormData.cooperationStartDate.seconds * 1000).toISOString().split('T')[0] : ''}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, cooperationStartDate: Timestamp.fromDate(new Date(e.target.value)) })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          ) : (
                            <div className="flex items-center text-gray-900 font-medium">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {selectedTenantForDetail.cooperationStartDate ? new Date(selectedTenantForDetail.cooperationStartDate.seconds * 1000).toLocaleDateString('id-ID') : '-'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Catatan Kerja Sama</label>
                        {isEditingTenant ? (
                          <textarea
                            value={tenantFormData.notes || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, notes: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                            placeholder="Catatan khusus, kesepakatan, dll"
                          />
                        ) : (
                          <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 italic">
                            {selectedTenantForDetail.notes || 'Tidak ada catatan.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setSelectedTenantForDetail(null)}
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
