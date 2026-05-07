import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Customer, CustomerCategory } from '../types';
import { 
  Plus, Search, Edit2, Trash2, UserRound, Mail, Phone, MapPin, X, 
  ChevronLeft, ChevronRight, Lock, CreditCard, Calendar, User, 
  ShoppingBag, Info, Eye, Tag, Upload, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';
import * as XLSX from 'xlsx';

export default function Customers() {
  const { profile, domainTenantId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [receivablesMap, setReceivablesMap] = useState<Record<string, number>>({});
  const [oldestInvoicesMap, setOldestInvoicesMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);
  const generateCustomerCode = async (targetTenantId: string) => {
    const customersRef = collection(db, 'customers');
    const q = query(customersRef, where('tenantId', '==', targetTenantId));
    const snap = await getDocs(q);
    const sequence = (snap.size + 1).toString().padStart(4, '0');
    
    return `A${sequence}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    type: 'umum' as 'umum' | 'langganan',
    categoryId: '',
    allowTempo: false,
    tempoLimitDays: 30,
    discount: 0,
  });

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (!profile) return;
    const targetTenantId = domainTenantId || profile.tenantId;
    if (!targetTenantId && profile.role !== 'superadmin') return;
    
    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'customers')
      : query(collection(db, 'customers'), where('tenantId', '==', targetTenantId));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    // Fetch customer categories
    const categoriesQuery = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'customer_categories')
      : query(collection(db, 'customer_categories'), where('tenantId', '==', targetTenantId));

    const unsubscribeCategories = onSnapshot(categoriesQuery, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerCategory)));
    });

    // Fetch orders to calculate receivables (piutang)
    const ordersQuery = query(
      collection(db, 'orders'),
      where('tenantId', '==', targetTenantId),
      where('paymentStatus', 'in', ['unpaid', 'partial'])
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snap) => {
      const recMap: Record<string, number> = {};
      const oldInvMap: Record<string, any> = {};

      snap.docs.forEach(d => {
        const order = { id: d.id, ...d.data() } as any;
        if (order.customerId) {
          const sisa = order.totalAmount - (order.paidAmount || 0);
          recMap[order.customerId] = (recMap[order.customerId] || 0) + sisa;

          // Track oldest unpaid invoice
          const getOrderTime = (o: any) => {
            if (!o.date) return Infinity;
            if (o.date.seconds) return o.date.seconds;
            if (o.date instanceof Date) return Math.floor(o.date.getTime() / 1000);
            if (typeof o.date === 'string') return Math.floor(new Date(o.date).getTime() / 1000);
            return Infinity;
          };

          const orderTime = getOrderTime(order);
          const currentOldest = oldInvMap[order.customerId];
          const currentOldestTime = currentOldest ? getOrderTime(currentOldest) : Infinity;

          if (!currentOldest || orderTime < currentOldestTime) {
            oldInvMap[order.customerId] = order;
          }
        }
      });

      setReceivablesMap(recMap);
      setOldestInvoicesMap(oldInvMap);
    });

    return () => {
      unsubscribe();
      unsubscribeCategories();
      unsubscribeOrders();
    };
  }, [profile, domainTenantId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.toLowerCase().includes(search.toLowerCase()) ||
    (c.id && c.id.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!targetTenantId) return;

    setConfirmConfig({
      isOpen: true,
      title: editingCustomer ? 'Simpan Perubahan' : 'Tambah Pelanggan',
      message: editingCustomer ? 'Apakah Anda yakin ingin menyimpan perubahan data pelanggan?' : 'Apakah Anda yakin ingin menambah pelanggan baru?',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          let finalCode = formData.code.trim();
          if (!finalCode) {
            finalCode = await generateCustomerCode(targetTenantId);
          }

          const data = {
            ...formData,
            code: finalCode,
          };

          if (editingCustomer) {
            await updateDoc(doc(db, 'customers', editingCustomer.id), data);
          } else {
            await addDoc(collection(db, 'customers'), {
              ...data,
              tenantId: targetTenantId,
              createdAt: serverTimestamp(),
            });
          }
          setIsModalOpen(false);
          setEditingCustomer(null);
          setFormData({ name: '', code: '', email: '', phone: '', address: '', type: 'umum', categoryId: '', allowTempo: false, tempoLimitDays: 30, discount: 0 });
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Nama: 'John Doe',
        Email: 'john@example.com',
        Telepon: '08123456789',
        Alamat: 'Jl. Jendral Sudirman',
        Tipe: 'umum',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    // Add column widths
    const wscols = [
      {wch: 30}, // Nama
      {wch: 30}, // Email
      {wch: 15}, // Telepon
      {wch: 40}, // Alamat
      {wch: 15}, // Tipe
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Pelanggan");
    XLSX.writeFile(wb, "Template_Import_Pelanggan.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!targetTenantId) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      let importedCount = 0;
      
      // Get the last sequence number for customer code
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where('tenantId', '==', targetTenantId));
      const snap = await getDocs(q);
      let currentSequence = snap.size;

      for (const row of jsonData) {
        if (!row.Nama) continue; // Skip empty names
        
        currentSequence++;
        const newCode = `A${currentSequence.toString().padStart(4, '0')}`;
        
        const customerData = {
          tenantId: targetTenantId,
          name: row.Nama || '',
          code: newCode,
          email: row.Email || '',
          phone: row.Telepon?.toString() || '',
          address: row.Alamat || '',
          type: (row.Tipe?.toString().toLowerCase() === 'langganan') ? 'langganan' : 'umum',
          categoryId: '',
          allowTempo: false,
          tempoLimitDays: 30,
          discount: 0,
          createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'customers'), customerData);
        importedCount++;
      }

      alert(`Berhasil mengimpor ${importedCount} pelanggan`);
    } catch (error) {
      console.error('Error importing customers:', error);
      alert('Terjadi kesalahan saat mengimpor pelanggan');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Pelanggan',
      message: 'Apakah Anda yakin ingin menghapus data pelanggan ini?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteDoc(doc(db, 'customers', id));
      }
    });
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    if (date.toDate) return date.toDate().toLocaleDateString('id-ID');
    if (date instanceof Date) return date.toLocaleDateString('id-ID');
    if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString('id-ID');
    return new Date(date).toLocaleDateString('id-ID');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
          <p className="text-gray-500">Maintain your customer database and contact information.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx,.xls" 
            className="hidden p-2 bg-white border border-gray-200 rounded-lg text-sm font-medium" 
          />
          <button
            onClick={handleDownloadTemplate}
            className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg flex items-center hover:bg-white transition-colors"
          >
            <Download className="w-5 h-5 mr-2" />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Upload className="w-5 h-5 mr-2" />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
          <button
            onClick={async () => { 
              const targetTenantId = domainTenantId || profile?.tenantId;
              if (!targetTenantId) return;
              
              setEditingCustomer(null); 
              const newCode = await generateCustomerCode(targetTenantId);
              setFormData({ 
                name: '', 
                code: newCode,
                email: '', 
                phone: '', 
                address: '', 
                type: 'umum', 
                categoryId: '',
                allowTempo: false, 
                tempoLimitDays: 30,
                discount: 0
              }); 
              setIsModalOpen(true); 
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Customer
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
          <span className="font-bold uppercase tracking-widest">Show:</span>
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
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">No</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Kode</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nama Pelanggan</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">TOP</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Piutang</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedCustomers.map((customer, index) => (
                <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-bold text-gray-500 tabular-nums">
                      {(currentPage - 1) * rowsPerPage + index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black tracking-widest uppercase border border-indigo-100">
                      {customer.code || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <UserRound className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 leading-none">{customer.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {customer.categoryId && categories.find(c => c.id === customer.categoryId) && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter bg-emerald-100 text-emerald-700">
                              {categories.find(c => c.id === customer.categoryId)?.name}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 font-bold tracking-tight">{customer.phone}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {customer.allowTempo ? (
                      <div className="flex flex-col items-center justify-center">
                         <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded text-[10px] font-black uppercase">
                            {customer.tempoLimitDays} Hari
                         </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">Tunai</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-black tabular-nums ${receivablesMap[customer.id] > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      Rp.{(receivablesMap[customer.id] || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedCustomerForDetail(customer);
                          setIsDetailModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow border border-transparent hover:border-emerald-100"
                        title="Detail Pelanggan"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { 
                          setEditingCustomer(customer); 
                          setFormData({
                            name: customer.name,
                            code: customer.code || '',
                            email: customer.email,
                            phone: customer.phone,
                            address: customer.address,
                            type: customer.type || 'umum',
                            categoryId: customer.categoryId || '',
                            allowTempo: customer.allowTempo || false,
                            tempoLimitDays: customer.tempoLimitDays || 30,
                            discount: customer.discount || 0
                          }); 
                          setIsModalOpen(true); 
                        }} 
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow border border-transparent hover:border-indigo-100"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(customer.id)} 
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow border border-transparent hover:border-red-100"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedCustomers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-gray-50 rounded-full">
                        <UserRound className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-400 font-bold">No customers found.</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest italic">Try adjusting your search or add a new customer.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredCustomers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-lg border border-gray-100 gap-4">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900">{Math.min(filteredCustomers.length, (currentPage - 1) * rowsPerPage + 1)}</span> to <span className="font-bold text-gray-900">{Math.min(filteredCustomers.length, currentPage * rowsPerPage)}</span> of <span className="font-bold text-gray-900">{filteredCustomers.length}</span> customers
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-white disabled:opacity-50 transition-colors"
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
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            >
              <div className="relative p-6 sm:p-8 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${editingCustomer ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {editingCustomer ? <Edit2 className="w-6 h-6" /> : <UserRound className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">
                      {editingCustomer ? 'Update Customer' : 'Add New Customer'}
                    </h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5 whitespace-nowrap">
                      {editingCustomer ? `Editing: ${editingCustomer.name}` : 'Customer registration portal'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-gray-200/50 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                {/* Section: Basic Information */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-wider">Identitas Pelanggan</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="ml-1 text-xs font-semibold text-gray-600">Nama Lengkap</label>
                      <div className="relative group">
                        <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Budi Santoso"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="ml-1 text-xs font-semibold text-gray-600">Customer Code</label>
                      <div className="relative flex gap-2">
                        <div className="relative flex-1 group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                          <input
                            type="text"
                            value={formData.code}
                            readOnly
                            className="w-full outline-none text-gray-500 cursor-not-allowed p-2 bg-white border border-gray-200 rounded-lg text-sm font-medium pl-10"
                          />
                        </div>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-medium text-xs border border-indigo-100">
                          AUTO
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Contact & Address */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <Mail className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-wider">Kontak & Alamat</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="ml-1 text-xs font-semibold text-gray-600">Alamat Email</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                          type="email"
                          required
                          placeholder="email@perusahaan.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="ml-1 text-xs font-semibold text-gray-600">Nomor Telepon/WA</label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                          type="text"
                          required
                          placeholder="+62 812..."
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-semibold text-gray-600">Alamat Pengiriman</label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-4 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                      <textarea
                        required
                        placeholder="Jl. Nama Jalan No. 123, Kota, Provinsi..."
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-24 text-sm font-medium resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Professional Setup */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <ShoppingBag className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-wider">Pengaturan Akun</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="ml-1 text-xs font-semibold text-gray-600">Tipe Pelanggan</label>
                      <div className="relative group">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="w-full pl-11 pr-8 py-3 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-sm font-medium text-gray-700"
                        >
                          <option value="">-- Umum / Tanpa Tipe --</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="ml-1 text-xs font-semibold text-gray-600">Otoritas Pembayaran Tempo</label>
                      <div className="flex items-center h-[48px] bg-white border border-gray-100 rounded-lg px-4 gap-4">
                        <div className="p-2 rounded-lg bg-white border border-gray-100 shadow-sm">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-1 text-xs font-semibold text-gray-600">
                          <input 
                            type="checkbox" 
                            className="sr-only peer p-2 rounded-lg border border-gray-200 text-sm"
                            checked={formData.allowTempo}
                            onChange={(e) => setFormData({ ...formData, allowTempo: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          <span className="ml-3 text-xs font-black text-gray-700 uppercase tracking-widest">
                            {formData.allowTempo ? 'Dizinkan' : 'Dilarang'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100 mt-6">
                    <div className="space-y-1.5">
                      <label className="ml-1 text-xs font-semibold text-gray-600">Diskon Otomatis (Opsional)</label>
                      <div className="relative group">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.discount || ''}
                          onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-gray-900"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-[45%] text-gray-500 font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold px-1 mt-1">Diskon akan diterapkan otomatis pada setiap transaksi customer ini tanpa kode kupon.</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {formData.allowTempo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-3xl border border-orange-200/50 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                          <div className="p-4 bg-white rounded-2xl text-orange-600 shadow-sm self-start">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <Info className="w-3 h-3 text-orange-600" />
                              <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Tenggat Waktu Pelunasan</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="relative group w-28">
                                <input
                                  type="number"
                                  min="1"
                                  value={formData.tempoLimitDays}
                                  onChange={(e) => setFormData({ ...formData, tempoLimitDays: parseInt(e.target.value) || 0 })}
                                  className="w-full px-5 py-3 bg-white border border-orange-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 shadow-sm font-medium text-orange-900 text-lg"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-sm font-black text-orange-900">Hari Kalender</p>
                                <p className="text-[10px] font-bold text-orange-600/70 uppercase">Setelah barang diterima</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </form>
              
              <div className="p-6 sm:p-8 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <p className="hidden sm:block text-[10px] text-gray-400 font-bold uppercase tracking-widest max-w-[200px]">
                  Semua data akan tersimpan dalam sistem terintegrasi cloud
                </p>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 sm:flex-none px-6 py-3 border border-gray-200 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:border-gray-300 transition-all text-xs font-medium uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 text-xs font-black uppercase tracking-widest"
                  >
                    {editingCustomer ? 'Update Data' : 'Simpan Akun'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailModalOpen && selectedCustomerForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <UserRound className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">{selectedCustomerForDetail.name}</h3>
                    <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em]">{selectedCustomerForDetail.code || 'NO CODE'}</p>
                  </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh] no-scrollbar">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Informasi Kontak</label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                          <Mail className="w-4 h-4 text-indigo-500" />
                          <span className="truncate">{selectedCustomerForDetail.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                          <Phone className="w-4 h-4 text-indigo-500" />
                          <span className="truncate">{selectedCustomerForDetail.phone}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Alamat Pengiriman</label>
                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100">
                        <MapPin className="w-4 h-4 text-indigo-500 mt-1 shrink-0" />
                        <span className="text-sm font-bold text-gray-600 leading-relaxed">{selectedCustomerForDetail.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex flex-col justify-center items-center text-center">
                      <div className="p-3 rounded-2xl bg-white shadow-sm text-red-600 mb-2">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Total Outstanding</p>
                      <h4 className="text-3xl font-black text-red-600 tabular-nums">Rp.{(receivablesMap[selectedCustomerForDetail.id] || 0).toLocaleString()}</h4>
                    </div>

                    <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Tagihan Terlama</span>
                      </div>
                      {oldestInvoicesMap[selectedCustomerForDetail.id] ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-indigo-600 truncate mr-2">#{oldestInvoicesMap[selectedCustomerForDetail.id].orderNumber}</span>
                            <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{formatDate(oldestInvoicesMap[selectedCustomerForDetail.id].date)}</span>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-orange-900">Sisa Tagihan:</span>
                            <span className="text-sm font-black text-orange-600 truncate ml-2">Rp.{(oldestInvoicesMap[selectedCustomerForDetail.id].totalAmount - (oldestInvoicesMap[selectedCustomerForDetail.id].paidAmount || 0)).toLocaleString()}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-orange-600/50 italic">Tidak ada tagihan tertunggak.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all active:scale-95"
                >
                  TUTUP DETAIL
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
          type={confirmConfig.type}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
