import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Product, Category } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { Briefcase, Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';

export default function ServiceList() {
  const { profile, domainTenantId } = useAuth();
  const [services, setServices] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    categoryId: '',
    price: 0,
    duration: '' // empty string translates to no duration, or number
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!profile) return;
    const targetTenantId = domainTenantId || profile.tenantId;

    const q = query(collection(db, 'products'), where('tenantId', '==', targetTenantId), where('type', '==', 'service'));
    const unsubscribeServices = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products', auth, profile);
      setLoading(false);
    });

    const catQ = query(collection(db, 'categories'), where('tenantId', '==', targetTenantId));
    const unsubscribeCat = onSnapshot(catQ, (snapshot) => {
      // Assuming you might want to filter categories that are for services. 
      // But for now, we just fetch all categories.
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });

    return () => {
      unsubscribeServices();
      unsubscribeCat();
    };
  }, [profile, domainTenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: formData.name,
        description: formData.description,
        category: formData.categoryId,
        price: Number(formData.price),
        serviceActiveDays: formData.duration ? Number(formData.duration) : null,
        type: 'service',
        hpp: 0,
        stock: 0,
        minStock: 0,
        sku: `SRV-${Date.now()}`
      };

      if (editingService) {
        await updateDoc(doc(db, 'products', editingService.id), {
          name: dataToSave.name,
          description: dataToSave.description,
          category: dataToSave.category,
          price: dataToSave.price,
          serviceActiveDays: dataToSave.serviceActiveDays
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...dataToSave,
          tenantId: domainTenantId || profile.tenantId,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingService(null);
      setFormData({ name: '', description: '', categoryId: '', price: 0, duration: '' });
    } catch (error: any) {
      handleFirestoreError(error, editingService ? OperationType.UPDATE : OperationType.CREATE, 'services', auth, profile);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Service',
      message: 'Apakah Anda yakin ingin menghapus layanan ini?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'products', id));
          setConfirmConfig(null);
        } catch (error: any) {
          handleFirestoreError(error, OperationType.DELETE, 'products', auth, profile);
        }
      }
    });
  };

  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            Daftar Service
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola layanan dan jasa yang ditawarkan kepada pelanggan.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Cari service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
            />
          </div>
          <button 
            onClick={() => {
              setEditingService(null);
              setFormData({ name: '', description: '', categoryId: '', price: 0, duration: '' });
              setIsModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Service Baru
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading data...</div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Briefcase className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Belum ada service</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-sm">Tambahkan service atau jasa yang dapat dipesan oleh pelanggan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100 font-bold">
                  <th className="p-4 pl-6">Nama Service</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Harga</th>
                  <th className="p-4">Durasi (Menit)</th>
                  <th className="p-4 text-right pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredServices.map((service) => {
                  const cat = categories.find(c => c.id === service.category);
                  return (
                    <tr key={service.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-medium text-gray-900">{service.name}</div>
                        {service.description && <div className="text-xs text-gray-500 line-clamp-1">{service.description}</div>}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {cat ? cat.name : '-'}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-900">{formatRupiah(service.price)}</td>
                      <td className="p-4 text-gray-500">{service.serviceActiveDays ? `${service.serviceActiveDays} Menit` : '-'}</td>
                      <td className="p-4 pr-6">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingService(service);
                              setFormData({
                                name: service.name,
                                description: service.description || '',
                                categoryId: service.category,
                                price: service.price,
                                duration: service.serviceActiveDays ? service.serviceActiveDays.toString() : ''
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(service.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">{editingService ? 'Edit Service' : 'Service Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Service <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durasi (Menit)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Opsional"
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
                  Batal
                </button>
                <button disabled={isSubmitting} type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
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
