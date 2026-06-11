import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { BusinessLine } from '../../types';
import { Plus, Search, Edit2, Trash2, Tag, X, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

export default function BusinessLines() {
  const { profile, domainTenantId } = useAuth();
  const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBL, setEditingBL] = useState<BusinessLine | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (!profile) return;

    const targetTenantId = domainTenantId || profile.tenantId;

    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'business_lines')
      : query(collection(db, 'business_lines'), where('tenantId', '==', targetTenantId));
      
    const unsubscribe = onSnapshot(q, (snap) => {
      setBusinessLines(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessLine)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching business lines:", err);
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
      title: editingBL ? 'Simpan Perubahan' : 'Tambah Market Bisnis',
      message: editingBL ? 'Apakah Anda yakin ingin menyimpan perubahan market bisnis ini?' : 'Apakah Anda yakin ingin menambah market bisnis baru?',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          if (editingBL) {
            await updateDoc(doc(db, 'business_lines', editingBL.id), formData);
          } else {
            await addDoc(collection(db, 'business_lines'), {
              ...formData,
              tenantId: targetTenantId,
              createdAt: serverTimestamp(),
            });
          }
          setIsModalOpen(false);
          setEditingBL(null);
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
      title: 'Hapus Market Bisnis',
      message: 'Apakah Anda yakin ingin menghapus market bisnis ini?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteDoc(doc(db, 'business_lines', id));
      }
    });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Market Bisnis...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Market Bisnis</h2>
          <p className="text-gray-500">Kelola market bisnis untuk mengkategorikan produk dan melacak omzet.</p>
        </div>
        <button
          onClick={() => { setEditingBL(null); setFormData({ name: '', description: '' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Market Bisnis
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businessLines.map((bl) => (
          <motion.div
            key={bl.id}
            layout
            className="bg-white p-6 rounded-md shadow-sm border border-gray-100 hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="flex space-x-1">
                <button onClick={() => { setEditingBL(bl); setFormData({ name: bl.name, description: bl.description || '' }); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(bl.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{bl.name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{bl.description || 'Tidak ada deskripsi.'}</p>
          </motion.div>
        ))}
        {businessLines.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-md border border-dashed border-gray-200">
            <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada market bisnis. Mulai dengan menambah satu!</p>
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
              className="bg-white rounded-md shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingBL ? 'Edit Market Bisnis' : 'Tambah Market Bisnis'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto auto-rows-max">
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Market Bisnis</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Media Creative Digital"
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Deskripsi (Opsional)</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 font-medium">Batal</button>
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium">Simpan</button>
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
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
          type={confirmConfig.type}
        />
      )}
    </div>
  );
}
