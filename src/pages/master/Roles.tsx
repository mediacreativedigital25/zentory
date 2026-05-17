import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types';
import { Shield, Plus, X, Edit2, Trash2, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

const FEATURES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sales_order', label: 'Sales: Sales Order' },
  { id: 'sales_receive', label: 'Sales: Sales Order Receive' },
  { id: 'sales_customers', label: 'Sales: Customers' },
  { id: 'inventory_products', label: 'Inventory: Produk' },
  { id: 'inventory_categories', label: 'Inventory: Kategori' },
  { id: 'inventory_stock', label: 'Inventory: Stock' },
  { id: 'inventory_warehouses', label: 'Inventory: Gudang' },
  { id: 'inventory_report', label: 'Inventory: Report Inventory' },
  { id: 'inventory_stock_opname', label: 'Inventory: Stock Opname' },
  { id: 'finance_claim', label: 'Finance: Claim Expense' },
  { id: 'finance_bank_accounts', label: 'Finance: Akun Bank' },
  { id: 'finance_charity', label: 'Finance: Amal' },
  { id: 'finance_report', label: 'Finance: Report Keuangan' },
  { id: 'finance_settings', label: 'Finance: Setting Claim Expense' },
  { id: 'daily_settlement', label: 'Daily Settlement' },
  { id: 'purchase_requests', label: 'Purchase: Purchase Request' },
  { id: 'purchase_orders', label: 'Purchase: Purchase Order' },
  { id: 'purchase_goods_receipts', label: 'Purchase: Goods Receipt' },
  { id: 'purchase_invoices', label: 'Purchase: Purchase Invoice' },
  { id: 'purchase_suppliers', label: 'Purchase: Supplier' },
  { id: 'catalog_editor', label: 'Catalog Editor' },
  { id: 'tenant_settings', label: 'Profil Bisnis' },
  { id: 'master_users', label: 'Master: Tambah User' },
  { id: 'master_roles', label: 'Master: Tambah Role' },
  { id: 'changelog', label: 'Changelog' },
  { id: 'guide', label: 'Panduan' },
];

export default function Roles() {
  const { profile, domainTenantId } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[]
  });

  useEffect(() => {
    if (!profile) return;

    // Determine target tenant ID: domain if present, otherwise user's tenant
    const targetTenantId = domainTenantId || profile.tenantId;

    if (!targetTenantId && profile.role !== 'superadmin') {
      setLoading(false);
      return;
    }

    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? query(collection(db, 'roles'))
      : query(collection(db, 'roles'), where('tenantId', '==', targetTenantId));

    const unsubscribe = onSnapshot(q, (snap) => {
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Role)));
      setLoading(false);
    }, (error) => {
      console.error('Roles Snapshot Error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, domainTenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const targetTenantId = domainTenantId || profile.tenantId;
    if (!targetTenantId && profile.role !== 'superadmin') return;

    try {
      if (editingRole) {
        await updateDoc(doc(db, 'roles', editingRole.id), {
          name: formData.name,
          permissions: formData.permissions,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'roles'), {
          tenantId: targetTenantId,
          name: formData.name,
          permissions: formData.permissions,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setFormData({ name: '', permissions: [] });
      setEditingRole(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save role.');
    }
  };

  const togglePermission = (featureId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(featureId)
        ? prev.permissions.filter(p => p !== featureId)
        : [...prev.permissions, featureId]
    }));
  };

  const deleteRole = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Role',
      message: 'Apakah Anda yakin ingin menghapus role ini? User dengan role ini mungkin kehilangan akses.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'roles', id));
          setConfirmConfig(null);
        } catch (err) {
          console.error(err);
          alert('Failed to delete role.');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manajemen Role</h2>
          <p className="text-gray-500">Atur hak akses fitur untuk setiap role di sistem Anda.</p>
        </div>
        <button
          onClick={() => { setEditingRole(null); setFormData({ name: '', permissions: [] }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-white p-6 rounded-md shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-indigo-50 rounded-md mr-3">
                  <Shield className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-bold text-gray-900">{role.name}</h3>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => { setEditingRole(role); setFormData({ name: role.name, permissions: role.permissions }); setIsModalOpen(true); }}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteRole(role.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Permissions ({role.permissions.length})</p>
              <div className="flex flex-wrap gap-2">
                {role.permissions.slice(0, 5).map(p => (
                  <span key={p} className="px-2 py-1 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-md border border-gray-100">
                    {FEATURES.find(f => f.id === p)?.label || p}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="px-2 py-1 bg-gray-50 text-gray-400 text-[10px] font-bold rounded-md border border-gray-100">
                    +{role.permissions.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">{editingRole ? 'Edit Role' : 'Tambah Role Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Nama Role</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Supervisor, Kasir, Warehouse Manager"
                    className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-4 text-xs font-semibold text-gray-600">Pilih Hak Akses Fitur</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FEATURES.map((feature) => (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() => togglePermission(feature.id)}
                        className={`flex items-center p-3 rounded-md border transition-all text-left ${
                          formData.permissions.includes(feature.id)
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        {formData.permissions.includes(feature.id) ? (
                          <CheckSquare className="w-5 h-5 mr-3 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 mr-3 text-gray-300" />
                        )}
                        <span className="text-sm font-medium">{feature.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 border border-gray-200 rounded-md text-gray-600 font-medium hover:bg-gray-100 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                >
                  {editingRole ? 'Update Role' : 'Simpan Role'}
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
        />
      )}
    </div>
  );
}
