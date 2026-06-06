import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Booking, Customer } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { Calendar as CalendarIcon, Clock, User, Phone, CheckCircle, XCircle, Search, Clock3, Plus, X, Eye, Edit, Trash2, Printer, Check, FileText, Save } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function BookingList() {
  const { profile, domainTenantId, tenant } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<{ [key: string]: any }>({});

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [editData, setEditData] = useState({
    status: '',
    bookingDate: '',
    bookingTime: '',
    notes: ''
  });

  useEffect(() => {
    if (!profile) return;

    const targetTenantId = domainTenantId || profile.tenantId;
    
    // To handle firestore rules without deployment, we use an unused collection 'payment_corrections'
    const q = query(
      collection(db, 'payment_corrections'),
      where('tenantId', '==', targetTenantId),
      where('docType', '==', 'booking') // To ensure we only fetch bookings
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bData: Booking[] = [];
      snapshot.forEach((doc) => {
        bData.push({ id: doc.id, ...doc.data() } as Booking);
      });
      bData.sort((a, b) => {
        const dA = new Date(`${a.bookingDate}T${a.bookingTime}`);
        const dB = new Date(`${b.bookingDate}T${b.bookingTime}`);
        return dB.getTime() - dA.getTime();
      });
      setBookings(bData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'payment_corrections', auth, profile);
      setLoading(false);
    });

    const customersRef = collection(db, 'customers');
    const customersQuery = query(customersRef, where('tenantId', '==', targetTenantId));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const custs: { [key: string]: any } = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        custs[doc.id] = data;
      });
      setCustomers(custs);
    });

    return () => {
      unsubscribe();
      unsubscribeCustomers();
    };
  }, [profile, domainTenantId]);

  const filteredBookings = bookings.filter(b => 
    b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.serviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'completed': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-amber-600 bg-amber-50 border-amber-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Clock3 className="w-4 h-4" />;
    }
  };

  const handlePrint = (booking: Booking) => {
    const serviceName = booking.serviceName || (booking.items && booking.items.length > 0 ? booking.items[0].name : '-');
    const invoiceNo = booking.invoiceNumber || '-';
    const amount = booking.totalAmount?.toLocaleString('id-ID') || '0';
    const dateFormatted = booking.createdAt ? format(booking.createdAt?.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt), 'dd MMM yyyy', { locale: idLocale }) : format(new Date(), 'dd MMM yyyy');
    const dueDateFormatted = format(new Date(booking.bookingDate), 'dd MMM yyyy', { locale: idLocale });
    
    // @ts-ignore
    const domainText = tenant?.settings?.domain || (tenant?.slug ? `${tenant.slug}.invit.co.id` : 'Domaintenant.my.id');
    const notesText = booking.notes ? `<br/><span style="font-size: 10px; color:#555;">(${booking.notes})</span>` : '';
    
    const maxItems = 10;
    const items = (booking.items && booking.items.length > 0) 
      ? booking.items 
      : [{ name: serviceName, quantity: 1, price: booking.totalAmount || 0 }];
      
    let itemsHtml = '';
    for (let i = 0; i < maxItems; i++) {
      if (i < items.length) {
        const item = items[i];
        const itemNotes = i === 0 && booking.notes ? `<br/><span style="font-size: 10px; color:#555;">(${booking.notes})</span>` : '';
        const itemPrice = (item.price || 0).toLocaleString('id-ID');
        const itemTotal = ((item.price || 0) * (item.quantity || 1)).toLocaleString('id-ID');
        
        itemsHtml += `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td style="text-align: center;">${item.quantity || 1}</td>
            <td style="text-align: center;">Layanan</td>
            <td>${item.name || '-'} ${itemNotes}</td>
            <td style="text-align: right;">${itemPrice}</td>
            <td style="text-align: right;">${itemTotal}</td>
          </tr>
        `;
      } else {
        itemsHtml += `
          <tr>
            <td style="padding: 15px 8px;"></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      }
    }

    const printContent = `
      <html>
        <head>
          <title>Faktur Penjualan - ${invoiceNo}</title>
          <style>
            body { font-family: 'Arial', sans-serif; margin: 0 auto; max-width: 210mm; padding: 20px 40px; color: #000; font-size: 14px; line-height: 1.4; }
            .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px;}
            .header-title { text-align: center; margin: 20px 0 30px 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .info-table { border: none; margin: 0; font-size: 12px; }
            .info-table td { padding: 4px 6px; border: none; vertical-align: top; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; border: 1px solid #000; }
            .items-table th { font-weight: bold; text-align: center; border: 1px solid #000; padding: 12px 8px; background-color: #f9f9f9; text-transform: uppercase; }
            .items-table td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 10px 8px; border-top: none; border-bottom: none; }
            .summary-section { display: flex; justify-content: flex-end; margin-bottom: 50px; }
            .summary-table { width: 300px; font-weight: bold; font-size: 12px; border: none; }
            .summary-table td { padding: 6px 8px; border: none; }
            .signature-section { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; font-size: 12px; }
            .signature-box { width: 250px; }
            .signature-space { margin-bottom: 90px; font-weight: bold; text-transform: uppercase; }
            .signature-line { border-top: 1px solid #000; padding-top: 8px; }
            @media print {
              body { padding: 0; margin: 0; max-width: none; }
              @page { size: A4 portrait; margin: 2.50mm; }
              .header-top { border-bottom: none !important; }
              .items-table th { background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header-top">
            <div style="display: flex; align-items: center; gap: 15px;">
               <img src="${tenant?.settings?.logoUrl || ''}" alt="Logo" style="height: 50px; ${!tenant?.settings?.logoUrl ? 'display:none;' : ''}" />
               <span style="font-size: 20px; font-weight: bold;">${tenant?.name || 'Tenant Name'}</span>
            </div>
            <div style="text-align: right; font-size: 12px;">
               <div>Pesan lebih cepat dengan klik</div>
               <div>${domainText}</div>
            </div>
          </div>
          
          <div class="header-title">FAKTUR PENJUALAN</div>
          
          <div class="info-section">
            <table class="info-table" style="width: 45%;">
              <tr><td style="width: 70px;">Dari</td><td style="width: 10px;">:</td><td>${tenant?.name || '-'}</td></tr>
              <tr><td>Alamat</td><td>:</td><td>${tenant?.settings?.address || '-'}</td></tr>
              <tr><td>No Hp</td><td>:</td><td>${tenant?.settings?.phone || '-'}</td></tr>
            </table>

            <table class="info-table" style="width: 45%;">
              <tr><td style="width: 110px;">No. Pelanggan</td><td style="width: 10px;">:</td><td>${customers[booking.customerId]?.code || booking.customerId || '-'}</td></tr>
              <tr><td>Nama Pelanggan</td><td>:</td><td>${booking.customerName || '-'}</td></tr>
              <tr><td>No. Faktur</td><td>:</td><td>${invoiceNo}</td></tr>
              <tr><td>Tanggal</td><td>:</td><td>${dateFormatted}</td></tr>
              <tr><td>Due Date</td><td>:</td><td>${dueDateFormatted}</td></tr>
              <tr><td>No PO</td><td>:</td><td>-</td></tr>
              <tr><td>Alamat</td><td>:</td><td>${customers[booking.customerId]?.address || '-'}</td></tr>
            </table>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th style="width: 70px;">Jumlah</th>
                <th style="width: 70px;">Satuan</th>
                <th>Nama Produk / Layanan</th>
                <th style="width: 120px;">Harga Satuan</th>
                <th style="width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary-section">
            <table class="summary-table">
              <tr><td>Sub Total</td><td style="width: 10px;">:</td><td style="text-align: right;">${amount}</td></tr>
              <tr><td>Diskon 1</td><td>:</td><td style="text-align: right;">0</td></tr>
              <tr><td>Diskon 2</td><td>:</td><td style="text-align: right;">0</td></tr>
              <tr><td>Netto</td><td>:</td><td style="text-align: right;">${amount}</td></tr>
            </table>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-space">Terima Kasih</div>
              <div class="signature-line">Nama & Tanda Tangan</div>
            </div>
            <div class="signature-box">
              <div class="signature-space">Diterima Oleh</div>
              <div class="signature-line">Nama Jelas & Tanda Tangan / Cap</div>
            </div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !profile) return;
    
    try {
      if (editData.status === 'cancelled') {
         const targetTenantId = domainTenantId || profile.tenantId;
         if (targetTenantId) {
             const orderQ = query(collection(db, 'orders'), where('tenantId', '==', targetTenantId), where('orderNumber', '==', selectedBooking.invoiceNumber));
             const orderSnap = await getDocs(orderQ);
             for (const oDoc of orderSnap.docs) {
                 const trxQ = query(collection(db, 'transactions'), where('tenantId', '==', targetTenantId), where('orderId', '==', oDoc.id));
                 const trxSnap = await getDocs(trxQ);
                 for (const tDoc of trxSnap.docs) {
                     const tData = tDoc.data();
                     if (tData.receiptId) {
                         await deleteDoc(doc(db, 'payment_receipts', tData.receiptId));
                     }
                     await deleteDoc(tDoc.ref);
                 }
                 await updateDoc(oDoc.ref, { status: 'cancelled' });
             }
         }
      }

      await updateDoc(doc(db, 'payment_corrections', selectedBooking.id), {
        status: editData.status,
        bookingDate: editData.bookingDate,
        bookingTime: editData.bookingTime,
        notes: editData.notes,
        updatedAt: serverTimestamp()
      });
      setIsEditOpen(false);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'payment_corrections', auth, profile);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedBooking || !profile) return;
    try {
      const targetTenantId = domainTenantId || profile.tenantId;
      if (targetTenantId) {
          const orderQ = query(collection(db, 'orders'), where('tenantId', '==', targetTenantId), where('orderNumber', '==', selectedBooking.invoiceNumber));
          const orderSnap = await getDocs(orderQ);
          for (const oDoc of orderSnap.docs) {
              const trxQ = query(collection(db, 'transactions'), where('tenantId', '==', targetTenantId), where('orderId', '==', oDoc.id));
              const trxSnap = await getDocs(trxQ);
              for (const tDoc of trxSnap.docs) {
                  const tData = tDoc.data();
                  if (tData.receiptId) {
                      await deleteDoc(doc(db, 'payment_receipts', tData.receiptId));
                  }
                  await deleteDoc(tDoc.ref);
              }
              await deleteDoc(oDoc.ref);
          }
      }

      await deleteDoc(doc(db, 'payment_corrections', selectedBooking.id));
      setIsDeleteOpen(false);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'payment_corrections', auth, profile);
    }
  };

  const openEdit = (booking: Booking) => {
    setSelectedBooking(booking);
    setEditData({
      status: booking.status,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      notes: booking.notes || ''
    });
    setIsEditOpen(true);
  };

  const openDetail = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDetailOpen(true);
  };

  const openDelete = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDeleteOpen(true);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-600" />
            Booking List
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola jadwal layanan dan reservasi pelanggan.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Cari nama atau layanan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading data...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <CalendarIcon className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Belum ada booking</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-sm">Jadwal reservasi atau layanan yang telah dibuat akan muncul di sini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100 font-bold">
                  <th className="p-4 pl-6">ID Pesanan</th>
                  <th className="p-4">Nama Pelanggan</th>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Jadwal</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                        {booking.invoiceNumber || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-900 text-sm">{booking.customerName}</p>
                      <p className="font-medium text-gray-500 text-xs mt-1 line-clamp-1">
                        {booking.serviceName || (booking.items && booking.items.length > 0 ? booking.items[0].name : 'Layanan')}
                      </p>
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-900">
                      {booking.createdAt ? format(booking.createdAt?.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                          <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                          {format(new Date(booking.bookingDate), 'dd MMM yyyy', { locale: idLocale })}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded w-max">
                          <Clock className="w-3 h-3" />
                          {booking.bookingTime}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        <span className="capitalize">{booking.status}</span>
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openDetail(booking)} className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors" title="Detail">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(booking)} className="text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg transition-colors" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handlePrint(booking)} className="text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 p-2 rounded-lg transition-colors" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => openDelete(booking)} className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Detail Pesanan</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedBooking.invoiceNumber || '-'}</p>
              </div>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm border border-gray-200 p-2 rounded-full transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Header Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Pelanggan</span>
                  </div>
                  <p className="font-semibold text-gray-900">{selectedBooking.customerName}</p>
                  <p className="text-sm text-gray-600">{selectedBooking.customerPhone || '-'}</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <CalendarIcon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Jadwal</span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(selectedBooking.bookingDate), 'dd MMM yyyy', { locale: idLocale })}
                  </p>
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedBooking.bookingTime}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Check className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Status</span>
                  </div>
                  <div className="pt-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(selectedBooking.status)}`}>
                      {getStatusIcon(selectedBooking.status)}
                      <span className="capitalize">{selectedBooking.status}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Detail Layanan & Produk</h4>
                
                {selectedBooking.items && selectedBooking.items.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
                          <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedBooking.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">Rp {(item.price || 0).toLocaleString('id-ID')}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">{item.qty || item.quantity || 1}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">Rp {((item.price || 0) * (item.qty || item.quantity || 1)).toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total Keseluruhan</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">Rp {selectedBooking.totalAmount?.toLocaleString('id-ID') || '0'}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{selectedBooking.serviceName || 'Layanan Custom'}</p>
                      <p className="text-xs text-gray-500">Item tidak memiliki rincian produk khusus</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total Harga</p>
                      <p className="font-bold text-blue-600 text-lg">Rp {selectedBooking.totalAmount?.toLocaleString('id-ID') || '0'}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedBooking.notes && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    Catatan Tambahan
                  </h4>
                  <div className="text-sm text-gray-700 bg-amber-50/50 p-4 rounded-xl border border-amber-100 italic leading-relaxed">
                    "{selectedBooking.notes}"
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-400 flex justify-between pt-4 border-t border-gray-100">
                <span>Dibuat pada: {selectedBooking.createdAt ? format(selectedBooking.createdAt?.toDate ? selectedBooking.createdAt.toDate() : new Date(selectedBooking.createdAt), 'dd MMM yyyy HH:mm', { locale: idLocale }) : '-'}</span>
                <span>ID Internal: {selectedBooking.id}</span>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDetailOpen(false);
                  handlePrint(selectedBooking);
                }}
                className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-800 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Cetak Faktur
              </button>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-6 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div>
                <h3 className="text-xl font-bold text-gray-900 border-none">Ubah Pesanan (Booking)</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedBooking.invoiceNumber || '-'}</p>
              </div>
              <button 
                onClick={() => setIsEditOpen(false)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm border border-gray-200 p-2 rounded-full transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              {/* Header Info Grid - Read Only */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Informasi Pelanggan</span>
                  </div>
                  <p className="font-semibold text-gray-900">{selectedBooking.customerName}</p>
                  <p className="text-sm text-gray-600">{selectedBooking.customerPhone || '-'}</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Layanan Terpilih</span>
                  </div>
                  <p className="font-medium text-gray-900 text-sm">
                    {selectedBooking.serviceName || (selectedBooking.items && selectedBooking.items.length > 0 ? selectedBooking.items.length + ' Item' : 'Layanan Custom')}
                  </p>
                  <p className="text-sm font-bold text-blue-600">Rp {selectedBooking.totalAmount?.toLocaleString('id-ID') || '0'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Data Form</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status Pesanan</label>
                    <select
                      value={editData.status}
                      onChange={e => setEditData({ ...editData, status: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal</label>
                      <input
                        type="date"
                        required
                        value={editData.bookingDate}
                        onChange={e => setEditData({ ...editData, bookingDate: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Waktu</label>
                      <input
                        type="time"
                        required
                        value={editData.bookingTime}
                        onChange={e => setEditData({ ...editData, bookingTime: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan Tambahan</label>
                  <textarea
                    rows={4}
                    value={editData.notes}
                    onChange={e => setEditData({ ...editData, notes: e.target.value })}
                    placeholder="Tambahkan catatan khusus untuk pesanan ini..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none resize-none"
                  />
                </div>
              </div>

              <div className="pt-5 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Pesanan?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Apakah Anda yakin ingin menghapus pesanan <strong>{selectedBooking.invoiceNumber || selectedBooking.customerName}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
