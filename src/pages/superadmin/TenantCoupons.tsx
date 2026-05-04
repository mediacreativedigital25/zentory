import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Ticket, Plus, Save, X, Trash2, Edit2, Loader2, CheckCircle2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'nominal' | 'free_days';
  value: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  notes?: string;
  createdAt: any;
}

export default function TenantCoupons() {
  const { profile } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    type: 'percentage',
    value: 0,
    maxUses: 0,
    isActive: true,
    notes: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const snap = await getDocs(collection(db, 'tenant_coupons'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Coupon));
      setCoupons(data.sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const payload: any = {
        code: formData.code?.toUpperCase().replace(/\s/g, ''),
        type: formData.type,
        value: formData.value,
        maxUses: formData.maxUses || 0,
        isActive: formData.isActive,
        notes: formData.notes || '',
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'tenant_coupons', editingId), payload);
      } else {
        payload.usedCount = 0;
        payload.createdAt = serverTimestamp();
        await setDoc(doc(db, 'tenant_coupons', payload.code), payload);
      }
      
      setIsModalOpen(false);
      fetchCoupons();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tenant_coupons', auth, profile);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus kupon ini?')) return;
    try {
      await deleteDoc(doc(db, 'tenant_coupons', id));
      fetchCoupons();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tenant_coupons', auth, profile);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tenant_coupons', id), { isActive: !currentStatus });
      fetchCoupons();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tenant_coupons', auth, profile);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Ticket className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Kupon Diskon Tenant</h1>
            <p className="text-sm text-gray-500 font-medium">Kelola kupon pendaftaran atau upgrade paket tenant</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData({ code: '', type: 'percentage', value: 0, maxUses: 0, isActive: true, notes: '' });
            setEditingId(null);
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          Buat Kupon
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="px-6 py-4">Kode Kupon</th>
                <th className="px-6 py-4">Tipe & Nilai</th>
                <th className="px-6 py-4">Penggunaan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Keterangan</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Memuat...</td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Belum ada kupon</td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                        {coupon.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">
                        {coupon.type === 'percentage' ? `${coupon.value}% Diskon` :
                         coupon.type === 'nominal' ? `Rp ${coupon.value.toLocaleString('id-ID')} Diskon` :
                         `Free ${coupon.value} Hari`}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-600">
                      {coupon.usedCount} {coupon.maxUses ? `/ ${coupon.maxUses}` : ' (unlimited)'}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(coupon.id, coupon.isActive)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {coupon.isActive ? 'AKTIF' : 'NONAKTIF'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {coupon.notes || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setFormData(coupon);
                            setEditingId(coupon.id);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <Ticket className="w-5 h-5 mr-2 text-indigo-600" />
                  {editingId ? 'Edit Kupon' : 'Buat Kupon Baru'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Kode Kupon</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    disabled={!!editingId}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase font-mono font-bold"
                    placeholder="Contoh: PROMO100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tipe</label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="percentage">Diskon Persentase (%)</option>
                      <option value="nominal">Diskon Nominal (Rp)</option>
                      <option value="free_days">Gratis Hari</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nilai</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.value || ''}
                      onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      placeholder="Contoh: 10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Maksimal Penggunaan (0 untuk unlimited)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxUses || 0}
                    onChange={e => setFormData({ ...formData, maxUses: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Keterangan (opsional)</label>
                  <input
                    type="text"
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="Promo Kemerdekaan"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center shadow-lg hover:bg-indigo-700 transition"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                    Simpan Kupon
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
