import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Calendar, Clock, User, Phone, FileText, CheckCircle2, Hash, CreditCard, Search, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Customer, Product } from '../../types';

export default function SalesBooking() {
  const { profile, domainTenantId } = useAuth();
  const isKasir = profile?.role === 'kasir';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banks, setBanks] = useState<{ id: string; bankName: string; accountNumber: string; accountName: string }[]>([]);

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    bookingDate: new Date().toISOString().split('T')[0],
    bookingTime: '08:00',
    pax: 1,
    notes: '',
  });

  const [bookingItems, setBookingItems] = useState<{ productId: string, name: string, price: number, quantity: number, total: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerCodeSearchTerm, setCustomerCodeSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCustomerCodeDropdownOpen, setIsCustomerCodeDropdownOpen] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [filteredCustomersByCode, setFilteredCustomersByCode] = useState<Customer[]>([]);

  const totalAmount = bookingItems.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => {
    if (customerSearchTerm.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const lowerReq = customerSearchTerm.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => 
          c.name.toLowerCase().includes(lowerReq)
        )
      );
    }
  }, [customerSearchTerm, customers]);

  useEffect(() => {
    if (customerCodeSearchTerm.trim() === '') {
      setFilteredCustomersByCode(customers);
    } else {
      const lowerReq = customerCodeSearchTerm.toLowerCase();
      setFilteredCustomersByCode(
        customers.filter(c => 
          c.code && c.code.toLowerCase().includes(lowerReq)
        )
      );
    }
  }, [customerCodeSearchTerm, customers]);

  useEffect(() => {
    if (!profile) return;
    const targetTenantId = domainTenantId || profile.tenantId;

    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('tenantId', '==', targetTenantId)), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', targetTenantId)), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubBanks = onSnapshot(query(collection(db, 'bank_accounts'), where('tenantId', '==', targetTenantId), where('isActive', '==', true)), (snap) => {
      setBanks(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubBanks();
    };
  }, [profile, domainTenantId]);

  const generateInvoiceNumber = async () => {
    const targetTenantId = domainTenantId || profile?.tenantId;
    const { generateSequentialNumber } = await import('../../lib/sequence');
    return await generateSequentialNumber(targetTenantId || '', 'INV');
  };

  const handleCustomerSelect = (custId: string) => {
    const cust = customers.find(c => c.id === custId);
    setFormData(prev => ({
      ...prev,
      customerId: custId,
      customerName: cust ? cust.name : '',
      customerPhone: cust ? cust.phone : ''
    }));
    setCustomerSearchTerm(cust ? cust.name : '');
    setCustomerCodeSearchTerm(cust && cust.code ? cust.code : '');
    setIsCustomerDropdownOpen(false);
    setIsCustomerCodeDropdownOpen(false);
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    // Check if already exists
    if (bookingItems.some(item => item.productId === selectedProductId)) {
      alert('Layanan/Produk ini sudah ditambahkan.');
      return;
    }

    setBookingItems(prev => [...prev, {
      productId: prod.id,
      name: prod.name,
      price: prod.price,
      quantity: 1,
      total: prod.price
    }]);
    setSelectedProductId('');
  };

  const handleRemoveProduct = (productId: string) => {
    setBookingItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleItemQuantityChange = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setBookingItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity, total: item.price * quantity };
      }
      return item;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (bookingItems.length === 0) {
      alert('Silahkan tambahkan minimal 1 layanan/produk.');
      return;
    }
    
    setLoading(true);
    try {
      const targetTenantId = domainTenantId || profile.tenantId;
      const orderNumber = await generateInvoiceNumber();
      const isPaid = false;
      const paidAmount = 0;
      const paymentStatusStr = 'unpaid';
      
      const newBooking = {
        tenantId: targetTenantId,
        type: 'booking',
        orderNumber: orderNumber,
        invoiceNumber: orderNumber,
        date: serverTimestamp(),
        dueDate: serverTimestamp(), // since no specific due date is set, use server time or perhaps booking Date
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        bookingDate: formData.bookingDate,
        bookingTime: formData.bookingTime,
        pax: formData.pax,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        paymentStatus: paymentStatusStr,
        paymentMethod: 'tunai',
        bankAccountId: null,
        downPaymentAmount: paidAmount,
        status: 'pending',
        notes: formData.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: profile.uid,
        items: bookingItems
      };

      const docRef = await addDoc(collection(db, 'orders'), newBooking);
      
      // Redirect to booking list
      navigate('/sales/bookings');
      
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Gagal membuat booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Booking</h1>
          <p className="text-gray-500 text-sm">Buat jadwal booking baru secara manual</p>
        </div>
      </div>

      <div>
        <form onSubmit={handleSubmit} className="space-y-6 pb-32">

          
          {/* 1. Informasi Pelanggan */}
          <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Informasi Pelanggan</h3>
                <p className="text-xs text-gray-500">Pilih dari database pelanggan.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Pilih Pelanggan <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      required={!formData.customerId}
                      placeholder="Ketik nama pelanggan..."
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setIsCustomerDropdownOpen(true);
                        if (formData.customerId) {
                           setFormData(prev => ({ ...prev, customerId: '', customerName: '', customerPhone: '' }));
                           setCustomerCodeSearchTerm('');
                        }
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 200)}
                      className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 bg-gray-50/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all font-medium"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                    {isCustomerDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-y-auto outline-none">
                        {filteredCustomers.length === 0 ? (
                          <div className="p-3 text-center text-xs text-gray-500">Pelanggan tidak ditemukan.</div>
                        ) : (
                          filteredCustomers.map(c => (
                            <div
                              key={c.id}
                              className={`p-2.5 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${formData.customerId === c.id ? 'bg-indigo-50/50' : ''}`}
                              onClick={() => handleCustomerSelect(c.id)}
                            >
                              <div className="font-semibold text-sm text-gray-900">{c.name}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Customer Code</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Ketik kode pelanggan..."
                      value={customerCodeSearchTerm}
                      onChange={(e) => {
                        setCustomerCodeSearchTerm(e.target.value);
                        setIsCustomerCodeDropdownOpen(true);
                        if (formData.customerId) {
                          setFormData(prev => ({ ...prev, customerId: '', customerName: '', customerPhone: '' }));
                          setCustomerSearchTerm('');
                        }
                      }}
                      onFocus={() => setIsCustomerCodeDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsCustomerCodeDropdownOpen(false), 200)}
                      className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 bg-gray-50/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all font-medium font-mono"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                    {isCustomerCodeDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-y-auto outline-none">
                        {filteredCustomersByCode.length === 0 ? (
                          <div className="p-3 text-center text-xs text-gray-500">Pelanggan tidak ditemukan.</div>
                        ) : (
                          filteredCustomersByCode.map(c => (
                            <div
                              key={c.id}
                              className={`p-2.5 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${formData.customerId === c.id ? 'bg-indigo-50/50' : ''}`}
                              onClick={() => handleCustomerSelect(c.id)}
                            >
                              <div className="font-mono text-gray-900 text-xs font-semibold">{c.code}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {formData.customerId && (() => {
                const selectedCust = customers.find(c => c.id === formData.customerId);
                if (!selectedCust) return null;
                
                return (
                  <div className="bg-gray-50/50 rounded-lg border border-gray-100 p-4 mt-3">
                    <h4 className="text-xs font-bold text-gray-900 mb-3">Detail Pelanggan</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Nama Lengkap</span>
                        <span className="font-medium text-gray-900">{selectedCust.name}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Nomor Telepon</span>
                        <span className="font-medium text-gray-900">{selectedCust.phone || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Email</span>
                        <span className="font-medium text-gray-900">{selectedCust.email || '-'}</span>
                      </div>
                      <div className="md:col-span-2 lg:col-span-3">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Alamat Lengkap</span>
                        <span className="font-medium text-gray-900">
                          {selectedCust.address || '-'}
                          {selectedCust.village && `, ${selectedCust.village}`}
                          {selectedCust.district && `, ${selectedCust.district}`}
                          {selectedCust.regency && `, ${selectedCust.regency}`}
                          {selectedCust.province && `, ${selectedCust.province}`}
                        </span>
                        {selectedCust.locationUrl && (
                          <div className="mt-1">
                            <a href={selectedCust.locationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                              Buka Peta (Share Loc)
                            </a>
                          </div>
                        )}
                      </div>
                      {selectedCust.notes && (
                        <div className="md:col-span-2 lg:col-span-3">
                          <span className="block text-xs font-semibold text-gray-500 mb-1">Keterangan</span>
                          <span className="font-medium text-gray-900 whitespace-pre-wrap">{selectedCust.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 2. Waktu & Jadwal */}
          <div className={`bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-4 sm:p-5 transition-all ${!formData.customerId ? 'opacity-60 pointer-events-none relative' : ''}`}>
            {!formData.customerId && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[1px] rounded-xl">
                <span className="bg-white px-4 py-2 font-bold text-sm text-indigo-600 rounded-lg shadow-sm border border-indigo-100">
                  Pilih pelanggan terlebih dahulu
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Informasi Booking</h3>
                <p className="text-xs text-gray-500">Tentukan jadwal dan pesanan layanan pelanggan.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Pilih Layanan <span className="text-red-500">*</span></label>
                  <div className="flex gap-2.5">
                    <div className="relative flex-1">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 bg-gray-50/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all appearance-none font-medium"
                      >
                        <option value="">Cari dan Pilih Layanan...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      disabled={!selectedProductId}
                      className="px-5 py-2 text-sm bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>

                <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50/50 min-h-[90px] flex flex-col justify-center">
                  {bookingItems.length === 0 ? (
                    <div className="text-center text-gray-500">
                      <Calendar className="w-6 h-6 mx-auto mb-1.5 text-gray-400 opacity-50" />
                      <p className="text-xs">Belum ada layanan yang dipilih.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {bookingItems.map((item, idx) => (
                        <div key={item.productId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-gray-200">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                            <p className="text-xs text-gray-500">Rp {item.price.toLocaleString('id-ID')} / pax</p>
                          </div>
                          
                          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                            <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-md border border-gray-200">
                              <button
                                type="button"
                                onClick={() => handleItemQuantityChange(item.productId, item.quantity - 1)}
                                className="w-5 h-5 flex items-center justify-center rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-bold"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleItemQuantityChange(item.productId, item.quantity + 1)}
                                className="w-5 h-5 flex items-center justify-center rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-bold"
                              >
                                +
                              </button>
                            </div>
                            
                            <div className="text-right min-w-[90px]">
                              <span className="font-bold text-gray-900 text-sm">Rp {item.total.toLocaleString('id-ID')}</span>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(item.productId)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <span className="sr-only">Hapus</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">Tanggal <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        required
                        value={formData.bookingDate}
                        onChange={(e) => setFormData({...formData, bookingDate: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 bg-gray-50/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">Jam <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        required
                        value={formData.bookingTime}
                        onChange={(e) => setFormData({...formData, bookingTime: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 bg-gray-50/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">Peserta/Pax <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.pax}
                        onChange={(e) => setFormData({...formData, pax: parseInt(e.target.value) || 1})}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 bg-gray-50/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">CatatanTambahan</label>
                <div className="relative h-full flex flex-col">
                  <FileText className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full flex-1 min-h-[90px] pl-9 pr-3 py-2 text-sm border border-gray-300 bg-gray-50/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all resize-none"
                    placeholder="Tulis detail/request khusus..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`fixed bottom-0 left-0 ${!isKasir ? 'lg:left-[260px]' : ''} right-0 z-50 p-4 sm:p-5 lg:px-8 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] transition-all`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
              <div className="w-full sm:w-auto">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Total Biaya Layanan</label>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-500 text-base">Rp</span>
                  <span className="font-black text-indigo-700 text-2xl tracking-tight">{totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading || !formData.customerId}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? 'Menyimpan...' : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Simpan Booking
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

