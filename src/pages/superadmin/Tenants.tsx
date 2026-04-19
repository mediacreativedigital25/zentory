import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Tenant, SubscriptionPlan } from '../../types';
import { Building2, Search, RefreshCcw, Eye, X, Save, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { PLANS } from '../../constants/plans';
import ConfirmModal from '../../components/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';

export default function SuperAdminTenants() {
  const { profile } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [selectedTenantForDetail, setSelectedTenantForDetail] = useState<Tenant | null>(null);
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [tenantFormData, setTenantFormData] = useState<Partial<Tenant>>({});
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tenant Management</h2>
          <p className="text-gray-500">Manage all businesses registered in the system.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">Tenants</h3>
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
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
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
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
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nama Bisnis</label>
                        {isEditingTenant ? (
                          <input
                            type="text"
                            value={tenantFormData.name || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">{selectedTenantForDetail.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Slug / URL</label>
                        <p className="text-gray-600">zentory.app/catalog/{selectedTenantForDetail.slug}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Alamat</label>
                        {isEditingTenant ? (
                          <textarea
                            value={tenantFormData.address || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-20"
                          />
                        ) : (
                          <p className="text-gray-600 flex items-start">
                            <MapPin className="w-4 h-4 mr-2 mt-1 flex-shrink-0" />
                            {selectedTenantForDetail.address || 'Belum diatur'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Masa Aktif</label>
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
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
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
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Siklus</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              value={tenantFormData.billingCycle || ''}
                              placeholder="e.g. 30 Hari"
                              onChange={(e) => setTenantFormData({ ...tenantFormData, billingCycle: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium">{selectedTenantForDetail.billingCycle || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Metode Bayar</label>
                          {isEditingTenant ? (
                            <input
                              type="text"
                              value={tenantFormData.lastPaymentMethod || ''}
                              placeholder="e.g. QRIS"
                              onChange={(e) => setTenantFormData({ ...tenantFormData, lastPaymentMethod: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium">{selectedTenantForDetail.lastPaymentMethod || '-'}</p>
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
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">WhatsApp</label>
                        {isEditingTenant ? (
                          <input
                            type="text"
                            value={tenantFormData.whatsapp || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, whatsapp: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className="text-gray-600 flex items-center">
                            <Phone className="w-4 h-4 mr-2" />
                            {selectedTenantForDetail.whatsapp || 'Belum diatur'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                        {isEditingTenant ? (
                          <input
                            type="email"
                            value={tenantFormData.email || ''}
                            onChange={(e) => setTenantFormData({ ...tenantFormData, email: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
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
              </div>

              {isEditingTenant && (
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-4">
                  <button
                    onClick={() => setIsEditingTenant(false)}
                    className="px-6 py-2 text-gray-600 font-bold hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveTenantDetails}
                    className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center"
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
