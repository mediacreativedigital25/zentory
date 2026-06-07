import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Tenant, SubscriptionPlan } from '../../types';
import { Building2, Search, RefreshCcw, Eye, X, Save, Phone, Mail, MapPin, Briefcase, Plus, Trash2, ListChecks, LayoutDashboard, CheckCircle2, ShoppingCart, TrendingUp, Package, Truck, Wallet, Calculator, Settings, Store, ShieldCheck, History, BookOpen, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { PLANS } from '../../constants/plans';
import ConfirmModal from '../../components/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';

const AVAILABLE_MENUS = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Approval', icon: CheckCircle2 },
  { label: 'Marketplace V1', icon: Store },
  { 
    label: 'Sales', 
    icon: ShoppingCart,
    children: [
      { label: 'Sales Booking' },
      { label: 'Booking List' },
      { label: 'Sales Order V1' },
      { label: 'Sales Order' },
      { label: 'Sales POS' },
      { label: 'Sales Order Receive' },
      { label: 'Kupon' },
      { label: 'Customers' },
      { label: 'Tipe Pelanggan' },
      { label: 'Review Produk' },
    ]
  },
  { 
    label: 'Sales Analisis', 
    icon: TrendingUp,
    children: [
      { label: 'Setting Target' },
      { label: 'Pencapaian' },
      { label: 'Operational Cost Ratio' },
    ]
  },
  { 
    label: 'Inventory', 
    icon: Package,
    children: [
      { label: 'Daftar Produk' },
      { label: 'Riwayat Produk' },
      { label: 'Kategori' },
      { label: 'Lini Bisnis' },
      { label: 'Stock' },
      { label: 'Gudang' },
      { label: 'Report Inventory' },
      { label: 'Stock Opname' },
    ]
  },
  { 
    label: 'Purchase', 
    icon: Truck,
    children: [
      { label: 'Purchase Request (PR)' },
      { label: 'Purchase Order (PO)' },
      { label: 'Goods Receipt' },
      { label: 'Purchase Invoice' },
      { label: 'Supplier' },
    ]
  },
  { 
    label: 'Finance', 
    icon: Wallet,
    children: [
      { label: 'Invoice' },
      { label: 'Receive Payment' },
      { label: 'Invoice Collection' },
      { label: 'Tabungan Pelanggan' },
      { label: 'Akun Bank' },
      { label: 'Transfer Kas/Bank' },
      { label: 'Claim Expense' },
      { label: 'Amal' },
      { label: 'Report Keuangan' },
      { label: 'Setting Claim Expense' },
    ]
  },
  { label: 'Daily Settlement', icon: Calculator },
  { 
    label: 'Master', 
    icon: Settings,
    children: [
      { label: 'Tambah User' },
      { label: 'Tambah Role' },
    ]
  },
  { label: 'Catalog Editor', icon: Store },
  { 
    label: 'Setting', 
    icon: Settings,
    children: [
      { label: 'Profil Bisnis' },
      { label: 'Payment Metode' },
      { label: 'Alamat Toko' },
    ]
  },
  { 
    label: 'Paket & Upgrade', 
    icon: ShieldCheck, 
    children: [
      { label: 'Pilih Paket' }, 
      { label: 'Invoice Transaksi' }, 
      { label: 'Layanan Saya' }
    ] 
  },
  { label: 'Changelog', icon: History },
  { label: 'Panduan', icon: BookOpen }
];

