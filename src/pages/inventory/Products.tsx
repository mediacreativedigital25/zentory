import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Product, Category, Warehouse, StockLog } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { Plus, Search, Edit2, Trash2, Package, X, Barcode, DollarSign, Image as ImageIcon, RefreshCw, Upload, Camera, Printer, Wand2, History, ChevronLeft, ChevronRight, AlertCircle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';
import ImageUpload from '../../components/ImageUpload';
import BarcodeScanner from '../../components/BarcodeScanner';
import PrintBarcodeModal from '../../components/PrintBarcodeModal';
import { logStockChange } from '../../lib/stock-logger';

export default function Products() {
  const { profile, domainTenantId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
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
    minStock: 0,
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
  const [activeTab, setActiveTab] = useState<'products' | 'history'>(
    (searchParams.get('tab') as 'products' | 'history') || 'products'
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'products' || tab === 'history') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'products' | 'history') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [globalStockLogs, setGlobalStockLogs] = useState<StockLog[]>([]);
  const [historySearch, setHistorySearch] = useState(searchParams.get('search') || '');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    hpp: 0,
    price: 0,
    stock: 0,
    minStock: 0,
    category: '',
    warehouseId: '',
    description: '',
    imageUrl: '',
    type: 'manual' as 'manual' | 'service',
    variants: [] as any[],
    wholesalePrices: [] as { minQuantity: number; price: number }[],
  });
  const [formDisplayType, setFormDisplayType] = useState<'tunggal' | 'variasi' | 'grosir' | 'service'>('tunggal');
  const [showPriceSettings, setShowPriceSettings] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const targetTenantId = domainTenantId || profile.tenantId;

    const productsQuery = (profile.role === 'superadmin' && !domainTenantId) 
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('tenantId', '==', targetTenantId));
      
    const categoriesQuery = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'categories')
      : query(collection(db, 'categories'), where('tenantId', '==', targetTenantId));
      
    const warehousesQuery = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'warehouses')
      : query(collection(db, 'warehouses'), where('tenantId', '==', targetTenantId));

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products', auth, profile));

    const unsubCategories = onSnapshot(categoriesQuery, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories', auth, profile));

    const unsubWarehouses = onSnapshot(warehousesQuery, (snap) => {
      setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'warehouses', auth, profile));

    let unsubLogs = () => {};
    if (selectedProductForHistory && targetTenantId) {
      const logsQuery = query(
        collection(db, 'stock_logs'),
        where('tenantId', '==', targetTenantId),
        where('productId', '==', selectedProductForHistory.id),
        orderBy('createdAt', 'desc')
      );
      unsubLogs = onSnapshot(logsQuery, (snap) => {
        setStockLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockLog)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'stock_logs', auth, profile));
    }

    let unsubGlobalLogs = () => {};
    if (activeTab === 'history' && targetTenantId) {
      const startTimestamp = new Date(dateRange.start);
      startTimestamp.setHours(0, 0, 0, 0);
      const endTimestamp = new Date(dateRange.end);
      endTimestamp.setHours(23, 59, 59, 999);

      const globalLogsQuery = query(
        collection(db, 'stock_logs'),
        where('tenantId', '==', targetTenantId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      unsubGlobalLogs = onSnapshot(globalLogsQuery, (snap) => {
        setGlobalStockLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockLog)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'global_stock_logs', auth, profile));
    }

    return () => {
      unsubProducts();
      unsubCategories();
      unsubWarehouses();
      unsubLogs();
      unsubGlobalLogs();
    };
  }, [profile, domainTenantId, selectedProductForHistory, activeTab, dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, dateRange, historyRowsPerPage]);

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
      minStock: 0,
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
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!targetTenantId) return;

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
              tenantId: targetTenantId,
              createdAt: serverTimestamp(),
            });

            if (product.stock > 0) {
              await logStockChange(
                targetTenantId,
                docRef.id,
                product.name,
                'IN',
                product.stock,
                0,
                product.stock,
                profile!.uid,
                profile!.displayName || 'System',
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
            minStock: 0,
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
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!targetTenantId) return;

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
          // Consolidate data if variants exist
          let finalData = { ...formData };
          if (formData.variants && formData.variants.length > 0) {
            finalData.stock = formData.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
            finalData.price = Math.min(...formData.variants.map(v => v.price || 0)); // Starting price
            finalData.hpp = Math.min(...formData.variants.map(v => v.hpp || 0));
            finalData.minStock = Math.min(...formData.variants.map(v => v.minStock || 0));
          }

          if (editingProduct) {
            const stockDiff = finalData.stock - editingProduct.stock;
            await updateDoc(doc(db, 'products', editingProduct.id), finalData);
            
            if (stockDiff !== 0) {
              await logStockChange(
                targetTenantId,
                editingProduct.id,
                finalData.name,
                'ADJUSTMENT',
                Math.abs(stockDiff),
                editingProduct.stock,
                finalData.stock,
                profile!.uid,
                profile!.displayName || 'System',
                undefined,
                'Manual adjustment (including variants update)'
              );
            }
          } else {
            const docRef = await addDoc(collection(db, 'products'), {
              ...finalData,
              tenantId: targetTenantId,
              createdAt: serverTimestamp(),
            });

            if (finalData.stock > 0) {
              await logStockChange(
                targetTenantId,
                docRef.id,
                finalData.name,
                'IN',
                finalData.stock,
                0,
                finalData.stock,
                profile!.uid,
                profile!.displayName || 'System',
                undefined,
                'Initial stock (from variants)'
              );
            }
          }
          setIsModalOpen(false);
          setEditingProduct(null);
          setFormDisplayType('tunggal');
          setFormData({ 
            name: '', 
            sku: '', 
            barcode: '', 
            hpp: 0, 
            price: 0, 
            stock: 0, 
            minStock: 0,
            category: '', 
            warehouseId: '', 
            description: '', 
            imageUrl: '', 
            type: 'manual', 
            variants: [],
            wholesalePrices: [] 
          });
          setShowPriceSettings(false);
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
    const displayType = product.type === 'service' ? 'service'
      : (product.variants && product.variants.length > 0) ? 'variasi'
      : (product.wholesalePrices && product.wholesalePrices.length > 0) ? 'grosir'
      : 'tunggal';
    
    setFormDisplayType(displayType);
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      hpp: product.hpp,
      price: product.price,
      stock: product.stock,
      minStock: product.minStock || 0,
      category: product.category,
      warehouseId: product.warehouseId || '',
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      type: product.type || 'manual',
      variants: product.variants || [],
      wholesalePrices: product.wholesalePrices || [],
    });
    setShowPriceSettings(displayType === 'variasi' ? true : false);
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

  const totalPages = Math.ceil(products.length / rowsPerPage);
  const paginatedProducts = products.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const filteredHistory = globalStockLogs.filter(log => 
    log.productName?.toLowerCase().includes(historySearch.toLowerCase()) ||
    log.productId?.toLowerCase().includes(historySearch.toLowerCase())
  );

  const totalHistoryPages = Math.ceil(filteredHistory.length / historyRowsPerPage);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * historyRowsPerPage,
    historyPage * historyRowsPerPage
  );

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
            className="bg-indigo-50 text-indigo-600 p-2 rounded-lg flex items-center hover:bg-indigo-100 transition-colors border border-indigo-100"
          >
            <Barcode className="w-5 h-5 mr-2" />
            Bulk Scan Barcode
          </button>
          <button
            onClick={() => { 
              setEditingProduct(null); 
              setFormDisplayType('tunggal');
              setFormData({ 
                name: '', 
                sku: generateSKU(), 
                barcode: '', 
                hpp: 0, 
                price: 0, 
                stock: 0, 
                minStock: 0,
                category: '', 
                warehouseId: '', 
                description: '', 
                imageUrl: '', 
                type: 'manual',
                variants: [],
                wholesalePrices: []
              }); 
              setShowPriceSettings(false);
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200">
              <span>Show:</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="bg-transparent font-bold text-gray-900 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 p-2 rounded-lg"
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
              {paginatedProducts.map((product) => (
                <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${selectedProducts.includes(product.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 p-2 rounded-lg"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 mr-3 overflow-hidden border border-gray-100">
                        <img
                          src={product.imageUrl || `https://picsum.photos/seed/${product.id}/100/100`}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 leading-none mb-1">{product.name}</span>
                        {product.variants && product.variants.length > 0 && (
                            <span className="flex items-center text-[9px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-full w-fit">
                                <Layers className="w-2.5 h-2.5 mr-1" /> {product.variants.length} Variasi
                            </span>
                        )}
                      </div>
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
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium italic">
                    Rp.${(product.hpp || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-indigo-600">Rp.{(product.price || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {product.type === 'service' ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">
                        NON-STOCK
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded-full text-center text-[10px] font-bold ${
                          product.stock > (product.minStock || 10) ? 'bg-green-50 text-green-700' : 
                          product.stock > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {product.stock} TERSEDIA
                        </span>
                        {product.stock <= (product.minStock || 0) && product.stock > 0 && (
                          <span className="text-[9px] font-bold text-red-500 animate-pulse bg-red-50 px-1 rounded flex items-center justify-center">
                            <AlertCircle className="w-2 h-2 mr-1" /> STOK KRITIS
                          </span>
                        )}
                        {product.stock <= 0 && (
                          <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 rounded flex items-center justify-center">
                            <X className="w-2 h-2 mr-1" /> HABIS
                          </span>
                        )}
                      </div>
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

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900">{Math.min(products.length, (currentPage - 1) * rowsPerPage + 1)}</span> to <span className="font-bold text-gray-900">{Math.min(products.length, currentPage * rowsPerPage)}</span> of <span className="font-bold text-gray-900">{products.length}</span> products
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

        {products.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada produk. Mulai dengan menambah satu!</p>
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-2 text-xs font-semibold text-gray-600">Cari Produk / SKU</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama produk atau SKU..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block mb-2 text-xs font-semibold text-gray-600">Dari Tanggal</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full p-2 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="w-48">
            <label className="block mb-2 text-xs font-semibold text-gray-600">Sampai Tanggal</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full p-2 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200">
              <span>Show:</span>
              <select 
                value={historyRowsPerPage} 
                onChange={(e) => setHistoryRowsPerPage(Number(e.target.value))}
                className="bg-transparent font-bold text-gray-900 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
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
                {paginatedHistory.map((log) => (
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

        {/* History Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900">{Math.min(filteredHistory.length, (historyPage - 1) * historyRowsPerPage + 1)}</span> to <span className="font-bold text-gray-900">{Math.min(filteredHistory.length, historyPage * historyRowsPerPage)}</span> of <span className="font-bold text-gray-900">{filteredHistory.length}</span> logs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
              disabled={historyPage === 1}
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalHistoryPages)].map((_, i) => {
                const page = i + 1;
                if (page === 1 || page === totalHistoryPages || (page >= historyPage - 1 && page <= historyPage + 1)) {
                  return (
                    <button
                      key={page}
                      onClick={() => setHistoryPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        historyPage === page 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                          : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if ((page === historyPage - 2 && page > 1) || (page === historyPage + 2 && page < totalHistoryPages)) {
                  return <span key={page} className="text-gray-400">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
              disabled={historyPage === totalHistoryPages || totalHistoryPages === 0}
              className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
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
                        <th className="pb-4 px-2 w-32 text-indigo-100">SKU (Auto)</th>
                        <th className="pb-4 px-2 w-24">Min QTY</th>
                        <th className="pb-4 px-2 w-32">HPP</th>
                        <th className="pb-4 px-2 w-32">Harga Jual</th>
                        <th className="pb-4 px-2 w-24">Stock Awal</th>
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
                                  className="w-full pl-3 pr-16 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
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
                              className="w-full text-gray-500 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium"
                            />
                          </td>
                          <td className="py-3 px-2">
                             <input
                               type="number"
                               required
                               value={row.minStock || 0}
                               onChange={(e) => updateBulkRow(index, 'minStock', Number(e.target.value))}
                               className="w-full px-3 py-2 border border-yellow-200 bg-yellow-50/30 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm"
                             />
                           </td>
                           <td className="py-3 px-2">
                             <input
                               type="number"
                               required
                               value={row.hpp || 0}
                               onChange={(e) => updateBulkRow(index, 'hpp', Number(e.target.value))}
                               className="w-full px-3 py-2 border border-red-200 bg-red-50/30 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                             />
                           </td>
                           <td className="py-3 px-2">
                             <input
                               type="number"
                               required
                               value={row.price || 0}
                               onChange={(e) => updateBulkRow(index, 'price', Number(e.target.value))}
                               className="w-full px-3 py-2 border border-green-200 bg-green-50/30 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm font-medium text-green-700"
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
                  className="px-6 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-all flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Tambah Baris
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-8 py-3 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-all"
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
              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="space-y-4">
                  <label className="block text-xs font-semibold text-gray-600">Tipe Produk</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'tunggal', label: 'Produk Tunggal', description: 'Satu item, satu harga' },
                      { id: 'variasi', label: 'Produk Variasi', description: 'Beberapa warna/ukuran' },
                      { id: 'grosir', label: 'Produk Grosir', description: 'Harga bertingkat' },
                      { id: 'service', label: 'Jasa (Service)', description: 'Layanan tanpa stok' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setFormDisplayType(t.id as any);
                          const isService = t.id === 'service';
                          setFormData({ 
                            ...formData, 
                            type: isService ? 'service' : 'manual',
                            sku: (editingProduct && (editingProduct.type === (isService ? 'service' : 'manual'))) ? formData.sku : (isService ? generateServiceSKU() : generateSKU()),
                            hpp: formData.hpp,
                            stock: isService ? 0 : formData.stock,
                            warehouseId: isService ? '' : formData.warehouseId,
                            variants: t.id === 'variasi' ? (formData.variants.length > 0 ? formData.variants : [{ id: Math.random().toString(36).substr(2, 9), name: 'Default', sku: `${formData.sku}-1`, stock: 0, hpp: 0, price: 0, minStock: 0 }]) : [],
                            wholesalePrices: t.id === 'grosir' ? (formData.wholesalePrices.length > 0 ? formData.wholesalePrices : [{ minQuantity: 10, price: 0 }]) : []
                          });
                          setShowPriceSettings(t.id === 'variasi');
                        }}
                        className={`p-3 text-left rounded-xl border-2 transition-all group ${
                          formDisplayType === t.id 
                            ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50' 
                            : 'border-gray-100 bg-white hover:border-indigo-200'
                        }`}
                      >
                        <p className={`text-xs font-black mb-1 ${formDisplayType === t.id ? 'text-indigo-600' : 'text-gray-900'}`}>{t.label}</p>
                        <p className="text-[9px] text-gray-500 leading-tight">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Produk</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">SKU (ID Unik)</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        readOnly
                        value={formData.sku || ''}
                        className="w-full outline-none bg-white text-gray-500 cursor-not-allowed p-2 border border-gray-200 rounded-lg text-sm font-medium pl-4"
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
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Barcode</label>
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
                  <div className={formDisplayType === 'service' ? 'col-span-2' : ''}>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Kategori</label>
                    <select
                      required
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  {formDisplayType !== 'service' && (
                    <>
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-600">Gudang</label>
                        <select
                          value={formData.warehouseId || ''}
                          onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                          className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Pilih Gudang</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      
                      {formDisplayType === 'variasi' && (
                        <div className="col-span-2 pt-2 border-t border-gray-100">
                          <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 space-y-4">
                              <div className="flex justify-between items-center">
                                  <h4 className="text-sm font-bold text-indigo-900 flex items-center">
                                      <Layers className="w-4 h-4 mr-2" /> Pengaturan Variasi
                                  </h4>
                                  <button 
                                      type="button" 
                                      onClick={() => {
                                          const newVariants = [...formData.variants, { 
                                              id: Math.random().toString(36).substr(2, 9), 
                                              name: `Variasi ${formData.variants.length + 1}`,
                                              sku: `${formData.sku}-${formData.variants.length + 1}`,
                                              stock: 0, 
                                              hpp: 0, 
                                              price: 0, 
                                              minStock: 0,
                                              type: 'stock'
                                          }];
                                          setFormData({ ...formData, variants: newVariants });
                                      }}
                                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center px-3 py-1.5 rounded-lg shadow-sm"
                                  >
                                      <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Variasi
                                  </button>
                              </div>

                              <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-separate border-spacing-y-2">
                                      <thead>
                                          <tr className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                                              <th className="px-2 pb-1">Foto</th>
                                              <th className="px-2 pb-1">Jenis</th>
                                              <th className="px-2 pb-1 w-24">Tipe</th>
                                              <th className="px-2 pb-1 w-20">Stock Awal</th>
                                              <th className="px-2 pb-1 w-28">HPP</th>
                                              <th className="px-2 pb-1 w-28">Harga Jual</th>
                                              <th className="px-2 pb-1 w-16">Min QTY</th>
                                              <th className="px-2 pb-1 w-10"></th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {formData.variants.map((v, idx) => (
                                              <tr key={v.id} className="bg-white rounded-lg shadow-sm border border-gray-100">
                                                  <td className="p-2 first:rounded-l-xl">
                                                      <ImageUpload
                                                          value={v.imageUrl || ''}
                                                          onChange={(url) => {
                                                              const newVars = [...formData.variants];
                                                              newVars[idx].imageUrl = url;
                                                              setFormData({ ...formData, variants: newVars });
                                                          }}
                                                          compact
                                                      />
                                                  </td>
                                                  <td className="p-2">
                                                      <input 
                                                          type="text"
                                                          value={v.name}
                                                          onChange={(e) => {
                                                              const newVars = [...formData.variants];
                                                              newVars[idx].name = e.target.value;
                                                              setFormData({ ...formData, variants: newVars });
                                                          }}
                                                          placeholder="Warna / Ukuran..."
                                                          className="w-full bg-transparent border border-gray-200 outline-none font-medium text-gray-900"
                                                      />
                                                  </td>
                                                  <td className="p-2">
                                                      <select 
                                                          value={v.type || 'stock'}
                                                          onChange={(e) => {
                                                              const newVars = [...formData.variants];
                                                              newVars[idx].type = e.target.value as 'stock' | 'non-stock';
                                                              if (e.target.value === 'non-stock') {
                                                                  newVars[idx].stock = 0;
                                                                  newVars[idx].minStock = 0;
                                                              }
                                                              setFormData({ ...formData, variants: newVars });
                                                          }}
                                                          className="w-full bg-transparent border border-gray-200 outline-none font-medium text-gray-900 text-xs"
                                                      >
                                                          <option value="stock">Stock</option>
                                                          <option value="non-stock">Non-Stock/Jasa</option>
                                                      </select>
                                                  </td>
                                                  <td className="p-2">
                                                      <input 
                                                          type="number"
                                                          value={v.stock}
                                                          readOnly={!!editingProduct || v.type === 'non-stock'}
                                                          onChange={(e) => {
                                                              const newVars = [...formData.variants];
                                                              newVars[idx].stock = Number(e.target.value);
                                                              setFormData({ ...formData, variants: newVars });
                                                          }}
                                                          className={`w-full bg-transparent border-none outline-none text-center ${(editingProduct || v.type === 'non-stock') ? 'text-gray-400 cursor-not-allowed font-medium' : ''}`}
                                                      />
                                                  </td>
                                                  <td className="p-2">
                                                      <input 
                                                          type="number"
                                                          value={v.hpp}
                                                          onChange={(e) => {
                                                              const newVars = [...formData.variants];
                                                              newVars[idx].hpp = Number(e.target.value);
                                                              setFormData({ ...formData, variants: newVars });
                                                          }}
                                                          className="w-full bg-transparent border border-gray-200 outline-none text-red-600 font-medium"
                                                      />
                                                  </td>
                                                  <td className="p-2">
                                                      <input 
                                                          type="number"
                                                          value={v.price}
                                                          onChange={(e) => {
                                                              const newVars = [...formData.variants];
                                                              newVars[idx].price = Number(e.target.value);
                                                              setFormData({ ...formData, variants: newVars });
                                                          }}
                                                          className="w-full bg-transparent border border-gray-200 outline-none font-medium text-green-700"
                                                      />
                                                  </td>
                                                  <td className="p-2">
                                                      <input 
                                                          type="number"
                                                          value={v.minStock}
                                                          readOnly={v.type === 'non-stock'}
                                                          onChange={(e) => {
                                                              const newVars = [...formData.variants];
                                                              newVars[idx].minStock = Number(e.target.value);
                                                              setFormData({ ...formData, variants: newVars });
                                                          }}
                                                          className={`w-full bg-transparent border-none outline-none text-center text-[10px] ${v.type === 'non-stock' ? 'text-gray-400 cursor-not-allowed' : ''}`}
                                                      />
                                                  </td>
                                                  <td className="p-2 last:rounded-r-xl">
                                                      <button 
                                                          type="button"
                                                          onClick={() => {
                                                              setFormData({ ...formData, variants: formData.variants.filter((_, i) => i !== idx) });
                                                          }}
                                                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                                      >
                                                          <Trash2 className="w-3.5 h-3.5" />
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                              <p className="text-[10px] text-indigo-400 italic font-medium">
                                  * Data harga & stok utama akan otomatis diakumulasi dari daftar variasi.
                              </p>
                          </div>
                        </div>
                      )}

                      {(formDisplayType === 'tunggal' || formDisplayType === 'grosir') && (
                        <>
                          <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-yellow-700 mb-1 flex items-center text-xs font-semibold text-gray-600">
                                Min. Stock <AlertCircle className="w-3 h-3 ml-1" />
                              </label>
                              <input
                                type="number"
                                required
                                value={formData.minStock || 0}
                                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                                className="w-full p-2 border border-yellow-100 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 bg-yellow-50/30"
                              />
                            </div>
                            <div>
                              <label className="block text-red-600 mb-1 flex items-center text-xs font-semibold text-gray-600">
                                HPP (Rp.) <DollarSign className="w-3 h-3 ml-1" />
                              </label>
                              <input
                                type="number"
                                required
                                value={formData.hpp || 0}
                                onChange={(e) => setFormData({ ...formData, hpp: Number(e.target.value) })}
                                className="w-full p-2 border border-red-100 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-red-50/30 font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-green-600 mb-1 flex items-center text-xs font-semibold text-gray-600">
                                Harga Jual <DollarSign className="w-3 h-3 ml-1" />
                              </label>
                              <input
                                type="number"
                                required
                                value={formData.price || 0}
                                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                className="w-full p-2 border border-green-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-green-50/30 font-medium text-green-700"
                              />
                            </div>
                            <div>
                              <label className="block mb-1 text-xs font-semibold text-gray-600">Stock Awal</label>
                              <input
                                type="number"
                                required
                                value={formData.stock || 0}
                                readOnly={!!editingProduct}
                                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                                className={`w-full px-4 py-2 border border-gray-200 rounded-lg outline-none font-bold ${editingProduct ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'focus:ring-2 focus:ring-indigo-500'}`}
                              />
                              {editingProduct && (
                                <p className="text-[9px] text-gray-400 mt-1 italic leading-tight">
                                  * Perubahan stok setelah produk dibuat harus melalui alur Pembelian (PO).
                                </p>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {formDisplayType === 'grosir' && (
                        <div className="col-span-2">
                          <div className="pt-2 border-t border-gray-100 mt-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-semibold text-gray-600">Harga Grosir (Bertingkat)</label>
                                <button 
                                    type="button" 
                                    onClick={() => setFormData({ 
                                        ...formData, 
                                        wholesalePrices: [...formData.wholesalePrices, { minQuantity: 10, price: 0 }] 
                                    })}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> Tambah Tingkatan
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {formData.wholesalePrices.map((tier, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100">
                                        <div className="w-20">
                                            <label className="block mb-1 text-xs font-semibold text-gray-600">Min. Qty</label>
                                            <input 
                                                type="number"
                                                value={tier.minQuantity}
                                                onChange={(e) => {
                                                    const newPrices = [...formData.wholesalePrices];
                                                    newPrices[idx].minQuantity = Number(e.target.value);
                                                    setFormData({ ...formData, wholesalePrices: newPrices });
                                                }}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block mb-1 text-xs font-semibold text-gray-600">Harga Grosir</label>
                                            <input 
                                                type="number"
                                                value={tier.price}
                                                onChange={(e) => {
                                                    const newPrices = [...formData.wholesalePrices];
                                                    newPrices[idx].price = Number(e.target.value);
                                                    setFormData({ ...formData, wholesalePrices: newPrices });
                                                }}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-bold text-indigo-600"
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setFormData({ 
                                                    ...formData, 
                                                    wholesalePrices: formData.wholesalePrices.filter((_, i) => i !== idx) 
                                                });
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-600 mt-4"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {formDisplayType === 'service' && (
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-red-600 mb-1 flex items-center text-xs font-semibold text-gray-600">
                          Harga Modal (HPP) <DollarSign className="w-3 h-3 ml-1" />
                        </label>
                        <input
                          type="number"
                          required
                          value={formData.hpp || 0}
                          onChange={(e) => setFormData({ ...formData, hpp: Number(e.target.value) })}
                          className="w-full p-2 border border-red-100 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-red-50/30 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-green-600 mb-1 flex items-center text-xs font-semibold text-gray-600">
                          Harga Jual <DollarSign className="w-3 h-3 ml-1" />
                        </label>
                        <input
                          type="number"
                          required
                          value={formData.price || 0}
                          onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                          className="w-full p-2 border border-green-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-green-50/30 font-medium text-green-700"
                        />
                      </div>
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
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Deskripsi</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-white"
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
