import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { StockOpname, Category, Product, Warehouse } from '../../types';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Printer, 
  Eye, 
  X, 
  Calendar,
  Tag,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: (auth.currentUser as any)?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function StockOpnamePage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<StockOpname[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StockOpname | null>(null);
  
  const [formData, setFormData] = useState({
    period: 'Harian' as 'Harian' | 'Mingguan' | 'Bulanan',
    category: 'all',
    warehouseId: '',
    remark: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const path = 'stock_opnames';
    const q = query(
      collection(db, path),
      where('tenantId', '==', profile.tenantId)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockOpname));
      setRecords(data.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    });

    const catPath = 'categories';
    const catQ = query(
      collection(db, catPath),
      where('tenantId', '==', profile.tenantId)
    );
    const unsubscribeCat = onSnapshot(catQ, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, catPath);
    });

    const whPath = 'warehouses';
    const whQ = query(
      collection(db, whPath),
      where('tenantId', '==', profile.tenantId)
    );
    const unsubscribeWh = onSnapshot(whQ, (snap) => {
      setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, whPath);
    });

    return () => {
      unsubscribe();
      unsubscribeCat();
      unsubscribeWh();
    };
  }, [profile]);

  const handleCreatePlanning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    const selectedWarehouse = warehouses.find(w => w.id === formData.warehouseId);
    if (!selectedWarehouse) {
      alert('Silakan pilih gudang.');
      return;
    }

    const path = 'stock_opnames';
    try {
      // Fetch products based on category
      let productsQuery;
      const productsPath = 'products';
      if (formData.category === 'all') {
        productsQuery = query(collection(db, productsPath), where('tenantId', '==', profile.tenantId));
      } else {
        productsQuery = query(
          collection(db, productsPath), 
          where('tenantId', '==', profile.tenantId),
          where('category', '==', formData.category)
        );
      }

      const productsSnap = await getDocs(productsQuery).catch(err => {
        handleFirestoreError(err, OperationType.LIST, productsPath);
        throw err;
      });

      const items = productsSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as Product))
        .filter(p => p.type !== 'service')
        .map(p => ({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          systemStock: p.stock || 0
        }));

      if (items.length === 0) {
        alert('Tidak ada produk dalam kategori ini.');
        return;
      }

      await addDoc(collection(db, path), {
        tenantId: profile.tenantId,
        date: serverTimestamp(),
        period: formData.period,
        category: formData.category === 'all' ? 'Semua Kategori' : formData.category,
        warehouseId: selectedWarehouse.id,
        warehouseName: selectedWarehouse.name,
        remark: formData.remark,
        createdBy: profile.uid,
        createdByName: profile.displayName || profile.email,
        items: items
      }).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, path);
        throw err;
      });

      setIsModalOpen(false);
      setFormData({ period: 'Harian', category: 'all', warehouseId: '', remark: '' });
    } catch (err) {
      console.error('Error creating stock opname:', err);
      // Error already handled or logged
    }
  };

  const handlePrint = (record: StockOpname) => {
    const doc = new jsPDF();
    const date = record.date?.toDate().toLocaleDateString('id-ID') || '-';
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text('LAPORAN STOCK OPNAME', 14, 22);
    
    // Horizontal Line
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(14, 28, 196, 28);

    // Two Column Layout for Info
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    
    // Column 1
    doc.text('PERIODE', 14, 38);
    doc.text('KATEGORI', 14, 44);
    
    // Column 2
    doc.text('GUDANG', 105, 38);
    doc.text('TANGGAL', 105, 44);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFont('helvetica', 'bold');
    
    // Values Column 1
    doc.text(`: ${record.period}`, 40, 38);
    doc.text(`: ${record.category}`, 40, 44);
    
    // Values Column 2
    doc.text(`: ${record.warehouseName}`, 130, 38);
    doc.text(`: ${date}`, 130, 44);

    // Remark (Full Width below)
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('REMARK', 14, 52);
    
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`: ${record.remark || '-'}`, 40, 52);

    // Footer Info
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak oleh: ${record.createdByName || '-'}`, 14, 60);

    const tableData = record.items.map(item => [
      item.productName,
      item.sku,
      item.systemStock.toString(),
      '..........', // Physical QTY
      '..........'  // Selisih
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['PRODUK', 'SKU', 'STOK SISTEM', 'STOK FISIK', 'SELISIH']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229], // Indigo 600
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' }
      }
    });

    doc.save(`Stock_Opname_${date.replace(/\//g, '-')}.pdf`);
  };

  const handleExportExcel = (record: StockOpname) => {
    const date = record.date?.toDate().toLocaleDateString('id-ID') || '-';
    
    // Prepare metadata rows
    const metadata = [
      ['LAPORAN STOCK OPNAME'],
      [''],
      ['Periode', record.period, '', 'Gudang', record.warehouseName],
      ['Kategori', record.category, '', 'Tanggal', date],
      ['Remark', record.remark || '-'],
      ['Dicetak oleh', record.createdByName || '-'],
      [''],
    ];

    // Prepare table data
    const tableHeaders = ['PRODUK', 'SKU', 'STOK SISTEM', 'STOK FISIK (MANUAL)', 'SELISIH (MANUAL)'];
    const tableRows = record.items.map(item => [
      item.productName,
      item.sku,
      item.systemStock,
      '',
      ''
    ]);

    const wsData = [...metadata, tableHeaders, ...tableRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Produk
      { wch: 20 }, // SKU
      { wch: 15 }, // Stok Sistem
      { wch: 20 }, // Stok Fisik
      { wch: 20 }, // Selisih
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Opname');
    XLSX.writeFile(wb, `Stock_Opname_${date.replace(/\//g, '-')}.xlsx`);
  };

  // Pagination logic
  const totalPages = Math.ceil(records.length / rowsPerPage);
  const paginatedRecords = records.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Memuat data Stock Opname...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Stock Opname</h2>
          <p className="text-gray-500 font-medium">Kelola perencanaan dan riwayat pemeriksaan stok fisik.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          STOCK PLANNING
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Kategori</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Warehouse</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Remark</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {record.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">{record.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Home className="w-3 h-3 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">{record.warehouseName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <MessageSquare className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-500 truncate">{record.remark || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setSelectedRecord(record); setIsDetailModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Detail"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handlePrint(record)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Print PDF"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleExportExcel(record)}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Export Excel"
                      >
                        <FileSpreadsheet className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {records.length > 0 && (
          <div className="p-6 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500 font-bold">
              Menampilkan <span className="text-gray-900">{Math.min(records.length, (currentPage - 1) * rowsPerPage + 1)}</span> - <span className="text-gray-900">{Math.min(records.length, currentPage * rowsPerPage)}</span> dari <span className="text-gray-900">{records.length}</span> data
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                      currentPage === i + 1 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
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
                className="p-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {records.length === 0 && (
          <div className="p-20 text-center">
            <ClipboardList className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Belum ada riwayat Stock Opname.</p>
          </div>
        )}
      </div>

      {/* Stock Planning Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-2xl font-black tracking-tight">Stock Planning</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreatePlanning} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Periode</label>
                    <select
                      required
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="Harian">Harian</option>
                      <option value="Mingguan">Mingguan</option>
                      <option value="Bulanan">Bulanan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Kategori</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="all">Semua Kategori</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gudang (Warehouse)</label>
                    <select
                      required
                      value={formData.warehouseId}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="">Pilih Gudang</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Remark (Catatan)</label>
                    <textarea
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      placeholder="Contoh: Pemeriksaan stok akhir bulan..."
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-32 resize-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 border border-gray-200 rounded-2xl text-gray-600 font-black hover:bg-gray-50 transition-all"
                  >
                    BATAL
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    BUAT PLANNING
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Detail Stock Opname</h3>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                    {selectedRecord.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Periode</p>
                    <p className="text-sm font-black text-gray-900">{selectedRecord.period}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Kategori</p>
                    <p className="text-sm font-black text-gray-900">{selectedRecord.category}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gudang</p>
                    <p className="text-sm font-black text-gray-900">{selectedRecord.warehouseName}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dibuat Oleh</p>
                    <p className="text-sm font-black text-gray-900">{selectedRecord.createdByName}</p>
                  </div>
                </div>

                {selectedRecord.remark && (
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Remark</p>
                    <p className="text-sm font-medium text-indigo-900">{selectedRecord.remark}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-black text-gray-900 uppercase tracking-wider text-sm">Daftar Produk ({selectedRecord.items.length})</h4>
                  </div>
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Stok Sistem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedRecord.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.productName}</td>
                            <td className="px-4 py-3 text-xs font-mono font-bold text-gray-500">{item.sku}</td>
                            <td className="px-4 py-3 text-sm font-black text-indigo-600 text-center">{item.systemStock}</td>
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
                  className="px-6 py-3 border border-gray-200 rounded-2xl text-gray-600 font-black hover:bg-gray-100 transition-all"
                >
                  TUTUP
                </button>
                <button
                  onClick={() => handleExportExcel(selectedRecord)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center"
                >
                  <FileSpreadsheet className="w-5 h-5 mr-2" />
                  EXCEL
                </button>
                <button
                  onClick={() => handlePrint(selectedRecord)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