export default function SuperAdminTenants() {
  const { profile } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [selectedTenantForDetail, setSelectedTenantForDetail] = useState<Tenant | null>(null);
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tenantFormData, setTenantFormData] = useState<Partial<Tenant>>({});
  const [newTenantData, setNewTenantData] = useState({
    name: '',
    slug: '',
    ownerId: '',
    subscription: 'free' as SubscriptionPlan,
    subscriptionEndDate: '',
    catalogTheme: 'v1'
  });
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; showCancel?: boolean } | null>(null);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const tenantSnap = await getDocs(query(collection(db, 'tenants'), orderBy('createdAt', 'desc')));
        setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'tenants', auth, profile);
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, [profile]);

  const updateSubscription = async (tenantId: string, plan: SubscriptionPlan) => {
    const planDef = PLANS[plan];
    try {
      await updateDoc(doc(db, 'tenants', tenantId), { 
        subscription: plan,
        plan: plan,
        features: planDef.features,
        limits: planDef.limits,
        updatedAt: serverTimestamp()
      });
      setTenants(tenants.map(t => t.id === tenantId ? { 
        ...t, 
        subscription: plan,
        plan: plan,
        features: planDef.features,
        limits: planDef.limits
      } : t));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}`, auth, profile);
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
      handleFirestoreError(err, OperationType.UPDATE, 'tenants_batch_update', auth, profile);
    } finally {
      setIsGeneratingCodes(false);
    }
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
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${selectedTenantForDetail.id}`, auth, profile);
    }
  };

  const handleAddTenant = async () => {
    if (!newTenantData.name || !newTenantData.slug) {
      alert('Nama dan Slug wajib diisi');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Tambah Tenant',
      message: `Apakah Anda yakin ingin menambah tenant "${newTenantData.name}"?`,
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          // Generate 3-character code
          const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          let tenantCode = '';
          for (let i = 0; i < 3; i++) {
            tenantCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }

          const planDef = PLANS[newTenantData.subscription];
          
          const docRef = await addDoc(collection(db, 'tenants'), {
            name: newTenantData.name,
            slug: newTenantData.slug.toLowerCase().replace(/\s+/g, '-'),
            code: tenantCode,
            ownerId: newTenantData.ownerId,
            subscription: newTenantData.subscription,
            plan: newTenantData.subscription,
            features: planDef.features,
            limits: planDef.limits,
            catalogTheme: newTenantData.catalogTheme,
            subscriptionEndDate: newTenantData.subscriptionEndDate ? new Date(newTenantData.subscriptionEndDate) : null,
            createdAt: serverTimestamp(),
          });

          const createdTenant = {
            id: docRef.id,
            name: newTenantData.name,
            slug: newTenantData.slug,
            code: tenantCode,
            ownerId: newTenantData.ownerId,
            subscription: newTenantData.subscription,
            createdAt: { seconds: Math.floor(Date.now() / 1000) } // Mock for UI
          };

          setTenants([createdTenant as Tenant, ...tenants]);
          setIsAddModalOpen(false);
          setNewTenantData({
            name: '',
            slug: '',
            ownerId: '',
            subscription: 'free' as SubscriptionPlan,
            subscriptionEndDate: '',
            catalogTheme: 'v1'
          });

          setConfirmConfig({
            isOpen: true,
            title: 'Berhasil',
            message: 'Tenant berhasil ditambahkan secara manual.',
            onConfirm: () => setConfirmConfig(null),
            showCancel: false
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'tenants', auth, profile);
        }
      }
    });
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Tenant',
      message: `Apakah Anda yakin ingin menghapus tenant "${tenant.name}"? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          await deleteDoc(doc(db, 'tenants', tenant.id));
          setTenants(tenants.filter(t => t.id !== tenant.id));
          
          setConfirmConfig({
            isOpen: true,
            title: 'Berhasil',
            message: 'Tenant berhasil dihapus.',
            onConfirm: () => setConfirmConfig(null),
            showCancel: false
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `tenants/${tenant.id}`, auth, profile);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tenant Management</h2>
          <p className="text-gray-500">Manage all businesses registered in the system.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Tenant Manual
        </button>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">Tenants</h3>
            <button
              onClick={generateMissingCodes}
              disabled={isGeneratingCodes}
              className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50"
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
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
                <th className="px-6 py-4 font-medium">Expiry Date</th>
                <th className="px-6 py-4 font-medium">Created At</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Memuat data tenant...</td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Belum ada tenant.</td>
                </tr>
              ) : (
                tenants
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
                        value={tenant.plan || tenant.subscription || 'free'}
                        onChange={(e) => updateSubscription(tenant.id, e.target.value as SubscriptionPlan)}
                        className={`text-[10px] font-black px-3 py-1 rounded-full outline-none border-none uppercase tracking-widest ${
                          PLANS[tenant.plan || tenant.subscription || 'free']?.color || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {Object.values(PLANS).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {tenant.subscriptionEndDate ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                          new Date(tenant.subscriptionEndDate.seconds * 1000) < new Date() 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {new Date(tenant.subscriptionEndDate.seconds * 1000).toLocaleDateString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 capitalize">No limit</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tenant.createdAt ? new Date(tenant.createdAt?.seconds * 1000).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => {
                            setSelectedTenantForDetail(tenant);
                            setTenantFormData(tenant);
                            setIsEditingTenant(false);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 text-xs font-bold flex items-center bg-indigo-50 px-2 py-1 rounded"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </button>
                        <button 
                          onClick={() => handleDeleteTenant(tenant)}
                          className="text-red-600 hover:text-red-900 text-xs font-bold flex items-center bg-red-50 px-2 py-1 rounded"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant Detail Modal */}
      <AnimatePresence>
        {selectedTenantForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-md shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div className="flex items-center">
                  <Building2 className="w-6 h-6 mr-3" />
                  <div>
                    <h3 className="text-xl font-bold">{selectedTenantForDetail.name}</h3>
                    <p className="text-indigo-100 text-sm">Tenant ID: {selectedTenantForDetail.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTenantForDetail(null)}
                  className="p-2 hover:bg-white/10 rounded-md transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-gray-900 flex items-center">
                        <Briefcase className="w-4 h-4 mr-2 text-indigo-600" />
                        Informasi Bisnis
                      </h4>
                      <button
                        onClick={() => setIsEditingTenant(!isEditingTenant)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        {isEditingTenant ? 'Batal Edit' : 'Edit Data'}
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Bisnis</label>
                        {isEditingTenant ? (
                          <input
                            type="text"
                            value={tenantFormData.name || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, name: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">{selectedTenantForDetail.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-600">Slug / URL</label>
                        <p className="text-gray-600">zentory.app/catalog/{selectedTenantForDetail.slug}</p>
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-600">Alamat</label>
                        {isEditingTenant ? (
                          <textarea
                            value={tenantFormData.address || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, address: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 h-20"
                          />
                        ) : (
                          <p className="text-gray-600 flex items-start">
                            <MapPin className="w-4 h-4 mr-2 mt-1 flex-shrink-0" />
                            {selectedTenantForDetail.address || 'Belum diatur'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-600">Masa Aktif</label>
                        {isEditingTenant ? (
                          <input
                            type="date"
                            value={tenantFormData.subscriptionEndDate ? 
                              new Date(tenantFormData.subscriptionEndDate.seconds ? tenantFormData.subscriptionEndDate.seconds * 1000 : tenantFormData.subscriptionEndDate).toISOString().split('T')[0] : 
                              ''
                            }
                            onChange={(e) => setTenantFormData({ 
                              ...tenantFormData, 
                              subscriptionEndDate: e.target.value ? new Date(e.target.value) : null 
                            })}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className={`font-black text-sm ${
                            selectedTenantForDetail.subscriptionEndDate && new Date(selectedTenantForDetail.subscriptionEndDate.seconds * 1000) < new Date()
                              ? 'text-red-600'
                              : 'text-indigo-600'
                          }`}>
                            {selectedTenantForDetail.subscriptionEndDate 
                              ? new Date(selectedTenantForDetail.subscriptionEndDate.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                              : 'Tanpa Batas'}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-gray-600">Siklus</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              value={tenantFormData.billingCycle || ''}
                              placeholder="e.g. 30 Hari"
                              onChange={(e) => setTenantFormData({ ...tenantFormData, billingCycle: e.target.value })}
                              className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium">{selectedTenantForDetail.billingCycle || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-gray-600">Metode Bayar</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              value={tenantFormData.lastPaymentMethod || ''}
                              placeholder="e.g. QRIS"
                              onChange={(e) => setTenantFormData({ ...tenantFormData, lastPaymentMethod: e.target.value })}
                              className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium">{selectedTenantForDetail.lastPaymentMethod || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-gray-600">Tema Katalog</label>
                          {isEditingTenant ? (
                            <select
                              value={tenantFormData.catalogTheme || 'default'}
                              onChange={(e) => setTenantFormData({ ...tenantFormData, catalogTheme: e.target.value })}
                              className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="default">Default</option>
                              <option value="v1">Tema V1 (Katalog)</option>
                              <option value="booking-v1">Tema Booking V1</option>
                            </select>
                          ) : (
                            <p className="text-gray-900 font-medium">
                              {selectedTenantForDetail.catalogTheme === 'v1' ? 'Tema V1 (Katalog)' : selectedTenantForDetail.catalogTheme === 'booking-v1' ? 'Tema Booking V1' : 'Default'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-6">
                    <h4 className="font-bold text-gray-900 flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-indigo-600" />
                      Kontak & Media
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-600">WhatsApp</label>
                        {isEditingTenant ? (
                          <input
                            type="text"
                            value={tenantFormData.phone || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, phone: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className="text-gray-600 flex items-center">
                            <Phone className="w-4 h-4 mr-2" />
                            {selectedTenantForDetail.phone || selectedTenantForDetail.whatsapp || 'Belum diatur'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-600">Email</label>
                        {isEditingTenant ? (
                          <input
                            type="email"
                            value={tenantFormData.email || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, email: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className="text-gray-600 flex items-center">
                            <Mail className="w-4 h-4 mr-2" />
                            {selectedTenantForDetail.email || 'Belum diatur'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Access Settings */}
                <div className="mt-12 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-gray-900 flex items-center">
                      <ListChecks className="w-5 h-5 mr-2 text-indigo-600" />
                      Custom Menu Access
                    </h4>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          const allEnabled: Record<string, any> = {};
                          AVAILABLE_MENUS.forEach(menu => {
                            allEnabled[menu.label] = true;
                            if (menu.children) {
                              menu.children.forEach(child => {
                                allEnabled[`${menu.label}_${child.label}`] = true;
                              });
                            }
                          });
                          setTenantFormData({ ...tenantFormData, menuSettings: allEnabled });
                          if (!isEditingTenant) setIsEditingTenant(true);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        Aktifkan Semua
                      </button>
                      <button
                        onClick={() => {
                          const allDisabled: Record<string, any> = {};
                          AVAILABLE_MENUS.forEach(menu => {
                            allDisabled[menu.label] = false;
                            if (menu.children) {
                              menu.children.forEach(child => {
                                allDisabled[`${menu.label}_${child.label}`] = false;
                              });
                            }
                          });
                          setTenantFormData({ ...tenantFormData, menuSettings: allDisabled });
                          if (!isEditingTenant) setIsEditingTenant(true);
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-700"
                      >
                        Matikan Semua
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {AVAILABLE_MENUS.map((menu) => {
                      const isEnabled = tenantFormData.menuSettings?.[menu.label] !== false;
                      const hasSubMenus = menu.children && menu.children.length > 0;
                      
                      return (
                        <div key={menu.label} className="bg-white border-2 border-gray-100 rounded-md overflow-hidden transition-all">
                          <div className={`p-4 flex items-center justify-between ${isEnabled ? 'bg-indigo-50/50' : 'bg-gray-50/50'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-md ${isEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                <menu.icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${isEnabled ? 'text-gray-900' : 'text-gray-400'}`}>{menu.label}</p>
                                {hasSubMenus && (
                                  <p className="text-[10px] text-gray-400 font-medium">
                                    {menu.children?.length} Sub Menu tersedia
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const currentSettings = tenantFormData.menuSettings || {};
                                const newEnabled = !isEnabled;
                                const newSettings = { ...currentSettings, [menu.label]: newEnabled };
                                
                                // If disabling parent, disable all children? Or just leave them?
                                // Let's disable children too if parent is disabled for better UX
                                if (menu.children && !newEnabled) {
                                  menu.children.forEach(child => {
                                    newSettings[`${menu.label}_${child.label}`] = false;
                                  });
                                } else if (menu.children && newEnabled) {
                                  // Enable all children if parent is enabled? Maybe better to keep previous state but at least parent must be true
                                  menu.children.forEach(child => {
                                    newSettings[`${menu.label}_${child.label}`] = true;
                                  });
                                }

                                setTenantFormData({ ...tenantFormData, menuSettings: newSettings });
                                if (!isEditingTenant) setIsEditingTenant(true);
                              }}
                              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                isEnabled 
                                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' 
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {isEnabled ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </div>

                          {isEnabled && hasSubMenus && (
                            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white">
                              {menu.children?.map((child) => {
                                const childKey = `${menu.label}_${child.label}`;
                                const isChildEnabled = tenantFormData.menuSettings?.[childKey] !== false;
                                
                                return (
                                  <button
                                    key={child.label}
                                    onClick={() => {
                                      const currentSettings = tenantFormData.menuSettings || {};
                                      setTenantFormData({
                                        ...tenantFormData,
                                        menuSettings: {
                                          ...currentSettings,
                                          [childKey]: !isChildEnabled
                                        }
                                      });
                                      if (!isEditingTenant) setIsEditingTenant(true);
                                    }}
                                    className={`flex items-center justify-between p-2.5 rounded-md border transition-all ${
                                      isChildEnabled 
                                        ? 'bg-white border-indigo-200 text-indigo-700 shadow-sm' 
                                        : 'bg-gray-50 border-gray-100 text-gray-400 opacity-60'
                                    }`}
                                  >
                                    <span className="text-[11px] font-bold text-left">{child.label}</span>
                                    {isChildEnabled ? (
                                      <CheckCircle2 className="w-3 h-3 fill-indigo-600 text-white shrink-0 ml-2" />
                                    ) : (
                                      <div className="w-3 h-3 rounded-full border border-gray-300 shrink-0 ml-2" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[10px] text-gray-400 italic">
                    * Menu yang dinonaktifkan tidak akan muncul pada sidebar tenant terkait, terlepas dari role user.
                  </p>
                </div>
              </div>

              {(isEditingTenant || tenantFormData.menuSettings !== selectedTenantForDetail.menuSettings) && (
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-4">
                  <button
                    onClick={() => setIsEditingTenant(false)}
                    className="px-6 py-2 text-gray-600 font-bold hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveTenantDetails}
                    className="px-8 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Simpan Perubahan
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Tenant Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-md shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div className="flex items-center">
                  <Plus className="w-6 h-6 mr-3" />
                  <h3 className="text-xl font-bold">Add Tenant Manual</h3>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-md transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4" flex-1 overflow-y-auto auto-rows-max>
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Business Name</label>
                  <input
                    type="text"
                    value={newTenantData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/\s+/g, '-');
                      setNewTenantData({ ...newTenantData, name, slug });
                    }}
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. My Awesome Shop"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Slug / URL Identifier</label>
                  <input
                    type="text"
                    value={newTenantData.slug}
                    onChange={(e) => setNewTenantData({ ...newTenantData, slug: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="e.g. awesome-shop"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Owner User ID (UID)</label>
                  <input
                    type="text"
                    value={newTenantData.ownerId}
                    onChange={(e) => setNewTenantData({ ...newTenantData, ownerId: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="User UID from Auth"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Leave blank if you want to assign it later or create user separately.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Plan</label>
                    <select
                      value={newTenantData.subscription}
                      onChange={(e) => setNewTenantData({ ...newTenantData, subscription: e.target.value as SubscriptionPlan })}
                      className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {Object.values(PLANS).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Jenis Sistem</label>
                    <select
                      value={newTenantData.catalogTheme}
                      onChange={(e) => setNewTenantData({ ...newTenantData, catalogTheme: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="v1">Sistem Marketplace</option>
                      <option value="booking-v1">Sistem Booking</option>
                      <option value="default">Default Katalog</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Expiry Date</label>
                  <input
                    type="date"
                    value={newTenantData.subscriptionEndDate}
                    onChange={(e) => setNewTenantData({ ...newTenantData, subscriptionEndDate: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-4">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-6 py-2 text-gray-600 font-bold hover:text-gray-900"
                >
                  Batal
                </button>
                <button
                  onClick={handleAddTenant}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center"
                >
                  Create Tenant
                </button>
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
          showCancel={confirmConfig.showCancel}
        />
      )}
    </div>
  );
}
