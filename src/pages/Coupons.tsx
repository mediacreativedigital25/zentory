import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Plus, Search, Filter, Edit2, Trash2, Tag, Calendar, CheckCircle2, XCircle, Percent, DollarSign, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  startDate: any;
  endDate: any;
  category: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  tenantId: string;
}

interface Category {
  id: string;
  name: string;
}

export default function Coupons() {
  const { profile } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    minPurchase: 0,
    startDate: '',
    endDate: '',
    category: 'all',
    usageLimit: 0,
    isActive: true
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(collection(db, 'coupons'), where('tenantId', '==', profile.tenantId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      setCoupons(data);
      setLoading(false);
    });

    const catQ = query(collection(db, 'categories'), where('tenantId', '==', profile.tenantId));
    const unsubscribeCat = onSnapshot(catQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setCategories(data);
    });

    return () => {
      unsubscribe();
      unsubscribeCat();
    };
  }, [profile?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    const couponData = {
      ...formData,
      tenantId: profile.tenantId,
      usedCount: editingCoupon ? editingCoupon.usedCount : 0,
      createdAt: editingCoupon ? editingCoupon.startDate : serverTimestamp()
    };

    try {
      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), couponData);
      } else {
        // Check if code already exists for this tenant
        const existingQ = query(
          collection(db, 'coupons'), 
          where('tenantId', '==', profile.tenantId),
          where('code', '==', formData.code.toUpperCase())
        );
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
          alert('Kode kupon sudah digunakan!');
          return;
        }
        await addDoc(collection(db, 'coupons'), {
          ...couponData,
          code: formData.code.toUpperCase(),
          usedCount: 0
        });
      }
      setIsModalOpen(false);
      setEditingCoupon(null);
      setFormData({
        code: '',
        type: 'percentage',
        value: 0,
        minPurchase: 0,
        startDate: '',
        endDate: '',
        category: 'all',
        usageLimit: 0,
        isActive: true
      });
    } catch (err) {
      console.error('Error saving coupon:', err);
      alert('Gagal menyimpan kupon.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kupon ini?')) return;
    try {
      await deleteDoc(doc(db, 'coupons', id));
    } catch (err) {
      console.error('Error deleting coupon:', err);
    }
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minPurchase: coupon.minPurchase,
      startDate: coupon.startDate instanceof Date ? coupon.startDate.toISOString().split('T')[0] : coupon.startDate,
      endDate: coupon.endDate instanceof Date ? coupon.endDate.toISOString().split('T')[0] : coupon.endDate,
      category: coupon.category,
      usageLimit: coupon.usageLimit,
      isActive: coupon.isActive
    });
    setIsModalOpen(true);
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Manajemen Kupon</h2>
          <p className="text-sm text-gray-500 font-medium">Kelola diskon dan promosi toko Anda.</p>
        </div>
        <button
          onClick={() => {
            setEditingCoupon(null);
            setFormData({
              code: '',
              type: 'percentage',
              value: 0,
              minPurchase: 0,
              startDate: '',
              endDate: '',
              category: 'all',
              usageLimit: 0,
              isActive: true
            });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Tambah Kupon
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-md border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Kupon</p>
              <p className="text-2xl font-black text-gray-900">{coupons.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-md flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Kupon Aktif</p>
              <p className="text-2xl font-black text-gray-900">{coupons.filter(c => c.isActive).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-md flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Penggunaan</p>
              <p className="text-2xl font-black text-gray-900">{coupons.reduce((acc, curr) => acc + curr.usedCount, 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kode kupon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Kode & Tipe</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nilai Diskon</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Periode</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Kategori</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Penggunaan</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCoupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center font-black">
                        {coupon.type === 'percentage' ? <Percent className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-black text-gray-900 tracking-tight">{coupon.code}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{coupon.type === 'percentage' ? 'Persentase' : 'Potongan Tetap'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-indigo-600">
                      {coupon.type === 'percentage' ? `${coupon.value}%` : `Rp ${coupon.value.toLocaleString()}`}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">Min. Rp {coupon.minPurchase.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {coupon.startDate} - {coupon.endDate}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {coupon.category === 'all' ? 'Semua' : categories.find(c => c.id === coupon.category)?.name || 'Kategori'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-black uppercase">
                        <span className="text-gray-400">Terpakai</span>
                        <span className="text-indigo-600">{coupon.usedCount} / {coupon.usageLimit || '∞'}</span>
                      </div>
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${coupon.usageLimit ? (coupon.usedCount / coupon.usageLimit) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {coupon.isActive ? (
                      <span className="flex items-center gap-1 text-green-600 text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3" /> Aktif
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-[10px] font-black uppercase tracking-widest">
                        <XCircle className="w-3 h-3" /> Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(coupon.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCoupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Tag className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-gray-500 font-bold">Belum ada kupon yang dibuat.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white z-50 rounded-md shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">
                    {editingCoupon ? 'Edit Kupon' : 'Tambah Kupon Baru'}
                  </h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Lengkapi detail promosi di bawah ini.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-md transition-all shadow-sm">
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto auto-rows-max">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Kode Kupon</label>
                    <input
                      required
                      type="text"
                      placeholder="MISAL: DISKON10"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium uppercase outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Tipe Diskon</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="percentage">Persentase (%)</option>
                      <option value="fixed">Potongan Tetap (Rp)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Nilai Diskon</label>
                    <input
                      required
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Min. Pembelian (Rp)</label>
                    <input
                      required
                      type="number"
                      value={formData.minPurchase}
                      onChange={(e) => setFormData({ ...formData, minPurchase: Number(e.target.value) })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Tanggal Mulai</label>
                    <input
                      required
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Tanggal Berakhir</label>
                    <input
                      required
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Kategori Produk</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="all">Semua Kategori</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Limit Penggunaan (0 = ∞)</label>
                    <input
                      type="number"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                      className="w-full p-4 bg-white border border-gray-200 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="cursor-pointer text-xs font-semibold text-gray-600">Aktifkan Kupon Sekarang</label>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-md font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-4 bg-indigo-600 text-white rounded-md font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingCoupon ? 'Simpan Perubahan' : 'Buat Kupon'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
