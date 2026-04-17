import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Supplier } from '../../types';
import { Plus, Search, Edit2, Trash2, Truck, X, Phone, Mail, MapPin, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

export default function Suppliers() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    paymentTerm: '',
  });
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(collection(db, 'suppliers'), where('tenantId', '==', profile.tenantId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching suppliers:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSuppliers.length / rowsPerPage);
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
          ...formData,
          paymentTerm: formData.paymentTerm ? Number(formData.paymentTerm) : null
        });
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          paymentTerm: formData.paymentTerm ? Number(formData.paymentTerm) : null,
          tenantId: profile.tenantId,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: '', contactName: '', email: '', phone: '', address: '', paymentTerm: '' });
    } catch (err) {
      console.error(err);
      alert('Failed to save supplier.');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Supplier',
      message: 'Apakah Anda yakin ingin menghapus supplier ini?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteDoc(doc(db, 'suppliers', id));
      }
    });
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      paymentTerm: supplier.paymentTerm?.toString() || '',
    });
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Suppliers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Supplier</h2>
          <p className="text-gray-500">Kelola daftar vendor dan supplier Anda.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <button
            onClick={() => { setEditingSupplier(null); setFormData({ name: '', contactName: '', email: '', phone: '', address: '', paymentTerm: '' }); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Supplier
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 bg-white p-2 rounded-lg border border-gray-100 w-fit">
        <span className="font-bold uppercase tracking-widest">Tampilkan:</span>
        <select 
          value={rowsPerPage} 
          onChange={(e) => setRowsPerPage(Number(e.target.value))}
          className="bg-transparent font-bold text-indigo-600 outline-none cursor-pointer"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedSuppliers.map((supplier) => (
          <motion.div
            key={supplier.id}
            layout
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all space-y-4"
          >
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <div className="flex space-x-2">
                <button onClick={() => openEditModal(supplier)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(supplier.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{supplier.name}</h3>
              {supplier.contactName && <p className="text-sm text-gray-500">CP: {supplier.contactName}</p>}
            </div>

            <div className="space-y-2 pt-2">
              {supplier.paymentTerm && (
                <div className="flex items-center text-sm font-bold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                  <Clock className="w-4 h-4 mr-2" />
                  Termin: {supplier.paymentTerm} Hari
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  {supplier.phone}
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  {supplier.email}
                </div>
              )}
              {supplier.address && (
                <div className="flex items-start text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                  <span className="line-clamp-2">{supplier.address}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {filteredSuppliers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 gap-4">
          <p className="text-xs text-gray-500">
            Menampilkan <span className="font-bold text-gray-900">{Math.min(filteredSuppliers.length, (currentPage - 1) * rowsPerPage + 1)}</span> sampai <span className="font-bold text-gray-900">{Math.min(filteredSuppliers.length, currentPage * rowsPerPage)}</span> dari <span className="font-bold text-gray-900">{filteredSuppliers.length}</span> supplier
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === page 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                          : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if ((page === currentPage - 2 && page > 1) || (page === currentPage + 2 && page < totalPages)) {
                  return <span key={page} className="text-gray-400">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {filteredSuppliers.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Truck className="w-16 h-16 text-gray-100 mx-auto mb-4" />
          <p className="text-gray-500">Belum ada supplier yang terdaftar.</p>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">{editingSupplier ? 'Edit Supplier' : 'Tambah Supplier'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan / Supplier</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Contoh: PT. Sumber Makmur"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kontak (CP)</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nama orang yang bisa dihubungi"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Termin Pembayaran (Hari)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      value={formData.paymentTerm}
                      onChange={(e) => setFormData({ ...formData, paymentTerm: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Contoh: 30"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">* Jumlah hari jangka waktu pembayaran (TOP) ke supplier ini.</p>
                </div>
                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 font-bold hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                  >
                    {editingSupplier ? 'Simpan Perubahan' : 'Tambah Supplier'}
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
