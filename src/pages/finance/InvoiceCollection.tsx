import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { InvoiceCollection as InvoiceCollectionType } from '../../types';
import { 
  FileStack, 
  Search, 
  Eye, 
  Trash2,
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  TrendingUp,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoiceCollection() {
  const { profile } = useAuth();
  const [collections, setCollections] = useState<InvoiceCollectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedCollection, setSelectedCollection] = useState<InvoiceCollectionType | null>(null);
  const [selectedCollectionOrders, setSelectedCollectionOrders] = useState<any[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!selectedCollection || !isDetailModalOpen) {
      setSelectedCollectionOrders([]);
      return;
    }

    const fetchOrders = async () => {
      const orders: any[] = [];
      for (const id of selectedCollection.orderIds) {
        const d = await getDocs(query(collection(db, 'orders'), where('__name__', '==', id)));
        if (!d.empty) {
          orders.push({ id: d.docs[0].id, ...d.docs[0].data() });
        }
      }
      setSelectedCollectionOrders(orders);
    };

    fetchOrders();
  }, [selectedCollection, isDetailModalOpen]);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'invoice_collections'),
      where('tenantId', '==', profile.tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setCollections(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceCollectionType)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching collections:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredCollections = collections.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      c.collectionNumber.toLowerCase().includes(searchLower) ||
      (c.customerName || '').toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredCollections.length / rowsPerPage);
  const paginatedCollections = filteredCollections.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const generatePDF = () => {
    if (!selectedCollection) return;
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE COLLECTION SUMMARY', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`No. Koleksi : ${selectedCollection.collectionNumber}`, 14, 25);
    doc.text(`Pelanggan : ${selectedCollection.customerName}`, 14, 30);
    doc.text(`Tanggal : ${selectedCollection.date?.toDate().toLocaleDateString('id-ID')}`, 14, 35);
    doc.text(`Status : ${selectedCollection.status.toUpperCase()}`, 14, 40);

    const tableData = selectedCollectionOrders.length > 0 
      ? selectedCollectionOrders.map((o, idx) => [
          (idx + 1).toString(),
          o.orderNumber,
          o.date?.toDate().toLocaleDateString('id-ID') || '-',
          o.totalAmount.toLocaleString(),
          o.paidAmount?.toLocaleString() || '0',
          (o.totalAmount - (o.paidAmount || 0)).toLocaleString(),
          o.paymentStatus?.toUpperCase() || 'UNKNOWN'
        ])
      : selectedCollection.orderNumbers.map((num, idx) => [
          (idx + 1).toString(),
          num,
          '-',
          '-',
          '-',
          '-',
          'IN COLLECTION'
        ]);

    autoTable(doc, {
      startY: 50,
      head: [['No', 'Order #', 'Date', 'Amount', 'Paid', 'Sisa', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL TAGIHAN: Rp.${selectedCollection.totalAmount.toLocaleString()}`, 140, finalY);
    doc.text(`TOTAL TERBAYAR: Rp.${selectedCollection.totalPaid.toLocaleString()}`, 140, finalY + 7);
    doc.text(`SISA PIUTANG: Rp.${selectedCollection.totalSisa.toLocaleString()}`, 140, finalY + 14);

    doc.save(`Collection_${selectedCollection.collectionNumber}.pdf`);
  };

  const handleCloseCollection = async () => {
    if (!selectedCollection || isUpdating) return;
    
    const hasUnpaid = selectedCollection.totalSisa > 0;
    const msg = hasUnpaid 
      ? 'PERINGATAN: Koleksi ini BELUM LUNAS. Menutup koleksi akan mengembalikan invoice yang belum lunas ke daftar piutang agar bisa ditagihkan kembali. Lanjutkan?'
      : 'Koleksi ini sudah LUNAS. Menutup koleksi akan mengarsipkan data ini. Lanjutkan?';

    if (!confirm(msg)) return;

    setIsUpdating(true);
    try {
      console.log('Closing collection:', selectedCollection.id);
      
      // Free up all orders in this collection from the lock
      if (selectedCollection.orderIds && selectedCollection.orderIds.length > 0) {
        const orderPromises = selectedCollection.orderIds.map(id => 
          updateDoc(doc(db, 'orders', id), { 
            isInCollection: false,
            updatedAt: serverTimestamp()
          })
        );
        await Promise.all(orderPromises);
        console.log(`Freed ${selectedCollection.orderIds.length} orders`);
      }

      await updateDoc(doc(db, 'invoice_collections', selectedCollection.id), {
        status: selectedCollection.totalSisa <= 0 ? 'completed' : 'closed',
        updatedAt: serverTimestamp()
      });
      
      setIsDetailModalOpen(false);
      setSelectedCollection(null);
      alert('Koleksi berhasil ditutup dan data telah diperbarui.');
    } catch (err) {
      console.error('Error closing collection:', err);
      alert('Gagal menutup koleksi. Silakan coba lagi.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReopenCollection = async () => {
    if (!selectedCollection || isUpdating) return;
    
    if (!confirm('Apakah Anda yakin ingin membuka kembali koleksi ini? Status akan menjadi OPEN dan bisa diproses di Pembayaran.')) return;

    setIsUpdating(true);
    try {
      // Re-occupy orders
      const orderPromises = selectedCollection.orderIds.map(id => 
        updateDoc(doc(db, 'orders', id), { isInCollection: true })
      );
      await Promise.all(orderPromises);

      await updateDoc(doc(db, 'invoice_collections', selectedCollection.id), {
        status: 'open'
      });
      setIsDetailModalOpen(false);
      setSelectedCollection(null);
      alert('Koleksi berhasil dibuka kembali.');
    } catch (err) {
      console.error('Error reopening collection:', err);
      alert('Gagal membuka kembali koleksi.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!selectedCollection || isUpdating || profile?.role !== 'superadmin') return;
    
    if (!confirm('DANGEROUS ACTION: Anda akan menghapus permanen data IC ini. Pesanan di dalamnya akan kembali ke status PIUTANG (isInCollection: false). Apakah Anda yakin?')) return;

    setIsUpdating(true);
    try {
      // 1. Free up orders first
      const orderPromises = selectedCollection.orderIds.map(id => 
        updateDoc(doc(db, 'orders', id), { 
          isInCollection: false 
        })
      );
      await Promise.all(orderPromises);

      // 2. Delete the IC record
      await deleteDoc(doc(db, 'invoice_collections', selectedCollection.id));

      setIsDetailModalOpen(false);
      setSelectedCollection(null);
      alert('Koleksi berhasil dihapus permanen.');
    } catch (err) {
      console.error('Error deleting collection:', err);
      alert('Gagal menghapus koleksi.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetOrdersStatus = async () => {
    if (!profile?.tenantId || isResetting) return;
    
    if (!confirm('PERINGATAN: Fitur ini akan mereset status "In Collection" pada SEMUA order Anda agar bisa ditagihkan kembali. Gunakan hanya jika ada data yang "nyangkut". Lanjutkan?')) return;

    setIsResetting(true);
    try {
      const ordersSnap = await getDocs(query(
        collection(db, 'orders'),
        where('tenantId', '==', profile.tenantId),
        where('isInCollection', '==', true)
      ));

      if (ordersSnap.empty) {
        alert('Tidak ada order yang sedang dalam proses koleksi.');
        return;
      }

      const promises = ordersSnap.docs.map(d => updateDoc(d.ref, { isInCollection: false }));
      await Promise.all(promises);
      
      alert(`Berhasil mereset ${ordersSnap.size} order.`);
    } catch (err) {
      console.error('Error resetting orders:', err);
      alert('Gagal mereset status order.');
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold animate-pulse text-lg">Memuat rincian penagihan...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <FileStack className="w-8 h-8 text-indigo-600" />
            Invoice Collection
          </h2>
          <p className="text-gray-500 font-medium">Lacak riwayat penagihan masal per pelanggan.</p>
        </div>

        {profile?.role === 'superadmin' && (
          <button
            onClick={handleResetOrdersStatus}
            disabled={isResetting}
            className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {isResetting ? <Clock className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reset All Collection Flags
          </button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Penagihan</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-gray-900">{collections.length}</span>
            <span className="text-xs text-gray-400 font-bold mb-1">Dihasilkan</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Nominal Tertagih</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-indigo-600">Rp.{collections.reduce((sum, c) => sum + c.totalAmount, 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sisa Piutang (Kolektif)</p>
          <div className="flex items-end gap-2 text-red-600">
            <span className="text-2xl font-black">Rp.{collections.reduce((sum, c) => sum + c.totalSisa, 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan No. Koleksi atau Nama Pelanggan..."
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
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tgl Koleksi</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">No. Invoice Collection</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nama Pelanggan</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty Pesanan</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Tagihan</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Sisa</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedCollections.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      <span className="text-xs font-bold">
                        {item.date?.toDate().toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-indigo-600 uppercase">
                      #{item.collectionNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-sm font-bold text-gray-900">{item.customerName}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-lg">
                      {item.orderIds.length}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-gray-900">
                      Rp.{item.totalAmount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-red-600">
                      Rp.{item.totalSisa.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 mx-auto w-fit ${
                      item.status === 'completed' ? 'bg-green-100 text-green-700' :
                      item.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      item.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {item.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : 
                       item.status === 'cancelled' || item.status === 'closed' ? <XCircle className="w-3 h-3" /> : 
                       <Clock className="w-3 h-3" />}
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => { setSelectedCollection(item); setIsDetailModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCollections.length === 0 && (
          <div className="p-20 text-center">
            <History className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Belum ada riwayat Invoice Collection.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedCollection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Detail Collection</h3>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                    #{selectedCollection.collectionNumber}
                  </p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center sm:text-left">Nama Pelanggan</p>
                      <p className="text-xl font-black text-gray-900">{selectedCollection.customerName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center sm:text-left">Tanggal Koleksi</p>
                      <p className="text-sm font-bold text-gray-900">{selectedCollection.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-right">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center sm:text-right">Total Pesanan</p>
                      <p className="text-xl font-black text-gray-900">{selectedCollection.orderIds.length} Item</p>
                    </div>
                     <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pembuat</p>
                      <p className="text-sm font-bold text-gray-400 uppercase">System Agent</p>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Akumulasi Tagihan</p>
                    <p className="text-2xl font-black text-indigo-600">Rp.{selectedCollection.totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Total Sisa Kolektif</p>
                    <p className="text-2xl font-black text-red-600">Rp.{selectedCollection.totalSisa.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Daftar Order Tercakup
                  </h4>
                  <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <ul className="divide-y divide-gray-50 text-sm">
                      {selectedCollectionOrders.length > 0 ? (
                        selectedCollectionOrders.map((order, idx) => (
                          <li key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                             <div className="flex flex-col">
                               <span className="font-black text-gray-900 uppercase">#{order.orderNumber}</span>
                               <span className="text-[10px] text-gray-400 font-bold tabular-nums">
                                 {order.date?.toDate().toLocaleDateString('id-ID')}
                               </span>
                             </div>
                             <div className="text-right">
                               <p className="font-black text-gray-900">Rp.{(order.totalAmount - (order.paidAmount || 0)).toLocaleString()}</p>
                               <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                 order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                                 order.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-700' :
                                 'bg-red-100 text-red-700'
                               }`}>
                                 {order.paymentStatus}
                               </span>
                             </div>
                          </li>
                        ))
                      ) : (
                        selectedCollection.orderNumbers.map((num, idx) => (
                          <li key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                             <span className="text-sm font-black text-gray-900 uppercase">#{num}</span>
                             <span className="text-xs font-bold text-gray-400 uppercase italic">Memuat Detail...</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={generatePDF}
                    className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black border border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm text-xs uppercase tracking-widest flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak
                  </button>
                  {selectedCollection.status === 'open' && (
                    <button
                      disabled={isUpdating}
                      onClick={handleCloseCollection}
                      className="px-6 py-3 bg-red-100 text-red-600 rounded-2xl font-black border border-red-200 hover:bg-red-200 transition-all shadow-sm text-xs uppercase tracking-widest flex items-center gap-2 group"
                    >
                      <XCircle className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                      Close Collection
                    </button>
                  )}
                  {selectedCollection.status === 'closed' && (
                    <button
                      disabled={isUpdating}
                      onClick={handleReopenCollection}
                      className="px-6 py-3 bg-indigo-100 text-indigo-600 rounded-2xl font-black border border-indigo-200 hover:bg-indigo-200 transition-all shadow-sm text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                      <History className="w-4 h-4" />
                      Reopen Collection
                    </button>
                  )}
                  {profile?.role === 'superadmin' && (
                    <button
                      disabled={isUpdating}
                      onClick={handleDeleteCollection}
                      className="px-6 py-3 bg-white text-red-600 rounded-2xl font-black border border-red-200 hover:bg-red-50 transition-all shadow-sm text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-8 py-3 bg-white border border-gray-200 rounded-2xl text-gray-600 font-black hover:bg-gray-100 transition-all shadow-sm text-xs uppercase tracking-widest"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
