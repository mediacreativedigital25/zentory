import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Plus, Edit2, Trash2, Search, CheckCircle2, XCircle, Info, Zap, Shield, Star, Building2, Sparkles, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import ConfirmModal from '../../components/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';
import { FEATURE_KEYS } from '../../constants/plans';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  menuPermissions?: string[];
  isEnabled: boolean;
  type: 'subscription' | 'addon';
  icon: string;
  createdAt: any;
}

const MENU_GROUPS = [
  {
    name: 'General & Master',
    items: [
      { key: FEATURE_KEYS.DASHBOARD, label: 'Dashboard Utama' },
      { key: FEATURE_KEYS.TENANT_SETTINGS, label: 'Profil Bisnis & Pengaturan' },
      { key: FEATURE_KEYS.CATALOG_EDITOR, label: 'Catalog Editor' },
      { key: FEATURE_KEYS.MASTER_USERS, label: 'Master Users' },
      { key: FEATURE_KEYS.MASTER_ROLES, label: 'Master Roles' },
      { key: FEATURE_KEYS.APPROVALS, label: 'Persetujuan / Approvals' },
      { key: FEATURE_KEYS.CUSTOM_DOMAIN, label: 'Custom Domain' },
    ]
  },
  {
    name: 'Sales & Penjualan',
    items: [
      { key: FEATURE_KEYS.SALES_ORDER, label: 'Sales Order & POS' },
      { key: FEATURE_KEYS.SALES_RECEIVE, label: 'Sales Order Receive' },
      { key: FEATURE_KEYS.SALES_CUSTOMERS, label: 'Database Customers' },
    ]
  },
  {
    name: 'Inventory & Gudang',
    items: [
      { key: FEATURE_KEYS.INVENTORY_PRODUCTS, label: 'Daftar Produk & Riwayat' },
      { key: FEATURE_KEYS.INVENTORY_CATEGORIES, label: 'Kategori Produk' },
      { key: FEATURE_KEYS.INVENTORY_STOCK, label: 'Stock Produk' },
      { key: FEATURE_KEYS.INVENTORY_WAREHOUSES, label: 'Manajemen Gudang' },
      { key: FEATURE_KEYS.MULTI_WAREHOUSE, label: 'Multi Warehouse' },
      { key: FEATURE_KEYS.INVENTORY_REPORT, label: 'Laporan Inventory' },
      { key: FEATURE_KEYS.INVENTORY_STOCK_OPNAME, label: 'Stock Opname' },
    ]
  },
  {
    name: 'Purchase & Pembelian',
    items: [
      { key: FEATURE_KEYS.PURCHASE_SUPPLIERS, label: 'Database Supplier' },
      { key: FEATURE_KEYS.PURCHASE_REQUESTS, label: 'Purchase Request (PR)' },
      { key: FEATURE_KEYS.PURCHASE_ORDERS, label: 'Purchase Order (PO)' },
      { key: FEATURE_KEYS.PURCHASE_GOODS_RECEIPTS, label: 'Goods Receipt' },
      { key: FEATURE_KEYS.PURCHASE_INVOICES, label: 'Purchase Invoice' },
    ]
  },
  {
    name: 'Finance & Keuangan',
    items: [
      { key: FEATURE_KEYS.FINANCE_INVOICES, label: 'Invoice Penjualan' },
      { key: FEATURE_KEYS.FINANCE_REPORT, label: 'Report Keuangan' },
      { key: FEATURE_KEYS.FINANCE_CLAIM, label: 'Claim Expense' },
      { key: FEATURE_KEYS.FINANCE_SETTINGS, label: 'Settings Finance' },
      { key: FEATURE_KEYS.FINANCE_BANK_ACCOUNTS, label: 'Akun Bank' },
      { key: FEATURE_KEYS.FINANCE_CHARITY, label: 'Modul Amal / Charity' },
      { key: FEATURE_KEYS.DAILY_SETTLEMENT, label: 'Daily Settlement' },
    ]
  }
];

