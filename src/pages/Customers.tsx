import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Customer, CustomerCategory } from '../types';
import { 
  Plus, Search, Edit2, Trash2, UserRound, Mail, Phone, MapPin, X, 
  ChevronLeft, ChevronRight, Lock, CreditCard, Calendar, User, 
  ShoppingBag, Info, Eye, Tag, Upload, Download, CheckCircle2
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
    province: '',
    regency: '',
    district: '',
    village: '',
    type: 'umum' as 'umum' | 'langganan',
    categoryId: '',
    allowTempo: false,
    tempoLimitDays: 30,
    discount: 0,
    hasSavingsProgram: false,
  });

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [provinces, setProvinces] = useState<{id: string, name: string}[]>([]);
  const [regencies, setRegencies] = useState<{id: string, name: string}[]>([]);
  const [districts, setDistricts] = useState<{id: string, name: string}[]>([]);
  const [villages, setVillages] = useState<{id: string, name: string}[]>([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedRegencyId, setSelectedRegencyId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState('');

  useEffect(() => {
    fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
      .then(res => res.json())
      .then(data => setProvinces(data))
      .catch(console.error);
  }, []);

  const fetchRegencies = (provinceId: string) => {
    if (!provinceId) return;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provinceId}.json`)
      .then(res => res.json())
      .then(data => setRegencies(data))
      .catch(console.error);
  };

  const fetchDistricts = (regencyId: string) => {
    if (!regencyId) return;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${regencyId}.json`)
      .then(res => res.json())
      .then(data => setDistricts(data))
      .catch(console.error);
  };

  const fetchVillages = (districtId: string) => {
    if (!districtId) return;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`)
      .then(res => res.json())
      .then(data => setVillages(data))
      .catch(console.error);
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedProvinceId(id);
    setSelectedRegencyId('');
    setSelectedDistrictId('');
    setSelectedVillageId('');
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    
    setFormData({ ...formData, province: id ? name : '', regency: '', district: '', village: '' });
    
    if (id) {
      fetchRegencies(id);
    }
  };

  const handleRegencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedRegencyId(id);
    setSelectedDistrictId('');
    setSelectedVillageId('');
    setDistricts([]);
    setVillages([]);
    
    setFormData({ ...formData, regency: id ? name : '', district: '', village: '' });
    
    if (id) {
      fetchDistricts(id);
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedDistrictId(id);
    setSelectedVillageId('');
    setVillages([]);
    
    setFormData({ ...formData, district: id ? name : '', village: '' });
    
    if (id) {
      fetchVillages(id);
    }
  };

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedVillageId(id);
    setFormData({ ...formData, village: id ? name : '' });
  };

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
        
        // Skip cancelled or deleted orders
        if (order.status === 'cancelled' || order.status === 'deleted') return;

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
              savingsBalance: 0,
              createdAt: serverTimestamp(),
            });
          }
          setIsModalOpen(false);
          setEditingCustomer(null);
          setFormData({ name: '', code: '', email: '', phone: '', address: '', province: '', regency: '', district: '', village: '', type: 'umum', categoryId: '', allowTempo: false, tempoLimitDays: 30, discount: 0, hasSavingsProgram: false });
          setSelectedProvinceId('');
          setSelectedRegencyId('');
          setSelectedDistrictId('');
          setSelectedVillageId('');
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
          hasSavingsProgram: false,
          savingsBalance: 0,
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
            className="hidden p-2 bg-white border border-gray-200 rounded-md text-sm font-medium" 
          />
          <button
            onClick={handleDownloadTemplate}
            className="bg-white border border-gray-200 text-gray-600 p-2 rounded-md flex items-center hover:bg-white transition-colors"
          >
            <Download className="w-5 h-5 mr-2" />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-emerald-700 transition-colors disabled:opacity-50"
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
                province: '',
                regency: '',
                district: '',
                village: '',
                type: 'umum', 
                categoryId: '',
                allowTempo: false, 
                tempoLimitDays: 30,
                discount: 0,
                hasSavingsProgram: false
              });
              setSelectedProvinceId('');
              setSelectedRegencyId('');
              setSelectedDistrictId('');
              setSelectedVillageId('');
              setIsModalOpen(true); 
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Customer
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
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

      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
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
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-black tracking-widest uppercase border border-indigo-100">
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
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-white rounded-md transition-all shadow-sm hover:shadow border border-transparent hover:border-emerald-100"
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
                            province: customer.province || '',
                            regency: customer.regency || '',
                            district: customer.district || '',
                            village: customer.village || '',
                            type: customer.type || 'umum',
                            categoryId: customer.categoryId || '',
                            allowTempo: customer.allowTempo || false,
                            tempoLimitDays: customer.tempoLimitDays || 30,
                            discount: customer.discount || 0,
                            hasSavingsProgram: customer.hasSavingsProgram || false
                          });
                          setSelectedProvinceId('');
                          setSelectedRegencyId('');
                          setSelectedDistrictId('');
                          setSelectedVillageId(''); 
                          setIsModalOpen(true); 
                        }} 
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all shadow-sm hover:shadow border border-transparent hover:border-indigo-100"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(customer.id)} 
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-md transition-all shadow-sm hover:shadow border border-transparent hover:border-red-100"
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
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-md border border-gray-100 gap-4">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900">{Math.min(filteredCustomers.length, (currentPage - 1) * rowsPerPage + 1)}</span> to <span className="font-bold text-gray-900">{Math.min(filteredCustomers.length, currentPage * rowsPerPage)}</span> of <span className="font-bold text-gray-900">{filteredCustomers.length}</span> customers
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-200 rounded-md bg-white hover:bg-white disabled:opacity-50 transition-colors"
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
                      className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${
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
              className="p-2 border border-gray-200 rounded-md bg-white hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${editingCustomer ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {editingCustomer ? <Edit2 className="w-6 h-6" /> : <UserRound className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {editingCustomer ? 'Update Customer' : 'Add New Customer'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingCustomer ? `Editing: ${editingCustomer.name}` : 'Customer registration portal'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/30 p-6 sm:p-8 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-8">
                    {/* Section: Basic Information */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-indigo-600 mb-2">
                        <User className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Identitas Pelanggan</span>
                      </div>
                      
                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Nama Lengkap</label>
                          <div className="relative group">
                            <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                              type="text"
                              required
                              placeholder="Contoh: Budi Santoso"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Customer Code</label>
                          <div className="relative flex gap-2">
                            <div className="relative flex-1 group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                              <input
                                type="text"
                                value={formData.code}
                                readOnly
                                className="w-full outline-none text-gray-400 cursor-not-allowed py-2.5 pr-4 pl-11 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                              />
                            </div>
                            <div className="px-4 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-medium text-xs border border-indigo-100">
                              AUTO
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section: Professional Setup */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-indigo-600 mb-2">
                        <ShoppingBag className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Pengaturan Akun</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Tipe Pelanggan</label>
                          <div className="relative group">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <select
                              value={formData.categoryId}
                              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                              className="w-full pl-11 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-sm text-gray-700"
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
                          <label className="text-sm font-medium text-gray-700">Diskon Otomatis (%)</label>
                          <div className="relative group">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                              type="number"
                              placeholder="0"
                              min="0"
                              max="100"
                              value={formData.discount || ''}
                              onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-11 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-[45%] text-gray-500 font-bold">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 pt-2">
                        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                          <div className="pr-4">
                            <label className="text-sm font-bold text-gray-900 cursor-pointer">Pembayaran Tempo</label>
                            <p className="text-xs text-gray-500 mt-0.5">Izinkan kasbon aktif</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={formData.allowTempo}
                              onChange={(e) => setFormData({ ...formData, allowTempo: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                          <div className="pr-4">
                            <label className="text-sm font-bold text-gray-900 cursor-pointer">Program Tabungan</label>
                            <p className="text-xs text-gray-500 mt-0.5">Mengikuti tabungan/berkah</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={formData.hasSavingsProgram}
                              onChange={(e) => setFormData({ ...formData, hasSavingsProgram: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>

                      <AnimatePresence>
                        {formData.allowTempo && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, scale: 0.95 }}
                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg flex items-center gap-4 mt-2">
                              <div className="p-2.5 bg-white rounded-lg text-orange-600 shadow-sm shrink-0">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <label className="text-sm font-bold text-orange-900 flex items-center gap-2">
                                  Tenggat Waktu Pelunasan <span className="text-xs font-medium text-orange-700">(Hari)</span>
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={formData.tempoLimitDays}
                                  onChange={(e) => setFormData({ ...formData, tempoLimitDays: parseInt(e.target.value) || 0 })}
                                  className="w-full md:w-48 px-3 py-2 bg-white border border-orange-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-medium"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-8">
                    {/* Section: Contact & Address */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-indigo-600 mb-2">
                        <Mail className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Kontak & Alamat</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Alamat Email</label>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                              type="email"
                              required
                              placeholder="email@perusahaan.com"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Nomor Telepon/WA</label>
                          <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                              type="text"
                              required
                              placeholder="+62 812..."
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Provinsi</label>
                            <select
                              value={selectedProvinceId}
                              onChange={handleProvinceChange}
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            >
                              <option value="">Pilih Provinsi</option>
                              {provinces.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Kabupaten/Kota</label>
                            <select
                              value={selectedRegencyId}
                              onChange={handleRegencyChange}
                              disabled={!selectedProvinceId}
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-50 disabled:bg-gray-50"
                            >
                              <option value="">Pilih Kabupaten/Kota</option>
                              {regencies.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Kecamatan</label>
                            <select
                              value={selectedDistrictId}
                              onChange={handleDistrictChange}
                              disabled={!selectedRegencyId}
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-50 disabled:bg-gray-50"
                            >
                              <option value="">Pilih Kecamatan</option>
                              {districts.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Kelurahan/Desa</label>
                            <select
                              value={selectedVillageId}
                              onChange={handleVillageChange}
                              disabled={!selectedDistrictId}
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-50 disabled:bg-gray-50"
                            >
                              <option value="">Pilih Kelurahan/Desa</option>
                              {villages.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Alamat Lengkap</label>
                          <div className="relative group">
                            <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <textarea
                              required
                              placeholder="Jl. Nama Jalan No. 123, RT/RW, Patokan..."
                              value={formData.address}
                              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[130px] text-sm resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  Batal
                </button>
                <button 
                  type="button"
                  onClick={handleSubmit}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingCustomer ? 'Simpan Perubahan' : 'Tambahkan'}
                </button>
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100/50 shadow-sm">
                    <UserRound className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">{selectedCustomerForDetail.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                        {selectedCustomerForDetail.code || 'NO CODE'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                {/* Contact & Address Section */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Info className="w-4 h-4 text-indigo-500" />
                      Informasi Pelanggan
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100/50">
                        <div className="flex items-center gap-3 mb-1">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500">Email</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 pl-7 break-all">{selectedCustomerForDetail.email || '-'}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100/50">
                        <div className="flex items-center gap-3 mb-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500">No. Telepon</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 pl-7">{selectedCustomerForDetail.phone || '-'}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100/50 md:col-span-2">
                        <div className="flex items-center gap-3 mb-1">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500">Alamat</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 pl-7 leading-relaxed">
                          {[
                            selectedCustomerForDetail.address,
                            selectedCustomerForDetail.village,
                            selectedCustomerForDetail.district,
                            selectedCustomerForDetail.regency,
                            selectedCustomerForDetail.province
                          ].filter(Boolean).join(', ') || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary Section */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    Ringkasan Keuangan
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Receivables Card */}
                    <div className="p-5 bg-gradient-to-br from-red-50 to-red-100/50 rounded-2xl border border-red-100 relative overflow-hidden group">
                      <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-200/50 rounded-full blur-2xl group-hover:bg-red-300/50 transition-colors" />
                      <div className="relative">
                        <p className="text-xs font-bold text-red-600/80 uppercase tracking-wider mb-2">Total Outstanding</p>
                        <h4 className="text-2xl font-black text-red-700 tabular-nums">
                          Rp {(receivablesMap[selectedCustomerForDetail.id] || 0).toLocaleString('id-ID')}
                        </h4>
                      </div>
                    </div>

                    {/* Savings Card (if active) */}
                    {selectedCustomerForDetail.hasSavingsProgram && (
                      <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 relative overflow-hidden group gap-4">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-200/50 rounded-full blur-2xl group-hover:bg-emerald-300/50 transition-colors" />
                        <div className="relative">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-wider">Saldo Tabungan</p>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase">Aktif</span>
                          </div>
                          <h4 className="text-2xl font-black text-emerald-700 tabular-nums">
                            Rp {Math.round(selectedCustomerForDetail.savingsBalance || 0).toLocaleString('id-ID')}
                          </h4>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Oldest Invoice Section */}
                  {oldestInvoicesMap[selectedCustomerForDetail.id] && (
                    <div className="mt-4 p-4 rounded-xl border border-orange-200 bg-orange-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Tagihan Terlama</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-gray-900 border-b border-dashed border-gray-400 pb-0.5">#{oldestInvoicesMap[selectedCustomerForDetail.id].orderNumber}</span>
                          <span className="font-medium text-gray-500">{formatDate(oldestInvoicesMap[selectedCustomerForDetail.id].date)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-xs font-semibold text-gray-500">Sisa Pembayaran:</span>
                          <span className="text-base font-black text-orange-600">
                            Rp {(oldestInvoicesMap[selectedCustomerForDetail.id].totalAmount - (oldestInvoicesMap[selectedCustomerForDetail.id].paidAmount || 0)).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!oldestInvoicesMap[selectedCustomerForDetail.id] && (receivablesMap[selectedCustomerForDetail.id] || 0) === 0 && (
                    <div className="mt-4 p-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center">
                      <p className="text-xs font-semibold text-gray-400">Tidak ada tagihan tertunggak.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  Tutup
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
