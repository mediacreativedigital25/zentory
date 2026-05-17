import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { CustomerCategory } from '../../types';
import { Plus, Edit2, Trash2, Tag, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

export default function CustomerCategories() {
  const { profile, domainTenantId } = useAuth();
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomerCategory | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (!profile) return;

    const targetTenantId = domainTenantId || profile.tenantId;

    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'customer_categories')
      : query(collection(db, 'customer_categories'), where('tenantId', '==', targetTenantId));
      
    const unsubscribe = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerCategory)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching customer categories:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, domainTenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!targetTenantId) return;

    setConfirmConfig({
      isOpen: true,
      title: editingCategory ? 'Simpan Perubahan' : 'Tambah Tipe',
      message: editingCategory ? 'Apakah Anda yakin ingin menyimpan perubahan tipe?' : 'Apakah Anda yakin ingin menambah tipe baru?',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          if (editingCategory) {
            await updateDoc(doc(db, 'customer_categories', editingCategory.id), formData);
          } else {
            await addDoc(collection(db, 'customer_categories'), {
              ...formData,
              tenantId: targetTenantId,
              createdAt: serverTimestamp(),
            });
          }
          setIsModalOpen(false);
          setEditingCategory(null);
          setFormData({ name: '', description: '' });
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Tipe',
      message: 'Apakah Anda yakin ingin menghapus tipe pelanggan ini?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteDoc(doc(db, 'customer_categories', id));
      }
    });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Categories...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tipe Pelanggan</h2>
          <p className="text-gray-500">Kelola tipe untuk mengelompokkan pelanggan Anda.</p>
        </div>
        <button
          onClick={() => { setEditingCategory(null); setFormData({ name: '', description: '' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Tipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <motion.div
            key={category.id}
            layout
            className="bg-white p-6 rounded-md shadow-sm border border-gray-100 hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Tag className="w-6 h-6" />
              </div>
              <div className="flex space-x-1">
                <button onClick={() => { setEditingCategory(category); setFormData({ name: category.name, description: category.description || '' }); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(category.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{category.name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{category.description || 'Tidak ada deskripsi.'}</p>
          </motion.div>
        ))}
        {categories.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-md border border-dashed border-gray-200">
            <Tag className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada tipe. Mulai dengan menambah satu!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">{editingCategory ? 'Edit Tipe' : 'Tambah Tipe Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Tipe</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Deskripsi</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border border-gray-200 rounded-md text-gray-600 hover:bg-white">Batal</button>
                  <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold">
                    {editingCategory ? 'Simpan Perubahan' : 'Tambah Tipe'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          type={confirmConfig.type}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
