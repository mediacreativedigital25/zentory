import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, addDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, Customer, BankAccount } from '../../types';
import { 
  FileText, 
  Search, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  User, 
  CreditCard, 
  AlertCircle,
  CheckCircle2,
  X,
  Printer,
  DollarSign,
  Plus,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Invoices() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isTagihkanModalOpen, setIsTagihkanModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (!profile?.tenantId) return;

    // Fetch unpaid/partial orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('tenantId', '==', profile.tenantId),
      where('paymentStatus', 'in', ['unpaid', 'partial'])
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snap) => {
      const ordersData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      // Sort by date descending for UI (latest first)
      setOrders(ordersData.filter(o => !o.isInCollection).sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching orders:', err);
      setLoading(false);
    });

    // Fetch customers to get codes
    const customersQuery = query(collection(db, 'customers'), where('tenantId', '==', profile.tenantId));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snap) => {
      const customersMap: Record<string, Customer> = {};
      snap.docs.forEach(d => {
        customersMap[d.id] = { id: d.id, ...d.data() } as Customer;
      });
      setCustomers(customersMap);
    });

    // Fetch bank accounts for payment
    const banksQuery = query(collection(db, 'bank_accounts'), where('tenantId', '==', profile.tenantId), where('isActive', '==', true));
    const unsubscribeBanks = onSnapshot(banksQuery, (snap) => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeBanks();
    };
  }, [profile]);

  const filteredOrders = orders.filter(order => {
    const customer = customers[order.customerId || ''];
    const searchLower = search.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      (order.customerName || '').toLowerCase().includes(searchLower) ||
      (customer?.code || '').toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === paginatedOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(paginatedOrders.map(o => o.id));
    }
  };

  const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
  const totalSelectedNominal = selectedOrders.reduce((acc, o) => acc + (o.totalAmount || (o as any).total || 0), 0);
  const totalSelectedSisa = selectedOrders.reduce((acc, o) => acc + ((o.totalAmount || (o as any).total || 0) - (o.paidAmount || 0)), 0);

  const generatePDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' });

    // Header
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE COLLECTION', 105, 15, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const firstCustomerName = selectedOrders.length > 0 ? selectedOrders[0].customerName : '-';
    const allSameCustomer = selectedOrders.every(o => o.customerName === firstCustomerName);
    const displayCustomerName = allSameCustomer ? (firstCustomerName || '-') : 'Berbagai Pelanggan';

    doc.text(`Nama Pelanggan : ${displayCustomerName}`, 14, 25);
    doc.text(`Tanggal Cetak : ${dateStr}`, 14, 31);

    // Table Data with Cumulative Calculation
    let runningTotal = 0;
    const tableData = selectedOrders.map((o, index) => {
      runningTotal += o.totalAmount;
      return [
        (index + 1).toString(),
        o.orderNumber,
        o.date?.toDate().toLocaleDateString('id-ID') || '-',
        o.dueDate?.toDate().toLocaleDateString('id-ID') || '-',
        o.totalAmount.toLocaleString(),
        runningTotal.toLocaleString()
      ];
    });

    const totalNominal = selectedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalPaid = selectedOrders.reduce((acc, o) => acc + (o.paidAmount || 0), 0);
    const totalSisa = totalNominal - totalPaid;

    autoTable(doc, {
      startY: 40,
      head: [['No', 'ID Pesanan', 'Tanggal', 'Jatuh Tempo', 'Nominal', 'Komulatif']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
      },
      styles: { 
        fontSize: 9,
        cellPadding: 2,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 32 },
        3: { cellWidth: 32 },
        4: { halign: 'right', cellWidth: 34 },
        5: { halign: 'right', cellWidth: 34 }
      },
      // Draw summary rows at the bottom right
      didDrawPage: (data) => {
        const finalY = (data as any).cursor.y;
        const col4Width = 34;
        const col5Width = 34;
        const startX = 14 + 10 + 40 + 32 + 32; // Sum of previous columns widths
        const rowHeight = 7;

        doc.setFont('helvetica', 'normal');
        
        // Total Row
        doc.rect(startX, finalY, col4Width, rowHeight);
        doc.text('Total', startX + 2, finalY + 5);
        doc.rect(startX + col4Width, finalY, col4Width, rowHeight);
        doc.text(totalNominal.toLocaleString(), startX + col4Width + col5Width - 2, finalY + 5, { align: 'right' });

        // Terbayar Row
        doc.rect(startX, finalY + rowHeight, col4Width, rowHeight);
        doc.text('Terbayar', startX + 2, finalY + rowHeight + 5);
        doc.rect(startX + col4Width, finalY + rowHeight, col4Width, rowHeight);
        doc.text(totalPaid.toLocaleString(), startX + col4Width + col5Width - 2, finalY + rowHeight + 5, { align: 'right' });

        // Sisa Row
        doc.rect(startX, finalY + rowHeight * 2, col4Width, rowHeight);
        doc.text('Sisa', startX + 2, finalY + rowHeight * 2 + 5);
        doc.rect(startX + col4Width, finalY + rowHeight * 2, col4Width, rowHeight);
        doc.text(totalSisa.toLocaleString(), startX + col4Width + col5Width - 2, finalY + rowHeight * 2 + 5, { align: 'right' });
      }
    });

    doc.save(`Invoice_Collection_${now.getTime()}.pdf`);
  };

  const handleSaveCollection = async () => {
    if (!profile?.tenantId || selectedOrderIds.length === 0) return;

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `IC${year}${month}`;

      // Get next sequence number
      const lastCollectionQuery = query(
        collection(db, 'invoice_collections'),
        where('tenantId', '==', profile.tenantId),
        where('collectionNumber', '>=', prefix),
        where('collectionNumber', '<=', prefix + '\uf8ff'),
        orderBy('collectionNumber', 'desc'),
        limit(1)
      );
      
      const lastSnap = await getDocs(lastCollectionQuery);
      let nextNumber = 1;
      if (!lastSnap.empty) {
        const lastNum = lastSnap.docs[0].data().collectionNumber;
        const sequence = parseInt(lastNum.slice(-6));
        if (!isNaN(sequence)) {
          nextNumber = sequence + 1;
        }
      }
      
      const collectionNumber = `${prefix}${String(nextNumber).padStart(6, '0')}`;
      
      const firstCustomer = selectedOrders.length > 0 ? selectedOrders[0] : null;
      const allSameCustomer = selectedOrders.every(o => o.customerId === firstCustomer?.customerId);
      
      // Sort selected orders by date ascending (oldest first) for FIFO payment distribution
      const sortedSelectedOrders = [...selectedOrders].sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0));

      // Update orders to be in collection
      const updatePromises = sortedSelectedOrders.map(o => 
        updateDoc(doc(db, 'orders', o.id), { isInCollection: true })
      );
      await Promise.all(updatePromises);
      
      await addDoc(collection(db, 'invoice_collections'), {
        tenantId: profile.tenantId,
        collectionNumber,
        customerId: allSameCustomer ? firstCustomer?.customerId : null,
        customerName: allSameCustomer ? (firstCustomer?.customerName || 'Pelanggan') : 'Berbagai Pelanggan',
        date: serverTimestamp(),
        orderIds: sortedSelectedOrders.map(o => o.id),
        orderNumbers: sortedSelectedOrders.map(o => o.orderNumber),
        totalAmount: totalSelectedNominal,
        totalPaid: totalSelectedNominal - totalSelectedSisa,
        totalSisa: totalSelectedSisa,
        createdBy: profile.uid,
        status: 'open',
        createdAt: serverTimestamp()
      });

      setIsTagihkanModalOpen(false);
      setSelectedOrderIds([]);
      alert(`Berhasil menyimpan Invoice Collection #${collectionNumber}`);
    } catch (err) {
      console.error('Error saving collection:', err);
      alert('Gagal menyimpan koleksi tagihan.');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Memuat data Invoice...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Invoices (Tempo)</h2>
          <p className="text-gray-500 font-medium">Daftar tagihan pelanggan yang belum lunas.</p>
        </div>
        <button
          onClick={() => setIsTagihkanModalOpen(true)}
          disabled={selectedOrderIds.length === 0}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none font-black uppercase tracking-widest text-xs"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tagihkan
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan No. Order, Nama Pelanggan, atau Kode..."
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

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 p-2 rounded-lg"
                    checked={selectedOrderIds.length === paginatedOrders.length && paginatedOrders.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Id Pesanan</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nama Pelanggan</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Due Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Nominal</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Sisa</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedOrders.map((order) => {
                const customer = customers[order.customerId || ''];
                const isOverdue = order.dueDate && order.dueDate.toDate() < new Date();
                const isSelected = selectedOrderIds.includes(order.id);
                
                return (
                  <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors group ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 p-2 rounded-lg"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(order.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-indigo-600 uppercase">
                        #{order.orderNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{order.customerName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{customer?.code || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span className="text-xs font-medium">
                          {order.date?.toDate().toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-600' : 'text-orange-600'}`}>
                        <AlertCircle className="w-3 h-3" />
                        <span className="text-xs font-black">
                          {order.dueDate?.toDate().toLocaleDateString('id-ID') || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-gray-900">
                        Rp.{order.totalAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-red-600">
                        Rp.{(order.totalAmount - (order.paidAmount || 0)).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Detail"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="p-20 text-center">
            <FileText className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Tidak ada invoice yang belum lunas.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-lg border border-gray-100 gap-4">
          <p className="text-xs text-gray-500">
            Menampilkan <span className="font-bold text-gray-900">{Math.min(filteredOrders.length, (currentPage - 1) * rowsPerPage + 1)}</span> sampai <span className="font-bold text-gray-900">{Math.min(filteredOrders.length, currentPage * rowsPerPage)}</span> dari <span className="font-bold text-gray-900">{filteredOrders.length}</span> invoice
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
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    currentPage === i + 1 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                      : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
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

      {/* Tagihkan Modal */}
      <AnimatePresence>
        {isTagihkanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-2xl font-black tracking-tight">Ringkasan Tagihan</h3>
                <button onClick={() => setIsTagihkanModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total Pesanan</span>
                    <span className="text-lg font-black text-gray-900">{selectedOrderIds.length} Item</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total Nominal</span>
                    <span className="text-lg font-black text-gray-900">Rp.{totalSelectedNominal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-6 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-sm font-black text-red-700 uppercase tracking-widest">Total Sisa Tagihan</span>
                    <span className="text-2xl font-black text-red-600">Rp.{totalSelectedSisa.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                    Anda akan mencetak ringkasan tagihan untuk {selectedOrderIds.length} pesanan yang dipilih. Pastikan data sudah benar sebelum mencetak.
                  </p>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setIsTagihkanModalOpen(false)}
                  className="col-span-2 sm:col-span-1 px-6 py-4 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-all text-xs"
                >
                  BATAL
                </button>
                <button
                  onClick={handleSaveCollection}
                  className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  <Check className="w-4 h-4" />
                  SIMPAN
                </button>
                <button
                  onClick={generatePDF}
                  className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  <Printer className="w-4 h-4" />
                  CETAK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Detail Invoice</h3>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                    Order #{selectedOrder.orderNumber}
                  </p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pelanggan</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{selectedOrder.customerName}</p>
                          <p className="text-xs text-gray-500 font-bold uppercase">{customers[selectedOrder.customerId || '']?.code || '-'}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tanggal Transaksi</p>
                      <p className="text-sm font-bold text-gray-900">{selectedOrder.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status Pembayaran</p>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                        selectedOrder.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {selectedOrder.paymentStatus}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Jatuh Tempo</p>
                      <p className={`text-sm font-black ${selectedOrder.dueDate?.toDate() < new Date() ? 'text-red-600' : 'text-orange-600'}`}>
                        {selectedOrder.dueDate?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-100 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold">Total Tagihan</span>
                    <span className="font-black text-gray-900">Rp.{selectedOrder.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold">Sudah Dibayar</span>
                    <span className="font-black text-emerald-600">Rp.{(selectedOrder.paidAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Sisa Tagihan</span>
                    <span className="text-xl font-black text-red-600">Rp.{(selectedOrder.totalAmount - (selectedOrder.paidAmount || 0)).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Item Pesanan</h4>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Harga</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-600 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-600 text-right">Rp.{item.price.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm font-black text-gray-900 text-right">Rp.{(item.price * item.quantity).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-3 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-all"
                >
                  TUTUP
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
