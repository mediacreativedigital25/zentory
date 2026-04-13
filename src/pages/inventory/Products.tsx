import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Product, Category, Warehouse, StockLog } from '../../types';
import { Plus, Search, Edit2, Trash2, Package, X, Barcode, DollarSign, Image as ImageIcon, RefreshCw, Upload, Camera, Printer, Wand2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';
import ImageUpload from '../../components/ImageUpload';
import BarcodeScanner from '../../components/BarcodeScanner';
import PrintBarcodeModal from '../../components/PrintBarcodeModal';
import { logStockChange } from '../../lib/stock-logger';

export default function Products() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [printData, setPrintData] = useState<{ name: string; barcode: string }[]>([]);
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [bulkProducts, setBulkProducts] = useState<any[]>([{
    name: '',
    sku: '',
    barcode: '',
    hpp: 0,
    price: 0,
    stock: 0,
    category: '',
    warehouseId: '',
    description: '',
    imageUrl: '',
    type: 'manual' as const
  }]);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'history'>('products');
  const [globalStockLogs, setGlobalStockLogs] = useState<StockLog[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    hpp: 0,
    price: 0,
    stock: 0,
    category: '',
    warehouseId: '',
    description: '',
    imageUrl: '',
    type: 'manual' as 'manual' | 'service',
  });

  useEffect(() => {
    if (!profile) return;

    const productsQuery = profile.role === 'superadmin' 
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('tenantId', '==', profile.tenantId));
      
    const categoriesQuery = profile.role === 'superadmin'
      ? collection(db, 'categories')
      : query(collection(db, 'categories'), where('tenantId', '==', profile.tenantId));
      
    const warehousesQuery = profile.role === 'superadmin'
      ? collection(db, 'warehouses')
      : query(collection(db, 'warehouses'), where('tenantId', '==', profile.tenantId));

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    const unsubCategories = onSnapshot(categoriesQuery, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    const unsubWarehouses = onSnapshot(warehousesQuery, (snap) => {
      setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    });

    let unsubLogs = () => {};
    if (selectedProductForHistory) {
      const logsQuery = query(
        collection(db, 'stock_logs'),
        where('productId', '==', selectedProductForHistory.id),
        orderBy('createdAt', 'desc')
      );
      unsubLogs = onSnapshot(logsQuery, (snap) => {
        setStockLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockLog)));
      });
    }

    let unsubGlobalLogs = () => {};
    if (activeTab === 'history' && profile?.tenantId) {
      const startTimestamp = new Date(dateRange.start);
      startTimestamp.setHours(0, 0, 0, 0);
      const endTimestamp = new Date(dateRange.end);
      endTimestamp.setHours(23, 59, 59, 999);

      const globalLogsQuery = query(
        collection(db, 'stock_logs'),
        where('tenantId', '==', profile.tenantId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      unsubGlobalLogs = onSnapshot(globalLogsQuery, (snap) => {
        setGlobalStockLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockLog)));
      });
    }

    return () => {
      unsubProducts();
      unsubCategories();
      unsubWarehouses();
      unsubLogs();
      unsubGlobalLogs();
    };
  }, [profile, selectedProductForHistory, activeTab, dateRange]);

  const generateServiceSKU = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'J';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateSKU = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'P';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const addBulkRow = () => {
    setBulkProducts([...bulkProducts, {
      name: '',
      sku: generateSKU(),
      barcode: '',
      hpp: 0,
      price: 0,
      stock: 0,
      category: '',
      warehouseId: '',
      description: '',
      imageUrl: '',
      type: 'manual' as const
    }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkProducts.length === 1) return;
    setBulkProducts(bulkProducts.filter((_, i) => i !== index));
  };

  const updateBulkRow = (index: number, field: string, value: any) => {
    const newRows = [...bulkProducts];
    newRows[index] = { ...newRows[index], [field]: value };
    setBulkProducts(newRows);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    setConfirmConfig({
      isOpen: true,
      title: 'Simpan Bulk Produk',
      message: `Apakah Anda yakin ingin menyimpan ${bulkProducts.length} produk sekaligus?`,
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          for (const product of bulkProducts) {
            const docRef = await addDoc(collection(db, 'products'), {
              ...product,
              tenantId: profile.tenantId,
              createdAt: serverTimestamp(),
            });

            if (product.stock > 0) {
              await logStockChange(
                profile.tenantId!,
                docRef.id,
                product.name,
                'IN',
                product.stock,
                0,
                product.stock,
                profile.uid,
                profile.displayName || 'System',
                undefined,
                'Initial bulk stock'
              );
            }
          }
          setIsBulkModalOpen(false);
          setBulkProducts([{
            name: '',
            sku: '',
            barcode: '',
            hpp: 0,
            price: 0,
            stock: 0,
            category: '',
            warehouseId: '',
            description: '',
            imageUrl: '',
            type: 'manual' as const
          }]);
        } catch (err) {
          console.error(err);
          alert('Failed to save bulk products.');
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    // Check for unique SKU and Barcode (simple client-side check for now)
    const duplicateSku = products.find(p => p.sku === formData.sku && p.id !== editingProduct?.id);
    if (duplicateSku) {
      alert('SKU already exists. Please use a unique SKU.');
      return;
    }

    if (formData.barcode) {
      const duplicateBarcode = products.find(p => p.barcode === formData.barcode && p.id !== editingProduct?.id);
      if (duplicateBarcode) {
        alert('Barcode already exists. Please use a unique Barcode.');
        return;
      }
    }

    setConfirmConfig({
      isOpen: true,
      title: editingProduct ? 'Simpan Perubahan' : 'Tambah Produk',
      message: editingProduct ? 'Apakah Anda yakin ingin menyimpan perubahan pada produk ini?' : 'Apakah Anda yakin ingin menambah produk baru ke inventaris?',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          if (editingProduct) {
            const stockDiff = formData.stock - editingProduct.stock;
            await updateDoc(doc(db, 'products', editingProduct.id), formData);
            
            if (stockDiff !== 0) {
              await logStockChange(
                profile.tenantId!,
                editingProduct.id,
                formData.name,
                stockDiff > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT',
                Math.abs(stockDiff),
                editingProduct.stock,
                formData.stock,
                profile.uid,
                profile.displayName || 'System',
                undefined,
                'Manual adjustment'
              );
            }
          } else {
            const docRef = await addDoc(collection(db, 'products'), {
              ...formData,
              tenantId: profile.tenantId,
              createdAt: serverTimestamp(),
            });

            if (formData.stock > 0) {
              await logStockChange(
                profile.tenantId!,
                docRef.id,
                formData.name,
                'IN',
                formData.stock,
                0,
                formData.stock,
                profile.uid,
                profile.displayName || 'System',
                undefined,
                'Initial stock'
              );
            }
          }
          setIsModalOpen(false);
          setEditingProduct(null);
          setFormData({ name: '', sku: '', barcode: '', hpp: 0, price: 0, stock: 0, category: '', warehouseId: '', description: '', imageUrl: '', type: 'manual' });
        } catch (err) {
          console.error(err);
          alert('Failed to save product.');
        }
      }
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Produk',
      message: 'Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteDoc(doc(db, 'products', id));
      }
    });
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      hpp: product.hpp,
      price: product.price,
      stock: product.stock,
      category: product.category,
      warehouseId: product.warehouseId || '',
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      type: product.type || 'manual',
    });
    setIsModalOpen(true);
  };

  const generateBarcode = () => {
    // Generate a 12-digit numeric barcode
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return timestamp + random;
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkPrint = () => {
    const productsToPrint = products
      .filter(p => selectedProducts.includes(p.id) && p.barcode)
      .map(p => ({ name: p.name, barcode: p.barcode! }));
    
    if (productsToPrint.length === 0) {
      alert('Pilih setidaknya satu produk yang memiliki barcode untuk dicetak.');
      return;
    }
    
    setPrintData(productsToPrint);
    setIsPrintModalOpen(true);
  };

  const handleScan = (barcode: string) => {
    if (scanningIndex !== null) {
      updateBulkRow(scanningIndex, 'barcode', barcode);
    } else {
      setFormData({ ...formData, barcode });
    }
    setScanningIndex(null);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Produk</h2>
          <p className="text-gray-500">Kelola daftar produk, HPP, dan harga jual.</p>
        </div>
        <div className="flex gap-3">
          {selectedProducts.length > 0 && (
            <button
              onClick={handleBulkPrint}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-700 transition-colors shadow-lg shadow-green-100"
            >
              <Printer className="w-5 h-5 mr-2" />
              Cetak Label ({selectedProducts.length})
            </button>
          )}
          <button
            onClick={() => { 
              setBulkProducts([{
                name: '',
                sku: generateSKU(),
                barcode: '',
                hpp: 0,
                price: 0,
                stock: 0,
                category: '',
                warehouseId: '',
                description: '',
                imageUrl: '',
                type: 'manual' as const
              }]);
              setIsBulkModalOpen(true); 
            }}
            className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg flex items-center hover:bg-indigo-100 transition-colors border border-indigo-100"
          >
            <Barcode className="w-5 h-5 mr-2" />
            Bulk Scan Barcode
          </button>
          <button
            onClick={() => { 
              setEditingProduct(null); 
              setFormData({ 
                name: '', 
                sku: generateSKU(), 
                barcode: '', 
                hpp: 0, 
                price: 0, 
                stock: 0, 
                category: '', 
                warehouseId: '', 
                description: '', 
                imageUrl: '', 
                type: 'manual' 
              }); 
              setIsModalOpen(true); 
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Manual
          </button>
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'products' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Daftar Produk
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Riwayat Stok
        </button>
      </div>

      {activeTab === 'products' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts(products.map(p => p.id));
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                    checked={selectedProducts.length === products.length && products.length > 0}
                  />
                </th>
                <th className="px-6 py-4 font-medium">Produk</th>
                <th className="px-6 py-4 font-medium">SKU / Barcode</th>
                <th className="px-6 py-4 font-medium">Kategori</th>
                <th className="px-6 py-4 font-medium">Tipe</th>
                <th className="px-6 py-4 font-medium">HPP</th>
                <th className="px-6 py-4 font-medium">Harga Jual</th>
                <th className="px-6 py-4 font-medium">Stock</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${selectedProducts.includes(product.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 mr-3 overflow-hidden">
                        <img
                          src={product.imageUrl || `https://picsum.photos/seed/${product.id}/100/100`}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    <div>{product.sku}</div>
                    {product.barcode && <div className="text-[10px] text-gray-400 flex items-center"><Barcode className="w-3 h-3 mr-1" /> {product.barcode}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{product.category}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      product.type === 'service' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {product.type === 'service' ? 'JASA' : 'MANUAL'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 italic">
                    {product.type === 'service' ? '-' : `Rp.${(product.hpp || 0).toLocaleString()}`}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-indigo-600">Rp.{(product.price || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {product.type === 'service' ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">
                        NON-STOCK
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        product.stock > 10 ? 'bg-green-50 text-green-700' : 
                        product.stock > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {product.stock} TERSEDIA
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => {
                          setSelectedProductForHistory(product);
                          setIsHistoryModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Riwayat Stok"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(product)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {product.barcode && (
                        <button 
                          onClick={() => {
                            setPrintData([{ name: product.name, barcode: product.barcode! }]);
                            setIsPrintModalOpen(true);
                          }} 
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Print Barcode"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(product.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada produk. Mulai dengan menambah satu!</p>
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cari Produk / SKU</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama produk atau SKU..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Dari Tanggal</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="w-48">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sampai Tanggal</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <button
            onClick={() => {
              setDateRange({
                start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              });
              setHistorySearch('');
            }}
            className="px-4 py-2 text-gray-500 hover:text-indigo-600 font-bold text-sm"
          >
            Reset
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-bold">Waktu</th>
                  <th className="px-6 py-4 font-bold">Produk</th>
                  <th className="px-6 py-4 font-bold">Tipe</th>
                  <th className="px-6 py-4 font-bold text-right">Qty</th>
                  <th className="px-6 py-4 font-bold text-right">Sblm</th>
                  <th className="px-6 py-4 font-bold text-right">Ssdh</th>
                  <th className="px-6 py-4 font-bold">Referensi</th>
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {globalStockLogs
                  .filter(log => 
                    log.productName?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    log.productId?.toLowerCase().includes(historySearch.toLowerCase())
                  )
                  .map((log) => (
                  <tr key={log.id} className="text-xs hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{log.productName}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{log.productId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        log.type === 'IN' || log.type === 'PURCHASE' ? 'bg-green-100 text-green-700' :
                        log.type === 'OUT' || log.type === 'SALE' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${
                      log.type === 'IN' || log.type === 'PURCHASE' ? 'text-green-600' :
                      log.type === 'OUT' || log.type === 'SALE' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {log.type === 'IN' || log.type === 'PURCHASE' ? '+' : '-'}{log.quantity}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400">{log.previousStock}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{log.currentStock}</td>
                    <td className="px-6 py-4 text-indigo-600 font-bold">
                      {log.referenceNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{log.userName}</td>
                    <td className="px-6 py-4 text-gray-400 italic max-w-[150px] truncate" title={log.note}>
                      {log.note || '-'}
                    </td>
                  </tr>
                ))}
                {globalStockLogs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                      <History className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                      <p>Tidak ada riwayat stok ditemukan untuk periode ini.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Bulk Scan Barcode</h3>
                  <p className="text-indigo-100 text-sm">Input banyak produk sekaligus dengan scanner.</p>
                </div>
                <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-6">
                <form id="bulkForm" onSubmit={handleBulkSubmit} className="space-y-4">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        <th className="pb-4 px-2">Barcode</th>
                        <th className="pb-4 px-2">Nama Produk</th>
                        <th className="pb-4 px-2 w-32">SKU (Auto)</th>
                        <th className="pb-4 px-2 w-32">Harga Beli</th>
                        <th className="pb-4 px-2 w-32">Harga Jual</th>
                        <th className="pb-4 px-2 w-24">QTY</th>
                        <th className="pb-4 px-2 w-40">Kategori</th>
                        <th className="pb-4 px-2 w-40">Gudang</th>
                        <th className="pb-4 px-2 w-48">Foto Produk</th>
                        <th className="pb-4 px-2">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bulkProducts.map((row, index) => (
                        <tr key={index} className="group">
                          <td className="py-3 px-2">
                            <div className="relative group/scan">
                                <input
                                  autoFocus={index === bulkProducts.length - 1}
                                  type="text"
                                  value={row.barcode || ''}
                                  onChange={(e) => updateBulkRow(index, 'barcode', e.target.value)}
                                  placeholder="Scan..."
                                  className="w-full pl-3 pr-16 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                                />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateBulkRow(index, 'barcode', generateBarcode())}
                                  className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                  title="Generate Barcode"
                                >
                                  <Wand2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScanningIndex(index);
                                    setIsScannerOpen(true);
                                  }}
                                  className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                  title="Scan with camera"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              required
                              value={row.name || ''}
                              onChange={(e) => updateBulkRow(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              readOnly
                              value={row.sku || ''}
                              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono text-gray-500"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              required
                              value={row.hpp || 0}
                              onChange={(e) => updateBulkRow(index, 'hpp', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              required
                              value={row.price || 0}
                              onChange={(e) => updateBulkRow(index, 'price', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-indigo-600"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              required
                              value={row.stock || 0}
                              onChange={(e) => updateBulkRow(index, 'stock', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <select
                              required
                              value={row.category}
                              onChange={(e) => updateBulkRow(index, 'category', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            >
                              <option value="">Pilih</option>
                              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <select
                              required
                              value={row.warehouseId}
                              onChange={(e) => updateBulkRow(index, 'warehouseId', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            >
                              <option value="">Pilih</option>
                              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex justify-center">
                              <ImageUpload
                                value={row.imageUrl}
                                onChange={(url) => updateBulkRow(index, 'imageUrl', url)}
                                label=""
                                compact={true}
                                className="!space-y-0"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <button
                              type="button"
                              onClick={() => removeBulkRow(index)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </form>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <button
                  type="button"
                  onClick={addBulkRow}
                  className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-all flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Tambah Baris
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-8 py-3 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    form="bulkForm"
                    type="submit"
                    className="px-12 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                  >
                    Simpan Semua Produk
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'manual', sku: editingProduct?.type === 'manual' ? formData.sku : generateSKU() })}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formData.type === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Manual Produk
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'service', sku: editingProduct?.type === 'service' ? formData.sku : generateServiceSKU(), hpp: 0, stock: 0, warehouseId: '' })}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formData.type === 'service' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Jasa (Service)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU (ID Unik)</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        readOnly
                        value={formData.sku || ''}
                        className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg outline-none bg-gray-50 text-gray-500 cursor-not-allowed font-mono text-xs"
                      />
                      {!editingProduct && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, sku: formData.type === 'service' ? generateServiceSKU() : generateSKU() })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Regenerate SKU"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                    <div className="relative">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.barcode || ''}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="w-full pl-10 pr-20 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Manual / Scan / Generate"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, barcode: generateBarcode() })}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                          title="Generate Barcode"
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScanningIndex(null);
                            setIsScannerOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                          title="Scan with camera"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={formData.type === 'service' ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                    <select
                      required
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  {formData.type === 'manual' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gudang</label>
                        <select
                          value={formData.warehouseId || ''}
                          onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Pilih Gudang</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center text-red-600">
                          HPP (Rp.) <DollarSign className="w-3 h-3 ml-1" />
                        </label>
                        <input
                          type="number"
                          required
                          value={formData.hpp || 0}
                          onChange={(e) => setFormData({ ...formData, hpp: Number(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </>
                  )}
                  <div className={formData.type === 'service' ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center text-green-600">
                      Harga Jual (Rp.) <DollarSign className="w-3 h-3 ml-1" />
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.price || 0}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {formData.type === 'manual' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock Awal</label>
                      <input
                        type="number"
                        required
                        value={formData.stock || 0}
                        onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <ImageUpload
                      value={formData.imageUrl}
                      onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                      label="Foto Produk"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                  >
                    {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
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

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />

      {isPrintModalOpen && printData.length > 0 && (
        <PrintBarcodeModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setPrintData([]);
          }}
          products={printData}
        />
      )}

      {isHistoryModalOpen && selectedProductForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Riwayat Stok</h3>
                  <p className="text-indigo-100 text-sm">{selectedProductForHistory.name} ({selectedProductForHistory.sku})</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedProductForHistory(null);
                }} 
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6 flex justify-between items-center">
                <div className="flex space-x-8">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Stok Saat Ini</p>
                    <p className="text-2xl font-black text-indigo-600">{selectedProductForHistory.stock}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Mutasi</p>
                    <p className="text-2xl font-black text-gray-900">{stockLogs.length}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kategori</p>
                  <p className="text-sm font-bold text-gray-700">{selectedProductForHistory.category}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-bold">Waktu</th>
                      <th className="px-4 py-3 font-bold">Tipe</th>
                      <th className="px-4 py-3 font-bold text-right">Qty</th>
                      <th className="px-4 py-3 font-bold text-right">Sblm</th>
                      <th className="px-4 py-3 font-bold text-right">Ssdh</th>
                      <th className="px-4 py-3 font-bold">Referensi</th>
                      <th className="px-4 py-3 font-bold">User</th>
                      <th className="px-4 py-3 font-bold">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stockLogs.map((log) => (
                      <tr key={log.id} className="text-xs hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            log.type === 'IN' || log.type === 'PURCHASE' ? 'bg-green-100 text-green-700' :
                            log.type === 'OUT' || log.type === 'SALE' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${
                          log.type === 'IN' || log.type === 'PURCHASE' ? 'text-green-600' :
                          log.type === 'OUT' || log.type === 'SALE' ? 'text-red-600' :
                          'text-blue-600'
                        }`}>
                          {log.type === 'IN' || log.type === 'PURCHASE' ? '+' : '-'}{log.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">{log.previousStock}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{log.currentStock}</td>
                        <td className="px-4 py-3 text-indigo-600 font-bold">
                          {log.referenceNumber || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{log.userName}</td>
                        <td className="px-4 py-3 text-gray-400 italic max-w-[150px] truncate" title={log.note}>
                          {log.note || '-'}
                        </td>
                      </tr>
                    ))}
                    {stockLogs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                          Belum ada riwayat mutasi stok untuk produk ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
