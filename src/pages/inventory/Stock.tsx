import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Product } from '../../types';
import { Search, Filter, Package, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Stock() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'out'>('all');

  useEffect(() => {
    if (!profile) return;

    const q = profile.role === 'superadmin'
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('tenantId', '==', profile.tenantId));
      
    const unsubscribe = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching products:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredProducts = products.filter(p => {
    // Exclude service products (Jasa) from stock monitoring as they don't have physical stock
    if (p.type === 'service') return false;
    
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStock = stockFilter === 'all' ? true : stockFilter === 'available' ? p.stock > 0 : p.stock <= 0;
    return matchesSearch && matchesStock;
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Stock Data...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Stock Produk</h2>
        <p className="text-gray-500">Pantau ketersediaan stok produk Anda di semua gudang.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
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
        <div className="flex gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <motion.div
            key={product.id}
            layout
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            <div className="aspect-video bg-gray-50 relative overflow-hidden">
              <img
                src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/225`}
                alt={product.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm ${
                  product.stock > 10 ? 'bg-green-500 text-white' : 
                  product.stock > 0 ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {product.stock} UNIT
                </span>
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">{product.category}</p>
                <h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">SKU: {product.sku}</p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Harga Jual</p>
                  <p className="text-sm font-bold text-indigo-600">Rp.{(product.price || 0).toLocaleString()}</p>
                </div>
                {product.stock <= 5 && product.stock > 0 && (
                  <div className="flex items-center text-yellow-600 text-[10px] font-bold animate-pulse">
                    <AlertCircle className="w-3 h-3 mr-1" /> STOK MENIPIS
                  </div>
                )}
                {product.stock <= 0 && (
                  <div className="flex items-center text-red-600 text-[10px] font-bold">
                    <AlertCircle className="w-3 h-3 mr-1" /> STOK HABIS
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Package className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">Tidak ada produk yang sesuai dengan filter Anda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