export default function ServiceTenant() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; serviceId: string | null }>({ isOpen: false, serviceId: null });

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    features: [''],
    menuPermissions: [] as string[],
    isEnabled: true,
    type: 'subscription' as 'subscription' | 'addon',
    icon: 'Zap'
  });

  const fetchServices = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'system_services'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
      setServices(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description,
        price: service.price,
        features: service.features.length > 0 ? service.features : [''],
        menuPermissions: service.menuPermissions || [],
        isEnabled: service.isEnabled,
        type: service.type,
        icon: service.icon
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        features: [''],
        menuPermissions: [],
        isEnabled: true,
        type: 'subscription',
        icon: 'Zap'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        features: formData.features.filter(f => f.trim() !== ''),
        updatedAt: serverTimestamp()
      };

      if (editingService) {
        await updateDoc(doc(db, 'system_services', editingService.id), data);
      } else {
        await addDoc(collection(db, 'system_services'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system_services', auth, profile);
    }
  };

  const handleDelete = async () => {
    if (!confirmModal.serviceId) return;
    try {
      await deleteDoc(doc(db, 'system_services', confirmModal.serviceId));
      setConfirmModal({ isOpen: false, serviceId: null });
      fetchServices();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `system_services/${confirmModal.serviceId}`, auth, profile);
    }
  };

  const addFeature = () => setFormData(prev => ({ ...prev, features: [...prev.features, ''] }));
  const removeFeature = (index: number) => setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  const updateFeature = (index: number, val: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = val;
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const toggleMenuPermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      menuPermissions: prev.menuPermissions.includes(key)
        ? prev.menuPermissions.filter(k => k !== key)
        : [...prev.menuPermissions, key]
    }));
  };

  const selectAllPermissions = () => {
    const allKeys = MENU_GROUPS.flatMap(g => g.items.map(i => i.key));
    setFormData(prev => ({ ...prev, menuPermissions: allKeys }));
  };

  const deselectAllPermissions = () => {
    setFormData(prev => ({ ...prev, menuPermissions: [] }));
  };

  const icons = [
    { name: 'Zap', icon: Zap },
    { name: 'Shield', icon: Shield },
    { name: 'Star', icon: Star },
    { name: 'Building2', icon: Building2 },
    { name: 'Sparkles', icon: Sparkles }
  ];

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Tenant</h2>
          <p className="text-gray-500">Kelola daftar layanan dan paket langganan sistem.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Layanan
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari layanan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">Layanan</th>
                <th className="px-6 py-4">Tipe</th>
                <th className="px-6 py-4">Harga</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Memuat data layanan...</td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Zap className="w-12 h-12 text-gray-200 mb-4" />
                      <p className="text-gray-500 font-medium">Belum ada layanan yang ditambahkan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                          {React.createElement(icons.find(i => i.name === service.icon)?.icon || Zap, { className: 'w-5 h-5' })}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{service.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{service.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                        service.type === 'subscription' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {service.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-gray-900">
                      Rp{service.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {service.isEnabled ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" /> Aktif
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                          <XCircle className="w-4 h-4" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(service)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, serviceId: service.id })}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  {editingService ? 'Edit Layanan' : 'Tambah Layanan Baru'}
                </h3>
              </div>
              
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Nama Layanan</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Icon</label>
                    <div className="flex gap-2">
                      {icons.map(item => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, icon: item.name }))}
                          className={`p-3 rounded-xl border-2 transition-all ${
                            formData.icon === item.name ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 text-gray-400 hover:border-gray-200'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Harga (Rp)</label>
                    <input
                      required
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Tipe</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    >
                      <option value="subscription">Subscription (Paket)</option>
                      <option value="addon">Add-on (Tambahan)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Deskripsi Singkat</label>
                  <textarea
                    required
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Fitur & Keunggulan</label>
                    <button
                      type="button"
                      onClick={addFeature}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      + Tambah Fitur
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => updateFeature(index, e.target.value)}
                          placeholder="Contoh: Unlimited Produk"
                          className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <div>
                      <h4 className="text-sm font-black text-gray-900">Hak Akses Modul & Fitur</h4>
                      <p className="text-[10px] text-gray-500 font-medium">Pilih modul apa saja yang dapat diakses oleh tenant di paket ini.</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPermissions} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded">Pilih Semua</button>
                      <button type="button" onClick={deselectAllPermissions} className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 px-2 py-1 rounded">Hapus Semua</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MENU_GROUPS.map((group, groupIdx) => (
                      <div key={groupIdx} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 font-black text-gray-700 text-xs uppercase tracking-wider">
                          {group.name}
                        </div>
                        <div className="p-3 divide-y divide-gray-50">
                          {group.items.map((item, itemIdx) => (
                            <label key={itemIdx} className="flex items-center gap-3 py-2 cursor-pointer group">
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={formData.menuPermissions.includes(item.key)}
                                  onChange={() => toggleMenuPermission(item.key)}
                                />
                                <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 flex items-center justify-center transition-colors">
                                  <CheckSquare className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" />
                                </div>
                              </div>
                              <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <input
                    type="checkbox"
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 rounded-lg border-gray-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="isEnabled" className="text-sm font-bold text-indigo-900 cursor-pointer">
                    Aktifkan Layanan (Akan muncul di halaman pilihan paket untuk tenant)
                  </label>
                </div>
              </form>

              <div className="p-8 border-t border-gray-100 bg-gray-50 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 border border-gray-200 bg-white rounded-2xl font-black text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  BATAL
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-black shadow-xl active:scale-95 transition-all"
                >
                  SIMPAN LAYANAN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Hapus Layanan"
        message="Apakah Anda yakin ingin menghapus layanan ini? Tindakan ini tidak dapat dibatalkan."
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmModal({ isOpen: false, serviceId: null })}
      />
    </div>
  );
}
