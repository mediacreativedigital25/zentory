import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Product, Category } from '../../types';
import { Search, Filter, Package, ArrowRight, AlertCircle, Printer, FileText, FileSpreadsheet, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Stock() {
  const { profile, domainTenantId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'out'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const targetTenantId = domainTenantId || profile.tenantId;

    const q = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('tenantId', '==', targetTenantId));
      
    const unsubscribe = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching products:", err);
      setLoading(false);
    });

    // Fetch categories for filtering
    const catQ = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'categories')
      : query(collection(db, 'categories'), where('tenantId', '==', targetTenantId));
    
    const unsubscribeCat = onSnapshot(catQ, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    return () => {
      unsubscribe();
      unsubscribeCat();
    };
  }, [profile, domainTenantId]);

  const filteredProducts = products.filter(p => {
    // Exclude service products (Jasa) from stock monitoring as they don't have physical stock
    if (p.type === 'service') return false;
    
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStock = stockFilter === 'all' ? true : stockFilter === 'available' ? p.stock > 0 : p.stock <= 0;
    const matchesCategory = selectedCategory === 'all' ? true : p.category === selectedCategory;
    return matchesSearch && matchesStock && matchesCategory;
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN STOK PRODUK', 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFont('helvetica', 'normal');
    doc.text(`Tanggal Cetak: ${dateStr}`, 105, 32, { align: 'center' });

    // Horizontal Line
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(14, 40, 196, 40);

    const tableData: string[][] = [];
    filteredProducts.forEach(p => {
      tableData.push([
        p.name,
        p.sku,
        p.category,
        p.stock.toString(),
        '', // Physical QTY placeholder
        ''  // Total placeholder
      ]);
      
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          tableData.push([
            `   - ${v.name}`,
            v.sku,
            '',
            v.stock.toString(),
            '',
            ''
          ]);
        });
      }
    });

    autoTable(doc, {
      startY: 48,
      head: [['PRODUK', 'SKU', 'KATEGORI', 'QTY SISTEM', 'QTY FISIK', 'SELISIH']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229], // Indigo 600
        textColor: 255, 
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      styles: { 
        fontSize: 8,
        cellPadding: 4
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { halign: 'center', fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'center' }
      }
    });

    doc.save(`Laporan_Stok_${now.getTime()}.pdf`);
    setIsPrintModalOpen(false);
  };

  const handleExportExcel = () => {
    const date = new Date().toLocaleDateString('id-ID');
    const data: any[] = [];
    filteredProducts.forEach(p => {
      data.push({
        'Produk': p.name,
        'SKU': p.sku,
        'Kategori': p.category,
        'QTY System': p.stock,
        'QTY FISIK (Manual)': '',
        'Total (Manual)': ''
      });

      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          data.push({
            'Produk': `   - ${v.name}`,
            'SKU': v.sku,
            'Kategori': '',
            'QTY System': v.stock,
            'QTY FISIK (Manual)': '',
            'Total (Manual)': ''
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Opname');
    XLSX.writeFile(wb, `Stock_Opname_${date.replace(/\//g, '-')}.xlsx`);
    setIsPrintModalOpen(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Stock Data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Produk</h2>
          <p className="text-gray-500">Pantau ketersediaan stok produk Anda di semua gudang.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari produk berdasarkan nama atau SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-medium"
          >
            <option value="all">Semua Kategori</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${stockFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Semua
            </button>
            <button
              onClick={() => setStockFilter('available')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${stockFilter === 'available' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tersedia
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${stockFilter === 'out' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Habis
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Kategori</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Stok</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Harga Jual</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map((product) => (
                <React.Fragment key={product.id}>
                  <tr className="hover:bg-gray-50/50 transition-colors group border-b border-gray-50 items-center">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                          <img
                            src={product.imageUrl || `https://picsum.photos/seed/${product.id}/100/100`}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">
                            {product.name}
                            {(product.variants && product.variants.length > 0) && (
                              <span className="ml-2 text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-black">Variasi</span>
                            )}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black shadow-sm ${
                          product.stock > 10 ? 'bg-green-500 text-white' : 
                          product.stock > 0 ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {product.stock} UNIT
                        </span>
                        {product.stock <= 5 && product.stock > 0 && (
                          <span className="text-[9px] font-black text-yellow-600 animate-pulse uppercase tracking-tighter">Stok Menipis</span>
                        )}
                        {product.stock <= 0 && (
                          <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">Stok Habis</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-indigo-600">Rp.{(product.price || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link 
                        to={`/inventory/products?tab=history&search=${product.sku || product.name}`}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                      >
                        <History className="w-4 h-4" />
                        Riwayat
                      </Link>
                    </td>
                  </tr>
                  
                  {/* Variant Rows */}
                  {product.variants && product.variants.length > 0 && product.variants.map((v: any) => (
                    <tr key={v.id} className="bg-gray-50/30 text-[11px] group border-b border-gray-50/50">
                      <td className="px-6 py-2 pl-16">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>
                          <span className="font-bold text-gray-700">{v.name}</span>
                          <span className="text-[9px] text-gray-400 font-mono">({v.sku})</span>
                        </div>
                      </td>
                      <td className="px-6 py-2">
                        <span className="text-[9px] text-gray-400 italic">Sub-Item</span>
                      </td>
                      <td className="px-6 py-2">
                        <div className="flex justify-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            v.stock > 0 ? 'text-gray-600 bg-white border border-gray-100' : 'text-red-400'
                          }`}>
                            {v.stock} unit
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-2 text-right">
                        <span className="text-gray-500">Rp.{v.price.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-2 text-center"></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">Tidak ada produk yang sesuai dengan filter Anda.</p>
          </div>
        )}
      </div>

      {/* Print Modal */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">Export Stock Opname</h3>
                <button onClick={() => setIsPrintModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <Printer className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="text-center">
                  <p className="text-gray-500 mb-6">Pilih format file untuk laporan stock opname Anda. Laporan akan difilter berdasarkan kategori yang sedang dipilih.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleExportPDF}
                      className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                    >
                      <FileText className="w-10 h-10 text-red-500 mb-3 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-gray-900">PDF Document</span>
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-gray-100 hover:border-green-600 hover:bg-green-50 transition-all group"
                    >
                      <FileSpreadsheet className="w-10 h-10 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-gray-900">Excel Sheet</span>
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Informasi Laporan</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Produk:</span>
                      <span className="font-bold text-gray-900">{filteredProducts.length} Item</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Filter Kategori:</span>
                      <span className="font-bold text-indigo-600">{selectedCategory === 'all' ? 'Semua' : selectedCategory}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-6 py-2 text-gray-600 font-bold hover:text-gray-900"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
